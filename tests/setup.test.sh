#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
base=$(mktemp -d)
trap 'cd /; rm -rf "$base"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=maintenance.auto GIT_CONFIG_VALUE_0=false
. "$here/tests/lib/pool.sh"

fail() {
  echo "FAIL: $1"
  exit 1
}

fixtures=$base/fixtures
plug="$fixtures/plug in"
mkdir -p "$fixtures/bin" "$fixtures/nobun" "$plug/scripts" "$plug/docs/adr"
cp "$here/scripts/setup.sh" "$here/scripts/celetis" "$here/scripts/worktree-lib.sh" "$plug/scripts/"
cp -R "$here/scripts/lib" "$plug/scripts/"
cp "$here/docs/adr/README.md" "$here/docs/adr/template.md" "$plug/docs/adr/"
cat >"$fixtures/bin/gh" <<'EOF'
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
chmod +x "$fixtures/bin/gh"
printf '#!/bin/sh\nexit 1\n' >"$fixtures/nobun/bun"
chmod +x "$fixtures/nobun/bun"
all_labels='needs-triage bug enhancement hotfix chore epic needs-info ready-for-agent ready-for-human wontfix'
export PATH="$fixtures/bin:$PATH" REPO=acme/widgets TRUNK=main LABELS=$all_labels

template=$fixtures/template
git init -q -b main "$template"
echo app >"$template/app.txt"
git -C "$template" add app.txt
git -C "$template" commit -qm base
git clone -q --bare "$template" "$template.git"
git -C "$template" remote add origin "$template.git"
git -C "$template" fetch -q origin

new_project() {
  proj="$tmp/$1"
  cp -R "$template" "$proj"
  cp -R "$template.git" "$tmp/$1.git"
  git -C "$proj" remote set-url origin "$tmp/$1.git"
}
run() { (cd "${CWD:-$proj}" && bash "$plug/scripts/setup.sh" "$@"); }
code_of() {
  set +e
  run "$@" >/dev/null 2>&1
  local c=$?
  set -e
  echo "$c"
}
# shellcheck disable=SC2069 # 2>&1 >/dev/null keeps stderr and drops stdout on purpose
err_of() { run "$@" 2>&1 >/dev/null || true; }
capture() {
  cap_code=0
  cap_out=$(run "$@" 2>"$tmp/cap.err") || cap_code=$?
  cap_err=$(<"$tmp/cap.err")
}
only_api() { ! grep -qv '^api ' "$GH_LOG" || fail "gh called without api: $(grep -v '^api ' "$GH_LOG")"; }
stops() {
  local want=$1
  shift
  capture "$@"
  [ "$cap_code" -eq 1 ] || fail "'$*' did not exit 1 for: $want"
  [[ $cap_err == "$want" ]] || fail "wrong stop for: $want; got: $cap_err"
}
stops_after() {
  local cause=$1 want=$2
  shift 2
  capture "$@"
  [ "$cap_code" -eq 1 ] || fail "'$*' did not exit 1 for: $want"
  [ "$(tail -n1 <<<"$cap_err")" = "$want" ] && grep -qF -- "$cause" <<<"$cap_err" || fail "wrong stop for: $want after: $cause; got: $cap_err"
}

case_clean() {
  new_project clean
  capture check
  [ "$cap_code" -eq 0 ] || fail "check refused a clean trunk"
  [ -z "$cap_out$cap_err" ] || fail "check printed on a clean trunk"
  grep -qxF 'api repos/{owner}/{repo} --jq .full_name, .default_branch' "$GH_LOG" || fail "check did not read the repository: $(cat "$GH_LOG")"
  mkdir "$proj/sub"
  [ "$(CWD=$proj/sub code_of check)" -eq 0 ] || fail "check refused a subfolder"
  touch "$proj/unrelated"
  [ "$(code_of check)" -eq 0 ] || fail "check refused an untracked file that setup does not touch"
  REPO_FAIL=1 stops_after "HTTP 404: Not Found" "setup: origin is not a GitHub repository that gh can read" check
}

case_trees() {
  new_project trees
  git -C "$proj" worktree add -q "$tmp/linked" -b side
  linked=$(git -C "$tmp/linked" rev-parse --show-toplevel)
  CWD=$tmp/linked stops "setup: run setup in the main checkout, not in a linked worktree: $linked" check

  mkdir "$tmp/plain"
  ceiling=$(cd "$tmp" && pwd -P)
  GIT_CEILING_DIRECTORIES=$ceiling CWD=$tmp/plain capture check
  [ "$cap_code" -eq 1 ] || fail "check did not exit 1 outside a git repository"
  [[ $cap_err == fatal:* ]] || fail "check did not pass on the fatal line of git"
}

case_branch() {
  new_project branch
  git -C "$proj" checkout -q -b other
  stops "setup: the main checkout is on other, not on main; switch to main first" check
  git -C "$proj" checkout -q --detach
  stops "setup: the main checkout is on a detached HEAD, not on main; switch to main first" check
  git -C "$proj" checkout -q main
  TRUNK=trunk stops "setup: the main checkout is on main, not on trunk; switch to trunk first" check
}

case_fetch() {
  new_project fetch
  git -C "$proj" remote set-url origin "$tmp/missing.git"
  stops_after "does not appear to be a git repository" "setup: cannot fetch main from origin" check
}

case_behind() {
  new_project behind
  git clone -q "$tmp/behind.git" "$tmp/behind-other"
  git -C "$tmp/behind-other" commit -q --allow-empty -m upstream
  git -C "$tmp/behind-other" push -q origin HEAD:main
  want="setup: the local main is behind origin/main or has diverged from it; run git pull first"
  stops "$want" check
  git -C "$proj" commit -q --allow-empty -m local
  stops "$want" check
}

case_ahead() {
  new_project ahead
  git -C "$proj" commit -q --allow-empty -m one
  capture check
  [ "$cap_code" -eq 0 ] || fail "check refused a local trunk that is ahead"
  want=$'setup: warning: the local main is 1 commit ahead of origin/main; the push carries it:\n  one'
  [[ $cap_out == "$want" ]] || fail "wrong warning for one commit ahead: $cap_out"
  git -C "$proj" commit -q --allow-empty -m two
  capture check
  [ "$cap_code" -eq 0 ] || fail "check refused a local trunk that is 2 commits ahead"
  want=$'setup: warning: the local main is 2 commits ahead of origin/main; the push carries them:\n  one\n  two'
  [[ $cap_out == "$want" ]] || fail "wrong warning for 2 commits ahead: $cap_out"
  [ -z "$cap_err" ] || fail "the warning went to stderr"
}

case_dirty() {
  new_project dirty
  echo node_modules/ >"$proj/.gitignore"
  git -C "$proj" add .gitignore
  git -C "$proj" commit -qm ignore
  echo dist/ >>"$proj/.gitignore"
  echo notes >"$proj/AGENTS.md"
  echo 'landing: pr' >"$proj/.celetis.yaml"
  want="setup: commit or drop the uncommitted changes of these files first: .gitignore .celetis.yaml AGENTS.md"
  stops "$want" check
  mkdir "$proj/sub"
  CWD=$proj/sub stops "$want" check
}

case_staged() {
  new_project staged
  echo x >"$proj/other.txt"
  git -C "$proj" add other.txt
  stops "setup: the index holds staged changes; commit or unstage them first" check
}

case_usage() {
  new_project usage
  want='usage: scripts/celetis setup check | write <options> | try <options> | try --remove | lane <path> | push; <options>: --hosts claude|codex|claude,codex [--default claude|codex] --landing pr|merge [--setup-file <file>] [--ignore <line>]... [--baseline-file <file>]'
  [ "$(code_of)" -eq 2 ] && [ "$(code_of bogus)" -eq 2 ] && [ "$(code_of check extra)" -eq 2 ] && [ "$(code_of push extra)" -eq 2 ] || fail "usage not refused"
  [[ $(err_of bogus) == "$want" ]] || fail "wrong usage line: $(err_of bogus)"

  for args in "write --hosts claude,codex --landing pr" "write --hosts claude --default codex --landing pr" "write --hosts claude --landing squash" \
    "write --hosts gitlab --landing pr" "write --hosts claude" "write --landing pr" "write --hosts claude --landing pr extra" "write --hosts claude,codex --default gitlab --landing pr" \
    "write --hosts codex --landing pr --setup-file" "write --hosts codex --landing pr --ignore" "write --hosts codex --landing pr --baseline-file"; do
    # shellcheck disable=SC2086 # args is a list of words
    [ "$(code_of $args)" -eq 2 ] || fail "'$args' did not exit 2"
  done
  for option in --setup-file --ignore --baseline-file; do
    [ "$(code_of write --hosts codex --landing pr "$option" '')" -eq 2 ] || fail "an empty value of $option did not exit 2"
  done
  [[ $(err_of write --hosts claude --default codex --landing pr) == "$want" ]] || fail "wrong usage line for write"
  [[ $(err_of write --hosts codex --landing pr --ignore '') == "$want" ]] || fail "wrong usage line for an empty --ignore"
}

readme_fence() {
  awk -v heading="$1" 'index($0, heading) == 1 { seen = 1; next } seen && /^```/ { if (open) exit; open = 1; next } open' "$here/README.md"
}
rules=$(readme_fence '### Codex permissions')
ignores=$(readme_fence '### `.gitignore`')
[ "$(printf '%s\n' "$rules" | grep -c '')" -eq 13 ] && [ "$(printf '%s\n' "$ignores" | grep -c '')" -eq 5 ] || fail "the README fences changed; update this test"
heading='## Celetis flow'
lanes="- The lanes are the skills of the plugin \`celetis\`, on the issues of \`$REPO\`."
landing='- `landing` in `.celetis.yaml` names the landing mechanism, and a build step ends with `scripts/celetis land`.'
never='- A lane never skips a step.'
maintainer='- The maintainer starts the runner; an agent starts it only when its task says so, with a number, and in a terminal.'
b=$lanes$'\n'$landing$'\n'$never$'\n'$maintainer$'\n'
gitattributes=$'scripts/celetis text eol=lf\n.celetis.yaml text eol=lf'
config_entries='[{"path": ["host"]}, {"path": ["landing"]}]'
host_differs='setup: warning: .celetis.yaml: host is codex, not claude; setup leaves it'
landing_differs='setup: warning: .celetis.yaml: landing is merge, not pr; setup leaves it'

commit_all() { git -C "$proj" add -A && git -C "$proj" commit -qm "$1"; }
sorted() { jq -S 'if type == "array" then sort else .files |= sort | .entries |= map_values(sort) end'; }
jlines() { jq -Rn '[inputs]'; }
record_is() {
  [ "$(sorted <"$proj/.claude/celetis-flow/wiring.json")" = "$(sorted <<<"$1")" ] || fail "wrong record: $(cat "$proj/.claude/celetis-flow/wiring.json")"
}
bytes_are() { printf '%s' "$1" | cmp -s - "$proj/$2" || fail "wrong bytes in $2: $(cat "$proj/$2")"; }
entries_of() { jq -S --arg file "$1" '.entries[$file]' "$proj/.claude/celetis-flow/wiring.json" | sorted; }
clean_tree() { [ -z "$(git -C "$proj" status --porcelain)" ] || fail "$1: $(git -C "$proj" status --porcelain)"; }
host_is() { grep -qxF "host: $1" "$proj/.celetis.yaml" || fail "wrong host line in .celetis.yaml: $(cat "$proj/.celetis.yaml")"; }

case_empty() {
  new_project empty
  out=$(run write --hosts codex --landing merge 2>"$tmp/err") || fail "write failed on an empty project: $(cat "$tmp/err")"
  [ ! -s "$tmp/err" ] || fail "write printed on stderr: $(cat "$tmp/err")"
  cmp -s "$plug/scripts/celetis" "$proj/scripts/celetis" && [ -x "$proj/scripts/celetis" ] || fail "the launcher is no executable copy"
  bytes_are $'host: codex\nlanding: merge\n' .celetis.yaml
  [ ! -e "$proj/.claude/celetis-flow/landing.json" ] || fail "write made landing.json"
  ! git -C "$proj" config celetis-flow.agent >/dev/null || fail "setup set celetis-flow.agent"
  bytes_are "$rules"$'\n' .codex/rules/celetis.rules
  bytes_are "$ignores"$'\n' .gitignore
  bytes_are "$gitattributes"$'\n' .gitattributes
  bytes_are "$heading"$'\n\n'"$b" AGENTS.md
  [ ! -e "$proj/.claude/settings.json" ] || fail "write made .claude/settings.json for codex only"
  expected=$(jq -n --argjson ignores "$(jlines <<<"$ignores")" --argjson agents "$(printf '%s\n%s' "$heading" "$b" | jlines)" \
    --argjson gitattributes "$(jlines <<<"$gitattributes")" --argjson config "$config_entries" '{
      schema: 1,
      answers: {hosts: ["codex"], tracker: "github"},
      files: [".claude/celetis-flow/wiring.json", ".codex/rules/celetis.rules", "scripts/celetis"],
      entries: {".gitignore": $ignores, ".gitattributes": $gitattributes, "AGENTS.md": $agents, ".celetis.yaml": $config}
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
}

case_own() {
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
}

agents_case() {
  new_project "agents$1"
  printf '%s' "$2" >"$proj/AGENTS.md"
  commit_all product
  run write --hosts codex --landing pr >/dev/null
  bytes_are "$3" AGENTS.md
}
case_agents1() { agents_case 1 $'# P\n- x\n' $'# P\n- x\n\n'"$heading"$'\n\n'"$b"; }
case_agents2() { agents_case 2 $'# P\n\n' $'# P\n\n'"$heading"$'\n\n'"$b"; }
case_agents3() { agents_case 3 $'## Celetis flow\n\n## Deploy\n' "$heading"$'\n\n'"$b"$'\n## Deploy\n'; }
case_agents4() { agents_case 4 $'## Celetis flow\n\n### Notes\n- note\n\n# Next\n' "$heading"$'\n\n### Notes\n- note\n'"$b"$'\n# Next\n'; }
case_agents5() { agents_case 5 $'## Celetis flow\n- A lane never skips a step.' "$heading"$'\n'"$never"$'\n'"$lanes"$'\n'"$landing"$'\n'"$maintainer"$'\n'; }
case_agents6() { agents_case 6 $'## Celetis flow\n\n- The maintainer starts the runner; an agent starts it only when its task says\n  so, with a number, and in a terminal.\n' \
  "$heading"$'\n\n- The maintainer starts the runner; an agent starts it only when its task says\n  so, with a number, and in a terminal.\n'"$b"; }
case_agents7() { agents_case 7 $'## Celetis flow\n\n  *   A lane never skips a step.  \r\n' "$heading"$'\n\n  *   A lane never skips a step.  \r\n'"$lanes"$'\n'"$landing"$'\n'"$maintainer"$'\n'; }
case_agents8() { agents_case 8 $'# P\n\n- A lane never skips a step.\n' $'# P\n\n- A lane never skips a step.\n\n'"$heading"$'\n\n'"$b"; }
case_agents9() {
  local fenced=$'# P\n\n## Celetis flow\n\n- A lane never skips a step.\n\nThe config of this project:\n\n```yaml\n# pr: each check must be green\nlanding: pr\n```\n\n- Run the gate before a review.\n'
  agents_case 9 "$fenced" "$fenced$lanes"$'\n'"$landing"$'\n'"$maintainer"$'\n'
}
case_agents10() {
  local fenced=$'# P\n\n```markdown\n## Celetis flow\n\n- A lane never skips a step.\n```\n'
  agents_case 10 "$fenced" "$fenced"$'\n'"$heading"$'\n\n'"$b"
}
case_agents11() {
  local fenced=$'## Celetis flow\n\n~~~\n- A lane never skips a step.\n~~~\n'
  agents_case 11 "$fenced" "$fenced$b"
}
case_agents12() {
  local fenced=$'## Celetis flow\n\n````markdown\n~~~~~\n# One\n```\n# Two\n````\n'
  agents_case 12 "$fenced" "$fenced$b"
}
case_agents13() {
  local fenced=$'# P\n\n```sh\nmake\n'
  agents_case 13 "$fenced" "$fenced"$'\n'"$heading"$'\n\n'"$b"
  commit_all wiring
  run write --hosts codex --landing pr >/dev/null
  bytes_are "$fenced"$'\n'"$heading"$'\n\n'"$b" AGENTS.md
}

case_claude() {
  new_project claude
  printf '# C' >"$proj/CLAUDE.md"
  mkdir "$proj/.claude"
  printf '# Dot\n@AGENTS.md\n' >"$proj/.claude/CLAUDE.md"
  commit_all product
  run write --hosts claude --landing pr >/dev/null
  bytes_are $'# C\n@AGENTS.md\n' CLAUDE.md
  bytes_are $'# Dot\n@AGENTS.md\n' .claude/CLAUDE.md
  [ "$(entries_of CLAUDE.md)" = "$(echo '["@AGENTS.md"]' | sorted)" ] && [ "$(entries_of .claude/CLAUDE.md)" = "$(entries_of CLAUDE.md)" ] || fail "wrong CLAUDE entries"
  host_is claude
}

case_claudedot() {
  new_project claudedot
  mkdir "$proj/.claude"
  printf '@AGENTS.md\n' >"$proj/.claude/CLAUDE.md"
  commit_all product
  run write --hosts claude --landing pr >/dev/null
  [ ! -e "$proj/CLAUDE.md" ] || fail "write made a CLAUDE.md"
  bytes_are $'@AGENTS.md\n' .claude/CLAUDE.md
  [ "$(jq -c '.entries | has("CLAUDE.md"), has(".claude/CLAUDE.md")' "$proj/.claude/celetis-flow/wiring.json" | paste -sd ' ' -)" = "false true" ] || fail "wrong CLAUDE record"
}

case_codexclaude() {
  new_project codexclaude
  printf '# C\n' >"$proj/CLAUDE.md"
  commit_all product
  run write --hosts codex --landing pr >/dev/null
  bytes_are $'# C\n' CLAUDE.md
  [ "$(jq '.entries | has("CLAUDE.md")' "$proj/.claude/celetis-flow/wiring.json")" = false ] || fail "codex recorded a CLAUDE file"
}

case_symlink() {
  new_project symlink
  printf '# P\n' >"$proj/AGENTS.md"
  ln -s AGENTS.md "$proj/CLAUDE.md"
  commit_all product
  out=$(run write --hosts claude --landing pr)
  ! grep -qF 'is a symbolic link' <<<"$out" || fail "write warned on a CLAUDE.md that links to AGENTS.md: $out"
  bytes_are "# P"$'\n\n'"$heading"$'\n\n'"$b" AGENTS.md
  [ -L "$proj/CLAUDE.md" ] || fail "write replaced a symlinked CLAUDE.md"
  [ "$(jq '.entries | has("CLAUDE.md")' "$proj/.claude/celetis-flow/wiring.json")" = false ] || fail "write recorded a symlinked CLAUDE.md"
}

case_symlinkignored() {
  new_project symlinkignored
  printf '# P\n' >"$proj/AGENTS.md"
  echo CLAUDE.md >"$proj/.gitignore"
  ln -s AGENTS.md "$proj/CLAUDE.md"
  commit_all product
  [ "$(code_of write --hosts claude --landing pr)" -eq 0 ] || fail "write refused an ignored symlinked CLAUDE.md"
}

case_agentslink() {
  new_project agentslink
  printf '# C\n' >"$proj/CLAUDE.md"
  ln -s CLAUDE.md "$proj/AGENTS.md"
  commit_all product
  run write --hosts claude --landing pr >/dev/null
  [ -L "$proj/AGENTS.md" ] || fail "write replaced a symlinked AGENTS.md"
  bytes_are "# C"$'\n\n'"$heading"$'\n\n'"$b" CLAUDE.md
  [ "$(jq '.entries | has("CLAUDE.md")' "$proj/.claude/celetis-flow/wiring.json")" = false ] || fail "write recorded @AGENTS.md in the file of AGENTS.md"
}

case_claudelink() {
  new_project claudelink
  mkdir "$proj/docs"
  printf '# C\n' >"$proj/docs/claude.md"
  ln -s docs/claude.md "$proj/CLAUDE.md"
  commit_all product
  out=$(run write --hosts claude --landing pr)
  grep -qxF 'setup: warning: CLAUDE.md is a symbolic link to a file other than AGENTS.md; setup leaves it, so Claude reads AGENTS.md only if that file holds @AGENTS.md' <<<"$out" ||
    fail "no warning for a CLAUDE.md that links to another file: $out"
  bytes_are $'# C\n' docs/claude.md
}

case_crlf() {
  new_project crlf
  printf '%s\n' "$ignores" | awk '{ printf "%s\r\n", $0 }' >"$proj/.gitignore"
  [ "$(grep -c $'\r' "$proj/.gitignore")" -eq 5 ] || fail "the CRLF fixture has no CR"
  cp "$proj/.gitignore" "$tmp/crlf.gitignore"
  commit_all product
  run write --hosts codex --landing pr >/dev/null
  cmp -s "$tmp/crlf.gitignore" "$proj/.gitignore" || fail "write changed a CRLF .gitignore"
  [ "$(entries_of .gitignore)" = "$(jlines <<<"$ignores" | sorted)" ] || fail "wrong entries for a CRLF .gitignore"
}

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

case_settings() {
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
  run write --hosts claude --landing pr >/dev/null
  cmp -s "$tmp/settings.want" "$proj/.claude/settings.json" || fail "wrong .claude/settings.json: $(cat "$proj/.claude/settings.json")"
  [ "$(readme_fence '### Claude permissions' | jq -S .)" = "$(jq -S . "$tmp/settings.want")" ] || fail "the README object changed; update this test"
  [ "$(entries_of .claude/settings.json)" = "$(sorted <<<"$settings_entries")" ] || fail "wrong settings entries: $(entries_of .claude/settings.json)"
  jq -e '.files | index(".claude/settings.json") == null' "$proj/.claude/celetis-flow/wiring.json" >/dev/null || fail "write recorded .claude/settings.json as an owned file"
}

case_settingsproduct() {
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
}

case_settingstab() {
  new_project settingstab
  mkdir "$proj/.claude"
  printf '{\n\t"env": {\n\t\t"CI": "1"\n\t}\n}\n' >"$proj/.claude/settings.json"
  commit_all product
  run write --hosts claude --landing pr >/dev/null
  [[ $(sed -n 2p "$proj/.claude/settings.json") == $'\t"env"'* ]] || fail "write changed a tab indent: $(sed -n 2p "$proj/.claude/settings.json")"
}

case_settingshand() {
  new_project settingshand
  mkdir "$proj/.claude"
  cp "$here/.claude/settings.json" "$proj/.claude/settings.json"
  commit_all product
  run write --hosts claude --landing pr >/dev/null
  cmp -s "$here/.claude/settings.json" "$proj/.claude/settings.json" || fail "write changed a hand-wired settings file"
  [ "$(entries_of .claude/settings.json)" = "$(sorted <<<"$settings_entries")" ] || fail "wrong entries for a hand-wired file"
}

differs='setup: warning: .claude/settings.json: enabledPlugins.celetis@celetis differs from the current form; setup leaves it'

case_settingsdiffers() {
  new_project settingsdiffers
  mkdir "$proj/.claude"
  printf '{"enabledPlugins": {"celetis@celetis": false}}\n' >"$proj/.claude/settings.json"
  commit_all product
  out=$(run write --hosts claude --landing pr 2>"$tmp/err") || fail "write failed on a differing entry: $(cat "$tmp/err")"
  grep -qxF "$differs" <<<"$out" || fail "no warning for a differing entry: $out"
  [ "$(jq -c .enabledPlugins "$proj/.claude/settings.json")" = '{"celetis@celetis":false,"superpowers@superpowers-marketplace":true}' ] || fail "write changed a differing entry"
  [ "$(entries_of .claude/settings.json)" = "$(jq 'map(select(.path != ["enabledPlugins", "celetis@celetis"]))' <<<"$settings_entries" | sorted)" ] ||
    fail "write recorded a differing entry: $(entries_of .claude/settings.json)"
}

case_settingsrecorded() {
  new_project settingsrecorded
  run write --hosts claude --landing pr >/dev/null
  jq '.enabledPlugins["celetis@celetis"] = false' "$proj/.claude/settings.json" >"$tmp/changed.json"
  cp "$tmp/changed.json" "$proj/.claude/settings.json"
  commit_all wiring
  out=$(run write --hosts claude --landing pr)
  grep -qxF "$differs" <<<"$out" || fail "no warning for a changed owned entry: $out"
  [ "$(entries_of .claude/settings.json)" = "$(sorted <<<"$settings_entries")" ] || fail "write dropped a recorded entry"
}

case_settingsbad() {
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
}

case_ignored() {
  new_project ignored
  echo '.claude/' >"$proj/.gitignore"
  commit_all product
  stops "setup: git ignores .claude/celetis-flow/wiring.json; make git track it first" write --hosts codex --landing merge
  clean_tree "an ignored path left a file"
}

case_ignoredconfig() {
  new_project ignoredconfig
  echo '.celetis.yaml' >"$proj/.gitignore"
  commit_all product
  stops "setup: git ignores .celetis.yaml; make git track it first" write --hosts codex --landing merge
  clean_tree "an ignored config left a file"
}

case_ignoredscripts() {
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
}

case_ignoredstore() {
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
}

case_linkedfolder() {
  new_project linkedfolder
  mkdir -p "$proj/config/claude"
  printf '{}\n' >"$proj/config/claude/settings.json"
  ln -s config/claude "$proj/.claude"
  commit_all product
  LABELS= stops_after 'is beyond a symbolic link' \
    'setup: .claude/celetis-flow/wiring.json lies beyond a symbolic link or in a submodule; setup writes no file there' write --hosts claude --landing pr
  clean_tree "a linked folder left a file"
  [ ! -s "$LABEL_LOG" ] || fail "a linked folder left a label: $(cat "$LABEL_LOG")"
}

case_linkedagents() {
  new_project linkedagents
  mkdir "$proj/docs"
  printf '# Rules\n' >"$proj/docs/agents.md"
  ln -s docs/agents.md "$proj/AGENTS.md"
  commit_all product
  LABELS= stops 'setup: AGENTS.md is a symbolic link; setup writes no file through a link' write --hosts codex --landing pr
  clean_tree "a linked AGENTS.md left a file"
  [ ! -s "$LABEL_LOG" ] || fail "a linked AGENTS.md left a label: $(cat "$LABEL_LOG")"
}

case_submodule() {
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
}

case_union() {
  new_project union
  run write --hosts claude,codex --default codex --landing merge >/dev/null
  bytes_are $'host: codex\nlanding: merge\n' .celetis.yaml
  echo '# own' >>"$proj/.codex/rules/celetis.rules"
  commit_all wiring
  git -C "$proj" push -q origin main
  rules_bytes=$(cat "$proj/.codex/rules/celetis.rules")
  out=$(run write --hosts claude --landing pr)
  [ "$(cat "$proj/.codex/rules/celetis.rules")" = "$rules_bytes" ] || fail "write changed the rules file of an unchosen host"
  [ "$(jq -c '(.files | index(".codex/rules/celetis.rules") != null), .answers.hosts' "$proj/.claude/celetis-flow/wiring.json" | paste -sd ' ' -)" = 'true ["claude"]' ] || fail "wrong union record"
  bytes_are $'host: codex\nlanding: merge\n' .celetis.yaml
  host_is codex
  grep -qxF "$host_differs" <<<"$out" || fail "no warning for a differing host: $out"
  grep -qxF "$landing_differs" <<<"$out" || fail "no warning for a differing landing: $out"
  [ "$(entries_of .celetis.yaml)" = "$(sorted <<<"$config_entries")" ] || fail "write dropped a recorded config entry: $(entries_of .celetis.yaml)"
}

case_badrecord() {
  new_project badrecord
  mkdir -p "$proj/.claude/celetis-flow"
  want='setup: .claude/celetis-flow/wiring.json is no record of setup; fix or remove it first'
  for bad in '[]' 'not json' '{"schema": 2, "files": [], "entries": {}}' '{"schema": 1}' '{"schema": 1, "files": [1], "entries": {}}' '{"schema": 1, "files": [], "entries": {"a": "b"}}'; do
    printf '%s\n' "$bad" >"$proj/.claude/celetis-flow/wiring.json"
    commit_all "bad $bad"
    stops "$want" write --hosts codex --landing pr
    clean_tree "a bad record left a file"
  done
}

index_head=$'# Lessons\n\n| Lesson | Tags | Date | Summary |\n|---|---|---|---|\n'
unrecorded_stores() {
  jq -e '[.files[], (.entries | keys[])] | all(startswith("docs/") | not)' "$proj/.claude/celetis-flow/wiring.json" >/dev/null ||
    fail "$1: the record names a store file"
}

case_stores() {
  new_project stores
  run write --hosts codex --landing pr >/dev/null
  cmp -s "$plug/docs/adr/README.md" "$proj/docs/adr/README.md" || fail "write made no copy of the ADR README"
  cmp -s "$plug/docs/adr/template.md" "$proj/docs/adr/template.md" || fail "write made no copy of the ADR template"
  ! grep -q harness "$proj/docs/adr/README.md" || fail "the ADR README of a product speaks of the harness"
  bytes_are "$index_head" docs/lessons/INDEX.md
  unrecorded_stores "an empty project"
}

case_productstores() {
  new_project productstores
  mkdir -p "$proj/docs/adr"
  printf '# Our decisions\n' >"$proj/docs/adr/README.md"
  commit_all product
  run write --hosts codex --landing pr >/dev/null
  bytes_are $'# Our decisions\n' docs/adr/README.md
  cmp -s "$plug/docs/adr/template.md" "$proj/docs/adr/template.md" || fail "write made no template next to a product README"
  bytes_are "$index_head" docs/lessons/INDEX.md
  unrecorded_stores "a product store"
}

case_producttemplate() {
  new_project producttemplate
  mkdir -p "$proj/docs/adr" "$proj/docs/lessons"
  printf '# Our template\n' >"$proj/docs/adr/template.md"
  printf '# Our lessons\n' >"$proj/docs/lessons/INDEX.md"
  commit_all product
  run write --hosts codex --landing pr >/dev/null
  bytes_are $'# Our template\n' docs/adr/template.md
  bytes_are $'# Our lessons\n' docs/lessons/INDEX.md
}

case_handwired() {
  new_project handwired
  mkdir -p "$proj/.claude" "$proj/.codex/rules" "$proj/scripts" "$proj/docs/adr" "$proj/docs/lessons"
  cp "$here/.claude/settings.json" "$proj/.claude/settings.json"
  printf '%s\n' "$ignores" >"$proj/.gitignore"
  printf '%s\n' "$rules" >"$proj/.codex/rules/celetis.rules"
  cp "$plug/scripts/celetis" "$proj/scripts/celetis"
  printf 'host: claude\nlanding: pr\n' >"$proj/.celetis.yaml"
  cp "$plug/docs/adr/README.md" "$plug/docs/adr/template.md" "$proj/docs/adr/"
  printf '%s' "$index_head" >"$proj/docs/lessons/INDEX.md"
  printf '* text=auto eol=lf\n' >"$proj/.gitattributes"
  printf '%s\n\n%s' "$heading" "$b" >"$proj/AGENTS.md"
  commit_all hand
  git -C "$proj" push -q origin main
  run write --hosts claude,codex --default claude --landing pr >/dev/null
  [ "$(git -C "$proj" status --porcelain --untracked-files=all)" = " M .gitattributes"$'\n''?? .claude/celetis-flow/wiring.json' ] || fail "wrong changes to a hand-wired project: $(git -C "$proj" status --porcelain --untracked-files=all)"
  bytes_are $'* text=auto eol=lf\n'"$gitattributes"$'\n' .gitattributes
  bytes_are $'host: claude\nlanding: pr\n' .celetis.yaml
  expected=$(jq -n --argjson ignores "$(jlines <<<"$ignores")" --argjson agents "$(printf '%s\n%s' "$heading" "$b" | jlines)" \
    --argjson gitattributes "$(jlines <<<"$gitattributes")" --argjson settings "$settings_entries" --argjson config "$config_entries" '{
      schema: 1,
      answers: {hosts: ["claude", "codex"], tracker: "github"},
      files: [".claude/celetis-flow/wiring.json", ".codex/rules/celetis.rules", "scripts/celetis"],
      entries: {".gitignore": $ignores, ".gitattributes": $gitattributes, "AGENTS.md": $agents, ".claude/settings.json": $settings, ".celetis.yaml": $config}
    }')
  record_is "$expected"
  unrecorded_stores "a hand-wired project"
}

case_configref() {
  new_project configref
  printf 'host: codex\nlanding: pr\nboard:\n  port: 4404\n' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  run write --hosts claude,codex --default codex --landing pr >/dev/null
  bytes_are $'host: codex\nlanding: pr\nboard:\n  port: 4404\n' .celetis.yaml
  [ "$(entries_of .celetis.yaml)" = "$(sorted <<<"$config_entries")" ] || fail "wrong config entries for a hand-wired config: $(entries_of .celetis.yaml)"
  commit_all wiring
  git -C "$proj" push -q origin main
  [ "$(run write --hosts claude,codex --default codex --landing pr 2>&1)" = "setup: no file changed" ] || fail "a rerun changed a hand-wired config"
}

case_configappend() {
  new_project configappend
  printf '# ours\nlanding: pr\ncustom:\n  bug: |-\n    Keep it small.' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  run write --hosts claude --landing pr >/dev/null
  bytes_are $'# ours\nlanding: pr\ncustom:\n  bug: |-\n    Keep it small.\nhost: claude\n' .celetis.yaml
  [ "$(. "$plug/scripts/celetis" && celetis_config_read "$proj" | jq -r .custom.bug)" = "Keep it small." ] || fail "the appended line broke the config"
}

case_configdiffers() {
  new_project configdiffers
  printf 'host: codex\nlanding: merge\n' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  out=$(run write --hosts claude --landing pr 2>"$tmp/err") || fail "write failed on a differing config: $(cat "$tmp/err")"
  grep -qxF "$host_differs" <<<"$out" || fail "no warning for a differing host: $out"
  grep -qxF "$landing_differs" <<<"$out" || fail "no warning for a differing landing: $out"
  bytes_are $'host: codex\nlanding: merge\n' .celetis.yaml
  jq -e '.entries | has(".celetis.yaml") | not' "$proj/.claude/celetis-flow/wiring.json" >/dev/null || fail "write recorded a differing config"
}

case_configinvalid() {
  new_project configinvalid
  printf 'landing: squash\n' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  : >"$LABEL_LOG"
  want='setup: cannot read .celetis.yaml; fix the cause above first'
  LABELS= stops_after 'landing: invalid value' "$want" write --hosts codex --landing pr
  [ ! -s "$LABEL_LOG" ] || fail "an invalid config left a label: $(cat "$LABEL_LOG")"
  clean_tree "an invalid config left a file"
  printf 'host: codex\n' >"$proj/.celetis.yaml"
  commit_all nolanding
  git -C "$proj" push -q origin main
  LABELS= stops_after 'landing: required field' "$want" write --hosts codex --landing pr
  [ ! -s "$LABEL_LOG" ] || fail "a config with no landing left a label: $(cat "$LABEL_LOG")"
  clean_tree "a config with no landing left a file"
}

case_confignoappend() {
  new_project confignoappend
  printf '{landing: pr}\n' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  : >"$LABEL_LOG"
  LABELS= stops 'setup: cannot add the line host: codex to .celetis.yaml; add it by hand first' write --hosts codex --landing pr
  [ ! -s "$LABEL_LOG" ] || fail "a config that takes no line left a label: $(cat "$LABEL_LOG")"
  clean_tree "a config that takes no line left a file"
}

case_configvalue() {
  new_project configvalue
  printf 'landing: pr\ncustom:\n  bug: |\n    Keep' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  : >"$LABEL_LOG"
  LABELS= stops 'setup: cannot add the line host: claude to .celetis.yaml; add it by hand first' write --hosts claude --landing pr
  [ ! -s "$LABEL_LOG" ] || fail "a line that changes a value left a label: $(cat "$LABEL_LOG")"
  clean_tree "a line that changes a value left a file"
}

case_confignobun() {
  new_project confignobun
  PATH="$fixtures/nobun:$PATH" run write --hosts codex --landing merge >/dev/null 2>"$tmp/err" || fail "write needed Bun for a new config: $(cat "$tmp/err")"
  bytes_are $'host: codex\nlanding: merge\n' .celetis.yaml
}

case_confignobunread() {
  new_project confignobunread
  printf 'landing: pr\n' >"$proj/.celetis.yaml"
  commit_all product
  LABELS= PATH="$fixtures/nobun:$PATH" stops_after 'Bun stopped with exit 1' 'setup: cannot read .celetis.yaml; fix the cause above first' write --hosts codex --landing pr
  [ ! -s "$LABEL_LOG" ] || fail "a config read with no Bun left a label: $(cat "$LABEL_LOG")"
  clean_tree "a config read with no Bun left a file"
}

case_configcrlf() {
  new_project configcrlf
  printf 'host: claude\r\nlanding: pr\r\n' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  : >"$LABEL_LOG"
  want='setup: the index holds .celetis.yaml with CRLF line endings; convert it to LF and commit it first'
  stops "$want" check
  LABELS= stops "$want" write --hosts claude --landing pr
  [ ! -s "$LABEL_LOG" ] || fail "a CRLF config left a label: $(cat "$LABEL_LOG")"
  clean_tree "a CRLF config left a file"
  printf 'host: claude\nlanding: pr\r\n' >"$proj/.celetis.yaml"
  commit_all mixed
  LABELS= stops "$want" write --hosts claude --landing pr
  [ ! -s "$LABEL_LOG" ] || fail "a config with mixed line endings left a label: $(cat "$LABEL_LOG")"
  clean_tree "a config with mixed line endings left a file"
}

case_configcrlfcheckout() {
  new_project configcrlfcheckout
  git -C "$proj" config core.autocrlf true
  git -C "$proj" config core.safecrlf false
  printf 'landing: pr\n' >"$proj/.celetis.yaml"
  commit_all product
  rm "$proj/.celetis.yaml"
  git -C "$proj" checkout -- .celetis.yaml
  [ "$(grep -c $'\r' "$proj/.celetis.yaml")" -eq 1 ] || fail "the CRLF checkout fixture has no CR"
  run write --hosts claude --landing pr >/dev/null 2>"$tmp/err" || fail "write stopped on a CRLF checkout of an LF config: $(cat "$tmp/err")"
  bytes_are $'landing: pr\r\nhost: claude\n' .celetis.yaml
}

setup_reads_back() {
  jq -e --rawfile want "$1" '.worktreeSetup == $want' <<<"$(. "$plug/scripts/celetis" && celetis_config_read "$proj")" >/dev/null ||
    fail "worktreeSetup differs from $1"
}
setup_case() {
  new_project "setup$1"
  printf '%s' "$2" >"$tmp/setup.sh"
  run write --hosts codex --landing merge --setup-file "$tmp/setup.sh" >/dev/null 2>"$tmp/err" || fail "write failed for setup file $1: $(cat "$tmp/err")"
  bytes_are $'host: codex\nlanding: merge\n'"$3" .celetis.yaml
  setup_reads_back "$tmp/setup.sh"
  [ "$(entries_of .celetis.yaml)" = "$(sorted <<<"$config_entries")" ] || fail "write recorded worktreeSetup for setup file $1"
}
case_setup1() { setup_case 1 $'set -e\necho hi\n' $'worktreeSetup: |\n  set -e\n  echo hi\n'; }
case_setup2() { setup_case 2 $'set -e\necho hi' $'worktreeSetup: |-\n  set -e\n  echo hi\n'; }
case_setup3() { setup_case 3 $'echo hi\n\n\n' $'worktreeSetup: |+\n  echo hi\n\n\n'; }
case_setup4() { setup_case 4 $'   lead\nnext\n' $'worktreeSetup: |2\n     lead\n  next\n'; }
case_setup5() { setup_case 5 '' $'worktreeSetup: |-\n'; }
case_setup6() { setup_case 6 $'\n\necho hi\n\tindented\n' $'worktreeSetup: |\n\n\n  echo hi\n  \tindented\n'; }
case_setup7() { setup_case 7 $'# not a comment\necho "a: b" # c\n\necho done\n' $'worktreeSetup: |\n  # not a comment\n  echo "a: b" # c\n\n  echo done\n'; }
case_setup8() { setup_case 8 $'\n   \n  x\n' $'worktreeSetup: |2\n\n     \n    x\n'; }
printf 'set -e\necho hi\n' >"$fixtures/setup1.sh"
printf 'set -e\necho hi' >"$fixtures/setup2.sh"

case_setupappend() {
  new_project setupappend
  printf 'landing: pr\ncustom:\n  bug: |-\n    Keep it small.' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  run write --hosts claude --landing pr --setup-file "$fixtures/setup1.sh" >/dev/null
  bytes_are $'landing: pr\ncustom:\n  bug: |-\n    Keep it small.\nhost: claude\nworktreeSetup: |\n  set -e\n  echo hi\n' .celetis.yaml
  setup_reads_back "$fixtures/setup1.sh"
  [ "$(. "$plug/scripts/celetis" && celetis_config_read "$proj" | jq -r .custom.bug)" = "Keep it small." ] || fail "the appended block broke the config"
  commit_all wiring
  git -C "$proj" push -q origin main
  [ "$(run write --hosts claude --landing pr --setup-file "$fixtures/setup1.sh" 2>&1)" = "setup: no file changed" ] || fail "a rerun with an equal worktreeSetup changed a file or warned"
}

case_setupblockonly() {
  new_project setupblockonly
  printf 'host: codex\nlanding: pr\nboard:\n  port: 4404' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  run write --hosts codex --landing pr --setup-file "$fixtures/setup2.sh" >/dev/null
  bytes_are $'host: codex\nlanding: pr\nboard:\n  port: 4404\nworktreeSetup: |-\n  set -e\n  echo hi\n' .celetis.yaml
  setup_reads_back "$fixtures/setup2.sh"
  [ "$(entries_of .celetis.yaml)" = "$(sorted <<<"$config_entries")" ] || fail "write recorded worktreeSetup for a hand-wired config"
}

case_setupdiffers() {
  new_project setupdiffers
  printf 'host: codex\nlanding: merge\nworktreeSetup: ""\n' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  differs='setup: warning: .celetis.yaml: worktreeSetup differs from the setup file; setup leaves it'
  out=$(run write --hosts codex --landing merge --setup-file "$fixtures/setup1.sh" 2>"$tmp/err") || fail "write failed on an empty worktreeSetup: $(cat "$tmp/err")"
  grep -qxF "$differs" <<<"$out" || fail "no warning for an empty worktreeSetup: $out"
  bytes_are $'host: codex\nlanding: merge\nworktreeSetup: ""\n' .celetis.yaml
  [ "$(entries_of .celetis.yaml)" = "$(sorted <<<"$config_entries")" ] || fail "write recorded a differing worktreeSetup"
  printf 'host: codex\nlanding: merge\nworktreeSetup: |-\n  echo other\n' >"$proj/.celetis.yaml"
  commit_all other
  out=$(run write --hosts codex --landing merge --setup-file "$fixtures/setup1.sh")
  grep -qxF "$differs" <<<"$out" || fail "no warning for another worktreeSetup: $out"
  bytes_are $'host: codex\nlanding: merge\nworktreeSetup: |-\n  echo other\n' .celetis.yaml
}

case_setupsame() {
  new_project setupsame
  printf 'host: codex\nlanding: merge\nworktreeSetup: |\n  set -e\n  echo hi\n' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  out=$(run write --hosts codex --landing merge --setup-file "$fixtures/setup1.sh")
  ! grep -q 'worktreeSetup' <<<"$out" || fail "write warned on an equal worktreeSetup: $out"
  bytes_are $'host: codex\nlanding: merge\nworktreeSetup: |\n  set -e\n  echo hi\n' .celetis.yaml
}

case_setupnone() {
  new_project setupnone
  printf 'host: codex\nlanding: merge\nworktreeSetup: ""\n' >"$proj/.celetis.yaml"
  commit_all product
  git -C "$proj" push -q origin main
  out=$(run write --hosts codex --landing merge)
  ! grep -q 'worktreeSetup' <<<"$out" || fail "write spoke of worktreeSetup with no setup file: $out"
  bytes_are $'host: codex\nlanding: merge\nworktreeSetup: ""\n' .celetis.yaml
}

case_setuprelative() {
  new_project setuprelative
  mkdir "$proj/sub"
  printf 'echo hi\n' >"$proj/sub/rel.sh"
  CWD=$proj/sub run write --hosts codex --landing pr --setup-file rel.sh >/dev/null 2>"$tmp/err" || fail "write failed on a relative setup file: $(cat "$tmp/err")"
  bytes_are $'host: codex\nlanding: pr\nworktreeSetup: |\n  echo hi\n' .celetis.yaml
  commit_all wiring
  CWD=$proj/sub LABELS= stops "setup: cannot read $proj/sub/missing.sh" write --hosts codex --landing pr --setup-file missing.sh
  for file in 'Z:/missing/x' 'Z:\missing\x'; do
    for option in --setup-file --baseline-file; do
      CWD=$proj/sub LABELS= stops "setup: cannot read $file" write --hosts codex --landing pr "$option" "$file"
    done
  done
}

no_add='setup: cannot add worktreeSetup to .celetis.yaml; add it by hand first'
case_setupcrlf() {
  new_project setupcrlf
  printf 'set -e\r\necho hi\r\n' >"$tmp/setupcrlf.sh"
  : >"$LABEL_LOG"
  LABELS= stops "$no_add" write --hosts codex --landing pr --setup-file "$tmp/setupcrlf.sh"
  [ ! -s "$LABEL_LOG" ] || fail "a CRLF setup file left a label: $(cat "$LABEL_LOG")"
  clean_tree "a CRLF setup file left a file"
  printf 'set -e\necho \033[1mhi\n' >"$tmp/setupesc.sh"
  LABELS= stops_after 'invalid character U+001B' "$no_add" write --hosts codex --landing pr --setup-file "$tmp/setupesc.sh"
  clean_tree "a setup file with a raw control character left a file"
  printf 'host: codex\nlanding: pr\n' >"$proj/.celetis.yaml"
  commit_all product
  LABELS= stops "$no_add" write --hosts codex --landing pr --setup-file "$tmp/setupcrlf.sh"
  [ ! -s "$LABEL_LOG" ] || fail "a CRLF setup file left a label: $(cat "$LABEL_LOG")"
  clean_tree "a CRLF setup file left a file in a config"
}

case_setupend() {
  new_project setupend
  printf 'host: codex\nlanding: pr\n...\n' >"$proj/.celetis.yaml"
  commit_all product
  LABELS= stops_after 'need one YAML document' "$no_add" write --hosts codex --landing pr --setup-file "$fixtures/setup1.sh"
  [ ! -s "$LABEL_LOG" ] || fail "a config with an end marker left a label: $(cat "$LABEL_LOG")"
  clean_tree "a config with an end marker left a file"
  [ "$(code_of write --hosts codex --landing pr)" -eq 0 ] || fail "write refused a config with an end marker and no setup file"
}

case_setupvalue() {
  new_project setupvalue
  printf 'host: claude\nlanding: pr\ncustom:\n  bug: |\n    Keep' >"$proj/.celetis.yaml"
  commit_all product
  LABELS= stops "$no_add" write --hosts claude --landing pr --setup-file "$fixtures/setup1.sh"
  [ ! -s "$LABEL_LOG" ] || fail "a block that changes a value left a label: $(cat "$LABEL_LOG")"
  clean_tree "a block that changes a value left a file"
}

case_setupnobun() {
  new_project setupnobun
  LABELS= PATH="$fixtures/nobun:$PATH" stops_after 'Bun stopped with exit 1' "$no_add" write --hosts codex --landing pr --setup-file "$fixtures/setup1.sh"
  clean_tree "a block check with no Bun left a file"
}

case_ignorelines() {
  new_project ignorelines
  printf 'node_modules/\r\n.venv/' >"$proj/.gitignore"
  commit_all product
  run write --hosts codex --landing pr --ignore .venv/ --ignore .mypy_cache/ --ignore .claude/worktrees/ --ignore .mypy_cache/ >/dev/null
  bytes_are $'node_modules/\r\n.venv/\n.claude/worktrees/\n.claude/settings.local.json\ndocs/superpowers/\n.superpowers/\ndocs/lessons/_pending/\n.mypy_cache/\n' .gitignore
  [ "$(entries_of .gitignore)" = "$(jlines <<<"$ignores" | sorted)" ] || fail "write recorded an ignore line: $(entries_of .gitignore)"
  commit_all wiring
  git -C "$proj" push -q origin main
  [ "$(run write --hosts codex --landing pr --ignore .venv/ --ignore .mypy_cache/ 2>&1)" = "setup: no file changed" ] || fail "a rerun with ignore lines changed a file"
}

case_ignorenew() {
  new_project ignorenew
  run write --hosts codex --landing pr --ignore .venv/ >/dev/null
  bytes_are "$ignores"$'\n.venv/\n' .gitignore
  [ "$(entries_of .gitignore)" = "$(jlines <<<"$ignores" | sorted)" ] || fail "write recorded an ignore line in a new .gitignore: $(entries_of .gitignore)"
}

baseline=$'## Baseline of the checks\n\n- mypy src/: 28 errors on 2026-10-20.\n'
printf '%s' "$baseline" >"$fixtures/baseline.md"
baseline_is='## Baseline of the checks is there; setup leaves it'
case_baseline() {
  new_project baseline
  printf '# P\n- x\n' >"$proj/AGENTS.md"
  commit_all product
  out=$(run write --hosts codex --landing pr --baseline-file "$fixtures/baseline.md" 2>"$tmp/err") || fail "write failed with a baseline: $(cat "$tmp/err")"
  ! grep -q 'Baseline' <<<"$out" || fail "write warned on a missing baseline: $out"
  bytes_are $'# P\n- x\n\n'"$heading"$'\n\n'"$b"$'\n'"$baseline" AGENTS.md
  [ "$(entries_of AGENTS.md)" = "$(printf '%s\n%s' "$heading" "$b" | jlines | sorted)" ] || fail "write recorded the baseline: $(entries_of AGENTS.md)"
  commit_all wiring
  git -C "$proj" push -q origin main
  out=$(run write --hosts codex --landing pr --baseline-file "$fixtures/baseline.md")
  grep -qxF "setup: warning: AGENTS.md: $baseline_is" <<<"$out" || fail "no warning for a baseline that is there: $out"
  clean_tree "a rerun with a baseline changed a file"
}

case_baselinenew() {
  new_project baselinenew
  run write --hosts codex --landing pr --baseline-file "$fixtures/baseline.md" >/dev/null
  bytes_are "$heading"$'\n\n'"$b"$'\n'"$baseline" AGENTS.md
}

case_baselineopen() {
  new_project baselineopen
  printf '%s' "${baseline%$'\n'}" >"$tmp/baseline-open.md"
  printf '# P\n' >"$proj/AGENTS.md"
  commit_all product
  run write --hosts codex --landing pr --baseline-file "$tmp/baseline-open.md" >/dev/null
  bytes_are $'# P\n\n'"$heading"$'\n\n'"$b"$'\n'"$baseline" AGENTS.md
}

case_baselinenonl() {
  new_project baselinenonl
  printf '%s\n\n%s\n- own rule' "$heading" "${b%$'\n'}" >"$proj/AGENTS.md"
  commit_all product
  run write --hosts codex --landing pr --baseline-file "$fixtures/baseline.md" >/dev/null
  bytes_are "$heading"$'\n\n'"${b%$'\n'}"$'\n- own rule\n\n'"$baseline" AGENTS.md
}

case_baselineblank() {
  new_project baselineblank
  printf '%s\n\n%s\n' "$heading" "$b" >"$proj/AGENTS.md"
  commit_all product
  run write --hosts codex --landing pr --baseline-file "$fixtures/baseline.md" >/dev/null
  bytes_are "$heading"$'\n\n'"$b"$'\n'"$baseline" AGENTS.md
}

case_baselinethere() {
  new_project baselinethere
  printf '%s\n\n%s\n## Baseline of the checks\n\n- own rule\n' "$heading" "$b" >"$proj/AGENTS.md"
  commit_all product
  out=$(run write --hosts codex --landing pr --baseline-file "$fixtures/baseline.md")
  grep -qxF "setup: warning: AGENTS.md: $baseline_is" <<<"$out" || fail "no warning for a product baseline: $out"
  bytes_are "$heading"$'\n\n'"$b"$'\n## Baseline of the checks\n\n- own rule\n' AGENTS.md
}

case_baselinemissing() {
  new_project baselinemissing
  LABELS= stops "setup: cannot read $tmp/missing.md" write --hosts codex --landing pr --baseline-file "$tmp/missing.md"
  clean_tree "a missing baseline file left a file"
  [ "$(code_of write --hosts codex --landing pr --baseline-file "$tmp")" -eq 1 ] || fail "write took a folder as a baseline file"
  [ ! -s "$LABEL_LOG" ] || fail "a missing input file left a label: $(cat "$LABEL_LOG")"
}

case_labels() {
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
}

case_labelsall() {
  new_project labelsall
  : >"$LABEL_LOG"
  out=$(run write --hosts codex --landing pr)
  [ ! -s "$LABEL_LOG" ] && ! grep -q 'made the label' <<<"$out" || fail "write made a label that is there: $(cat "$LABEL_LOG")"
}

case_labelcase() {
  new_project labelcase
  out=$(LABELS="${all_labels/ bug / Bug }" run write --hosts codex --landing pr)
  [ ! -s "$LABEL_LOG" ] || fail "write made a label that differs in case: $(cat "$LABEL_LOG")"
  grep -qxF 'setup: warning: the label Bug differs in case from bug; setup leaves it' <<<"$out" || fail "no warning for a label in another case: $out"
}

case_labelpages() {
  new_project labelpages
  PAGES=2 run write --hosts codex --landing pr >/dev/null
  [ ! -s "$LABEL_LOG" ] || fail "write made a label of page 2: $(cat "$LABEL_LOG")"
}

case_labelfail() {
  new_project labelfail
  LABELS= LABEL_FAIL=1 stops_after "HTTP 403: Resource not accessible" "setup: cannot make the label needs-triage" write --hosts codex --landing pr
  clean_tree "a label failure left a file"
  LIST_FAIL=1 stops_after "HTTP 403: Resource not accessible" "setup: cannot list the labels" write --hosts codex --landing pr
  clean_tree "a label list failure left a file"
}

subject='chore(celetis): wire the project for the celetis lanes'
remote_head() { git -C "$proj" ls-remote origin refs/heads/main | cut -f1; }

case_push() {
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
}

case_pushahead() {
  new_project pushahead
  git -C "$proj" commit -q --allow-empty -m one
  git -C "$proj" commit -q --allow-empty -m two
  run write --hosts codex --landing pr >/dev/null
  run push >/dev/null || fail "push failed on a trunk that is ahead"
  [ "$(git -C "$tmp/pushahead.git" log --format=%s main)" = "$subject"$'\ntwo\none\nbase' ] || fail "push did not carry the commits ahead: $(git -C "$tmp/pushahead.git" log --format=%s main)"
}

case_pushclean() {
  new_project pushclean
  run write --hosts codex --landing pr >/dev/null
  commit_all wiring
  git -C "$proj" push -q origin main
  head=$(git -C "$proj" rev-parse HEAD)
  [ "$(run push 2>&1)" = 'setup: no file changed; nothing to commit' ] && [ "$(code_of push)" -eq 0 ] || fail "push did not report no change"
  [ "$(git -C "$proj" rev-parse HEAD)" = "$head" ] && [ "$(remote_head)" = "$head" ] || fail "push moved a trunk with no change"
}

case_pushrefused() {
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
}

case_pushhook() {
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
}

case_pushstaged() {
  new_project pushstaged
  run write --hosts codex --landing pr >/dev/null
  echo x >"$proj/other.txt"
  git -C "$proj" add other.txt
  head=$(git -C "$proj" rev-parse HEAD)
  stops "setup: the index holds staged changes; commit or unstage them first" push
  [ "$(git -C "$proj" rev-parse HEAD)" = "$head" ] || fail "push committed with a staged file"
}

case_pushbranch() {
  new_project pushbranch
  run write --hosts codex --landing pr >/dev/null
  git -C "$proj" checkout -q -b other
  stops "setup: the main checkout is on other, not on main; switch to main first" push
  [ "$(git -C "$proj" log -1 --format=%s)" = base ] || fail "push committed on another branch"
}

marker_of() { echo "$(git -C "$1" rev-parse --path-format=absolute --git-dir)/celetis-flow-setup-done"; }
gh_calls() { echo $(($(wc -l <"$GH_LOG"))); }
cat >"$fixtures/lane-setup.sh" <<'EOF'
printf '%s|%s\n' "$PWD" "$1" >>"$SETUP_LOG"
echo script-stdout
echo script-stderr >&2
[ -z "${SETUP_FAIL:-}" ] || exit 7
EOF
lane_identity='celetis <setup@celetis.invalid>|celetis <setup@celetis.invalid>'
try_opts=(--hosts codex --landing merge --setup-file "$fixtures/lane-setup.sh")
only_lanes() { ! git -C "$proj" status --porcelain --untracked-files=all | grep -qv '^?? \.claude/worktrees/' || fail "try changed the main checkout: $(git -C "$proj" status --porcelain --untracked-files=all)"; }
in_list() { git -C "$proj" worktree list --porcelain | grep -qxF "worktree $1"; }

case_try() {
  new_project try
  top=$(git -C "$proj" rev-parse --show-toplevel)
  trylane=$top/.claude/worktrees/setup-try
  printf '#!/bin/sh\nexit 1\n' >"$proj/.git/hooks/pre-commit"
  chmod +x "$proj/.git/hooks/pre-commit"
  git -C "$proj" config hook.block.event pre-commit
  git -C "$proj" config hook.block.command false
  git -C "$proj" config hook.message.event prepare-commit-msg
  git -C "$proj" config hook.message.command false
  head=$(git -C "$proj" rev-parse HEAD)
  refs=$(git -C "$proj" for-each-ref --format='%(refname)')
  : >"$LABEL_LOG"
  : >"$SETUP_LOG"
  calls=$(gh_calls)
  out=$(run try "${try_opts[@]}" 2>"$tmp/err") || fail "try failed: $(cat "$tmp/err")"
  [ "$out" = "$trylane" ] || fail "try printed more than the path of the test lane: $out"
  in_list "$out" || fail "the test lane is no worktree of git"
  [ "$(git -C "$out" rev-parse --abbrev-ref HEAD)" = HEAD ] || fail "the test lane is no detached worktree"
  [ "$(git -C "$out" rev-parse HEAD^)" = "$head" ] || fail "the test lane is not HEAD plus one commit"
  [ -z "$(git -C "$out" status --porcelain --untracked-files=all)" ] || fail "the wiring is not committed in the test lane"
  [ "$(git -C "$out" log -1 --format='%an <%ae>|%cn <%ce>')" = "$lane_identity" ] || fail "wrong identity: $(git -C "$out" log -1 --format='%an <%ae>|%cn <%ce>')"
  [ "$(git -C "$out" log -1 --format=%s)" = 'chore(celetis): wire the project for the celetis lanes' ] || fail "wrong subject of the test lane commit"
  [[ $(git -C "$out" ls-tree HEAD scripts/celetis) == 100755* ]] || fail "the launcher has no mode 100755 in the test lane"
  [ "$(cat "$SETUP_LOG")" = "$out|$top" ] || fail "the setup did not run once in the test lane with the main checkout: $(cat "$SETUP_LOG")"
  grep -qx script-stdout "$tmp/err" && grep -qx script-stderr "$tmp/err" || fail "the setup output is not on stderr: $(cat "$tmp/err")"
  [ -f "$(marker_of "$out")" ] || fail "the test lane has no marker after a setup"
  jq -e --rawfile want "$fixtures/lane-setup.sh" '.worktreeSetup == $want' <<<"$(. "$plug/scripts/celetis" && celetis_config_read "$out")" >/dev/null || fail "the config of the test lane lacks the setup"
  [ "$(git -C "$proj" rev-parse HEAD)" = "$head" ] && [ "$(git -C "$proj" branch --show-current)" = main ] || fail "try moved the main checkout"
  [ "$(git -C "$proj" for-each-ref --format='%(refname)')" = "$refs" ] || fail "try made a ref"
  only_lanes
  [ ! -e "$proj/.celetis.yaml" ] && [ ! -e "$proj/scripts/celetis" ] || fail "try wrote a file in the main checkout"
  [ ! -s "$LABEL_LOG" ] || fail "try made a label: $(cat "$LABEL_LOG")"
  [ "$(gh_calls)" -eq $((calls + 1)) ] && [ "$(tail -n1 "$GH_LOG")" = 'api repos/{owner}/{repo} --jq .full_name, .default_branch' ] || fail "try made another gh call: $(tail -n +$((calls + 1)) "$GH_LOG")"

  mkdir -p "$out/.venv/bin"
  echo x >"$out/.venv/bin/python"
  echo junk >"$out/untracked.txt"
  : >"$SETUP_LOG"
  again=$(run try "${try_opts[@]}" 2>"$tmp/err") || fail "a second try failed: $(cat "$tmp/err")"
  [ "$again" = "$trylane" ] && [ ! -e "$again/.venv" ] && [ ! -e "$again/untracked.txt" ] || fail "a second try kept files of the old test lane"
  [ "$(cat "$SETUP_LOG")" = "$again|$top" ] || fail "the setup did not run in the new test lane: $(cat "$SETUP_LOG")"
  [ "$(git -C "$proj" worktree list --porcelain | grep -c 'setup-try' || true)" -eq 1 ] || fail "a second try left two test lanes"
  [ "$(git -C "$again" rev-parse HEAD^)" = "$head" ] || fail "the new test lane is not HEAD plus one commit"

  mkdir "$proj/sub"
  cp "$fixtures/lane-setup.sh" "$proj/sub/rel.sh"
  again=$(CWD=$proj/sub run try --hosts codex --landing merge --setup-file rel.sh 2>"$tmp/err") || fail "try failed in a subfolder: $(cat "$tmp/err")"
  [ "$again" = "$trylane" ] || fail "try in a subfolder printed another path: $again"

  : >"$SETUP_LOG"
  set +e
  out=$(SETUP_FAIL=1 run try "${try_opts[@]}" 2>"$tmp/err")
  code=$?
  set -e
  [ "$code" -eq 7 ] || fail "try did not exit with the status of the setup: $code"
  [ "$out" = "$trylane" ] || fail "try did not print the path after a failed setup: $out"
  [ -d "$out" ] && in_list "$out" || fail "try removed the test lane after a failed setup"
  [ ! -f "$(marker_of "$out")" ] || fail "a failed setup left a marker in the test lane"
  grep -qx script-stdout "$tmp/err" || fail "the failed setup output is not on stderr"
  [ -z "$(git -C "$out" status --porcelain --untracked-files=all)" ] || fail "the test lane is dirty after a failed setup"

  : >"$SETUP_LOG"
  calls=$(gh_calls)
  out=$(run try --remove 2>"$tmp/err") || fail "try --remove failed: $(cat "$tmp/err")"
  [ -z "$out" ] && [ ! -s "$tmp/err" ] || fail "try --remove printed: $out $(cat "$tmp/err")"
  ! in_list "$trylane" && [ ! -e "$trylane" ] || fail "try --remove left the test lane"
  [ -z "$(git -C "$proj" worktree list --porcelain | grep 'setup-try' || true)" ] || fail "try --remove left a record of the test lane"
  out=$(run try --remove 2>"$tmp/err") || fail "a second try --remove failed: $(cat "$tmp/err")"
  [ -z "$out" ] && [ ! -s "$tmp/err" ] || fail "a second try --remove printed: $out $(cat "$tmp/err")"
  [ ! -s "$SETUP_LOG" ] || fail "try --remove ran the setup"
  [ "$(gh_calls)" -eq "$calls" ] || fail "try --remove called gh: $(tail -n +$((calls + 1)) "$GH_LOG")"
}

case_trynotworktree() {
  new_project trynotworktree
  trylane=$(git -C "$proj" rev-parse --show-toplevel)/.claude/worktrees/setup-try
  mkdir -p "$trylane"
  echo keep >"$trylane/keep"
  not_worktree='setup: .claude/worktrees/setup-try is no worktree of git; remove it first'
  stops "$not_worktree" try "${try_opts[@]}"
  stops "$not_worktree" try --remove
  [ "$(cat "$trylane/keep")" = keep ] || fail "a stop removed a folder that is no worktree"
  [ ! -s "$SETUP_LOG" ] || fail "try ran the setup before its stop"
  rm -rf "$trylane"
  git -C "$proj" worktree add -q --detach "$trylane"
  rm -rf "$trylane"
  out=$(run try "${try_opts[@]}" 2>"$tmp/err") || fail "try failed after a test lane was deleted by hand: $(cat "$tmp/err")"
  [ "$out" = "$trylane" ] && in_list "$out" || fail "try did not make a new test lane after a deleted one"
  run try --remove
}

case_tryrefused() {
  new_project tryrefused
  git -C "$proj" worktree add -q "$tmp/try-linked" -b side
  linked=$(git -C "$tmp/try-linked" rev-parse --show-toplevel)
  in_linked="setup: run setup in the main checkout, not in a linked worktree: $linked"
  CWD=$tmp/try-linked stops "$in_linked" try --remove
  CWD=$tmp/try-linked stops "$in_linked" try "${try_opts[@]}"
  CWD=$tmp/try-linked stops "$in_linked" lane "$linked"

  [ "$(code_of try)" -eq 2 ] && [ "$(code_of try --hosts codex)" -eq 2 ] && [ "$(code_of try --hosts codex --landing pr --remove)" -eq 2 ] || fail "try took a wrong argument list"
  [ "$(code_of try --remove extra)" -eq 2 ] && [ "$(code_of try --remove --hosts codex)" -eq 2 ] || fail "try --remove took another argument"
  [ "$(code_of lane)" -eq 2 ] && [ "$(code_of lane a b)" -eq 2 ] && [ "$(code_of lane '')" -eq 2 ] || fail "lane took a wrong argument list"
}

case_tryahead() {
  new_project tryahead
  git -C "$proj" commit -q --allow-empty -m one
  head=$(git -C "$proj" rev-parse HEAD)
  out=$(run try "${try_opts[@]}" 2>"$tmp/err") || fail "try failed on a trunk that is ahead: $(cat "$tmp/err")"
  [ "$out" = "$(git -C "$proj" rev-parse --show-toplevel)/.claude/worktrees/setup-try" ] || fail "try printed a warning on stdout: $out"
  grep -qF 'setup: warning: the local main is 1 commit ahead of origin/main' "$tmp/err" || fail "the warning of try is not on stderr: $(cat "$tmp/err")"
  [ "$(git -C "$out" rev-parse HEAD^)" = "$head" ] || fail "the test lane is not the local trunk plus one commit"
}

case_trywired() {
  new_project trywired
  run write --hosts codex --landing merge >/dev/null
  commit_all wiring
  git -C "$proj" push -q origin main
  head=$(git -C "$proj" rev-parse HEAD)
  : >"$SETUP_LOG"
  out=$(run try --hosts codex --landing merge 2>"$tmp/err") || fail "try failed on a wired project: $(cat "$tmp/err")"
  [ "$(git -C "$out" rev-parse HEAD)" = "$head" ] || fail "try committed in a test lane that needs no change"
  [ ! -s "$SETUP_LOG" ] && [ ! -f "$(marker_of "$out")" ] || fail "try ran a setup that is not there"
  run try --remove
  run write --hosts codex --landing merge --setup-file "$fixtures/lane-setup.sh" >/dev/null
  commit_all setup
  git -C "$proj" push -q origin main
  head=$(git -C "$proj" rev-parse HEAD)
  out=$(run try --hosts codex --landing merge 2>"$tmp/err") || fail "try failed on a project with a setup: $(cat "$tmp/err")"
  [ "$(git -C "$out" rev-parse HEAD)" = "$head" ] || fail "try committed in a test lane that needs no change"
  [ "$(cat "$SETUP_LOG")" = "$out|$(git -C "$proj" rev-parse --show-toplevel)" ] || fail "try did not run the setup of the config: $(cat "$SETUP_LOG")"
  run try --remove
}

case_trysame() {
  new_project trysame
  out=$(run try "${try_opts[@]}" 2>"$tmp/err") || fail "try failed: $(cat "$tmp/err")"
  run write "${try_opts[@]}" >/dev/null
  [ "$(git -C "$out" diff --name-only HEAD^ HEAD | sort)" = "$(git -C "$proj" status --porcelain --untracked-files=all | cut -c4- | sort)" ] || fail "the test lane holds other paths than write: $(git -C "$out" diff --name-only HEAD^ HEAD)"
  for path in $(git -C "$out" diff --name-only HEAD^ HEAD); do
    cmp -s "$out/$path" "$proj/$path" || fail "the test lane differs from write in $path"
  done
}

lane_project() {
  new_project "$1"
  git -C "$proj" worktree add -q -b feat/1-x "$proj/.claude/worktrees/1-x"
  git -C "$proj" worktree add -q --detach "$proj/.claude/worktrees/setup-try"
  git -C "$proj" worktree add -q --detach "$tmp/lane-outside"
  mkdir "$tmp/elsewhere" "$proj/sub"
  run write "${try_opts[@]}" >/dev/null
  top=$(git -C "$proj" rev-parse --show-toplevel)
  lane=$(git -C "$proj/.claude/worktrees/1-x" rev-parse --show-toplevel)
  git -C "$proj" remote set-url origin "$tmp/missing.git"
  touch "$(marker_of "$lane")"
}

case_lane() {
  lane_project lane
  mkdir "$lane/sub"
  calls=$(gh_calls)
  out=$(run lane "$lane" 2>"$tmp/err") || fail "lane failed: $(cat "$tmp/err")"
  [ -z "$out" ] || fail "lane printed on stdout: $out"
  [ "$(cat "$SETUP_LOG")" = "$lane|$top" ] || fail "lane did not run the setup of the main checkout once in the lane: $(cat "$SETUP_LOG")"
  grep -qx script-stdout "$tmp/err" || fail "the setup output of lane is not on stderr"
  [ -f "$(marker_of "$lane")" ] || fail "lane left no marker"
  rm "$(marker_of "$lane")"
  CWD=$proj run lane .claude/worktrees/1-x/sub 2>"$tmp/err" >/dev/null || fail "lane failed on a subfolder of a lane: $(cat "$tmp/err")"
  run lane "$lane/sub" 2>"$tmp/err" >/dev/null || fail "lane failed on the absolute path of a subfolder of a lane: $(cat "$tmp/err")"
  CWD=$proj/sub run lane ../.claude/worktrees/1-x 2>"$tmp/err" >/dev/null || fail "lane failed on a relative path from a subfolder: $(cat "$tmp/err")"
  [ "$(cat "$SETUP_LOG")" = "$lane|$top"$'\n'"$lane|$top"$'\n'"$lane|$top"$'\n'"$lane|$top" ] || fail "lane did not run in the lane of a relative path: $(cat "$SETUP_LOG")"
  [ -f "$(marker_of "$lane")" ] || fail "lane left no marker for a relative path"
  [ "$(gh_calls)" -eq "$calls" ] || fail "lane called gh: $(tail -n +$((calls + 1)) "$GH_LOG")"
  [ -z "$(git -C "$lane" status --porcelain)" ] || fail "lane changed the files of the lane"
}

case_lanestops() {
  new_project clean
  lane_project lanestops
  no_lane="is no lane worktree in .claude/worktrees/ of this repository"
  for path in "$proj" "$proj/sub" "$proj/.claude/worktrees/setup-try" "$tmp/lane-outside" "$tmp/elsewhere" "$tmp/missing" "$tmp/clean" "$proj/app.txt" "$proj/.claude/worktrees"; do
    stops "setup: $path $no_lane" lane "$path"
  done
  [ ! -s "$SETUP_LOG" ] || fail "a stop of lane ran the setup"
  CWD=$lane stops "setup: run setup in the main checkout, not in a linked worktree: $lane" lane "$lane"
}

case_lanefail() {
  lane_project lanefail
  [ -f "$(marker_of "$lane")" ] || fail "the lane has no marker before a failed setup"
  SETUP_FAIL=1 stops_after script-stdout "setup: the worktree setup failed in $lane" lane "$lane"
  [ -d "$lane" ] && [ ! -f "$(marker_of "$lane")" ] || fail "a failed setup of lane removed the lane or kept a marker"
  [ -z "$(git -C "$lane" status --porcelain)" ] || fail "a failed setup of lane changed the lane"
}

case_lanenone() {
  new_project lanenone
  git -C "$proj" worktree add -q -b fix/2-y "$proj/.claude/worktrees/2-y"
  lane=$(git -C "$proj/.claude/worktrees/2-y" rev-parse --show-toplevel)
  no_script='setup: the main .celetis.yaml has no worktreeSetup to run'
  stops_after 'need a regular, readable file' 'setup: cannot read .celetis.yaml; fix the cause above first' lane "$lane"
  printf 'host: codex\nlanding: merge\n' >"$proj/.celetis.yaml"
  stops "$no_script" lane "$lane"
  printf 'host: codex\nlanding: merge\nworktreeSetup: ""\n' >"$proj/.celetis.yaml"
  stops "$no_script" lane "$lane"
  printf 'host: codex\nlanding: merge\nworktreeSetup: |-\n  exit 0\n' >"$proj/.celetis.yaml"
  [ ! -f "$(marker_of "$lane")" ] || fail "a stop of lane left a marker"
  run lane "$lane" 2>/dev/null || fail "lane failed on a one-line setup"
  [ -f "$(marker_of "$lane")" ] || fail "lane left no marker for a one-line setup"
}

run_case() {
  tmp=$base/case_$1
  mkdir "$tmp"
  export GH_LOG=$tmp/gh.log LABEL_LOG=$tmp/label.log SETUP_LOG=$tmp/setup.log
  touch "$GH_LOG" "$LABEL_LOG" "$SETUP_LOG"
  "case_$1"
  only_api
  [ "$1" = labels ] || [ ! -s "$LABEL_LOG" ] || fail "a label was made: $(cat "$LABEL_LOG")"
}

cases=$(declare -F | sed -n 's/^declare -f case_//p')
[ -n "$cases" ] || fail "no case found"
# shellcheck disable=SC2034 # tests/lib/pool.sh reads POOL_JOBS
POOL_JOBS=24
for name in $(grep '^try' <<<"$cases") $(grep -v '^try' <<<"$cases"); do
  pool_run "case_$name" run_case "$name"
done
pool_wait || exit 1
echo "PASS: $(grep -c '' <<<"$cases") cases"
