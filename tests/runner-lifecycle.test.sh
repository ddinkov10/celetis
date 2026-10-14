#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
export LIFECYCLE_TEST="$tmp/state" CLAUDE_CONFIG_DIR="$tmp/claude"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export HERDR_ENV=1 HERDR_PANE_ID=w1:p1
unset HERDR_TAB_ID
S=$LIFECYCLE_TEST
plugin="$tmp/plugin"
repo="$tmp/project"
mkdir -p "$S" "$plugin" "$repo/.claude/celetis-flow" "$tmp/bin"
mkdir -p "$repo/scripts"
cp "$root/scripts/celetis" "$repo/scripts/celetis"
cp -R "$root/scripts" "$root/.claude-plugin" "$plugin/"
mkdir -p "$plugin/skills/guide"
echo fixture >"$plugin/skills/guide/SKILL.md"
echo fixture >"$plugin/step-prompt.md"
export LIFECYCLE_PLUGIN="$plugin"
export LIFECYCLE_GIT
LIFECYCLE_GIT=$(command -v git)
trap 'touch "$S/finish-1" "$S/finish-2" 2>/dev/null || true; kill $(cat "$tmp/pids" 2>/dev/null) 2>/dev/null || true; rm -rf "$tmp"' EXIT
fail() { printf 'FAIL: %s\n' "$1"; exit 1; }
await_file() {
  local count=0
  until [ -f "$1" ]; do
    count=$((count + 1))
    [ "$count" -le 200 ] || fail "timed out: $1; $(cat "$tmp"/*.err 2>/dev/null)"
    /bin/sleep 0.05
  done
}
cat >"$tmp/bin/host" <<'EOF'
#!/bin/bash
set -eu
S=$LIFECYCLE_TEST
host=${0##*/}
if [ "$1" = plugin ]; then
  printf '%s %s\n' "$host" "$*" >>"$S/updates"
  [ ! -f "$S/update-fail" ] || exit 1
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
echo working >"$S/status"
mkdir -p "$CLAUDE_CONFIG_DIR/projects/fixture"
jq -nc --arg id "$(cat "$S/id")" --arg cwd "$PWD" --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{sessionId:$id,type:"user",cwd:$cwd,timestamp:$time}' >"$CLAUDE_CONFIG_DIR/projects/fixture/$(cat "$S/id").jsonl"
touch "$S/live" "$S/started-$k"
until [ -f "$S/finish-$k" ]; do /bin/sleep 0.05; done
rm -f "$S/live"
exit "$(cat "$S/exit-code" 2>/dev/null || echo 0)"
EOF
cp "$tmp/bin/host" "$tmp/bin/claude"
cp "$tmp/bin/host" "$tmp/bin/codex"
cat >"$tmp/bin/gh" <<'EOF'
#!/bin/bash
S=$LIFECYCLE_TEST
case "$1 $2" in
  'issue view')
    if [ -f "$S/status-during-resolver" ]; then
      count=$(($(cat "$S/resolver-checks" 2>/dev/null || echo 0) + 1))
      echo "$count" >"$S/resolver-checks"
      if [ "$count" -eq 2 ]; then
        cp "$S/status-during-resolver" "$S/status"
        touch "$S/late-state-set"
      fi
    fi
    cat "$S/issue.json" ;;
  'issue list') jq -s . "$LIFECYCLE_TEST/issue.json" ;;
  *) exit 1 ;;
esac
EOF
cat >"$tmp/bin/git" <<'EOF'
#!/bin/bash
S=$LIFECYCLE_TEST
if [ -f "$S/hold-registration" ] && [ "$*" = 'update-ref --no-deref --stdin' ]; then
  cat >"$S/registration"
  touch "$S/registering"
  until [ -f "$S/allow-registration" ]; do /bin/sleep 0.05; done
  exec "$LIFECYCLE_GIT" "$@" <"$S/registration"
fi
exec "$LIFECYCLE_GIT" "$@"
EOF
cat >"$tmp/bin/herdr" <<'EOF'
#!/bin/bash
S=$LIFECYCLE_TEST
printf '%s\n' "$*" >>"$S/herdr-calls"
case "$1 $2" in
  'agent get')
    [ -f "$S/live" ] || exit 1
    jq -nc --arg host "$(cat "$S/host")" --arg id "$(cat "$S/id")" --arg status "$(cat "$S/status")" \
      '{result:{agent:{agent:$host,interactive_ready:true,agent_status:$status,agent_session:{agent:$host,kind:"id",value:$id}}}}' ;;
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
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH"
git init -q "$repo"
echo '{"plan":"auto","implement":"auto"}' >"$repo/.claude/celetis-flow/gates.json"
echo '.claude/worktrees/' >"$repo/.gitignore"
git -C "$repo" add .
git -C "$repo" commit -qm fixture
common=$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)
state="$common/celetis-flow"
lane="$repo/.claude/worktrees/7-fixture"
git -C "$repo" worktree add -q -b fix/7-fixture "$lane"
issue() {
  jq -nc --arg label "${1:-enhancement}" --arg state "${2:-OPEN}" --arg comment "${3:-}" \
    '{number:7,state:$state,labels:[{name:$label}],body:"Spec: fixture",comments:(if $comment == "" then [] else [{body:$comment}] end)}' >"$S/issue.json"
}
reset() {
  git -C "$repo" for-each-ref --format='%(refname)' refs/celetis-flow/locks | while IFS= read -r ref; do git -C "$repo" update-ref -d "$ref"; done
  rm -rf "$S" "$state" "$CLAUDE_CONFIG_DIR"
  mkdir -p "$S"
  issue
}
start_runner() {
  set -- "${1:-issue}"
  if [ "$1" = issue ]; then set -- 7; else set --; fi
  (cd "$repo" && CELETIS_HOST="$host" exec "$BASH" "$plugin/scripts/celetis-flow.sh" "$@" >"$tmp/out" 2>"$tmp/flow.err") &
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
    tries=$((tries + 1)); [ "$tries" -le 200 ] || fail "$host identity was not saved"
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
  (cd "$repo" && CELETIS_HOST="$other" "$BASH" "$plugin/scripts/celetis-flow.sh" 7) >"$tmp/other-out" 2>"$tmp/other.err" || fail "$other lock check failed"
  [ "$(cat "$S/count")" = 1 ] && grep -q 'another celetis-flow.sh' "$tmp/other-out" || fail "$other entered the active $host step"
}
late_failures=0
for host in claude codex; do
  for status in blocked unknown; do
    reset
    start
    issue enhancement CLOSED
    echo "$status" >"$S/status-during-resolver"
    echo idle >"$S/status"
    await_file "$S/decision-made"
    [ "$(cat "$S/resolver-checks")" -eq 2 ] || fail "$host did not reach the final resolver call"
    if [ -f "$S/prompts" ]; then
      printf 'FAIL: %s received /exit after the final resolver changed its state to %s\n' "$host" "$status"
      late_failures=$((late_failures + 1))
    fi
    held
    finish
    [ "$result" -eq 0 ] || fail "$host $status exited with $result"
  done
done
[ "$late_failures" -eq 0 ] || exit 1
for host in claude codex; do
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
  (cd "$repo" && CELETIS_HOST="$host" exec "$BASH" "$plugin/scripts/celetis-flow.sh" --resume 7) >"$tmp/resume-out" 2>"$tmp/resume.err" &
  runner=$!
  echo "$runner" >>"$tmp/pids"
  await_file "$S/resumed"
  held
  [ ! -s "$S/updates" ] && [ ! -s "$S/herdr-calls" ] || fail "$host resume refreshed or started a watcher"
  rm "$S/hold-resume"
  wait "$runner"
  for update in success failure; do
    reset
    [ "$update" != failure ] || touch "$S/update-fail"
    start
    issue enhancement CLOSED
    finish
    [ "$result" -eq 0 ] || fail "$host $update refresh prevented the installed step"
    if [ "$host" = codex ]; then
      expected='codex plugin marketplace upgrade celetis'
    elif [ "$update" = failure ]; then
      expected='claude plugin marketplace update celetis'
    else
      expected='claude plugin marketplace update celetis
claude plugin update celetis@celetis --scope user
claude plugin list --json'
    fi
    [ "$(cat "$S/updates")" = "$expected" ] || fail "$host refreshed another host or marketplace"
    if [ "$update" = failure ]; then
      grep -qx 'celetis-flow: the plugin update failed; the session starts on the installed version' "$tmp/out" || fail "$host failed refresh has no notice"
    fi
  done
  for status in blocked unknown; do
    reset
    start
    issue enhancement CLOSED
    echo "$status" >"$S/status-after-wait"
    echo idle >"$S/status"
    await_file "$S/wait-returned"
    /bin/sleep 0.3
    [ ! -f "$S/prompts" ] || fail "$host received /exit after idle changed to $status"
    held
    finish
    [ "$result" -eq 0 ] || fail "$host $status exited with $result"
  done
  for guard in unchanged dirty landing missing; do
    reset
    start
    case $guard in
      unchanged) ;;
      dirty) issue enhancement CLOSED; echo dirty >"$lane/new" ;;
      missing) rm "$plugin/scripts/next-step.sh" ;;
      landing)
        issue enhancement CLOSED
        "$BASH" -c '/bin/sleep 30; :' "$tmp/land.sh" &
        landing=$!
        echo "$landing" >>"$tmp/pids"
        echo "$landing" >"$state/land-7.lock" ;;
    esac
    echo idle >"$S/status"
    await_file "$S/wait-returned"
    /bin/sleep 0.3
    [ ! -f "$S/prompts" ] || fail "$host received /exit with $guard"
    held
    finish
    if [ "$guard" = missing ]; then
      grep -q 'the plugin version of this runner was removed after an update; start the runner again' "$tmp/out" || fail "$host lost the stale-resource diagnosis"
      cp "$root/scripts/next-step.sh" "$plugin/scripts/next-step.sh"
    fi
    if [ "$guard" = landing ]; then kill "$landing" 2>/dev/null || true; wait "$landing" 2>/dev/null || true; fi
    rm -f "$lane/new"
  done
  for submit in accepted failed; do
    reset
    start
    [ "$submit" != failed ] || touch "$S/prompt-fail"
    issue enhancement CLOSED
    echo idle >"$S/status"
    await_file "$S/exit-submitted"
    /bin/sleep 0.2
    held
    [ "$(cat "$S/count")" = 1 ] && [ "$(wc -l <"$S/prompts" | tr -d ' ')" = 1 ] || fail "$host advanced before $submit exit completed"
    finish
    [ "$result" -eq 0 ] || fail "$host failed after actual exit"
  done
  reset
  start
  issue enhancement CLOSED
  kill -TERM "$runner"
  /bin/sleep 0.2
  held
  finish
  [ "$result" -eq 143 ] || fail "$host runner termination did not wait for the foreground exit: $result"
  for mode in issue auto; do
    reset
    touch "$S/hold-registration"
    start_runner "$mode"
    await_file "$S/registering"
    kill -KILL "$runner"
    { wait "$runner" || true; } 2>/dev/null
    touch "$S/allow-registration"
    /bin/sleep 0.3
    [ ! -e "$S/count" ] || fail "$host started after its runner died before lock registration"
    reset
    start "$mode"
    if [ "$mode" = auto ]; then
      [ "$(git -C "$repo" rev-parse refs/celetis-flow/locks/runner)" = "$(git -C "$repo" rev-parse refs/celetis-flow/locks/issue-7)" ] || fail "$host did not register the foreground in both locks"
    fi
    issue enhancement CLOSED
    kill -KILL "$runner"
    { wait "$runner" || true; } 2>/dev/null
    held
    if [ "$mode" = auto ]; then
      code=0
      (cd "$repo" && CELETIS_HOST=codex "$BASH" "$plugin/scripts/celetis-flow.sh") >"$tmp/auto-out" 2>"$tmp/auto.err" || code=$?
      [ "$code" -eq 1 ] && grep -q 'another automatic runner or its session' "$tmp/auto.err" || fail "$host lost its automatic lock with a live foreground"
    fi
    touch "$S/finish-1"
    for attempt in {1..200}; do
      [ ! -f "$S/live" ] && break
      /bin/sleep 0.05
    done
    [ ! -f "$S/live" ] || fail "$host orphaned session did not exit"
    (cd "$repo" && CELETIS_HOST="$host" "$BASH" "$plugin/scripts/celetis-flow.sh" 7) >"$tmp/after-crash" 2>"$tmp/after-crash.err"
    grep -q 'stop #7 is finished' "$tmp/after-crash" || fail "$host session exit did not free the crashed runner's lock"
  done
  reset
  start
  echo 23 >"$S/exit-code"
  finish
  [ "$result" -ne 0 ] && [ ! -f "$state/no-progress" ] || fail "$host crash became no progress"
  grep -q 'session exited with status 23' "$tmp/flow.err" || fail "$host crash had no recovery message"
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
done
echo PASS
