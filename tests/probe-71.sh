#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(dirname "$here")
tmp=$(mktemp -d)
ln -s "$root" "$tmp/plug in"
plugin="$tmp/plug in"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export CELETIS_FLOW_TEST_STATE="$tmp/state"
export CELETIS_AGENT=claude
export CELETIS_FLOW_TEST_PLUGIN="$plugin" CELETIS_FLOW_TEST_PERL="$(command -v perl)"
export CLAUDE_CONFIG_DIR="$tmp/claude config" CODEX_HOME="$tmp/codex config"
export CELETIS_TEST_HERDR_FIXTURES="$root/tests/fixtures/herdr"
unset HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
S=$CELETIS_FLOW_TEST_STATE
# A test that fails must leave no runner alive: an automatic runner has no end of its own.
trap 'kill $(cat "$S/runner-pids" 2>/dev/null) "${landing:-}" "${lock_holder:-}" 2>/dev/null || true; [ -z "${update_pid:-}" ] || kill -KILL -- "-$update_pid" 2>/dev/null || true; kill -KILL $(cat "$S/codex-pid" "$S/codex-child" 2>/dev/null) 2>/dev/null || true; rm -rf "$tmp"' EXIT
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
[ "$1" = api ] || { echo "HTTP 403: GitHub GraphQL is not available from Claude Code sessions" >&2; exit 1; }
[ ! -f "$S/gh-fail" ] || { echo "HTTP 502" >&2; exit 1; }
filter=. endpoint=
while [ $# -gt 0 ]; do
  case $1 in
    --jq) filter=$2; shift ;;
    repos/*) endpoint=$1 ;;
  esac
  shift
done
issue=${endpoint#repos/\{owner\}/\{repo\}/issues/}
n=${issue%%/*}
case $endpoint in
  'repos/{owner}/{repo}/issues/'*/comments'?'*)
    [ -f "$S/issue-$n.json" ] || { echo "no issue $n" >&2; exit 1; }
    jq -r ".comments | $filter" "$S/issue-$n.json" ;;
  'repos/{owner}/{repo}/issues/'*)
    [ -f "$S/issue-$n.json" ] && [ ! -f "$S/view-fail-$n" ] || { echo "no issue $n" >&2; exit 1; }
    jq -r "(.comments |= length) | $filter" "$S/issue-$n.json" ;;
  'repos/{owner}/{repo}/issues?state='*)
    state=${endpoint#*state=}
    cat "$S"/issue-*.json 2>/dev/null | jq -s --arg s "${state%%&*}" 'map(select(.state == $s) | .comments |= length)' | jq -r "$filter" ;;
  'repos/{owner}/{repo}/pulls?state=open&'*) echo '[]' | jq -r "$filter" ;;
  *) echo "fake gh: unexpected $endpoint" >&2; exit 1 ;;
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
  [ ! -f "$S/plugin-fail-$2" ] || { echo "probe: $2 failed" >&2; exit 23; }
  if [ -f "$S/plugin-hang-$2" ]; then
    trap '' TERM
    echo "$$" >"$S/plugin-pid"
    bash -c 'trap "" TERM; echo "$$" >"$CELETIS_FLOW_TEST_STATE/plugin-child"; /bin/sleep 30' &
    wait
  fi
  if [ "$2" = marketplace ] && [ -f "$S/hold-update" ]; then
    mkdir "$S/update-active" 2>/dev/null || touch "$S/update-overlap"
    touch "$S/update-entered"
    while [ -f "$S/hold-update" ]; do /bin/sleep 0.05; done
    rmdir "$S/update-active" 2>/dev/null || true
  fi
  [ "$2" != list ] || {
    cat "$S/plugin-list" 2>/dev/null || printf '[{"id":"celetis@celetis","version":"test","scope":"user","enabled":true,"installPath":"%s"}]\n' "$CELETIS_FLOW_TEST_PLUGIN"
    exit 0
  }
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
[ ! -f "$S/invalid-config" ] || cp "$S/invalid-config" .celetis.yaml
exit "$(cat "$S/claude-exit" 2>/dev/null || echo 0)"
EOF
cat >"$bin/codex" <<'EOF'
#!/usr/bin/env bash
S=$CELETIS_FLOW_TEST_STATE
printf '%s\n' "$*" >>"$S/codex-calls"
[ "$*" != 'plugin marketplace upgrade celetis' ] || exit 0
[ "$*" = 'app-server --stdio' ] || exit 81
while IFS= read -r line; do
  case $(printf '%s\n' "$line" | jq -r .method) in
    initialize) echo '{"id":1,"result":{}}' ;;
    initialized) ;;
    skills/list)
      echo 'fixture: skills catalog lookup stalled with original cause' >&2
      echo "$$" >"$S/codex-pid"
      bash -c 'trap "" TERM; echo "$$" >"$CELETIS_FLOW_TEST_STATE/codex-child"; exec /bin/sleep 30' &
      wait
      ;;
    *) exit 82 ;;
  esac
done
EOF
cat >"$bin/perl" <<'EOF'
#!/usr/bin/env bash
case $1 in */plugin-update.pl) ;; *) exec "$CELETIS_FLOW_TEST_PERL" "$@" ;; esac
echo "$$" >>"$CELETIS_FLOW_TEST_STATE/helpers"
if [ ! -f "$CELETIS_FLOW_TEST_STATE/fast-clock" ]; then exec "$CELETIS_FLOW_TEST_PERL" "$@"; fi
exec "$CELETIS_FLOW_TEST_PERL" -MTime::HiRes -e '
  my $clock = \&Time::HiRes::clock_gettime;
  {
    no warnings "redefine";
    *Time::HiRes::clock_gettime = sub { $clock->(@_) * 120 };
  }
  $0 = shift @ARGV;
  do $0 or die $@ || $!;
' "$@"
EOF
cat >"$bin/herdr" <<'EOF'
#!/usr/bin/env bash
S=$CELETIS_FLOW_TEST_STATE
printf '%s\n' "$*" >>"$S/herdr-calls"
case "$1 $2 $*" in
  "tab rename"*) ;;
  "agent get"*)
    [ -f "$S/claude-live" ] || exit 1
    jq -c --arg cwd "$PWD" --arg pane "$HERDR_PANE_ID" '
      .result.agent |= (.agent_status = "idle" | .cwd = $cwd | .foreground_cwd = $cwd | .pane_id = $pane
        | .agent_session.value = "00000000-0000-4000-8000-000000000001")
    ' "$CELETIS_TEST_HERDR_FIXTURES/claude.json" ;;
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
chmod +x "$bin/gh" "$bin/claude" "$bin/codex" "$bin/herdr" "$bin/sleep" "$bin/perl"
cp "$bin/gh" "$nobin/gh"
ln -s "$(command -v jq)" "$nobin/jq"
ln -s "$(command -v git)" "$nobin/git"
ln -s "$(command -v dirname)" "$nobin/dirname"
ln -s "$(command -v mkdir)" "$nobin/mkdir"
for tool in yq perl mktemp rm cat; do ln -s "$(command -v "$tool")" "$nobin/$tool"; done
export PATH="$bin:$PATH"

repo="$tmp/re po"
git init -q "$repo"
git -C "$repo" config core.autocrlf false
cat >"$repo/.celetis.yaml" <<'EOF'
landing: merge
gates:
  triage: auto
  plan: auto
  implement: auto
worktreeSetup: touch "$CELETIS_FLOW_TEST_STATE/setup-ran"
EOF
cp "$repo/.celetis.yaml" "$tmp/initial-config"
cp "$repo/.celetis.yaml" "$tmp/flow-config"
printf '.claude/worktrees/\n' >"$repo/.gitignore"
git -C "$repo" add -A
git -C "$repo" commit -qm base
common=$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)
main=$(dirname "$common")
st="$common/celetis-flow"
lane="$repo/.claude/worktrees/7-crash"
git -C "$repo" worktree add -q -b fix/7-crash "$lane"
printf 'landing: pr\nhost: codex\ngates:\n  specify: auto\n  bug: auto\n  chore: auto\n  hotfix: auto\n' >"$lane/.celetis.yaml"
git -C "$lane" commit -qam lane-config
mkdir "$repo/config-sub" "$lane/config-sub"

reset() {
  rm -rf "$S" "$st"
  mkdir -p "$S"
  printf 'one\ntwo\nthree\nfour\nfive\n' >"$tmp/stdin"
  git -C "$repo" config --remove-section celetis-flow.gate 2>/dev/null || true
  if ! cmp -s "$tmp/flow-config" "$repo/.celetis.yaml"; then
    cp "$tmp/flow-config" "$repo/.celetis.yaml"
    git -C "$repo" add .celetis.yaml
    git -C "$repo" commit -qm reset-config
  fi
}
set_gate() {
  yq -i ".gates.$1 = \"$2\"" "$repo/.celetis.yaml"
  git -C "$repo" commit -qam gate-config
}

closed_at=$(jq -rn 'now | todate')
issue() {
  local dir=${into:-$S} n=$1 state=$2 labels=$3 body=$4
  shift 4
  mkdir -p "$dir"
  jq -n --argjson n "$n" --arg s "$state" --arg l "$labels" --arg b "$body" --arg closed "$closed_at" \
    '{number: $n, title: "Issue \($n)", html_url: "https://example.test/issues/\($n)", state: ($s | ascii_downcase), updated_at: "2026-10-01T00:00:00Z", closed_at: (if $s == "CLOSED" then $closed else null end), labels: ($l | split(",") | map(select(. != "") | {name: .})), body: (if $b == "" then null else $b end), comments: ($ARGS.positional | map({body: .}))}' \
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
  [ ! -e "$S/setup-ran" ] || fail "runner executed worktree setup"
}
run_flow() { start_flow "$@"; end_flow; }

calls() { cat "$S/$1" 2>/dev/null || true; }
count() { calls "$1" | wc -l | tr -d ' '; }
await_count() {
  local tries=0
  until [ "$(count "$1")" -ge "$2" ]; do
    tries=$((tries + 1))
    [ "$tries" -le 400 ] || fail "$1 did not reach $2 calls in 20 seconds: [$(calls "$1")]"
    /bin/sleep 0.05
  done
}
await() { await_count claude-calls "$1"; }
await_file() {
  local tries=0
  until [ -f "$1" ]; do
    tries=$((tries + 1))
    [ "$tries" -le 400 ] || fail "the update did not reach $1 in 20 seconds"
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
moved="$tmp/moved plugin Ж"
bare="$tmp/bare plugin"
mkdir -p "$moved/scripts" "$bare/scripts"
cp "$root/scripts/root.sh" "$moved/scripts/root.sh"
cp "$root/scripts/root.sh" "$bare/scripts/root.sh"
echo "the step text of the moved plugin" >"$moved/step-prompt.md"
plugin_list() { printf '[{"id":"celetis@celetis","scope":"user","enabled":true,"installPath":"%s"}]\n' "$1" >"$S/plugin-list"; }
export PROBE_LOG="$tmp/probe.log"
: >"$PROBE_LOG"
echo "probe: $(uname -sr) nproc=$(nproc 2>/dev/null) pid_max=$(cat /proc/sys/kernel/pid_max 2>/dev/null) $("$BASH" --version | head -1)"
echo "probe: pid 1 is $(ps -p 1 -o comm= 2>/dev/null)"
i=0 hits=0 gone=0 zombie=0
for stage in $PROBE_STAGES; do
  i=$((i + 1))
  reset; issue 7 OPEN enhancement "Spec: x"; touch "$S/plugin-hang-$stage" "$S/fast-clock"
  start_flow 7
  await_file "$S/plugin-child"
  update_pid=$(cat "$S/plugin-pid")
  update_child=$(cat "$S/plugin-child")
  echo "== $stage update_pid=$update_pid" >>"$PROBE_LOG"
  hogs=
  if [ -n "${PROBE_HOGS:-}" ]; then
    renice -n 19 -p "$update_pid" >/dev/null
    for _ in $(seq "$PROBE_HOGS"); do yes >/dev/null & hogs="$hogs $!"; done
  fi
  end_flow
  [ "$code" -ne 0 ] && [ "$(count claude-calls)" -eq 0 ] && [ ! -e "$st/no-progress" ] || echo "probe: $i unexpected end: $code"
  phase=$stage
  [ "$stage" != list ] || phase='--agent claude root'
  [[ $err == *"timed out"* && $err == *"$phase"* && $err == *"fake claude plugin: error"* ]] || echo "probe: $i unexpected stderr"
  st_now=$(ps -p "$update_pid" -o stat= 2>/dev/null | tr -d ' ' || true)
  t_check=$(perl -MTime::HiRes=time -e 'printf q(%.3f), time')
  line_now=$(ps -p "$update_pid" -o pid=,ppid=,pgid=,stat=,wchan:24=,command= 2>/dev/null || true)
  st_child=$(ps -p "$update_child" -o stat= 2>/dev/null | tr -d ' ' || true)
  [ -z "$hogs" ] || { kill $hogs; wait $hogs 2>/dev/null || true; }
  t_kill=$(grep '^== KILL t=' "$PROBE_LOG" | tail -1 | sed 's/.* t=//')
  gap=$(perl -e 'printf q(%d), ($ARGV[0] - $ARGV[1]) * 1000' "$t_check" "$t_kill")
  case $st_now in
    '') gone=$((gone + 1)); echo "probe: $i $stage gone child=[$st_child] kill_to_check=${gap}ms" ;;
    *Z*) zombie=$((zombie + 1)); echo "probe: $i $stage zombie [$st_now] child=[$st_child] kill_to_check=${gap}ms" ;;
    *)
      hits=$((hits + 1))
      states=$st_now n=0
      while :; do
        s=$(ps -p "$update_pid" -o stat= 2>/dev/null | tr -d ' ' || true)
        case $s in '' | *Z*) break ;; esac
        case " $states " in *" $s "*) ;; *) states="$states $s" ;; esac
        n=$((n + 1))
        [ "$n" -lt 3500 ] || break
        /bin/sleep 0.01
      done
      t_stop=$(perl -MTime::HiRes=time -e 'printf q(%.3f), time')
      echo "probe: $i $stage HIT [$st_now] child=[$st_child] kill_to_check=${gap}ms stopped=[$s] $(perl -e 'printf q(%d), ($ARGV[0] - $ARGV[1]) * 1000' "$t_stop" "$t_check")ms after the check, states:$states"
      echo "probe: $i ps at check: $line_now"
      ;;
  esac
done
echo "probe: the tree at the last KILL:"
awk '/^== before KILL/ { block = $0 "\n"; next } /^== / { next } { block = block $0 "\n" } END { printf "%s", block }' "$PROBE_LOG"
echo "probe: summary: $i runs, $gone gone, $zombie zombie, $hits live at the check"
