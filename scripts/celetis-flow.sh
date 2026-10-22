#!/usr/bin/env bash
set -euo pipefail

usage="usage: scripts/celetis celetis-flow [<issue number>...] | --board | --resume <issue number>, e.g. scripts/celetis celetis-flow 373 374; with no number, the automatic runner"
issues=
mode=
if [ $# -eq 1 ] && [ "$1" = --board ]; then
  mode=board
elif [ $# -eq 2 ] && [ "$1" = --resume ]; then
  mode=resume
  issues=${2#\#}
  [[ $issues =~ ^[1-9][0-9]*$ ]] || {
    echo "$usage" >&2
    exit 2
  }
else
  for arg; do
    n=${arg#\#}
    [[ $n =~ ^[1-9][0-9]*$ ]] || {
      echo "$usage" >&2
      exit 2
    }
    issues="$issues $n"
  done
fi

die() {
  printf 'celetis-flow: %s\n' "$1" >&2
  exit 1
}

for tool in jq git; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not on PATH"
done

here=$(cd "$(dirname "$0")" && pwd)
root=$(dirname "$here")
common=$(git rev-parse --path-format=absolute --git-common-dir)
main=$(dirname "$common")
next="$here/next-step.sh"
stale="stop the plugin version of this runner was removed after an update; start the runner again"
stale_n() { printf '#%s: the plugin version of this runner was removed after an update; start the runner again' "$1"; }
gone() {
  local file
  for file in "$next" "$here/celetis" "$here/lib/host.sh" "$here/lib/session.sh" "$here/plugin-update.pl"; do
    [ -f "$file" ] || return 0
  done
  return 1
}
state="$common/celetis-flow"
record="$state/no-progress"
cd "$main"

[ -n "$mode" ] || mode=numbers
[ "$mode" != numbers ] || [ -n "$issues" ] || mode=auto
managed=
if ! gone; then
  source "$here/lib/host.sh"
  source "$here/lib/session.sh"
  if [ "$mode" = resume ]; then
    celetis_session_select "$issues" || exit $?
    if [ "${CELETIS_RESUME_RECORD+x}" = x ] && [ "$CELETIS_RESUME_RECORD" != "$CELETIS_SESSION" ]; then
      die "the session record changed during package discovery; run the resume command again"
    fi
    unset CELETIS_RESUME_RECORD
    config=$(celetis_config_read "$main") || exit $?
    celetis_host_require || exit $?
    session_id=$(printf '%s\n' "$CELETIS_SESSION" | jq -r .session_id)
    cd "$(printf '%s\n' "$CELETIS_SESSION" | jq -r .checkout)"
  else
    config=$(celetis_config_read "$main") || exit $?
    celetis_host_require || exit $?
    command -v gh >/dev/null 2>&1 || die "gh is not on PATH"
    if [ "${HERDR_ENV:-}" = 1 ]; then
      [[ ${HERDR_PANE_ID:-} =~ ^w[A-Za-z0-9]+:p[A-Za-z0-9]+$ ]] || die "HERDR_ENV=1 needs a valid HERDR_PANE_ID; start from a herdr pane"
      command -v herdr >/dev/null 2>&1 || die "herdr is not on PATH"
      managed=1
    fi
  fi
elif [ "$mode" = resume ]; then
  die "the plugin version of this runner was removed after an update; start the runner again"
fi
mkdir -p "$state"
FLOW='{
  "lanes": {
    "feature": ["triage", "specify", "plan", "implement"],
    "bug": ["triage", "bug", "plan", "implement"],
    "chore": ["triage", "chore"],
    "hotfix": ["triage", "hotfix"]
  },
  "stages": [
    {"name": "Triage", "steps": ["triage"]},
    {"name": "Define", "steps": ["specify", "bug", "chore", "hotfix"]},
    {"name": "Plan", "steps": ["plan"]},
    {"name": "Implement", "steps": ["implement"]}
  ]
}'
said=
started=0
holder=
lock_owner=
locks_held=
session_pid=
signal_status=0
updater=
update_output=

say() {
  [ "$mode" != auto ] || [ "$1" != "$said" ] || return 0
  said=$1
  printf 'celetis-flow: %s\n' "$1"
}

gate() {
  printf '%s\n' "$config" | jq -r --arg step "$1" '.gates[$step] // "me"'
}

holder_from() {
  local owner kind pid began
  owner=$(git cat-file blob "$1" 2>/dev/null) || return 1
  for kind in runner session; do
    pid=$(printf '%s\n' "$owner" | jq -er --arg kind "$kind" '.[$kind].pid | select(type == "number" and . > 0 and . == floor)' 2>/dev/null) || continue
    began=$(printf '%s\n' "$owner" | jq -er --arg kind "$kind" '.[$kind].start | select(type == "string" and length > 0)' 2>/dev/null) || continue
    if [ "$kind" = runner ]; then
      case $(ps -p "$pid" -o command= 2>/dev/null) in *celetis-flow.sh*) ;; *) continue ;; esac
    fi
    case $(ps -p "$pid" -o stat= 2>/dev/null) in '' | *Z* | *X*) continue ;; esac
    [ "$(LC_ALL=C ps -p "$pid" -o lstart= 2>/dev/null)" = "$began" ] || continue
    echo "$pid"
    return 0
  done
  return 1
}

holder_of() {
  local owner
  owner=$(git rev-parse --verify "refs/celetis-flow/locks/$1" 2>/dev/null) || return 1
  holder_from "$owner"
}

take() {
  local ref="refs/celetis-flow/locks/$1" old current began
  if [ -z "$lock_owner" ]; then
    began=$(LC_ALL=C ps -p "$$" -o lstart= 2>/dev/null) || die "cannot read process identity; allow process access and start the runner again"
    lock_owner=$(jq -nc --argjson pid "$$" --arg start "$began" '{runner:{pid:$pid,start:$start},session:null}' | git hash-object -w --stdin) || die "cannot write the lock owner"
  fi
  while :; do
    old=$(git rev-parse --verify "$ref" 2>/dev/null) || old=
    if [ -n "$old" ] && holder=$(holder_from "$old"); then return 1; fi
    if git update-ref --no-deref "$ref" "$lock_owner" "$old" 2>/dev/null; then
      locks_held="$locks_held $1"
      return 0
    fi
    current=$(git rev-parse --verify "$ref" 2>/dev/null) || current=
    [ "$current" != "$old" ] || die "cannot take the $1 lock; check Git access and start the runner again"
  done
}

release() {
  local name keep=
  [ -z "$lock_owner" ] || git update-ref --no-deref -d "refs/celetis-flow/locks/$1" "$lock_owner" 2>/dev/null || true
  for name in $locks_held; do [ "$name" = "$1" ] || keep="$keep $name"; done
  locks_held=$keep
}

register_session() {
  local began owner name
  began=$(LC_ALL=C ps -p "$session_pid" -o lstart= 2>/dev/null) || die "cannot read session process identity; start the runner again"
  owner=$(git cat-file blob "$lock_owner" | jq -c --argjson pid "$session_pid" --arg start "$began" '.session = {pid:$pid,start:$start}' |
    git hash-object -w --stdin) || die "cannot write the session lock owner"
  for name in $locks_held; do printf 'update refs/celetis-flow/locks/%s %s %s\n' "$name" "$owner" "$lock_owner"; done |
    git update-ref --no-deref --stdin || die "cannot register the session in its locks; start the runner again"
  lock_owner=$owner
}

release_all() {
  local name
  trap '' INT TERM HUP
  if [ -n "$updater" ]; then
    kill "$updater" 2>/dev/null || true
    wait "$updater" 2>/dev/null || true
  fi
  [ -z "$update_output" ] || rm -f "$update_output"
  if [ -n "${watcher:-}" ]; then
    kill "$watcher" 2>/dev/null || true
    wait "$watcher" 2>/dev/null || true
  fi
  [ -z "${watch_dir:-}" ] || rm -rf "$watch_dir"
  for name in $locks_held; do release "$name"; done
}
trap release_all EXIT
on_signal() { if [ -n "$session_pid" ]; then signal_status=$1; else exit "$1"; fi; }
trap 'on_signal 129' HUP
trap 'on_signal 130' INT
trap 'on_signal 143' TERM

recorded() { grep -qxF "$1"$'\t'"$2" "$record" 2>/dev/null; }

step_of() {
  local step=${1#run /celetis:}
  step=${step%% *}
  [ "$step" != feature ] || step=specify
  echo "$step"
}

end_when_done() {
  local n=$1 start_line=$2 step=$3 errors=$4 prior_id=$5 started_at=$6 deadline=$((SECONDS + 60)) line reply status id
  while :; do
    if reply=$(herdr agent get "$HERDR_PANE_ID" 2>/dev/null); then
      status=0
      celetis_session_observe "$n" "$step" "$main" "$reply" "$prior_id" "$started_at" || status=$?
      [ "$status" -ne 0 ] || break
      if [ "$status" -eq 2 ]; then
        touch "$errors"
        celetis_startup_error "$n" "herdr returned an invalid identity"
        return 1
      fi
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      touch "$errors"
      celetis_startup_error "$n" "no saved turn with a verified identity after 60 seconds"
      return 1
    fi
    sleep 1
  done
  id=$(jq -r .session_id "$state/sessions/$n.json")
  while herdr agent wait "$HERDR_PANE_ID" --until idle --until 'done' >/dev/null 2>&1; do
    if gone; then
      say "$(stale_n "$n")"
      return 1
    fi
    if celetis_session_idle "$id"; then
      line=$("$next" "$n" </dev/null) || line=$start_line
      case $line in
        "$start_line") ;;
        "run "* | "stop #$n "*)
          if [ "$("$next" "$n" </dev/null)" = "$line" ] && celetis_session_idle "$id"; then
            herdr agent prompt "$HERDR_PANE_ID" /exit >/dev/null 2>&1 ||
              printf 'celetis-flow: #%s cannot submit /exit; the session stays open. Exit it in this pane when ready.\n' "$n" >&2
            return 0
          fi
          ;;
      esac
    fi
    herdr agent wait "$HERDR_PANE_ID" --until working --until blocked --timeout 5000 >/dev/null 2>&1 || true
    sleep 1
  done
}

update_plugin() {
  local moved result=0
  command -v perl >/dev/null 2>&1 || die "perl is not on PATH"
  update_output=$(mktemp)
  perl "$here/plugin-update.pl" "$$" "$CELETIS_AGENT" >"$update_output" </dev/null &
  updater=$!
  wait "$updater" || result=$?
  updater=
  moved=$(cat "$update_output")
  rm -f "$update_output"
  update_output=
  [ "$result" -eq 0 ] || die "the plugin update failed; the step did not start"
  root=$moved
}

start_session() {
  watch_dir=$(mktemp -d "$state/start.XXXXXX")
  (
    while [ ! -f "$watch_dir/go" ]; do
      kill -0 "$$" 2>/dev/null || exit 1
      sleep 0.05
    done
    exec "$CELETIS_AGENT" "${CELETIS_ARGS[@]}"
  ) <&0 &
  session_pid=$!
  register_session
  if [ "$signal_status" -ne 0 ]; then
    kill "$session_pid" 2>/dev/null || true
    wait "$session_pid" 2>/dev/null || true
    exit "$signal_status"
  fi
}

wait_session() {
  touch "$watch_dir/go"
  while :; do
    exit_code=0
    wait "$session_pid" || exit_code=$?
    kill -0 "$session_pid" 2>/dev/null || break
  done
  session_pid=
  [ "$signal_status" -eq 0 ] || exit "$signal_status"
}

run_issue() {
  local n=$1 first=$2 line last= prompt step watcher watch_dir prior_id started_at exit_code=0
  take "issue-$n" || {
    say "another celetis-flow.sh or its session (PID $holder) works on #$n"
    return 0
  }
  while :; do
    if gone; then
      say "$(stale_n "$n")"
      break
    fi
    config=$(celetis_config_read "$main") || exit $?
    line=$("$next" "$n" </dev/null) || true
    case $line in
      "run "*) ;;
      "")
        say "#$n: next-step.sh printed no line"
        break
        ;;
      *)
        say "$line"
        break
        ;;
    esac
    prompt=${line#run }
    if [ "$line" = "$last" ]; then
      [ "$exit_code" -eq 0 ] || die "$CELETIS_AGENT session exited with status $exit_code before issue progress; check startup output, then run $(celetis_manual_recovery) from the main checkout or start the step again"
      say "no progress: $prompt"
      recorded "$n" "$line" || printf '%s\t%s\n' "$n" "$line" >>"$record"
      break
    fi
    step=$(step_of "$line")
    if [ "$first" != any ] && [ "$(gate "$step")" != auto ]; then
      say "the gate of $step is me: scripts/celetis celetis-flow $n starts $prompt"
      break
    fi
    first=gated
    say "start: $prompt"
    started=1
    update_plugin
    if gone || { [ "$step" != specify ] && [ ! -f "$root/step-prompt.md" ]; }; then
      say "$(stale_n "$n")"
      break
    fi
    celetis_host_arguments "$n" "$step" "$prompt" "$root" || die "cannot read the step instructions; start the runner again"
    celetis_session_write "$n" "$step" "$main" "" || die "cannot write the session record for #$n"
    watcher=
    start_session
    if [ -n "$managed" ]; then
      [ -z "${HERDR_TAB_ID:-}" ] || herdr tab rename "$HERDR_TAB_ID" "#$n $step" >/dev/null 2>&1 || true
      prior_id=$(herdr agent get "$HERDR_PANE_ID" </dev/null 2>/dev/null | jq -r '.result.agent.agent_session.value // empty' 2>/dev/null) || prior_id=
      started_at=$(date +%s)
      end_when_done "$n" "$line" "$step" "$watch_dir/error" "$prior_id" "$started_at" </dev/null &
      watcher=$!
    fi
    wait_session
    if [ -n "$watcher" ]; then
      kill "$watcher" 2>/dev/null || true
      wait "$watcher" 2>/dev/null || true
      if ! jq -e '.session_id != null' "$state/sessions/$n.json" >/dev/null; then
        [ -f "$watch_dir/error" ] || celetis_startup_error "$n" "the session ended before a saved turn had a verified identity"
        rm -rf "$watch_dir"
        return 1
      fi
    fi
    rm -rf "$watch_dir"
    watcher=
    watch_dir=
    last=$line
  done
  release "issue-$n"
}

if [ "$mode" = resume ]; then
  take "issue-$issues" || die "another celetis-flow.sh or its session (PID $holder) works on #$issues"
  case $CELETIS_AGENT in
    claude) CELETIS_ARGS=(--resume "$session_id") ;;
    codex) CELETIS_ARGS=(resume --no-daemon "$session_id") ;;
  esac
  start_session
  wait_session
  exit "$exit_code"
fi

if [ "$mode" = board ]; then
  if gone; then
    printf '%s\n' "$stale"
    exit 1
  fi
  doc=$("$next" --json </dev/null) || {
    printf '%s\n' "${doc:-stop cannot read the issues from GitHub}"
    exit 1
  }
  extra=
  while IFS=$'\t' read -r n line; do
    step=
    case $line in
      "run /"*) step=$(step_of "$line") ;;
    esac
    locked=false
    ! holder_of "issue-$n" >/dev/null || locked=true
    stuck=false
    ! recorded "$n" "$line" || stuck=true
    extra="$extra$n"$'\t'"$step"$'\t'"$locked"$'\t'"$stuck"$'\n'
  done < <(printf '%s' "$doc" | jq -r '.issues[] | "\(.number)\t\(.line)"')
  gates=
  for step in $(printf '%s' "$FLOW" | jq -r '[.lanes[][]] | unique[]'); do gates="$gates$step"$'\t'"$(gate "$step")"$'\n'; done
  runner=false
  ! holder_of runner >/dev/null || runner=true
  agents=$(for agent in claude codex; do
    cause=
    command -v "$agent" >/dev/null 2>&1 || cause="celetis: $agent is not on PATH"
    jq -nc --arg agent "$agent" --arg cause "$cause" '{key:$agent,value:{available:($cause == ""),cause:(if $cause == "" then null else $cause end)}}'
  done | jq -s from_entries)
  printf '%s' "$doc" | jq --argjson flow "$FLOW" --arg extra "$extra" --arg gates "$gates" --argjson runner "$runner" \
    --argjson agents "$agents" --arg defaultAgent "$CELETIS_AGENT" '
    ($extra | split("\n") | map(select(. != "") | split("\t") | {key: .[0], value: {
      step: (if .[1] == "" then null else .[1] end), locked: (.[2] == "true"), stuck: (.[3] == "true")}}) | from_entries) as $more
    | ["implement", "chore", "hotfix"] as $lands
    | {contract: 1, tracker: "GitHub", agents: $agents, defaultAgent: $defaultAgent,
       flow: ($flow + {steps: ($gates | split("\n") | map(select(. != "") | split("\t") | . as $f | {key: $f[0], value: ({gate: $f[1]}
         + (if ($lands | index($f[0])) then {hint: "It lands the change when the build is done."} else {} end))}) | from_entries)}),
       noRun, runner: $runner,
       issues: (.issues | map(
         . as $i | $more[$i.number | tostring] as $m
         | . + {step: $m.step, started: ($m.step | IN("plan", "implement")), urgent: ($i.type == "hotfix")}
         | if .state == "done" then .
           elif $m.locked then .state = "starting"
           elif .state == "dirty" then .
           elif $m.stuck then .state = "stuck" | .act = "scripts/celetis celetis-flow --resume \($i.number)"
           else . end
         | del(.line)))}'
  exit 0
fi

if [ "$mode" = numbers ]; then
  for n in $issues; do run_issue "$n" any; done
  exit 0
fi

take runner || die "another automatic runner or its session has PID $holder"
while :; do
  pick=
  if gone; then
    say "$stale"
    exit 1
  fi
  config=$(celetis_config_read "$main") || exit $?
  if rows=$("$next" --open </dev/null); then
    while IFS=$'\t' read -r n line; do
      case $line in "run "*) ;; *) continue ;; esac
      [ "$(gate "$(step_of "$line")")" = auto ] || continue
      # The lock check is first: run_issue writes the row of a step with no progress before it frees the lock.
      ! holder_of "issue-$n" >/dev/null || continue
      ! recorded "$n" "$line" || continue
      pick=$n
      break
    done <<<"$rows"
  else
    say "${rows:-stop cannot read the open issues from GitHub}"
    sleep 60
    continue
  fi
  started=0
  if [ -n "$pick" ]; then
    run_issue "$pick" gated
  else
    say "no auto step can start; the runner asks again each 60 seconds"
  fi
  [ "$started" -eq 1 ] || sleep 60
done
