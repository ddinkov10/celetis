#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
base=$(mktemp -d)
. "$root/tests/lib/pool.sh"
export CELETIS_TEST_HERDR_FIXTURES="$root/tests/fixtures/herdr"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
unset HERDR_TAB_ID
export LIFECYCLE_GIT
LIFECYCLE_GIT=$(command -v git)
cleanup() {
  local d pids
  for d in "$base"/*/state; do touch "$d/finish-1" "$d/finish-2" 2>/dev/null || true; done
  pids=$(cat "$base"/*/pids 2>/dev/null | paste -sd , -)
  if [ -n "$pids" ]; then
    pkill -P "$pids" 2>/dev/null || true
    kill ${pids//,/ } 2>/dev/null || true
  fi
  rm -rf "$base"
}
trap cleanup EXIT
fail() { printf 'FAIL: %s\n' "$1"; exit 1; }
case_idle() {
  source "$root/scripts/lib/session.sh"
  herdr() {
    [ "$*" = "agent get $HERDR_PANE_ID" ] || return 1
    jq "$filter" "$CELETIS_TEST_HERDR_FIXTURES/$CELETIS_AGENT.json"
  }
  for CELETIS_AGENT in claude codex; do
    id=$(jq -r .result.agent.agent_session.value "$CELETIS_TEST_HERDR_FIXTURES/$CELETIS_AGENT.json")
    for status in idle done; do
      filter=".result.agent.agent_status=\"$status\""
      celetis_session_idle "$id" || fail "$CELETIS_AGENT $status was not idle with the current herdr reply"
    done
    for mutation in '.agent_status="working"' '.agent_status="blocked"' '.agent_status="unknown"' \
      'del(.agent_status)' '.agent_status="ready"' '.agent="other"' '.agent_session=null' \
      '.agent_session.agent="other"' '.agent_session.kind="name"' \
      '.agent_session.value="00000000-0000-4000-8000-000000000002"'; do
      filter=".result.agent |= (.agent_status=\"idle\" | $mutation)"
      ! celetis_session_idle "$id" || fail "$CELETIS_AGENT accepted an unsafe idle reply: $mutation"
    done
  done
}
await_file() {
  local count=0
  until [ -f "$1" ]; do
    count=$((count + 1))
    [ "$count" -le 600 ] || fail "timed out: $1; $(cat "$tmp"/*.err 2>/dev/null)"
    /bin/sleep 0.05
  done
}
mkdir -p "$base/bin"
cat >"$base/bin/host" <<'EOF'
#!/bin/bash
set -eu
S=$LIFECYCLE_TEST
host=${0##*/}
if [ "$1" = plugin ]; then
  printf '%s %s\n' "$host" "$*" >>"$S/updates"
  [ ! -f "$S/update-fail" ] || { echo "fixture: $host update unavailable" >&2; exit 1; }
  if [ "${2:-}" = list ]; then
    jq -nc --arg p "$LIFECYCLE_PLUGIN" '[{id:"celetis@celetis",scope:"user",enabled:true,installPath:$p}]'
  fi
  exit 0
fi
if [ "$1" = app-server ]; then
  while IFS= read -r line; do
    method=$(printf '%s\n' "$line" | jq -r .method)
    id=$(printf '%s\n' "$line" | jq -r .id)
    case $method in
      initialize) printf '{"id":%s,"result":{}}\n' "$id" ;;
      initialized) ;;
      config/read) printf '{"id":%s,"result":{"config":{}}}\n' "$id" ;;
      skills/list)
        jq -nc --argjson id "$id" --arg p "$LIFECYCLE_PLUGIN" --arg cwd "$PWD" \
          '{id:$id,result:{data:[{cwd:$cwd,skills:[{name:"celetis:guide",pluginId:"celetis@celetis",enabled:true,path:($p+"/skills/guide/SKILL.md")}]}]}}' ;;
      thread/read)
        jq -nc --argjson id "$id" --arg sid "$(cat "$S/id")" --arg cwd "$PWD" --argjson time "$(date +%s)" \
          '{id:$id,result:{thread:{id:$sid,cwd:$cwd,createdAt:$time,ephemeral:false}}}' ;;
      thread/turns/list) printf '{"id":%s,"result":{"data":[{"id":"turn"}]}}\n' "$id" ;;
      *) exit 82 ;;
    esac
  done
  exit 0
fi
if [ "$1" = resume ] || [ "$1" = --resume ]; then
  touch "$S/resumed"
  while [ -f "$S/hold-resume" ]; do /bin/sleep 0.05; done
  exit 0
fi
k=$(($(cat "$S/count" 2>/dev/null || echo 0) + 1))
echo "$k" >"$S/count"
printf '%s\n' "$host" >>"$S/hosts"
printf '00000000-0000-4000-8000-%012d\n' "$k" >"$S/id"
echo "$host" >"$S/host"
cat "$S/initial-status" >"$S/status"
mkdir -p "$CLAUDE_CONFIG_DIR/projects/fixture"
jq -nc --arg id "$(cat "$S/id")" --arg cwd "$PWD" --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{sessionId:$id,type:"user",cwd:$cwd,timestamp:$time}' >"$CLAUDE_CONFIG_DIR/projects/fixture/$(cat "$S/id").jsonl"
touch "$S/live" "$S/started-$k"
until [ -f "$S/finish-$k" ]; do
  [ -d "$S" ] || exit 1
  /bin/sleep 0.05
done
rm -f "$S/live"
exit "$(cat "$S/exit-code" 2>/dev/null || echo 0)"
EOF
cp "$base/bin/host" "$base/bin/claude"
cp "$base/bin/host" "$base/bin/codex"
cat >"$base/bin/sleep" <<'EOF'
#!/bin/bash
[ "$*" != 1 ] || exec /bin/sleep 0.05
exec /bin/sleep "$@"
EOF
cat >"$base/bin/gh" <<'EOF'
#!/bin/bash
S=$LIFECYCLE_TEST
[ "$1" = api ] || { echo "HTTP 403: GitHub GraphQL is not available from Claude Code sessions" >&2; exit 1; }
filter=. endpoint=
while [ $# -gt 0 ]; do case $1 in --jq) filter=$2; shift ;; repos/*) endpoint=$1 ;; esac; shift; done
case $endpoint in
  'repos/{owner}/{repo}/issues/7')
    if [ -f "$S/status-during-resolver" ]; then
      count=$(($(cat "$S/resolver-checks" 2>/dev/null || echo 0) + 1))
      echo "$count" >"$S/resolver-checks"
      if [ "$count" -eq 2 ]; then
        cp "$S/status-during-resolver" "$S/status"
        touch "$S/late-state-set"
      fi
    fi
    jq -r "(.comments |= length) | $filter" "$S/issue.json" ;;
  'repos/{owner}/{repo}/issues/7/comments?'*) jq -r ".comments | $filter" "$S/issue.json" ;;
  'repos/{owner}/{repo}/issues?state=open&'*) jq -r "[select(.state == \"open\") | .comments |= length] | $filter" "$S/issue.json" ;;
  *) exit 1 ;;
esac
EOF
cat >"$base/bin/git" <<'EOF'
#!/bin/bash
S=$LIFECYCLE_TEST
if [ -f "$S/hold-registration" ] && [ "$*" = 'update-ref --no-deref --stdin' ]; then
  cat >"$S/registration"
  touch "$S/registering"
  until [ -f "$S/allow-registration" ]; do
    [ -d "$S" ] || exit 1
    /bin/sleep 0.05
  done
  exec "$LIFECYCLE_GIT" "$@" <"$S/registration"
fi
exec "$LIFECYCLE_GIT" "$@"
EOF
cat >"$base/bin/herdr" <<'EOF'
#!/bin/bash
S=$LIFECYCLE_TEST
printf '%s\n' "$*" >>"$S/herdr-calls"
case "$1 $2" in
  'agent get')
    [ -f "$S/live" ] || exit 1
    jq -c --arg id "$(cat "$S/id")" --arg status "$(cat "$S/status")" --arg cwd "$PWD" --arg pane "$HERDR_PANE_ID" '
      .result.agent |= (.agent_status = $status | .cwd = $cwd | .foreground_cwd = $cwd | .pane_id = $pane
        | .agent_session.value = $id)
    ' "$CELETIS_TEST_HERDR_FIXTURES/$(cat "$S/host").json" ;;
  'agent wait')
    case " $* " in
      *' --until working --until blocked '*) [ ! -f "$S/late-state-set" ] || touch "$S/decision-made" ;;
    esac
    while [ -f "$S/live" ]; do
      case " $* " in
        *" --until $(cat "$S/status") "*)
          if [ -f "$S/status-after-wait" ]; then mv "$S/status-after-wait" "$S/status"; fi
          touch "$S/wait-returned"
          exit 0 ;;
      esac
      /bin/sleep 0.05
    done
    exit 1 ;;
  'agent prompt')
    echo /exit >>"$S/prompts"
    touch "$S/exit-submitted"
    [ ! -f "$S/late-state-set" ] || touch "$S/decision-made"
    [ ! -f "$S/prompt-fail" ] ;;
  'pane read') echo 'fixture output' ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$base/bin/"*
export PATH="$base/bin:$PATH"
setup_job() {
  tmp="$base/$1"
  export LIFECYCLE_TEST="$tmp/state" CLAUDE_CONFIG_DIR="$tmp/claude" CODEX_HOME="$tmp/codex"
  export LIFECYCLE_PLUGIN="$tmp/plugin"
  S=$LIFECYCLE_TEST
  plugin=$LIFECYCLE_PLUGIN
  repo="$tmp/project"
  mkdir -p "$S" "$plugin/skills/guide" "$repo/.claude/celetis-flow" "$repo/scripts"
  cp "$root/scripts/celetis" "$repo/scripts/celetis"
  cp -R "$root/scripts" "$root/.claude-plugin" "$plugin/"
  echo fixture >"$plugin/skills/guide/SKILL.md"
  echo fixture >"$plugin/step-prompt.md"
  git init -q "$repo"
  printf 'landing: merge\ngates:\n  plan: auto\n  implement: auto\n' >"$repo/.celetis.yaml"
  echo '.claude/worktrees/' >"$repo/.gitignore"
  git -C "$repo" add .
  git -C "$repo" commit -qm fixture
  common=$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)
  state="$common/celetis-flow"
  lane="$repo/.claude/worktrees/7-fixture"
  git -C "$repo" worktree add -q -b fix/7-fixture "$lane"
}
issue() {
  jq -nc --arg label "${1:-enhancement}" --arg state "${2:-OPEN}" --arg comment "${3:-}" \
    '{number:7,state:($state | ascii_downcase),labels:[{name:$label}],body:"Spec: fixture",comments:(if $comment == "" then [] else [{body:$comment}] end)}' >"$S/issue.json"
}
reset() {
  git -C "$repo" for-each-ref --format='%(refname)' refs/celetis-flow/locks | while IFS= read -r ref; do git -C "$repo" update-ref -d "$ref"; done
  rm -rf "$S" "$state" "$CLAUDE_CONFIG_DIR"
  mkdir -p "$S"
  echo working >"$S/initial-status"
  issue
}
start_runner() {
  set -- "${1:-issue}"
  if [ "$1" = issue ]; then set -- 7; else set --; fi
  (cd "$repo" && CELETIS_AGENT="$host" exec "$BASH" "$plugin/scripts/celetis-flow.sh" "$@" >"$tmp/out" 2>"$tmp/flow.err") &
  runner=$!
  echo "$runner" >>"$tmp/pids"
}
start() {
  start_runner "${1:-issue}"
  await_file "$S/started-1"
  await_identity 1
}
await_identity() {
  local tries=0
  until jq -e --arg id "$(printf '00000000-0000-4000-8000-%012d' "$1")" '.session_id == $id' "$state/sessions/7.json" >/dev/null 2>&1; do
    tries=$((tries + 1)); [ "$tries" -le 600 ] || fail "$host identity was not saved"
    /bin/sleep 0.05
  done
}
finish() {
  touch "$S/finish-1"
  result=0
  { wait "$runner" || result=$?; } 2>/dev/null
}
held() {
  local other=codex
  [ "$host" != codex ] || other=claude
  (cd "$repo" && CELETIS_AGENT="$other" "$BASH" "$plugin/scripts/celetis-flow.sh" 7) >"$tmp/other-out" 2>"$tmp/other.err" || fail "$other lock check failed"
  [ "$(cat "$S/count")" = 1 ] && grep -q 'another celetis-flow.sh' "$tmp/other-out" || fail "$other entered the active $host step"
}
case_late() {
  reset
  start
  issue enhancement CLOSED
  echo "$1" >"$S/status-during-resolver"
  echo idle >"$S/status"
  await_file "$S/decision-made"
  [ "$(cat "$S/resolver-checks")" -eq 2 ] || fail "$host did not reach the final resolver call"
  [ ! -f "$S/prompts" ] || fail "$host received /exit after the final resolver changed its state to $1"
  held
  finish
  [ "$result" -eq 0 ] || fail "$host $1 exited with $result"
}
case_saved() {
  reset
  echo "$1" >"$S/initial-status"
  start
  issue enhancement CLOSED
  /bin/sleep 0.3
  [ ! -e "$S/prompts" ] || fail "$host received /exit while its first saved turn was $1"
  held
  finish
  [ "$result" -eq 0 ] || fail "$host could not end its saved $1 session"
}
case_resume() {
  reset
  start
  code=0
  (cd "$repo" && scripts/celetis celetis-flow --resume 7) >"$tmp/resume-out" 2>"$tmp/resume.err" || code=$?
  [ "$code" -eq 1 ] && [ ! -e "$S/resumed" ] && grep -q 'works on #7' "$tmp/resume.err" || fail "$host resume entered a live issue"
  issue enhancement CLOSED
  finish
  : >"$S/updates"
  : >"$S/herdr-calls"
  touch "$S/hold-resume"
  (cd "$repo" && CELETIS_AGENT="$host" exec "$BASH" "$plugin/scripts/celetis-flow.sh" --resume 7) >"$tmp/resume-out" 2>"$tmp/resume.err" &
  runner=$!
  echo "$runner" >>"$tmp/pids"
  await_file "$S/resumed"
  held
  [ ! -s "$S/updates" ] && [ ! -s "$S/herdr-calls" ] || fail "$host resume refreshed or started a watcher"
  rm "$S/hold-resume"
  wait "$runner"
}
case_update() {
  reset
  if [ "$1" = failure ]; then
    touch "$S/update-fail" "$S/finish-1"
    start_runner
    finish
    [ "$result" -ne 0 ] && [ ! -e "$S/count" ] && [ ! -e "$state/no-progress" ] && [ ! -e "$state/sessions/7.json" ] || fail "$host failed refresh started a fallback session"
    grep -q "fixture: $host update unavailable" "$tmp/flow.err" || fail "$host lost the update failure cause"
  else
    start
    issue enhancement CLOSED
    finish
    [ "$result" -eq 0 ] || fail "$host successful refresh prevented the installed step"
  fi
  if [ "$host" = codex ]; then
    expected='codex plugin marketplace upgrade celetis'
  elif [ "$1" = failure ]; then
    expected='claude plugin marketplace update celetis'
  else
    expected='claude plugin marketplace update celetis
claude plugin update celetis@celetis --scope user
claude plugin list --json'
  fi
  [ "$(cat "$S/updates")" = "$expected" ] || fail "$host refreshed another host or marketplace"
  if [ "$1" = failure ]; then
    grep -qx 'celetis-flow: the plugin update failed; the step did not start' "$tmp/flow.err" || fail "$host failed refresh has no stop notice"
  fi
}
case_after_wait() {
  reset
  start
  issue enhancement CLOSED
  echo "$1" >"$S/status-after-wait"
  echo idle >"$S/status"
  await_file "$S/wait-returned"
  /bin/sleep 0.3
  [ ! -f "$S/prompts" ] || fail "$host received /exit after idle changed to $1"
  held
  finish
  [ "$result" -eq 0 ] || fail "$host $1 exited with $result"
}
case_guard() {
  reset
  start
  case $1 in
    unchanged) ;;
    dirty) issue enhancement CLOSED; echo dirty >"$lane/new" ;;
    missing) rm "$plugin/scripts/next-step.sh" ;;
    landing)
      issue enhancement CLOSED
      "$BASH" -c '/bin/sleep 30; :' "$tmp/land.sh" >/dev/null 2>&1 &
      landing=$!
      echo "$landing" >>"$tmp/pids"
      echo "$landing" >"$state/land-7.lock" ;;
  esac
  echo idle >"$S/status"
  await_file "$S/wait-returned"
  /bin/sleep 0.3
  [ ! -f "$S/prompts" ] || fail "$host received /exit with $1"
  held
  finish
  if [ "$1" = missing ]; then
    grep -q 'the plugin version of this runner was removed after an update; start the runner again' "$tmp/out" || fail "$host lost the stale-resource diagnosis"
  fi
  if [ "$1" = landing ]; then
    pkill -P "$landing" 2>/dev/null || true
    kill "$landing" 2>/dev/null || true
    wait "$landing" 2>/dev/null || true
  fi
}
case_ending() {
  reset
  start
  [ "$2" != failed ] || touch "$S/prompt-fail"
  issue enhancement CLOSED
  echo "$1" >"$S/status"
  await_file "$S/exit-submitted"
  /bin/sleep 0.2
  held
  [ "$(cat "$S/count")" = 1 ] && [ "$(wc -l <"$S/prompts" | tr -d ' ')" = 1 ] || fail "$host advanced before $2 exit completed"
  finish
  [ "$result" -eq 0 ] || fail "$host failed after actual exit"
}
case_term() {
  reset
  start
  issue enhancement CLOSED
  kill -TERM "$runner"
  /bin/sleep 0.2
  held
  finish
  [ "$result" -eq 143 ] || fail "$host runner termination did not wait for the foreground exit: $result"
}
case_registration() {
  reset
  touch "$S/hold-registration"
  start_runner "$1"
  await_file "$S/registering"
  kill -KILL "$runner"
  { wait "$runner" || true; } 2>/dev/null
  touch "$S/allow-registration"
  /bin/sleep 0.3
  [ ! -e "$S/count" ] || fail "$host started after its runner died before lock registration"
  reset
  start "$1"
  if [ "$1" = auto ]; then
    [ "$(git -C "$repo" rev-parse refs/celetis-flow/locks/runner)" = "$(git -C "$repo" rev-parse refs/celetis-flow/locks/issue-7)" ] || fail "$host did not register the foreground in both locks"
  fi
  issue enhancement CLOSED
  kill -KILL "$runner"
  { wait "$runner" || true; } 2>/dev/null
  held
  if [ "$1" = auto ]; then
    code=0
    (cd "$repo" && CELETIS_AGENT=codex "$BASH" "$plugin/scripts/celetis-flow.sh") >"$tmp/auto-out" 2>"$tmp/auto.err" || code=$?
    [ "$code" -eq 1 ] && grep -q 'another automatic runner or its session' "$tmp/auto.err" || fail "$host lost its automatic lock with a live foreground"
  fi
  touch "$S/finish-1"
  local attempt=0
  while [ -f "$S/live" ] && [ "$attempt" -lt 600 ]; do
    attempt=$((attempt + 1))
    /bin/sleep 0.05
  done
  [ ! -f "$S/live" ] || fail "$host orphaned session did not exit"
  (cd "$repo" && CELETIS_AGENT="$host" "$BASH" "$plugin/scripts/celetis-flow.sh" 7) >"$tmp/after-crash" 2>"$tmp/after-crash.err"
  grep -q 'stop #7 is finished' "$tmp/after-crash" || fail "$host session exit did not free the crashed runner's lock"
}
case_crash() {
  reset
  start
  echo 23 >"$S/exit-code"
  finish
  [ "$result" -ne 0 ] && [ ! -f "$state/no-progress" ] || fail "$host crash became no progress"
  grep -q 'session exited with status 23' "$tmp/flow.err" || fail "$host crash had no recovery message"
}
case_handoff() {
  reset
  start
  issue enhancement OPEN '## Plan'
  echo idle >"$S/status"
  await_file "$S/exit-submitted"
  held
  touch "$S/finish-1"
  await_file "$S/started-2"
  await_identity 2
  issue enhancement CLOSED
  touch "$S/finish-2"
  wait "$runner" || fail "$host handoff failed: $(cat "$tmp/flow.err")"
  [ "$(cat "$S/count")" = 2 ] || fail "$host did not hand off exactly once"
}
job() {
  setup_job "$1"
  host=$2
  "case_$3" "${4:-}" "${5:-}"
}
run() {
  local label="$*"
  pool_run "$label" job "${label// /-}" "$@"
}
pool_run idle case_idle
run claude late blocked
run codex late unknown
for host in claude codex; do
  run "$host" saved blocked
  run "$host" saved unknown
  run "$host" resume
  run "$host" update success
  run "$host" update failure
  run "$host" handoff
done
run claude after_wait blocked
run codex after_wait unknown
run claude guard unchanged
run claude guard dirty
run codex guard landing
run codex guard missing
run claude ending idle accepted
run claude ending done failed
run codex ending idle failed
run codex ending done accepted
run codex term
run claude registration issue
run codex registration auto
run claude crash
pool_wait
echo PASS
