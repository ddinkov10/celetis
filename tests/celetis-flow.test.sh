#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(dirname "$here")
tmp=$(mktemp -d)
ln -s "$root" "$tmp/plug in"
plugin="$tmp/plug in"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export CELETIS_FLOW_TEST_STATE="$tmp/state"
export CELETIS_HOST=claude CLAUDE_CONFIG_DIR="$tmp/claude"
unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
S=$CELETIS_FLOW_TEST_STATE
# A test that fails must leave no runner alive: an automatic runner has no end of its own.
trap 'kill $(cat "$S/runner-pids" 2>/dev/null) "${landing:-}" 2>/dev/null || true; rm -rf "$tmp"' EXIT
bin="$tmp/bin"
nobin="$tmp/nobin"
mkdir -p "$bin" "$nobin"

fail() { echo "FAIL: $1"; exit 1; }

# The gh stub serves each issue from its own file, so the real resolver runs against it. It reads all of stdin, as a real command can.
cat >"$bin/gh" <<'EOF'
#!/usr/bin/env bash
S=$CELETIS_FLOW_TEST_STATE
cat >/dev/null
printf '%s\n' "$*" >>"$S/gh-calls"
[ "$(wc -l <"$S/gh-calls")" -le 300 ] || { echo "fake gh: over 300 calls" >&2; kill -TERM $(cat "$S/runner-pids") 2>/dev/null; exit 1; }
[ ! -f "$S/gh-fail" ] || { echo "HTTP 502" >&2; exit 1; }
case "$1 $2" in
  "issue view")
    [ -f "$S/issue-$3.json" ] && [ ! -f "$S/view-fail-$3" ] || { echo "no issue $3" >&2; exit 1; }
    cat "$S/issue-$3.json"
    ;;
  "issue list") cat "$S"/issue-*.json 2>/dev/null | jq -s --arg s "$4" '[.[] | select(.state == ($s | ascii_upcase))]' ;;
  "pr list") cat "$S"/pr-* 2>/dev/null | jq -Rn '[inputs | {headRefName: .}]' ;;
  *) echo "fake gh: unexpected $*" >&2; exit 1 ;;
esac
EOF
cat >"$bin/claude" <<'EOF'
#!/usr/bin/env bash
S=$CELETIS_FLOW_TEST_STATE
if [ "$1" = plugin ]; then
  echo "$*" >>"$S/plugin-calls"
  echo "$*" >>"$S/order"
  IFS= read -r _ || true
  echo "fake claude plugin: error" >&2
  [ ! -f "$S/plugin-fail" ] || exit 1
  [ "$2" != list ] || { cat "$S/plugin-list" 2>/dev/null || echo '[]'; exit 0; }
  echo "fake claude plugin: output"
  exit 0
fi
for prompt; do :; done
n=${prompt##*#}
echo "session $prompt" >>"$S/order"
k=$(($(cat "$S/sessions-$n" 2>/dev/null || echo 0) + 1))
echo "$k" >"$S/sessions-$n"
{ printf '[%s]' "$@"; echo; } >>"$S/claude-calls"
IFS= read -r typed || typed=
printf '%s|%s|%s|%s\n' "$n" "$prompt" "$PWD" "$typed" >>"$S/claude-env"
echo $({ git for-each-ref --format='%(refname:strip=3)' refs/celetis-flow/locks; [ ! -f "$(git rev-parse --git-common-dir)/celetis-flow/no-progress" ] || echo no-progress; } | sort) >>"$S/claude-locks"
[ "$(wc -l <"$S/claude-calls")" -le 20 ] || kill -TERM $(cat "$S/runner-pids") 2>/dev/null
if [ -n "${HERDR_PANE_ID:-}" ]; then
  mkdir -p "$CLAUDE_CONFIG_DIR/projects/fixture"
  jq -nc --arg cwd "$PWD" --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{sessionId:"00000000-0000-4000-8000-000000000001",type:"user",cwd:$cwd,timestamp:$time,message:{role:"user",content:"fixture"}}' >"$CLAUDE_CONFIG_DIR/projects/fixture/00000000-0000-4000-8000-000000000001.jsonl"
  touch "$S/claude-live"
fi
while [ "$k" -eq 1 ] && [ -f "$S/hold-$n" ]; do /bin/sleep 0.05; done
[ ! -d "$S/after/$n/$k" ] || cp "$S/after/$n/$k"/* "$S/"
if [ -n "${HERDR_PANE_ID:-}" ]; then
  touch "$S/turn-ended"
  tries=0
  until [ -f "$S/exit-typed" ] || [ "$tries" -ge 40 ]; do tries=$((tries + 1)); /bin/sleep 0.05; done
  rm -f "$S/claude-live" "$S/turn-ended" "$S/exit-typed"
fi
exit "$(cat "$S/claude-exit" 2>/dev/null || echo 0)"
EOF
cat >"$bin/herdr" <<'EOF'
#!/usr/bin/env bash
S=$CELETIS_FLOW_TEST_STATE
printf '%s\n' "$*" >>"$S/herdr-calls"
case "$1 $2 $*" in
  "tab rename"*) ;;
  "agent get"*)
    [ -f "$S/claude-live" ] || exit 1
    printf '%s\n' '{"result":{"agent":{"agent":"claude","interactive_ready":true,"agent_status":"idle","agent_session":{"agent":"claude","kind":"id","value":"00000000-0000-4000-8000-000000000001"}}}}' ;;
  "agent wait"*"--until idle"*)
    until [ -f "$S/turn-ended" ]; do [ -f "$S/claude-live" ] || exit 1; /bin/sleep 0.05; done ;;
  "agent wait"*) while [ -f "$S/claude-live" ]; do /bin/sleep 0.05; done; exit 1 ;;
  "agent prompt"*) touch "$S/exit-typed" ;;
  *) echo "fake herdr: unexpected $*" >&2; exit 1 ;;
esac
EOF
# The sleep stub ends the automatic runner, which has no end of its own.
cat >"$bin/sleep" <<'EOF'
#!/usr/bin/env bash
S=$CELETIS_FLOW_TEST_STATE
[ "$1" = 60 ] || exec /bin/sleep "$1"
echo "$1" >>"$S/sleeps"
[ "$(wc -l <"$S/sleeps")" -lt "$(cat "$S/sleep-limit" 2>/dev/null || echo 1)" ] || kill -TERM "$PPID"
EOF
chmod +x "$bin/gh" "$bin/claude" "$bin/herdr" "$bin/sleep"
cp "$bin/gh" "$nobin/gh"
ln -s "$(command -v jq)" "$nobin/jq"
ln -s "$(command -v git)" "$nobin/git"
ln -s "$(command -v dirname)" "$nobin/dirname"
ln -s "$(command -v mkdir)" "$nobin/mkdir"
export PATH="$bin:$PATH"

repo="$tmp/re po"
git init -q "$repo"
git -C "$repo" config core.autocrlf false
mkdir -p "$repo/.claude/celetis-flow"
printf '{"triage":"auto","bug":"me","chore":"me","hotfix":"me","plan":"auto","implement":"auto"}\n' >"$repo/.claude/celetis-flow/gates.json"
printf '.claude/worktrees/\n' >"$repo/.gitignore"
git -C "$repo" add -A
git -C "$repo" commit -qm base
common=$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)
main=$(dirname "$common")
st="$common/celetis-flow"
lane="$repo/.claude/worktrees/7-crash"
git -C "$repo" worktree add -q -b fix/7-crash "$lane"

reset() {
  rm -rf "$S" "$st"
  mkdir -p "$S"
  printf 'one\ntwo\nthree\nfour\nfive\n' >"$tmp/stdin"
  git -C "$repo" config --remove-section celetis-flow.gate 2>/dev/null || true
}

issue() {
  local dir=${into:-$S} n=$1 state=$2 labels=$3 body=$4
  shift 4
  mkdir -p "$dir"
  jq -n --argjson n "$n" --arg s "$state" --arg l "$labels" --arg b "$body" \
    '{number: $n, title: "Issue \($n)", url: "https://example.test/issues/\($n)", state: $s, updatedAt: "2026-10-01T00:00:00Z", closedAt: (if $s == "CLOSED" then "2026-10-02T00:00:00Z" else null end), labels: ($l | split(",") | map(select(. != "") | {name: .})), body: $b, comments: ($ARGS.positional | map({body: .}))}' \
    --args "$@" >"$dir/issue-$n.json"
}
after() { into="$S/after/$1/$2" issue "$1" "${@:3}"; }

start_flow() {
  ( cd "${from:-$repo}" && PATH=${path:-$PATH} exec "$BASH" "$plugin/scripts/celetis-flow.sh" "$@" \
    >"$tmp/${tag:-}out" 2>"$tmp/${tag:-}err" <"$tmp/stdin" ) &
  flow_pid=$!
  echo "$flow_pid" >>"$S/runner-pids"
}
end_flow() {
  set +e
  { wait "$flow_pid"; code=$?; } 2>/dev/null
  set -e
  out=$(cat "$tmp/out")
  err=$(cat "$tmp/err")
}
run_flow() { start_flow "$@"; end_flow; }

calls() { cat "$S/$1" 2>/dev/null || true; }
count() { calls "$1" | wc -l | tr -d ' '; }
await() {
  local tries=0
  until [ "$(count claude-calls)" -ge "$1" ]; do
    tries=$((tries + 1))
    [ "$tries" -le 400 ] || fail "session $1 did not start in 20 seconds: [$(calls claude-calls)]"
    /bin/sleep 0.05
  done
}
sessions() { calls claude-env | cut -d'|' -f1,2; }
locks() { git -C "$repo" for-each-ref --format='%(refname)' refs/celetis-flow/locks | wc -l | tr -d ' '; }
rows() { wc -l <"$st/no-progress" | tr -d ' '; }
form() { printf '[--permission-mode][auto][-n][#%s %s][--append-system-prompt-file][%s/step-prompt.md][/celetis:%s #%s]' "$1" "$2" "${3:-$plugin}" "$2" "$1"; }
update="plugin marketplace update celetis
plugin update celetis@celetis --scope user"
lookup="plugin list --json"
moved="$tmp/moved plugin"
bare="$tmp/bare plugin"
mkdir -p "$moved/scripts" "$bare/scripts"
cp "$root/scripts/root.sh" "$moved/scripts/root.sh"
cp "$root/scripts/root.sh" "$bare/scripts/root.sh"
echo "the step text of the moved plugin" >"$moved/step-prompt.md"
plugin_list() { printf '[{"id":"celetis@celetis","scope":"user","enabled":true,"installPath":"%s"}]\n' "$1" >"$S/plugin-list"; }
usage="usage: scripts/celetis celetis-flow [<issue number>...] | --board | --resume <issue number>, e.g. scripts/celetis celetis-flow 373 374; with no number, the automatic runner"

reset; echo 1 >"$S/claude-exit"
issue 7 OPEN bug "It breaks"
after 7 1 OPEN bug "It breaks" "## Root cause"
after 7 2 OPEN bug "It breaks" "## Root cause" "## Plan"
after 7 3 CLOSED bug "It breaks" "## Root cause" "## Plan"
run_flow 7
[ "$code" -eq 0 ] && [ "$out" = "celetis-flow: start: /celetis:bug #7
celetis-flow: start: /celetis:plan #7
celetis-flow: start: /celetis:implement #7
celetis-flow: stop #7 is finished." ] || fail "a start with a number must start the me step and then each auto step, whatever claude exits with: $code [$out] [$err]"
[ "$(calls claude-calls | head -1)" = "$(form 7 bug)" ] || fail "the command line of a session: [$(calls claude-calls | head -1)]"
[ "$(calls claude-env)" = "7|/celetis:bug #7|$main|one
7|/celetis:plan #7|$main|two
7|/celetis:implement #7|$main|three" ] || fail "each session must get its prompt, the main checkout, and the next line of the script's stdin: [$(calls claude-env)]"
[ -z "$(calls herdr-calls)" ] || fail "outside herdr the script must make no herdr call: [$(calls herdr-calls)]"
[ "$(locks)" -eq 0 ] && [ ! -e "$st/no-progress" ] || fail "a finished run left a lock or a row in the record"

reset; issue 7 OPEN enhancement "Spec: x"
run_flow 7
[ "$(calls plugin-calls)" = "$update
$lookup" ] && [ "$(calls order)" = "$update
$lookup
session /celetis:plan #7" ] || fail "a step start must run the two update commands and then the lookup, in order, before its session: [$(calls order)]"
[ "$out" = "celetis-flow: start: /celetis:plan #7
celetis-flow: no progress: /celetis:plan #7" ] && [ -z "$err" ] || fail "the update must print nothing: [$out] [$err]"

reset; issue 7 OPEN enhancement "Spec: x"; touch "$S/plugin-fail"
run_flow 7
[ "$code" -eq 0 ] && [ "$out" = "celetis-flow: start: /celetis:plan #7
celetis-flow: the plugin update failed; the session starts on the installed version
celetis-flow: no progress: /celetis:plan #7" ] && [ -z "$err" ] || fail "a failed update must print one line, and the session must start: $code [$out] [$err]"
[ "$(calls plugin-calls)" = "plugin marketplace update celetis" ] && [ "$(count claude-calls)" -eq 1 ] || fail "a failed update command must stop the chain: [$(calls plugin-calls)] [$(calls claude-calls)]"

reset; issue 7 OPEN enhancement "Spec: x"; after 7 1 OPEN enhancement "Spec: x" "## Plan"
run_flow 7
[ "$(calls order)" = "$update
$lookup
session /celetis:plan #7
$update
$lookup
session /celetis:implement #7" ] || fail "the update must run before each of two sessions: [$(calls order)]"

reset; issue 7 OPEN enhancement "Spec: x"; plugin_list "$moved"
run_flow 7
[ "$(calls claude-calls)" = "$(form 7 plan "$moved")" ] && [ -z "$err" ] || fail "a session must take the step text of the folder that the update installed: [$(calls claude-calls)] [$err]"

reset; issue 7 OPEN enhancement "Spec: x"; after 7 1 OPEN enhancement "Spec: x" "## Plan"; plugin_list "$moved"
run_flow 7
[ "$(calls claude-calls)" = "$(form 7 plan "$moved")
$(form 7 implement "$moved")" ] && [ -z "$err" ] || fail "the second of two sessions must keep the installed folder: [$(calls claude-calls)] [$err]"

reset; issue 7 OPEN enhancement "Spec: x"; after 7 1 OPEN enhancement "Spec: x" "## Plan"; plugin_list "$moved"
echo oops >"$S/after/7/1/plugin-list"
run_flow 7
[ "$(calls claude-calls)" = "$(form 7 plan "$moved")
$(form 7 implement "$moved")" ] && [ -z "$err" ] || fail "a lookup that gives no folder must keep the folder that the runner has: [$(calls claude-calls)] [$err]"

reset; issue 7 OPEN enhancement "Spec: x"; echo oops >"$S/plugin-list"
run_flow 7
[ "$out" = "celetis-flow: start: /celetis:plan #7
celetis-flow: no progress: /celetis:plan #7" ] && [ "$(calls claude-calls)" = "$(form 7 plan)" ] && [ -z "$err" ] || fail "a lookup that prints no JSON must keep the folder of the runner, with no error: [$out] [$(calls claude-calls)] [$err]"

reset; issue 7 OPEN enhancement "Spec: x"; plugin_list "$bare"
run_flow 7
[ "$out" = "celetis-flow: start: /celetis:plan #7
celetis-flow: no progress: /celetis:plan #7" ] && [ "$(calls claude-calls)" = "$(form 7 plan)" ] && [ -z "$err" ] || fail "a folder with no step-prompt.md must keep the folder of the runner, with no error: [$out] [$(calls claude-calls)] [$err]"

reset
issue 7 OPEN bug "It breaks"; after 7 1 OPEN bug "It breaks" "## Root cause"
issue 8 OPEN enhancement "Spec: x"
export HERDR_ENV=1 HERDR_PANE_ID=w1:p4 HERDR_TAB_ID=w1:t2
run_flow 7 8
unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
[ "$code" -eq 0 ] && [ "$out" = "celetis-flow: start: /celetis:bug #7
celetis-flow: start: /celetis:plan #7
celetis-flow: no progress: /celetis:plan #7
celetis-flow: start: /celetis:plan #8
celetis-flow: no progress: /celetis:plan #8" ] || fail "in herdr the runner must go on after each session: $code [$out] [$err]"
[ "$(calls herdr-calls | grep -v '^agent get ' | grep -vx 'agent wait w1:p4 --until working --until blocked --timeout 5000')" = "tab rename w1:t2 #7 bug
agent wait w1:p4 --until idle --until done
agent prompt w1:p4 /exit
tab rename w1:t2 #7 plan
agent wait w1:p4 --until idle --until done
tab rename w1:t2 #8 plan
agent wait w1:p4 --until idle --until done" ] || fail "in herdr the runner must name its tab after each step and type /exit only into the session of a step that is done: [$(calls herdr-calls)]"
calls herdr-calls | grep -q '^agent get w1:p4$' || fail "the runner must wait until herdr finds the agent: [$(calls herdr-calls)]"

reset; issue 7 OPEN needs-triage "A typo"; after 7 1 OPEN chore "A typo"
run_flow 7
[ "$code" -eq 0 ] && [ "$out" = "celetis-flow: start: /celetis:triage #7
celetis-flow: the gate of chore is me: scripts/celetis celetis-flow 7 starts /celetis:chore #7" ] || fail "a me gate must end the issue: $code [$out] [$err]"

reset; issue 9 OPEN enhancement "An idea"; after 9 1 OPEN enhancement "Spec: x"
run_flow 9
[ "$code" -eq 0 ] && [ "$out" = "celetis-flow: start: /celetis:feature #9
celetis-flow: start: /celetis:plan #9
celetis-flow: no progress: /celetis:plan #9" ] || fail "a feature with no spec must start /feature, and then the auto step plan: $code [$out] [$err]"
[ "$(calls claude-calls)" = "[--permission-mode][auto][-n][#9 specify][/celetis:feature #9]
$(form 9 plan)" ] || fail "the session of specify must get the name specify and no step text, and each other session must get the step text: [$(calls claude-calls)]"
[ -z "$(calls herdr-calls)" ] || fail "outside herdr the script must make no herdr call for specify: [$(calls herdr-calls)]"

reset; issue 9 OPEN needs-triage "An idea"; after 9 1 OPEN enhancement "An idea"
run_flow 9
[ "$out" = "celetis-flow: start: /celetis:triage #9
celetis-flow: the gate of specify is me: scripts/celetis celetis-flow 9 starts /celetis:feature #9" ] || fail "after an auto step, the default gate of specify must end the issue: [$out] [$err]"
run_flow
[ "$code" -eq 143 ] && [ "$(count claude-calls)" -eq 1 ] || fail "with the default gate the automatic runner must start no specify session: $code [$(calls claude-calls)]"
git -C "$repo" config celetis-flow.gate.specify auto
run_flow
[ "$(sessions | tail -1)" = "9|/celetis:feature #9" ] && [ "$(cat "$st/no-progress")" = "9"$'\t'"run /celetis:feature #9" ] || fail "with the gate auto the automatic runner must start specify, and a session that publishes no spec must write one row: [$(sessions)] [$(cat "$st/no-progress" 2>/dev/null)]"

reset; issue 9 OPEN enhancement "An idea"; after 9 2 OPEN enhancement "Spec: x"
git -C "$repo" config celetis-flow.gate.plan me
export HERDR_ENV=1 HERDR_PANE_ID=w1:p4 HERDR_TAB_ID=w1:t2
run_flow 9; first=$out
run_flow 9
unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
[ "$first" = "celetis-flow: start: /celetis:feature #9
celetis-flow: no progress: /celetis:feature #9" ] && [ "$out" = "celetis-flow: start: /celetis:feature #9
celetis-flow: the gate of plan is me: scripts/celetis celetis-flow 9 starts /celetis:plan #9" ] || fail "in herdr a specify session with no spec is no progress, and one with a spec ends at the gate of plan: [$first] [$out] [$err]"
[ "$(calls herdr-calls | grep -v '^agent get ' | grep -vx 'agent wait w1:p4 --until working --until blocked --timeout 5000')" = "tab rename w1:t2 #9 specify
agent wait w1:p4 --until idle --until done
tab rename w1:t2 #9 specify
agent wait w1:p4 --until idle --until done
agent prompt w1:p4 /exit" ] || fail "in herdr the runner must name its tab #9 specify, and type /exit only after the spec is on the issue: [$(calls herdr-calls)]"
[ "$(cat "$st/no-progress")" = "9"$'\t'"run /celetis:feature #9" ] || fail "a specify session that ends with the same line must write one row: [$(cat "$st/no-progress")]"

for end in "OPEN epic" "CLOSED wontfix"; do
  reset; issue 9 OPEN enhancement "An idea"; after 9 1 $end "An idea"
  export HERDR_ENV=1 HERDR_PANE_ID=w1:p4 HERDR_TAB_ID=w1:t2
  run_flow 9
  unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
  [ "$(printf '%s\n' "$out" | sed -n 2p | cut -c1-25)" = "celetis-flow: stop #9 is " ] && [ "$(count claude-calls)" -eq 1 ] && [ ! -e "$st/no-progress" ] &&
    calls herdr-calls | grep -qx 'agent prompt w1:p4 /exit' || fail "the step end must end a specify session whose issue became [$end]: [$out] [$(calls herdr-calls)]"
done

reset; issue 9 OPEN enhancement "Spec: x"; issue 8 OPEN enhancement "Spec: x"
run_flow 9 '#8'
[ "$code" -eq 0 ] && [ "$out" = "celetis-flow: start: /celetis:plan #9
celetis-flow: no progress: /celetis:plan #9
celetis-flow: start: /celetis:plan #8
celetis-flow: no progress: /celetis:plan #8" ] || fail "numbers must keep their order, and a session that changes nothing is no progress: $code [$out] [$err]"
[ "$(cat "$st/no-progress")" = "9"$'\t'"run /celetis:plan #9
8"$'\t'"run /celetis:plan #8" ] || fail "no progress must write one row: [$(cat "$st/no-progress")]"
run_flow 9
[ "$(count claude-calls)" -eq 3 ] && [ "$(rows)" -eq 2 ] || fail "a start with a number must ignore the record and add no second row"

reset; issue 7 OPEN epic ""
run_flow 7
[ "$out" = "celetis-flow: stop #7 is an epic. Each child runs its own flow." ] && [ -z "$(calls claude-calls)" ] || fail "a stop line must end the issue with no session: [$out] [$err]"

reset; issue 7 OPEN enhancement "Spec: x"; mkdir -p "$S/after/7/1"; touch "$S/after/7/1/gh-fail"
run_flow 7
[ "$out" = "celetis-flow: start: /celetis:plan #7
celetis-flow: stop cannot read #7 from GitHub" ] && [ ! -e "$st/no-progress" ] || fail "GitHub down after a session is not no progress: [$out]"

reset; issue 4 CLOSED bug "old"
run_flow 4
[ "$out" = "celetis-flow: stop #4 is finished." ] && [ -z "$(calls claude-calls)" ] || fail "a closed issue must start no session: [$out] [$(sessions)]"

mkdir -p "$tmp/install dir/scripts"
cat >"$tmp/install dir/scripts/land.sh" <<'EOF'
#!/usr/bin/env bash
trap 'kill $!' TERM
/bin/sleep 30 &
wait
EOF
reset; issue 7 OPEN enhancement "Spec: x" "## Plan"; after 7 1 CLOSED enhancement "Spec: x" "## Plan"; touch "$S/hold-7"
export HERDR_ENV=1 HERDR_PANE_ID=w1:p4 HERDR_TAB_ID=w1:t2
start_flow 7
await 1
bash "$tmp/install dir/scripts/land.sh" 7 "feat(x): y" &
landing=$!
echo "$landing" >"$st/land-7.lock"
rm "$S/hold-7"
end_flow
unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
kill "$landing"; wait "$landing" 2>/dev/null || true
[ "$out" = "celetis-flow: start: /celetis:implement #7
celetis-flow: stop the landing of #7 runs; wait until scripts/celetis land ends" ] || fail "a landing that runs must hold the step end: [$out] [$err]"
! calls herdr-calls | grep -q '^agent prompt' || fail "the runner typed /exit while the landing ran: [$(calls herdr-calls)]"
calls herdr-calls | grep -qx 'agent wait w1:p4 --until working --until blocked --timeout 5000' || fail "the runner must read the line of #7 and wait while the landing runs: [$(calls herdr-calls)]"

for args in abc 0 7x "#" "7 abc" -h --open "--board 7" "7 --board" --resume "--resume abc" "--resume 7 8" "7 --resume"; do
  reset
  run_flow $args
  [ "$code" -eq 2 ] && [ -z "$out" ] && printf '%s' "$err" | grep -qxF "$usage" || fail "bad arguments [$args]: $code [$out] [$err]"
  [ -z "$(calls gh-calls)$(calls claude-calls)" ] || fail "a usage error called gh or claude: [$args]"
done

reset; issue 7 OPEN enhancement "Spec: x"
path=$nobin run_flow 7
[ "$code" -eq 1 ] && [ "$err" = "celetis: claude is not on PATH" ] && [ -z "$(calls gh-calls)" ] && [ ! -e "$st/no-progress" ] || fail "claude missing: $code [$out] [$err]"

reset; issue 7 OPEN enhancement "Spec: x"
from=$lane run_flow 7
[ "$(calls claude-calls)" = "$(form 7 plan)" ] && [ "$(calls claude-env)" = "7|/celetis:plan #7|$main|one" ] || fail "a start from a lane worktree must use the step text of the plugin, in the main checkout: [$(calls claude-calls)] [$(calls claude-env)]"

reset; issue 7 OPEN enhancement "Spec: x"; mkdir "$repo/sub"
from=$repo/sub run_flow 7
rmdir "$repo/sub"
[ "$(calls claude-calls)" = "$(form 7 plan)" ] && [ "$(calls claude-env)" = "7|/celetis:plan #7|$main|one" ] || fail "a start from a subfolder of the repository: [$(calls claude-calls)] [$(calls claude-env)] [$err]"

reset; issue 7 OPEN enhancement "Spec: x"
from=$tmp run_flow 7
[ "$code" -ne 0 ] && [ -z "$out" ] && [ -z "$(calls gh-calls)$(calls claude-calls)" ] || fail "a working directory outside the repository: $code [$out] [$err]"

reset; issue 7 OPEN enhancement "Spec: x"; echo dirty >"$repo/new.txt"
run_flow 7
[ "$out" = "celetis-flow: stop the working tree is dirty: $main; commit or stash first" ] || fail "a dirty tree: [$out] [$err]"
run_flow
[ "$code" -eq 143 ] && [ -z "$(calls claude-calls)" ] || fail "a dirty tree must start no session: $code [$out] [$err]"
rm "$repo/new.txt"

reset; issue 7 OPEN enhancement "Spec: x"; issue 8 OPEN enhancement "Spec: x"; touch "$S/hold-7"
tag=a- start_flow 7; a=$flow_pid
await 1
run_flow 7
[ "$code" -eq 0 ] && [ "$out" = "celetis-flow: another celetis-flow.sh or its session (PID $a) works on #7" ] && [ "$(count claude-calls)" -eq 1 ] || fail "a second script must start no session for a locked issue: $code [$out] [$err]"
run_flow
[ "$(sessions)" = "7|/celetis:plan #7
8|/celetis:plan #8" ] || fail "the automatic runner must leave a locked issue and take the next: [$(sessions)]"
issue 9 OPEN enhancement "Spec: x"; touch "$S/hold-9"
tag=b- start_flow; b=$flow_pid
await 3
run_flow
[ "$code" -eq 1 ] && [ -z "$out" ] && [ "$err" = "celetis-flow: another automatic runner or its session has PID $b" ] || fail "a second automatic runner: $code [$out] [$err]"
rm "$S/hold-7" "$S/hold-9"
wait "$a" "$b" 2>/dev/null || true
[ "$(locks)" -eq 0 ] || fail "a script that ended left a lock"

for stale in dead "$$" garbage; do
  reset; issue 7 OPEN enhancement "Spec: x"; mkdir -p "$st"
  if [ "$stale" = dead ]; then /bin/sleep 0 & stale=$!; wait "$stale"; fi
  owner=$(jq -nc --arg pid "$stale" '{runner:{pid:($pid | tonumber?),start:"stale"},session:null}' | git -C "$repo" hash-object -w --stdin)
  git -C "$repo" update-ref refs/celetis-flow/locks/issue-7 "$owner"
  run_flow 7
  [ "$(count claude-calls)" -eq 1 ] && [ "$(locks)" -eq 0 ] || fail "a lock of [$stale] must hold nothing: [$out] [$err]"
done

reset
issue 4 CLOSED bug "old"; issue 5 OPEN bug "It breaks"; issue 6 OPEN epic ""
issue 7 OPEN enhancement "Spec: x"; issue 8 OPEN enhancement "Spec: x"
after 7 1 OPEN enhancement "Spec: x" "## Plan"
run_flow
[ "$code" -eq 143 ] && [ "$out" = "celetis-flow: start: /celetis:plan #7
celetis-flow: start: /celetis:implement #7
celetis-flow: no progress: /celetis:implement #7
celetis-flow: start: /celetis:plan #8
celetis-flow: no progress: /celetis:plan #8
celetis-flow: no auto step can start; the runner asks again each 60 seconds" ] || fail "the automatic runner: $code [$out] [$err]"
[ "$(calls sleeps)" = 60 ] && [ "$(calls gh-calls | grep -c '^issue list --state open --limit 200 --json number,state,labels,body,comments$')" -eq 3 ] || fail "the automatic runner must list again after each issue and wait 60 seconds: [$(calls sleeps)] [$(calls gh-calls)]"
[ "$(calls claude-env | cut -d'|' -f4 | tr '\n' ' ')" = "one two three " ] || fail "the list of the automatic runner must not read the stdin of a session: [$(calls claude-env)]"
[ "$(calls claude-locks | tail -1)" = "issue-8 no-progress runner" ] || fail "a session must run under the lock of its issue and of the runner, and no other: [$(calls claude-locks)]"
[ "$(locks)" -eq 0 ] && [ "$(rows)" -eq 2 ] || fail "the automatic runner must write one row for each step with no progress and free its locks"
run_flow 7
[ "$out" = "celetis-flow: start: /celetis:implement #7
celetis-flow: no progress: /celetis:implement #7" ] && [ "$(rows)" -eq 2 ] || fail "a start with a number must start a step that has a row: [$out]"

reset; issue 5 OPEN bug "It breaks"; echo 3 >"$S/sleep-limit"
run_flow
[ "$out" = "celetis-flow: no auto step can start; the runner asks again each 60 seconds" ] && [ "$(count sleeps)" -eq 3 ] && [ -z "$(calls claude-calls)" ] || fail "the runner must print one line for the whole wait and start no me step: [$out]"

reset; touch "$S/gh-fail"; echo 2 >"$S/sleep-limit"
run_flow
[ "$out" = "celetis-flow: stop cannot read the open issues from GitHub" ] && [ "$(count sleeps)" -eq 2 ] || fail "GitHub down: [$out] [$err]"
printf '%s' "$err" | grep -q "HTTP 502" || fail "the message of gh must reach stderr: [$err]"

reset; issue 7 OPEN enhancement "Spec: x"; touch "$S/view-fail-7"; echo 2 >"$S/sleep-limit"
run_flow
[ "$out" = "celetis-flow: stop cannot read #7 from GitHub" ] && [ "$(count sleeps)" -eq 2 ] && [ -z "$(calls claude-calls)" ] && [ ! -e "$st/no-progress" ] || fail "an issue that cannot start must wait 60 seconds: [$out]"

[ "$(jq -cS . "$root/.claude/celetis-flow/gates.json")" = '{"bug":"me","chore":"me","hotfix":"me","implement":"me","plan":"me","specify":"me","triage":"me"}' ] || fail "gates.json must hold me for each of the seven steps"

cp "$root/.claude/celetis-flow/gates.json" "$tmp/real-gates.json"
reset; issue 7 OPEN enhancement "Spec: x"; after 7 1 OPEN enhancement "Spec: x" "## Plan"; issue 9 OPEN enhancement "An idea"
cp "$tmp/real-gates.json" "$repo/.claude/celetis-flow/gates.json"; git -C "$repo" commit -qam "the tracked gates"
run_flow 7
[ "$out" = "celetis-flow: start: /celetis:plan #7
celetis-flow: the gate of implement is me: scripts/celetis celetis-flow 7 starts /celetis:implement #7" ] || fail "with the tracked gates a start with a number must start one session: [$out] [$err]"
run_flow
[ "$code" -eq 143 ] && [ -z "$(calls claude-calls | sed 1d)" ] || fail "with the tracked gates the automatic runner must start nothing: $code [$(calls claude-calls)]"
git -C "$repo" revert --no-edit HEAD >/dev/null

reset; issue 5 OPEN bug "It breaks"; issue 7 OPEN enhancement "Spec: x"
git -C "$repo" config celetis-flow.gate.plan Auto
git -C "$repo" config celetis-flow.gate.bug auto
run_flow
[ "$(sessions)" = "5|/celetis:bug #5" ] || fail "git config must change a gate, and only the value auto is auto: [$(sessions)]"
run_flow 7
[ "$(sessions | tail -1)" = "7|/celetis:plan #7" ] || fail "a start with a number must start a me step: [$(sessions)]"

jq 'del(.plan)' "$repo/.claude/celetis-flow/gates.json" >"$tmp/gates.json"
cp "$tmp/gates.json" "$repo/.claude/celetis-flow/gates.json"
git -C "$repo" commit -qam "no gate for plan"
reset; issue 7 OPEN enhancement "Spec: x"
run_flow
[ -z "$(calls claude-calls)" ] || fail "a step with no entry must be a me step"

git -C "$repo" rm -q .claude/celetis-flow/gates.json
git -C "$repo" commit -qm "no gates.json"
reset; issue 7 OPEN enhancement "Spec: x"; after 7 1 OPEN enhancement "Spec: x" "## Plan"
run_flow 7
[ "$out" = "celetis-flow: start: /celetis:plan #7
celetis-flow: the gate of implement is me: scripts/celetis celetis-flow 7 starts /celetis:implement #7" ] && [ -z "$err" ] || fail "with no gates.json a start with a number must start one session, and print no error: [$out] [$err]"
run_flow
[ "$code" -eq 143 ] && [ -z "$(calls claude-calls | sed 1d)" ] && [ -z "$err" ] || fail "with no gates.json the automatic runner must start nothing, and print no error: $code [$(calls claude-calls)] [$err]"
run_flow --board
[ "$(printf '%s' "$out" | jq -cS '.flow.steps | map_values(.gate)')" = '{"bug":"me","chore":"me","hotfix":"me","implement":"me","plan":"me","specify":"me","triage":"me"}' ] && [ -z "$err" ] || fail "with no gates.json --board must show each gate as me, and print no error: [$out] [$err]"
git -C "$repo" revert --no-edit HEAD >/dev/null

field() { printf '%s' "$out" | jq -c ".issues[] | select(.number == $1) | $2"; }
doc() { printf '%s' "$out" | jq -c "$1"; }
# npx reads .npmrc and node_modules/.bin of the folder where it starts, and the test can start in a lane worktree.
checked() {
  [ "${CELETIS_FLOW_SKIP_BOARD_CHECK:-}" != 1 ] || return 0
  if [ -n "${AGENT_BOARD:-}" ]; then printf '%s' "$out" | node "$AGENT_BOARD" check --stdin >"$tmp/check" 2>&1
  else printf '%s' "$out" | ( cd "$tmp" && npx --yes 'github:ddinkov10/agent-board#semver:^2' check --stdin ) >"$tmp/check" 2>&1; fi ||
    fail "the --board document is not contract 1 (AGENT_BOARD names the entry file of a local agent-board checkout; else npx needs the network and the git credentials): $(cat "$tmp/check")"
}

mkdir "$tmp/checker-bin"
cat >"$tmp/checker-bin/node" <<'EOF'
#!/usr/bin/env bash
echo "${0##*/} $*" >>"$CHECKER_CALLS"
cat >/dev/null
EOF
cp "$tmp/checker-bin/node" "$tmp/checker-bin/npx"
chmod +x "$tmp/checker-bin/node" "$tmp/checker-bin/npx"
checker_calls() {
  : >"$tmp/checker-calls"
  (
    export PATH="$tmp/checker-bin:$PATH" CHECKER_CALLS="$tmp/checker-calls"
    unset AGENT_BOARD CELETIS_FLOW_SKIP_BOARD_CHECK
    [ $# -eq 0 ] || export "$@"
    out='{}'
    checked
  )
  cat "$tmp/checker-calls"
}
[ -z "$(checker_calls CELETIS_FLOW_SKIP_BOARD_CHECK=1 AGENT_BOARD=/board/cli.mjs)" ] || fail "CELETIS_FLOW_SKIP_BOARD_CHECK=1 must skip the checker"
[ "$(checker_calls AGENT_BOARD=/board/cli.mjs)" = "node /board/cli.mjs check --stdin" ] || fail "AGENT_BOARD must name the checker: [$(checker_calls AGENT_BOARD=/board/cli.mjs)]"
[ "$(checker_calls)" = "npx --yes github:ddinkov10/agent-board#semver:^2 check --stdin" ] || fail "with neither variable the pinned npx command must run: [$(checker_calls)]"

reset
issue 4 CLOSED bug "old"; issue 5 OPEN bug "It breaks"; issue 6 OPEN epic ""; issue 10 OPEN hotfix,needs-info ""
issue 7 OPEN enhancement "Spec: x"; issue 8 OPEN needs-triage "A typo"; issue 9 OPEN enhancement "An idea"
issue 11 OPEN chore,ready-for-human "" "## Landing refused"; issue 12 OPEN hotfix,ready-for-human "" "## Landing refused" "## Before landing"
git -C "$repo" config celetis-flow.gate.plan me
git -C "$repo" config celetis-flow.gate.chore auto; git -C "$repo" config celetis-flow.gate.specify auto
mkdir -p "$st"; printf '7\trun /celetis:plan #7\n' >"$st/no-progress"
touch "$S/hold-5"; tag=a- start_flow 5; a=$flow_pid; await 1
echo x >"$lane/new.txt"
: >"$S/gh-calls"
run_flow --board
[ "$code" -eq 0 ] && [ "$(doc '[.contract, .tracker, .noRun, .runner, [.issues[].number]]')" = '[1,"GitHub",null,false,[4,5,7,8,9,10,11,12]]' ] || fail "--board must print contract 1 with no row for an epic: $code [$out] [$err]"
checked
[ "$(field 4 '[.type, .state, .step, .closedAt, .title, .url]')" = '["bug","done",null,"2026-10-02T00:00:00Z","Issue 4","https://example.test/issues/4"]' ] || fail "--board, a closed issue: [$(field 4 .)]"
[ "$(field 5 '[.state, .step]')" = '["starting","bug"]' ] || fail "--board, a lock that a live script holds: [$(field 5 .)]"
[ "$(field 7 '[.type, .state, .step, .path, .started]')" = "[\"feature\",\"dirty\",\"plan\",\"$main/.claude/worktrees/7-crash\",true]" ] || fail "--board, a dirty lane worktree comes before a row of the record: [$(field 7 .)]"
[ "$(field 8 '[.state, .step, .started, .urgent]')" = '["ready","triage",false,false]' ] || fail "--board, a ready row: [$(field 8 .)]"
[ "$(field 9 '[.state, .step]')" = '["ready","specify"]' ] || fail "--board, a feature with no spec has the step specify: [$(field 9 .)]"
[ "$(field 10 '[.state, .reason, .act, .urgent]')" = '["blocked","needs info","Answer the questions on the issue, then remove the label.",true]' ] || fail "--board, a blocked hotfix: [$(field 10 .)]"
[ "$(field 11 '[.type, .state, .reason, .act, .step, .urgent]')" = '["chore","blocked","landing refused","Do the human step (e.g. the hotfix ship checklist), then remove the label.",null,false]' ] || fail "--board, a refused landing: [$(field 11 .)]"
[ "$(field 12 '[.state, .reason, .urgent]')" = '["blocked","ready for your step",true]' ] || fail "--board, a refusal that is not current: [$(field 12 .)]"
[ "$(doc '[.issues[] | has("line")] | any')" = false ] || fail "--board must print no line field"
[ "$(printf '%s' "$out" | jq -cS '.flow.steps | map_values(.gate)')" = '{"bug":"me","chore":"auto","hotfix":"me","implement":"auto","plan":"me","specify":"auto","triage":"auto"}' ] || fail "--board, the gate of each step from git config and gates.json: [$out]"
[ "$(doc '[.flow.lanes.feature, .flow.lanes.hotfix, [.flow.stages[].name], .flow.stages[1].steps, .flow.steps.implement.hint, .flow.steps.plan.hint]')" = '[["triage","specify","plan","implement"],["triage","hotfix"],["Triage","Define","Plan","Implement"],["specify","bug","chore","hotfix"],"It lands the change when the build is done.",null]' ] || fail "--board, the lanes, the stages, and the hints: [$out]"
[ "$(count gh-calls)" -eq 3 ] && calls gh-calls | grep -Eq '^issue list --state closed --search closed:>=[0-9]{4}-[0-9]{2}-[0-9]{2} --limit 200 --json ' || fail "--board must make 3 gh calls: [$(calls gh-calls)]"
[ "$(count claude-calls)" -eq 1 ] && [ "$(locks)" -eq 1 ] && [ "$(rows)" -eq 1 ] || fail "--board must start no session, take no lock, and write no row"
rm "$lane/new.txt"
run_flow --board
[ "$(field 7 '[.state, .step, .act, .started]')" = '["stuck","plan","scripts/celetis celetis-flow --resume 7",true]' ] || fail "--board, a row of the record: [$(field 7 .)]"
checked
touch "$S/hold-8"; tag=b- start_flow; b=$flow_pid; await 2
run_flow --board
[ "$code" -eq 0 ] && [ "$(doc .runner)" = true ] || fail "--board, a live automatic runner: $code [$out] [$err]"
checked
rm "$S/hold-8"; wait "$b" 2>/dev/null || true
echo dirty >"$repo/new.txt"
run_flow --board
[ "$(printf '%s' "$out" | jq -r .noRun)" = "The main checkout is dirty: $main. Commit or stash first." ] || fail "--board with a dirty main checkout: [$out]"
checked
rm "$repo/new.txt" "$S/hold-5"; wait "$a" 2>/dev/null || true

reset; mkdir -p "$st"; printf '7\trun /celetis:plan #7\n' >"$st/no-progress"
run_flow --resume 7
[ "$code" -eq 1 ] && [[ $err == *'no current session record'* ]] && [ -z "$(calls claude-calls)" ] || fail "--resume must reject an obsolete name record: $code [$err]"
[ "$(locks)" -eq 0 ] && [ -z "$(calls herdr-calls)" ] && [ -z "$(calls gh-calls)" ] && [ ! -e "$S/plugin-calls" ] || fail "--resume must take no lock, start no job, make no gh call, and update no plugin"

reset; issue 7 OPEN enhancement "Spec: x"
run_flow --board
[ "$code" -eq 0 ] && [ ! -e "$S/plugin-calls" ] || fail "--board must update no plugin: $code [$(calls plugin-calls)] [$err]"

[ "$(jq -c . "$root/.claude/celetis-flow/board.json")" = '{"data":["scripts/celetis","celetis-flow","--board"],"run":["scripts/celetis","celetis-flow","{n}"],"resume":["scripts/celetis","celetis-flow","--resume","{n}"],"port":4404}' ] || fail "board.json must hold the four keys"

reset; issue 7 OPEN enhancement "Spec: x"; touch "$S/gh-fail"
run_flow --board
[ "$code" -eq 1 ] && [ "$out" = "stop cannot read the issues from GitHub" ] && printf '%s' "$err" | grep -q "HTTP 502" || fail "--board with gh down: $code [$out] [$err]"

stale="$tmp/stale-plugin/scripts"
mkdir -p "$stale"
cp "$root/scripts/celetis-flow.sh" "$stale/"
stale_msg="the plugin version of this runner was removed after an update; start the runner again"
reset; issue 7 OPEN enhancement "Spec: x"
( cd "$repo" && PATH="$bin:$PATH" "$BASH" "$stale/celetis-flow.sh" 7 >"$tmp/stale-out" 2>"$tmp/stale-err" <"$tmp/stdin" ) || fail "a stale runner with numbers must exit 0"
[ "$(cat "$tmp/stale-out")" = "celetis-flow: #7: $stale_msg" ] && [ ! -s "$tmp/stale-err" ] || fail "a stale runner with numbers must name the removed version: [$(cat "$tmp/stale-out")] [$(cat "$tmp/stale-err")]"
[ -z "$(calls gh-calls)" ] || fail "a stale runner must not call gh: [$(calls gh-calls)]"
set +e
( cd "$repo" && PATH="$bin:$PATH" "$BASH" "$stale/celetis-flow.sh" --board >"$tmp/stale-out" 2>"$tmp/stale-err" <"$tmp/stdin" )
stale_code=$?
set -e
[ "$stale_code" -eq 1 ] && [ "$(cat "$tmp/stale-out")" = "stop $stale_msg" ] && [ ! -s "$tmp/stale-err" ] || fail "a stale --board must name the removed version: [$stale_code] [$(cat "$tmp/stale-out")] [$(cat "$tmp/stale-err")]"
reset; issue 7 OPEN enhancement "Spec: x"; echo 1 >"$S/sleep-limit"
set +e
( cd "$repo" && PATH="$bin:$PATH" "$BASH" "$stale/celetis-flow.sh" >"$tmp/stale-out" 2>"$tmp/stale-err" <"$tmp/stdin" )
stale_code=$?
set -e
[ "$stale_code" -eq 1 ] && [ "$(cat "$tmp/stale-out")" = "celetis-flow: stop $stale_msg" ] && [ ! -s "$tmp/stale-err" ] && [ ! -e "$S/sleeps" ] || fail "a stale automatic runner must stop at once with the true cause: [$stale_code] [$(cat "$tmp/stale-out")] [$(cat "$tmp/stale-err")]"
reset; issue 7 OPEN enhancement "Spec: x"; issue 8 OPEN enhancement "Spec: x"
( cd "$repo" && PATH="$bin:$PATH" "$BASH" "$stale/celetis-flow.sh" 7 8 >"$tmp/stale-out" 2>"$tmp/stale-err" <"$tmp/stdin" ) || fail "a stale runner with numbers must exit 0"
[ "$(cat "$tmp/stale-out")" = "celetis-flow: #7: $stale_msg
celetis-flow: #8: $stale_msg" ] && [ ! -s "$tmp/stale-err" ] || fail "a stale runner must name the removed version per number in order"
mkdir -p "$stale/next-step.sh"
reset; issue 7 OPEN enhancement "Spec: x"
( cd "$repo" && PATH="$bin:$PATH" "$BASH" "$stale/celetis-flow.sh" 7 >"$tmp/stale-out" 2>"$tmp/stale-err" <"$tmp/stdin" ) || fail "a stale runner with numbers must exit 0"
[ "$(cat "$tmp/stale-out")" = "celetis-flow: #7: $stale_msg" ] && [ ! -s "$tmp/stale-err" ] || fail "a stale runner with a directory at next-step.sh must name the removed version: [$(cat "$tmp/stale-out")] [$(cat "$tmp/stale-err")]"
[ -z "$(calls gh-calls)" ] || fail "a stale runner must not call gh: [$(calls gh-calls)]"

[ -f "$root/step-prompt.md" ] || fail "the step text is missing"
[ -x "$root/scripts/celetis-flow.sh" ] || fail "celetis-flow.sh must be executable"

echo "PASS"
