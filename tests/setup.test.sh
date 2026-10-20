#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'cd /; rm -rf "$tmp"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

fail() { echo "FAIL: $1"; exit 1; }

plug="$tmp/plug in"
mkdir -p "$tmp/bin" "$plug/scripts" "$plug/docs/adr"
cp "$here/scripts/setup.sh" "$here/scripts/celetis" "$plug/scripts/"
cp "$here/docs/adr/README.md" "$here/docs/adr/template.md" "$plug/docs/adr/"
cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "$*" >>"$GH_LOG"
if [ "$1" != api ]; then
  echo "HTTP 403: GitHub GraphQL is not available from Claude Code sessions" >&2
  exit 1
fi
shift
paginate=0 filter=. endpoint= fields=()
while [ $# -gt 0 ]; do
  case "$1" in
    --paginate) paginate=1 ;;
    --silent) ;;
    --jq) filter=$2; shift ;;
    -f) fields+=("$2"); shift ;;
    -*) echo "unknown flag $1" >&2; exit 1 ;;
    *) endpoint=$1 ;;
  esac
  shift
done
case "$endpoint" in
  'repos/{owner}/{repo}')
    [ -z "${REPO_FAIL:-}" ] || { echo "HTTP 404: Not Found" >&2; exit 1; }
    jq -n --arg repo "$REPO" --arg trunk "$TRUNK" '{full_name: $repo, default_branch: $trunk}' | jq -r "$filter" ;;
  'repos/{owner}/{repo}/labels?per_page=100')
    [ "$paginate" -eq 1 ] || { echo "list without --paginate" >&2; exit 1; }
    [ -z "${LIST_FAIL:-}" ] || { echo "HTTP 403: Resource not accessible" >&2; exit 1; }
    page=$(jq -nc --arg names "$LABELS" '[$names | split(" ")[] | select(. != "") | {name: .}]')
    if [ "${PAGES:-1}" -eq 2 ]; then jq -c '[.[:1], .[1:]] | .[]' <<<"$page"; else echo "$page"; fi | jq -r "$filter" ;;
  'repos/{owner}/{repo}/labels')
    [ -z "${LABEL_FAIL:-}" ] || { echo "HTTP 403: Resource not accessible" >&2; exit 1; }
    name= description= color=
    for field in "${fields[@]}"; do
      case "$field" in
        name=*) name=${field#name=} ;;
        description=*) description=${field#description=} ;;
        color=*) color=${field#color=} ;;
      esac
    done
    printf '%s|%s|%s\n' "$name" "$description" "$color" >>"$LABEL_LOG" ;;
  *) echo "HTTP 404: Not Found ($endpoint)" >&2; exit 1 ;;
esac
EOF
chmod +x "$tmp/bin/gh"
all_labels='needs-triage bug enhancement hotfix chore epic needs-info ready-for-agent ready-for-human wontfix'
export PATH="$tmp/bin:$PATH" GH_LOG="$tmp/gh.log" LABEL_LOG="$tmp/label.log" REPO=acme/widgets TRUNK=main LABELS=$all_labels
touch "$GH_LOG" "$LABEL_LOG"

new_project() {
  proj="$tmp/$1"
  git init -q -b main "$proj"
  echo app >"$proj/app.txt"
  git -C "$proj" add app.txt
  git -C "$proj" commit -qm base
  git clone -q --bare "$proj" "$tmp/$1.git"
  git -C "$proj" remote add origin "$tmp/$1.git"
  git -C "$proj" fetch -q origin
}
run() { (cd "${CWD:-$proj}" && bash "$plug/scripts/setup.sh" "$@"); }
code_of() { set +e; run "$@" >/dev/null 2>&1; local c=$?; set -e; echo "$c"; }
out_of() { run "$@" 2>/dev/null || true; }
err_of() { run "$@" 2>&1 >/dev/null || true; }
only_api() { ! grep -qv '^api ' "$GH_LOG" || fail "gh called without api: $(grep -v '^api ' "$GH_LOG")"; }
stops() {
  local want=$1
  shift
  [ "$(code_of "$@")" -eq 1 ] || fail "'$*' did not exit 1 for: $want"
  [[ $(err_of "$@") == "$want" ]] || fail "wrong stop for: $want; got: $(err_of "$@")"
}
stops_after() {
  local cause=$1 want=$2 err
  shift 2
  [ "$(code_of "$@")" -eq 1 ] || fail "'$*' did not exit 1 for: $want"
  err=$(err_of "$@")
  [ "$(tail -n1 <<<"$err")" = "$want" ] && grep -qF -- "$cause" <<<"$err" || fail "wrong stop for: $want after: $cause; got: $err"
}

new_project clean
[ "$(code_of check)" -eq 0 ] || fail "check refused a clean trunk"
[ -z "$(out_of check)$(err_of check)" ] || fail "check printed on a clean trunk"
grep -qxF 'api repos/{owner}/{repo} --jq .full_name, .default_branch' "$GH_LOG" || fail "check did not read the repository: $(cat "$GH_LOG")"
mkdir "$proj/sub"
[ "$(CWD=$proj/sub code_of check)" -eq 0 ] || fail "check refused a subfolder"
touch "$proj/unrelated"
[ "$(code_of check)" -eq 0 ] || fail "check refused an untracked file that setup does not touch"
REPO_FAIL=1 stops_after "HTTP 404: Not Found" "setup: origin is not a GitHub repository that gh can read" check

new_project trees
git -C "$proj" worktree add -q "$tmp/linked" -b side
linked=$(git -C "$tmp/linked" rev-parse --show-toplevel)
CWD=$tmp/linked stops "setup: run setup in the main checkout, not in a linked worktree: $linked" check

mkdir "$tmp/plain"
ceiling=$(cd "$tmp" && pwd -P)
[ "$(GIT_CEILING_DIRECTORIES=$ceiling CWD=$tmp/plain code_of check)" -eq 1 ] || fail "check did not exit 1 outside a git repository"
[[ $(GIT_CEILING_DIRECTORIES=$ceiling CWD=$tmp/plain err_of check) == fatal:* ]] || fail "check did not pass on the fatal line of git"

new_project branch
git -C "$proj" checkout -q -b other
stops "setup: the main checkout is on other, not on main; switch to main first" check
git -C "$proj" checkout -q --detach
stops "setup: the main checkout is on a detached HEAD, not on main; switch to main first" check
git -C "$proj" checkout -q main
TRUNK=trunk stops "setup: the main checkout is on main, not on trunk; switch to trunk first" check

new_project fetch
git -C "$proj" remote set-url origin "$tmp/missing.git"
stops_after "does not appear to be a git repository" "setup: cannot fetch main from origin" check

new_project behind
git clone -q "$tmp/behind.git" "$tmp/behind-other"
git -C "$tmp/behind-other" commit -q --allow-empty -m upstream
git -C "$tmp/behind-other" push -q origin HEAD:main
want="setup: the local main is behind origin/main or has diverged from it; run git pull first"
stops "$want" check
git -C "$proj" commit -q --allow-empty -m local
stops "$want" check

new_project ahead
git -C "$proj" commit -q --allow-empty -m one
[ "$(code_of check)" -eq 0 ] || fail "check refused a local trunk that is ahead"
want=$'setup: warning: the local main is 1 commit ahead of origin/main; the push carries it:\n  one'
[[ $(out_of check) == "$want" ]] || fail "wrong warning for one commit ahead: $(out_of check)"
git -C "$proj" commit -q --allow-empty -m two
[ "$(code_of check)" -eq 0 ] || fail "check refused a local trunk that is 2 commits ahead"
want=$'setup: warning: the local main is 2 commits ahead of origin/main; the push carries them:\n  one\n  two'
[[ $(out_of check) == "$want" ]] || fail "wrong warning for 2 commits ahead: $(out_of check)"
[ -z "$(err_of check)" ] || fail "the warning went to stderr"

new_project dirty
echo node_modules/ >"$proj/.gitignore"
git -C "$proj" add .gitignore
git -C "$proj" commit -qm ignore
echo dist/ >>"$proj/.gitignore"
echo notes >"$proj/AGENTS.md"
mkdir -p "$proj/.claude/celetis-flow"
echo '{}' >"$proj/.claude/celetis-flow/landing.json"
want="setup: commit or drop the uncommitted changes of these files first: .gitignore .claude/celetis-flow/landing.json AGENTS.md"
stops "$want" check
mkdir "$proj/sub"
CWD=$proj/sub stops "$want" check

new_project staged
echo x >"$proj/other.txt"
git -C "$proj" add other.txt
stops "setup: the index holds staged changes; commit or unstage them first" check

new_project usage
want='usage: scripts/celetis setup check | write --hosts claude|codex|claude,codex [--default claude|codex] --landing pr|merge | push'
[ "$(code_of)" -eq 2 ] && [ "$(code_of bogus)" -eq 2 ] && [ "$(code_of check extra)" -eq 2 ] && [ "$(code_of push extra)" -eq 2 ] || fail "usage not refused"
[[ $(err_of bogus) == "$want" ]] || fail "wrong usage line: $(err_of bogus)"


want='usage: scripts/celetis setup check | write --hosts claude|codex|claude,codex [--default claude|codex] --landing pr|merge | push'
for args in "write --hosts claude,codex --landing pr" "write --hosts claude --default codex --landing pr" "write --hosts claude --landing squash" \
  "write --hosts gitlab --landing pr" "write --hosts claude" "write --landing pr" "write --hosts claude --landing pr extra" "write --hosts claude,codex --default gitlab --landing pr"; do
  [ "$(code_of $args)" -eq 2 ] || fail "'$args' did not exit 2"
done
[[ $(err_of write --hosts claude --default codex --landing pr) == "$want" ]] || fail "wrong usage line for write"

readme_fence() {
  awk -v heading="$1" 'index($0, heading) == 1 { seen = 1; next } seen && /^```/ { if (open) exit; open = 1; next } open' "$here/README.md"
}
rules=$(readme_fence '### Codex permissions')
ignores=$(readme_fence '### `.gitignore`')
[ "$(printf '%s\n' "$rules" | grep -c '')" -eq 13 ] && [ "$(printf '%s\n' "$ignores" | grep -c '')" -eq 5 ] || fail "the README fences changed; update this test"
heading='## Celetis flow'
lanes="- The lanes are the skills of the plugin \`celetis\`, on the issues of \`$REPO\`."
landing='- `.claude/celetis-flow/landing.json` names the landing mechanism, and a build step ends with `scripts/celetis land`.'
never='- A lane never skips a step.'
maintainer='- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.'
b=$lanes$'\n'$landing$'\n'$never$'\n'$maintainer$'\n'
gitattributes='scripts/celetis text eol=lf'

commit_all() { git -C "$proj" add -A && git -C "$proj" commit -qm "$1"; }
sorted() { jq -S 'if type == "array" then sort else .files |= sort | .entries |= map_values(sort) end'; }
jlines() { jq -Rn '[inputs]'; }
record_is() {
  [ "$(sorted <"$proj/.claude/celetis-flow/wiring.json")" = "$(sorted <<<"$1")" ] || fail "wrong record: $(cat "$proj/.claude/celetis-flow/wiring.json")"
}
bytes_are() { printf '%s' "$1" | cmp -s - "$proj/$2" || fail "wrong bytes in $2: $(cat "$proj/$2")"; }
entries_of() { jq -S --arg file "$1" '.entries[$file]' "$proj/.claude/celetis-flow/wiring.json" | sorted; }
clean_tree() { [ -z "$(git -C "$proj" status --porcelain)" ] || fail "$1: $(git -C "$proj" status --porcelain)"; }

new_project empty
out=$(run write --hosts codex --landing merge 2>"$tmp/err") || fail "write failed on an empty project: $(cat "$tmp/err")"
[ ! -s "$tmp/err" ] || fail "write printed on stderr: $(cat "$tmp/err")"
cmp -s "$plug/scripts/celetis" "$proj/scripts/celetis" && [ -x "$proj/scripts/celetis" ] || fail "the launcher is no executable copy"
bytes_are $'{"landing": "merge"}\n' .claude/celetis-flow/landing.json
bytes_are "$rules"$'\n' .codex/rules/celetis.rules
bytes_are "$ignores"$'\n' .gitignore
bytes_are "$gitattributes"$'\n' .gitattributes
bytes_are "$heading"$'\n\n'"$b" AGENTS.md
[ ! -e "$proj/.claude/settings.json" ] || fail "write made .claude/settings.json for codex only"
[ "$(git -C "$proj" config celetis-flow.agent)" = codex ] || fail "wrong celetis-flow.agent"
expected=$(jq -n --argjson ignores "$(jlines <<<"$ignores")" --argjson agents "$(printf '%s\n%s' "$heading" "$b" | jlines)" \
  --arg gitattributes "$gitattributes" '{
    schema: 1,
    answers: {hosts: ["codex"], tracker: "github"},
    files: [".claude/celetis-flow/landing.json", ".claude/celetis-flow/wiring.json", ".codex/rules/celetis.rules", "scripts/celetis"],
    entries: {".gitignore": $ignores, ".gitattributes": [$gitattributes], "AGENTS.md": $agents}
  }')
record_is "$expected"
jq -S . "$proj/.claude/celetis-flow/wiring.json" | cmp -s - "$proj/.claude/celetis-flow/wiring.json" || fail "the record is not in the jq -S form"
[ -z "$(grep -v '^setup: changed ' <<<"$out" || true)" ] || fail "write printed more than the changed paths: $out"
[ "$(sed -n 's/^setup: changed //p' <<<"$out" | sort)" = "$(git -C "$proj" status --porcelain --untracked-files=all | cut -c4- | sort)" ] ||
  fail "the changed paths differ from git status: $out"
record=$(cat "$proj/.claude/celetis-flow/wiring.json")
commit_all wiring
git -C "$proj" push -q origin main
[ "$(run write --hosts codex --landing merge 2>&1)" = "setup: no file changed" ] || fail "a rerun did not report no change"
clean_tree "a rerun changed a file"
[ "$(cat "$proj/.claude/celetis-flow/wiring.json")" = "$record" ] || fail "a rerun changed the record"

new_project own
mkdir "$proj/scripts"
echo old >"$proj/scripts/celetis"
printf 'node_modules/\ndocs/superpowers/' >"$proj/.gitignore"
printf '# P\n## Build\n- make\n## Celetis flow\n\n* A lane never skips a step.\n\n## Deploy\n- ship\n' >"$proj/AGENTS.md"
commit_all product
run write --hosts codex --landing pr >/dev/null
cmp -s "$plug/scripts/celetis" "$proj/scripts/celetis" && [ -x "$proj/scripts/celetis" ] || fail "write kept an old launcher"
bytes_are $'node_modules/\ndocs/superpowers/\n.claude/worktrees/\n.claude/settings.local.json\n.superpowers/\ndocs/lessons/_pending/\n' .gitignore
bytes_are $'# P\n## Build\n- make\n## Celetis flow\n\n* A lane never skips a step.\n'"$lanes"$'\n'"$landing"$'\n'"$maintainer"$'\n\n## Deploy\n- ship\n' AGENTS.md
[ "$(entries_of AGENTS.md)" = "$(printf '%s\n%s' "$heading" "$b" | jlines | sorted)" ] || fail "wrong AGENTS.md entries: $(entries_of AGENTS.md)"
[ "$(entries_of .gitignore)" = "$(jlines <<<"$ignores" | sorted)" ] || fail "wrong .gitignore entries: $(entries_of .gitignore)"

agents_case() {
  new_project "agents$1"
  printf '%s' "$2" >"$proj/AGENTS.md"
  commit_all product
  run write --hosts codex --landing pr >/dev/null
  bytes_are "$3" AGENTS.md
}
agents_case 1 $'# P\n- x\n' $'# P\n- x\n\n'"$heading"$'\n\n'"$b"
agents_case 2 $'# P\n\n' $'# P\n\n'"$heading"$'\n\n'"$b"
agents_case 3 $'## Celetis flow\n\n## Deploy\n' "$heading"$'\n\n'"$b"$'\n## Deploy\n'
agents_case 4 $'## Celetis flow\n\n### Notes\n- note\n\n# Next\n' "$heading"$'\n\n### Notes\n- note\n'"$b"$'\n# Next\n'
agents_case 5 $'## Celetis flow\n- A lane never skips a step.' "$heading"$'\n'"$never"$'\n'"$lanes"$'\n'"$landing"$'\n'"$maintainer"$'\n'
agents_case 6 $'## Celetis flow\n\n- The maintainer starts the runner; an agent starts it only when its task says\n  so, with a number, and in a terminal.\n' \
  "$heading"$'\n\n- The maintainer starts the runner; an agent starts it only when its task says\n  so, with a number, and in a terminal.\n'"$b"
agents_case 7 $'## Celetis flow\n\n  *   A lane never skips a step.  \r\n' "$heading"$'\n\n  *   A lane never skips a step.  \r\n'"$lanes"$'\n'"$landing"$'\n'"$maintainer"$'\n'
agents_case 8 $'# P\n\n- A lane never skips a step.\n' $'# P\n\n- A lane never skips a step.\n\n'"$heading"$'\n\n'"$b"

new_project claude
printf '# C' >"$proj/CLAUDE.md"
mkdir "$proj/.claude"
printf '# Dot\n@AGENTS.md\n' >"$proj/.claude/CLAUDE.md"
commit_all product
run write --hosts claude --landing pr >/dev/null
bytes_are $'# C\n@AGENTS.md\n' CLAUDE.md
bytes_are $'# Dot\n@AGENTS.md\n' .claude/CLAUDE.md
[ "$(entries_of CLAUDE.md)" = "$(echo '["@AGENTS.md"]' | sorted)" ] && [ "$(entries_of .claude/CLAUDE.md)" = "$(entries_of CLAUDE.md)" ] || fail "wrong CLAUDE entries"
[ "$(git -C "$proj" config celetis-flow.agent)" = claude ] || fail "wrong celetis-flow.agent for claude"

new_project claudedot
mkdir "$proj/.claude"
printf '@AGENTS.md\n' >"$proj/.claude/CLAUDE.md"
commit_all product
run write --hosts claude --landing pr >/dev/null
[ ! -e "$proj/CLAUDE.md" ] || fail "write made a CLAUDE.md"
bytes_are $'@AGENTS.md\n' .claude/CLAUDE.md
[ "$(jq -c '.entries | has("CLAUDE.md"), has(".claude/CLAUDE.md")' "$proj/.claude/celetis-flow/wiring.json" | paste -sd ' ' -)" = "false true" ] || fail "wrong CLAUDE record"

new_project codexclaude
printf '# C\n' >"$proj/CLAUDE.md"
commit_all product
run write --hosts codex --landing pr >/dev/null
bytes_are $'# C\n' CLAUDE.md
[ "$(jq '.entries | has("CLAUDE.md")' "$proj/.claude/celetis-flow/wiring.json")" = false ] || fail "codex recorded a CLAUDE file"

new_project symlink
printf '# P\n' >"$proj/AGENTS.md"
ln -s AGENTS.md "$proj/CLAUDE.md"
commit_all product
out=$(run write --hosts claude --landing pr)
! grep -qF 'is a symbolic link' <<<"$out" || fail "write warned on a CLAUDE.md that links to AGENTS.md: $out"
bytes_are "# P"$'\n\n'"$heading"$'\n\n'"$b" AGENTS.md
[ -L "$proj/CLAUDE.md" ] || fail "write replaced a symlinked CLAUDE.md"
[ "$(jq '.entries | has("CLAUDE.md")' "$proj/.claude/celetis-flow/wiring.json")" = false ] || fail "write recorded a symlinked CLAUDE.md"
new_project symlinkignored
printf '# P\n' >"$proj/AGENTS.md"
echo CLAUDE.md >"$proj/.gitignore"
ln -s AGENTS.md "$proj/CLAUDE.md"
commit_all product
[ "$(code_of write --hosts claude --landing pr)" -eq 0 ] || fail "write refused an ignored symlinked CLAUDE.md"

new_project agentslink
printf '# C\n' >"$proj/CLAUDE.md"
ln -s CLAUDE.md "$proj/AGENTS.md"
commit_all product
run write --hosts claude --landing pr >/dev/null
[ -L "$proj/AGENTS.md" ] || fail "write replaced a symlinked AGENTS.md"
bytes_are "# C"$'\n\n'"$heading"$'\n\n'"$b" CLAUDE.md
[ "$(jq '.entries | has("CLAUDE.md")' "$proj/.claude/celetis-flow/wiring.json")" = false ] || fail "write recorded @AGENTS.md in the file of AGENTS.md"

new_project claudelink
mkdir "$proj/docs"
printf '# C\n' >"$proj/docs/claude.md"
ln -s docs/claude.md "$proj/CLAUDE.md"
commit_all product
out=$(run write --hosts claude --landing pr)
grep -qxF 'setup: warning: CLAUDE.md is a symbolic link to a file other than AGENTS.md; setup leaves it, so Claude reads AGENTS.md only if that file holds @AGENTS.md' <<<"$out" ||
  fail "no warning for a CLAUDE.md that links to another file: $out"
bytes_are $'# C\n' docs/claude.md

new_project crlf
printf '%s\n' "$ignores" | awk '{ printf "%s\r\n", $0 }' >"$proj/.gitignore"
[ "$(grep -c $'\r' "$proj/.gitignore")" -eq 5 ] || fail "the CRLF fixture has no CR"
cp "$proj/.gitignore" "$tmp/crlf.gitignore"
commit_all product
run write --hosts codex --landing pr >/dev/null
cmp -s "$tmp/crlf.gitignore" "$proj/.gitignore" || fail "write changed a CRLF .gitignore"
[ "$(entries_of .gitignore)" = "$(jlines <<<"$ignores" | sorted)" ] || fail "wrong entries for a CRLF .gitignore"

new_project settings
cat >"$tmp/settings.want" <<'EOF'
{
  "permissions": {
    "allow": [
      "Bash(scripts/celetis land *)",
      "Bash(scripts/celetis --agent claude land *)",
      "Bash(scripts/celetis --agent codex land *)"
    ],
    "deny": [
      "Bash(gh pr merge*)",
      "PowerShell(gh pr merge*)"
    ]
  },
  "extraKnownMarketplaces": {
    "celetis": {
      "source": {
        "source": "github",
        "repo": "ddinkov10/celetis"
      },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "superpowers@superpowers-marketplace": true,
    "celetis@celetis": true
  }
}
EOF
settings_entries='[
  {"path": ["permissions", "allow"], "item": "Bash(scripts/celetis land *)"},
  {"path": ["permissions", "allow"], "item": "Bash(scripts/celetis --agent claude land *)"},
  {"path": ["permissions", "allow"], "item": "Bash(scripts/celetis --agent codex land *)"},
  {"path": ["permissions", "deny"], "item": "Bash(gh pr merge*)"},
  {"path": ["permissions", "deny"], "item": "PowerShell(gh pr merge*)"},
  {"path": ["extraKnownMarketplaces", "celetis"]},
  {"path": ["enabledPlugins", "superpowers@superpowers-marketplace"]},
  {"path": ["enabledPlugins", "celetis@celetis"]}
]'
run write --hosts claude --landing pr >/dev/null
cmp -s "$tmp/settings.want" "$proj/.claude/settings.json" || fail "wrong .claude/settings.json: $(cat "$proj/.claude/settings.json")"
[ "$(readme_fence '### Claude permissions' | jq -S .)" = "$(jq -S . "$tmp/settings.want")" ] || fail "the README object changed; update this test"
[ "$(entries_of .claude/settings.json)" = "$(sorted <<<"$settings_entries")" ] || fail "wrong settings entries: $(entries_of .claude/settings.json)"
jq -e '.files | index(".claude/settings.json") == null' "$proj/.claude/celetis-flow/wiring.json" >/dev/null || fail "write recorded .claude/settings.json as an owned file"

new_project settingsproduct
mkdir "$proj/.claude"
cat >"$proj/.claude/settings.json" <<'EOF'
{
    "permissions": {
        "allow": [
            "Bash(npm test)"
        ]
    },
    "env": {
        "CI": "1"
    },
    "enabledPlugins": {}
}
EOF
commit_all product
run write --hosts claude --landing pr >/dev/null
file=$proj/.claude/settings.json
[ "$(jq -c .permissions.allow "$file")" = '["Bash(npm test)","Bash(scripts/celetis land *)","Bash(scripts/celetis --agent claude land *)","Bash(scripts/celetis --agent codex land *)"]' ] || fail "wrong allow items"
[ "$(jq -c keys_unsorted "$file")" = '["permissions","env","enabledPlugins","extraKnownMarketplaces"]' ] || fail "wrong key order"
[ "$(jq -c .env "$file")" = '{"CI":"1"}' ] || fail "write changed env"
[[ $(sed -n 2p "$file") == '    "'* ]] || fail "write changed the indent: $(sed -n 2p "$file")"
[ "$(entries_of .claude/settings.json)" = "$(sorted <<<"$settings_entries")" ] || fail "wrong entries for a product file"
commit_all wiring
git -C "$proj" push -q origin main
[ "$(run write --hosts claude --landing pr 2>&1)" = "setup: no file changed" ] || fail "a rerun changed a settings file"

new_project settingstab
mkdir "$proj/.claude"
printf '{\n\t"env": {\n\t\t"CI": "1"\n\t}\n}\n' >"$proj/.claude/settings.json"
commit_all product
run write --hosts claude --landing pr >/dev/null
[[ $(sed -n 2p "$proj/.claude/settings.json") == $'\t"env"'* ]] || fail "write changed a tab indent: $(sed -n 2p "$proj/.claude/settings.json")"

new_project settingshand
mkdir "$proj/.claude"
cp "$here/.claude/settings.json" "$proj/.claude/settings.json"
commit_all product
run write --hosts claude --landing pr >/dev/null
cmp -s "$here/.claude/settings.json" "$proj/.claude/settings.json" || fail "write changed a hand-wired settings file"
[ "$(entries_of .claude/settings.json)" = "$(sorted <<<"$settings_entries")" ] || fail "wrong entries for a hand-wired file"

new_project settingsdiffers
mkdir "$proj/.claude"
printf '{"enabledPlugins": {"celetis@celetis": false}}\n' >"$proj/.claude/settings.json"
commit_all product
differs='setup: warning: .claude/settings.json: enabledPlugins.celetis@celetis differs from the current form; setup leaves it'
out=$(run write --hosts claude --landing pr 2>"$tmp/err") || fail "write failed on a differing entry: $(cat "$tmp/err")"
grep -qxF "$differs" <<<"$out" || fail "no warning for a differing entry: $out"
[ "$(jq -c .enabledPlugins "$proj/.claude/settings.json")" = '{"celetis@celetis":false,"superpowers@superpowers-marketplace":true}' ] || fail "write changed a differing entry"
[ "$(entries_of .claude/settings.json)" = "$(jq 'map(select(.path != ["enabledPlugins", "celetis@celetis"]))' <<<"$settings_entries" | sorted)" ] ||
  fail "write recorded a differing entry: $(entries_of .claude/settings.json)"

new_project settingsrecorded
run write --hosts claude --landing pr >/dev/null
jq '.enabledPlugins["celetis@celetis"] = false' "$proj/.claude/settings.json" >"$tmp/changed.json"
cp "$tmp/changed.json" "$proj/.claude/settings.json"
commit_all wiring
out=$(run write --hosts claude --landing pr)
grep -qxF "$differs" <<<"$out" || fail "no warning for a changed owned entry: $out"
[ "$(entries_of .claude/settings.json)" = "$(sorted <<<"$settings_entries")" ] || fail "write dropped a recorded entry"

new_project settingsbad
mkdir "$proj/.claude"
bad_settings() {
  printf '%s\n' "$1" >"$proj/.claude/settings.json"
  commit_all "bad $1"
  stops "setup: .claude/settings.json$2; fix it first" write --hosts claude --landing pr
  clean_tree "bad settings left a file"
}
bad_settings '{' ' is no JSON object'
bad_settings '[]' ' is no JSON object'
bad_settings '{"permissions":{"allow":"x"}}' ': permissions.allow is no array'
bad_settings '{"enabledPlugins":[]}' ': enabledPlugins is no object'
[ "$(code_of write --hosts codex --landing pr)" -eq 0 ] || fail "write checked .claude/settings.json for codex only"

new_project ignored
echo '.claude/' >"$proj/.gitignore"
commit_all product
stops "setup: git ignores .claude/celetis-flow/landing.json; make git track it first" write --hosts codex --landing merge
clean_tree "an ignored path left a file"
new_project ignoredscripts
echo 'scripts/' >"$proj/.gitignore"
commit_all product
stops "setup: git ignores scripts/celetis; make git track it first" write --hosts codex --landing merge
clean_tree "an ignored launcher left a file"
mkdir "$proj/scripts"
cp "$plug/scripts/celetis" "$proj/scripts/celetis"
git -C "$proj" add -f scripts/celetis
git -C "$proj" commit -qm tracked
[ "$(code_of write --hosts codex --landing merge)" -eq 0 ] || fail "write refused a tracked launcher that .gitignore matches"

new_project ignoredstore
echo 'docs/adr/' >"$proj/.gitignore"
commit_all product
LABELS= stops "setup: git ignores docs/adr/README.md; make git track it first" write --hosts codex --landing merge
clean_tree "an ignored store left a file"
[ ! -s "$LABEL_LOG" ] || fail "an ignored store left a label: $(cat "$LABEL_LOG")"
mkdir -p "$proj/docs/adr"
printf '# Our decisions\n' >"$proj/docs/adr/README.md"
printf '# Our template\n' >"$proj/docs/adr/template.md"
git -C "$proj" add -f docs/adr
git -C "$proj" commit -qm tracked
[ "$(code_of write --hosts codex --landing merge)" -eq 0 ] || fail "write refused tracked store files that .gitignore matches"

new_project linkedfolder
mkdir -p "$proj/config/claude"
printf '{}\n' >"$proj/config/claude/settings.json"
ln -s config/claude "$proj/.claude"
commit_all product
LABELS= stops_after 'is beyond a symbolic link' \
  'setup: .claude/celetis-flow/landing.json lies beyond a symbolic link or in a submodule; setup writes no file there' write --hosts claude --landing pr
clean_tree "a linked folder left a file"
[ ! -s "$LABEL_LOG" ] || fail "a linked folder left a label: $(cat "$LABEL_LOG")"

new_project linkedagents
mkdir "$proj/docs"
printf '# Rules\n' >"$proj/docs/agents.md"
ln -s docs/agents.md "$proj/AGENTS.md"
commit_all product
LABELS= stops 'setup: AGENTS.md is a symbolic link; setup writes no file through a link' write --hosts codex --landing pr
clean_tree "a linked AGENTS.md left a file"
[ ! -s "$LABEL_LOG" ] || fail "a linked AGENTS.md left a label: $(cat "$LABEL_LOG")"

new_project submodule
git init -q -b main "$tmp/subdocs"
echo docs >"$tmp/subdocs/index.md"
git -C "$tmp/subdocs" add index.md
git -C "$tmp/subdocs" commit -qm docs
git -C "$proj" -c protocol.file.allow=always submodule add -q "$tmp/subdocs" docs
commit_all product
LABELS= stops_after "is in submodule 'docs'" \
  'setup: docs/adr/README.md lies beyond a symbolic link or in a submodule; setup writes no file there' write --hosts codex --landing pr
clean_tree "a submodule left a file"
[ ! -s "$LABEL_LOG" ] || fail "a submodule left a label: $(cat "$LABEL_LOG")"
mkdir -p "$proj/docs/adr" "$proj/docs/lessons"
touch "$proj/docs/adr/README.md" "$proj/docs/adr/template.md" "$proj/docs/lessons/INDEX.md"
[ "$(code_of write --hosts codex --landing pr)" -eq 0 ] || fail "write stopped on store files that are there in a submodule"

new_project union
run write --hosts claude,codex --default codex --landing merge >/dev/null
[ "$(git -C "$proj" config celetis-flow.agent)" = codex ] || fail "wrong celetis-flow.agent for two hosts"
echo '# own' >>"$proj/.codex/rules/celetis.rules"
commit_all wiring
git -C "$proj" push -q origin main
rules_bytes=$(cat "$proj/.codex/rules/celetis.rules")
run write --hosts claude --landing pr >/dev/null
[ "$(cat "$proj/.codex/rules/celetis.rules")" = "$rules_bytes" ] || fail "write changed the rules file of an unchosen host"
[ "$(jq -c '(.files | index(".codex/rules/celetis.rules") != null), .answers.hosts' "$proj/.claude/celetis-flow/wiring.json" | paste -sd ' ' -)" = 'true ["claude"]' ] || fail "wrong union record"
bytes_are $'{"landing": "pr"}\n' .claude/celetis-flow/landing.json
[ "$(git -C "$proj" config celetis-flow.agent)" = claude ] || fail "wrong celetis-flow.agent for one host"

new_project badrecord
mkdir -p "$proj/.claude/celetis-flow"
want='setup: .claude/celetis-flow/wiring.json is no record of setup; fix or remove it first'
for bad in '[]' 'not json' '{"schema": 2, "files": [], "entries": {}}' '{"schema": 1}' '{"schema": 1, "files": [1], "entries": {}}' '{"schema": 1, "files": [], "entries": {"a": "b"}}'; do
  printf '%s\n' "$bad" >"$proj/.claude/celetis-flow/wiring.json"
  commit_all "bad $bad"
  stops "$want" write --hosts codex --landing pr
  clean_tree "a bad record left a file"
done

index_head=$'# Lessons\n\n| Lesson | Tags | Date | Summary |\n|---|---|---|---|\n'
unrecorded_stores() {
  jq -e '[.files[], (.entries | keys[])] | all(startswith("docs/") | not)' "$proj/.claude/celetis-flow/wiring.json" >/dev/null ||
    fail "$1: the record names a store file"
}

new_project stores
run write --hosts codex --landing pr >/dev/null
cmp -s "$plug/docs/adr/README.md" "$proj/docs/adr/README.md" || fail "write made no copy of the ADR README"
cmp -s "$plug/docs/adr/template.md" "$proj/docs/adr/template.md" || fail "write made no copy of the ADR template"
! grep -q harness "$proj/docs/adr/README.md" || fail "the ADR README of a product speaks of the harness"
bytes_are "$index_head" docs/lessons/INDEX.md
unrecorded_stores "an empty project"

new_project productstores
mkdir -p "$proj/docs/adr"
printf '# Our decisions\n' >"$proj/docs/adr/README.md"
commit_all product
run write --hosts codex --landing pr >/dev/null
bytes_are $'# Our decisions\n' docs/adr/README.md
cmp -s "$plug/docs/adr/template.md" "$proj/docs/adr/template.md" || fail "write made no template next to a product README"
bytes_are "$index_head" docs/lessons/INDEX.md
unrecorded_stores "a product store"

new_project producttemplate
mkdir -p "$proj/docs/adr" "$proj/docs/lessons"
printf '# Our template\n' >"$proj/docs/adr/template.md"
printf '# Our lessons\n' >"$proj/docs/lessons/INDEX.md"
commit_all product
run write --hosts codex --landing pr >/dev/null
bytes_are $'# Our template\n' docs/adr/template.md
bytes_are $'# Our lessons\n' docs/lessons/INDEX.md

new_project handwired
mkdir -p "$proj/.claude/celetis-flow" "$proj/.codex/rules" "$proj/scripts" "$proj/docs/adr" "$proj/docs/lessons"
cp "$here/.claude/settings.json" "$proj/.claude/settings.json"
printf '%s\n' "$ignores" >"$proj/.gitignore"
printf '%s\n' "$rules" >"$proj/.codex/rules/celetis.rules"
cp "$plug/scripts/celetis" "$proj/scripts/celetis"
printf '{"landing": "pr"}\n' >"$proj/.claude/celetis-flow/landing.json"
cp "$plug/docs/adr/README.md" "$plug/docs/adr/template.md" "$proj/docs/adr/"
printf '%s' "$index_head" >"$proj/docs/lessons/INDEX.md"
printf '* text=auto eol=lf\n' >"$proj/.gitattributes"
printf '%s\n\n%s' "$heading" "$b" >"$proj/AGENTS.md"
commit_all hand
git -C "$proj" push -q origin main
run write --hosts claude,codex --default claude --landing pr >/dev/null
[ "$(git -C "$proj" status --porcelain)" = " M .gitattributes"$'\n''?? .claude/celetis-flow/wiring.json' ] || fail "wrong changes to a hand-wired project: $(git -C "$proj" status --porcelain)"
bytes_are $'* text=auto eol=lf\n'"$gitattributes"$'\n' .gitattributes
expected=$(jq -n --argjson ignores "$(jlines <<<"$ignores")" --argjson agents "$(printf '%s\n%s' "$heading" "$b" | jlines)" \
  --arg gitattributes "$gitattributes" --argjson settings "$settings_entries" '{
    schema: 1,
    answers: {hosts: ["claude", "codex"], tracker: "github"},
    files: [".claude/celetis-flow/landing.json", ".claude/celetis-flow/wiring.json", ".codex/rules/celetis.rules", "scripts/celetis"],
    entries: {".gitignore": $ignores, ".gitattributes": [$gitattributes], "AGENTS.md": $agents, ".claude/settings.json": $settings}
  }')
record_is "$expected"
unrecorded_stores "a hand-wired project"

[ ! -s "$LABEL_LOG" ] || fail "an earlier case made a label: $(cat "$LABEL_LOG")"
new_project labels
out=$(LABELS='bug enhancement wontfix' run write --hosts codex --landing pr 2>"$tmp/err") || fail "write failed on a project with three labels: $(cat "$tmp/err")"
cat >"$tmp/label.want" <<'EOF'
needs-triage|not yet classified|FBCA04
hotfix|production broken, the fix ships now|FEF2C0
chore|zero-behavior-change edit|006B75
epic|parent of several feature sub-issues|0052CC
needs-info|the report lacks what its lane needs; the questions are in a comment|FEF2C0
ready-for-agent|plan posted; `/celetis:implement #<n>` can start|D93F0B
ready-for-human|a step only a human runs|C2E0C6
EOF
cmp -s "$tmp/label.want" "$LABEL_LOG" || fail "wrong labels made: $(cat "$LABEL_LOG")"
[ "$(sed -n 's/^setup: made the label //p' <<<"$out")" = "$(cut -d'|' -f1 "$tmp/label.want")" ] || fail "wrong label report: $out"

new_project labelsall
: >"$LABEL_LOG"
out=$(run write --hosts codex --landing pr)
[ ! -s "$LABEL_LOG" ] && ! grep -q 'made the label' <<<"$out" || fail "write made a label that is there: $(cat "$LABEL_LOG")"

new_project labelcase
out=$(LABELS="${all_labels/ bug / Bug }" run write --hosts codex --landing pr)
[ ! -s "$LABEL_LOG" ] || fail "write made a label that differs in case: $(cat "$LABEL_LOG")"
grep -qxF 'setup: warning: the label Bug differs in case from bug; setup leaves it' <<<"$out" || fail "no warning for a label in another case: $out"

new_project labelpages
PAGES=2 run write --hosts codex --landing pr >/dev/null
[ ! -s "$LABEL_LOG" ] || fail "write made a label of page 2: $(cat "$LABEL_LOG")"

new_project labelfail
LABELS= LABEL_FAIL=1 stops_after "HTTP 403: Resource not accessible" "setup: cannot make the label needs-triage" write --hosts codex --landing pr
clean_tree "a label failure left a file"
LIST_FAIL=1 stops_after "HTTP 403: Resource not accessible" "setup: cannot list the labels" write --hosts codex --landing pr
clean_tree "a label list failure left a file"

subject='chore(celetis): wire the project for the celetis lanes'
remote_head() { git -C "$proj" ls-remote origin refs/heads/main | cut -f1; }

new_project push
git -C "$proj" config core.fileMode false
out=$(run write --hosts claude,codex --default claude --landing pr)
chmod -x "$proj/scripts/celetis"
echo product >"$proj/notes.txt"
run push >"$tmp/out" 2>"$tmp/err" || fail "push failed: $(cat "$tmp/err")"
[ ! -s "$tmp/out" ] && [ ! -s "$tmp/err" ] || fail "push printed: $(cat "$tmp/out" "$tmp/err")"
[ "$(git -C "$proj" log -1 --format=%s)" = "$subject" ] || fail "wrong subject of the push commit"
[ "$(git -C "$proj" show --name-only --format= HEAD | sort)" = "$(sed -n 's/^setup: changed //p' <<<"$out" | sort)" ] || fail "the push commit holds other paths: $(git -C "$proj" show --name-only --format= HEAD)"
[[ $(git -C "$proj" ls-tree HEAD scripts/celetis) == 100755* ]] || fail "the launcher has no mode 100755: $(git -C "$proj" ls-tree HEAD scripts/celetis)"
[ "$(remote_head)" = "$(git -C "$proj" rev-parse HEAD)" ] || fail "push did not reach origin/main"
[ "$(git -C "$proj" status --porcelain)" = '?? notes.txt' ] || fail "push touched a product file: $(git -C "$proj" status --porcelain)"

new_project pushahead
git -C "$proj" commit -q --allow-empty -m one
git -C "$proj" commit -q --allow-empty -m two
run write --hosts codex --landing pr >/dev/null
run push >/dev/null || fail "push failed on a trunk that is ahead"
[ "$(git -C "$tmp/pushahead.git" log --format=%s main)" = "$subject"$'\ntwo\none\nbase' ] || fail "push did not carry the commits ahead: $(git -C "$tmp/pushahead.git" log --format=%s main)"

new_project pushclean
run write --hosts codex --landing pr >/dev/null
commit_all wiring
git -C "$proj" push -q origin main
head=$(git -C "$proj" rev-parse HEAD)
[ "$(run push 2>&1)" = 'setup: no file changed; nothing to commit' ] && [ "$(code_of push)" -eq 0 ] || fail "push did not report no change"
[ "$(git -C "$proj" rev-parse HEAD)" = "$head" ] && [ "$(remote_head)" = "$head" ] || fail "push moved a trunk with no change"

new_project pushrefused
run write --hosts codex --landing pr >/dev/null
printf '#!/bin/sh\nexit 1\n' >"$tmp/pushrefused.git/hooks/pre-receive"
chmod +x "$tmp/pushrefused.git/hooks/pre-receive"
before=$(remote_head)
set +e
run push >/dev/null 2>"$tmp/err"
code=$?
set -e
[ "$code" -eq 1 ] || fail "a refused push did not exit 1: $code"
[ "$(tail -n1 "$tmp/err")" = 'setup: the push failed; the commit stays on the local main' ] || fail "wrong last line for a refused push: $(cat "$tmp/err")"
awk '/pre-receive hook declined/ { seen = 1 } /^setup: the push failed/ { ok = seen } END { exit !ok }' "$tmp/err" || fail "git's refusal does not come before the setup line: $(cat "$tmp/err")"
[ "$(git -C "$proj" log -1 --format=%s)" = "$subject" ] && [ "$(remote_head)" = "$before" ] || fail "a refused push moved a trunk"
rm "$tmp/pushrefused.git/hooks/pre-receive"
head=$(git -C "$proj" rev-parse HEAD)
out=$(run push 2>"$tmp/err") || fail "a rerun of push failed: $(cat "$tmp/err")"
grep -qxF 'setup: no file changed; nothing to commit' <<<"$out" || fail "a rerun of push did not report no change: $out"
[ "$(git -C "$proj" rev-parse HEAD)" = "$head" ] && [ "$(remote_head)" = "$head" ] || fail "a rerun of push did not carry the commit ahead"

new_project pushhook
run write --hosts codex --landing pr >/dev/null
printf '#!/bin/sh\necho the hook refuses the commit >&2\nexit 1\n' >"$proj/.git/hooks/pre-commit"
chmod +x "$proj/.git/hooks/pre-commit"
head=$(git -C "$proj" rev-parse HEAD)
dirty=$(git -C "$proj" status --porcelain)
stops_after 'the hook refuses the commit' 'setup: the commit failed; the files stay uncommitted' push
git -C "$proj" diff --cached --quiet || fail "a refused commit left staged files: $(git -C "$proj" diff --cached --name-only)"
[ "$(git -C "$proj" rev-parse HEAD)" = "$head" ] && [ "$(remote_head)" = "$head" ] || fail "a refused commit moved a trunk"
[ "$(git -C "$proj" status --porcelain)" = "$dirty" ] || fail "a refused commit changed the files: $(git -C "$proj" status --porcelain)"
rm "$proj/.git/hooks/pre-commit"
run push >/dev/null 2>"$tmp/err" || fail "push failed after a refused commit: $(cat "$tmp/err")"
[ "$(git -C "$proj" log -1 --format=%s)" = "$subject" ] && [ "$(remote_head)" = "$(git -C "$proj" rev-parse HEAD)" ] || fail "push did not commit after a refused commit"

new_project pushstaged
run write --hosts codex --landing pr >/dev/null
echo x >"$proj/other.txt"
git -C "$proj" add other.txt
head=$(git -C "$proj" rev-parse HEAD)
stops "setup: the index holds staged changes; commit or unstage them first" push
[ "$(git -C "$proj" rev-parse HEAD)" = "$head" ] || fail "push committed with a staged file"

new_project pushbranch
run write --hosts codex --landing pr >/dev/null
git -C "$proj" checkout -q -b other
stops "setup: the main checkout is on other, not on main; switch to main first" push
[ "$(git -C "$proj" log -1 --format=%s)" = base ] || fail "push committed on another branch"

only_api
echo "PASS"
