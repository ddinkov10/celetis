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
export PATH="$tmp/bin:$PATH" GH_LOG="$tmp/gh.log" LABEL_LOG="$tmp/label.log" REPO=acme/widgets TRUNK=main LABELS=
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

new_project clean
[ "$(code_of check)" -eq 0 ] || fail "check refused a clean trunk"
[ -z "$(out_of check)$(err_of check)" ] || fail "check printed on a clean trunk"
grep -qxF 'api repos/{owner}/{repo} --jq .full_name, .default_branch' "$GH_LOG" || fail "check did not read the repository: $(cat "$GH_LOG")"
mkdir "$proj/sub"
[ "$(CWD=$proj/sub code_of check)" -eq 0 ] || fail "check refused a subfolder"
touch "$proj/unrelated"
[ "$(code_of check)" -eq 0 ] || fail "check refused an untracked file that setup does not touch"
REPO_FAIL=1 stops "setup: origin is not a GitHub repository that gh can read" check

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
stops "setup: cannot fetch main from origin" check

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
[ "$(code_of)" -eq 2 ] && [ "$(code_of bogus)" -eq 2 ] && [ "$(code_of check extra)" -eq 2 ] || fail "usage not refused"
[[ $(err_of bogus) == "$want" ]] || fail "wrong usage line: $(err_of bogus)"

only_api
echo "PASS"
