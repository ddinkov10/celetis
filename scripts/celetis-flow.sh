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
  [[ $issues =~ ^[1-9][0-9]*$ ]] || { echo "$usage" >&2; exit 2; }
else
  for arg; do
    n=${arg#\#}
    [[ $n =~ ^[1-9][0-9]*$ ]] || { echo "$usage" >&2; exit 2; }
    issues="$issues $n"
  done
fi

die() { printf 'celetis-flow: %s\n' "$1" >&2; exit 1; }

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
  for file in "$next" "$here/celetis" "$here/lib/host.sh" "$here/lib/session.sh"; do
    [ -f "$file" ] || return 0
  done
  return 1
}
flow="$main/.claude/celetis-flow"
state="$common/celetis-flow"
record="$state/no-progress"
mkdir -p "$state"
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
    celetis_host_require || exit $?
    session_id=$(printf '%s\n' "$CELETIS_SESSION" | jq -r .session_id)
    cd "$(printf '%s\n' "$CELETIS_SESSION" | jq -r .checkout)"
    case $CELETIS_HOST in
      claude) exec claude --resume "$session_id" ;;
      codex) exec codex resume "$session_id" ;;
    esac
  fi
  celetis_host_require || exit $?
  command -v gh >/dev/null 2>&1 || die "gh is not on PATH"
  if [ "${HERDR_ENV:-}" = 1 ]; then
    [[ ${HERDR_PANE_ID:-} =~ ^w[1-9][0-9]*:p[1-9][0-9]*$ ]] || die "HERDR_ENV=1 needs a valid HERDR_PANE_ID; start from a herdr pane"
    command -v herdr >/dev/null 2>&1 || die "herdr is not on PATH"
    managed=1
  fi
elif [ "$mode" = resume ]; then
  die "the plugin version of this runner was removed after an update; start the runner again"
fi
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

say() {
  [ "$mode" != auto ] || [ "$1" != "$said" ] || return 0
  said=$1
  printf 'celetis-flow: %s\n' "$1"
}

gate() {
  local value
  value=$(git config --get "celetis-flow.gate.$1" 2>/dev/null) ||
    value=$(jq -r --arg step "$1" '.[$step] // "me"' "$flow/gates.json" 2>/dev/null)
  [ "$value" = auto ] && echo auto || echo me
}

holder_of() {
  local pid
  pid=$(cat "$state/$1.lock" 2>/dev/null) || return 1
  case $pid in '' | *[!0-9]* | "$$") return 1 ;; esac
  case $(ps -p "$pid" -o command= 2>/dev/null) in
    *celetis-flow.sh*) echo "$pid" ;;
    *) return 1 ;;
  esac
}

take() {
  local file="$state/$1.lock"
  ( set -C; echo "$$" >"$file" ) 2>/dev/null && return 0
  if holder=$(holder_of "$1"); then return 1; fi
  # superdinq: two scripts that take over one stale lock at the same moment can both hold it; hold the lock with lockf(1) or flock(1) if that occurs.
  rm -f "$file"
  ( set -C; echo "$$" >"$file" ) 2>/dev/null || { holder=$(cat "$file" 2>/dev/null || true); return 1; }
}

release() { [ "$(cat "$state/$1.lock" 2>/dev/null)" != "$$" ] || rm -f "$state/$1.lock"; }

release_all() {
  local file
  for file in "$state"/*.lock; do
    file=${file##*/}
    release "${file%.lock}"
  done
}
trap release_all EXIT

recorded() { grep -qxF "$1"$'\t'"$2" "$record" 2>/dev/null; }

step_of() {
  local step=${1#run /celetis:}
  step=${step%% *}
  [ "$step" != feature ] || step=specify
  echo "$step"
}

end_when_done() {
  local n=$1 start_line=$2 step=$3 errors=$4 prior_id=$5 started_at=$6 deadline=$((SECONDS + 60)) line reply status
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
  while herdr agent wait "$HERDR_PANE_ID" --until idle --until done >/dev/null 2>&1; do
    line=$("$next" "$n" </dev/null) || line=$start_line
    case $line in
      "$start_line") ;;
      "run "* | "stop #$n "*) if herdr agent prompt "$HERDR_PANE_ID" /exit >/dev/null 2>&1; then return 0; fi ;;
    esac
    herdr agent wait "$HERDR_PANE_ID" --until working --until blocked >/dev/null 2>&1 || return 0
  done
}

update_plugin() {
  local moved
  if celetis_host_update >/dev/null 2>&1 </dev/null; then
    moved=$("$here/celetis" root </dev/null 2>/dev/null) || return 0
    [ ! -f "$moved/step-prompt.md" ] || root=$moved
  else
    say "the plugin update failed; the session starts on the installed version"
  fi
}

run_issue() {
  local n=$1 first=$2 line last= prompt step watcher watch_dir prior_id started_at exit_code=0
  take "issue-$n" || { say "another celetis-flow.sh (PID $holder) works on #$n"; return 0; }
  while :; do
    if gone; then say "$(stale_n "$n")"; break; fi
    line=$("$next" "$n" </dev/null) || true
    case $line in
      "run "*) ;;
      "") say "#$n: next-step.sh printed no line"; break ;;
      *) say "$line"; break ;;
    esac
    prompt=${line#run }
    if [ "$line" = "$last" ]; then
      [ "$exit_code" -eq 0 ] || die "$CELETIS_HOST session exited with status $exit_code before issue progress; check startup output, then run $(celetis_manual_recovery) from the main checkout or start the step again"
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
    if gone || { [ "$step" != specify ] && [ ! -f "$root/step-prompt.md" ]; }; then say "$(stale_n "$n")"; break; fi
    celetis_host_arguments "$n" "$step" "$prompt" "$root" || die "cannot read the step instructions; start the runner again"
    celetis_session_write "$n" "$step" "$main" "" || die "cannot write the session record for #$n"
    watcher=
    watch_dir=
    if [ -n "$managed" ]; then
      [ -z "${HERDR_TAB_ID:-}" ] || herdr tab rename "$HERDR_TAB_ID" "#$n $step" >/dev/null 2>&1 || true
      prior_id=$(herdr agent get "$HERDR_PANE_ID" </dev/null 2>/dev/null | jq -r '.result.agent.agent_session.value // empty' 2>/dev/null) || prior_id=
      watch_dir=$(mktemp -d "$state/start.XXXXXX")
      started_at=$(date +%s)
      end_when_done "$n" "$line" "$step" "$watch_dir/error" "$prior_id" "$started_at" </dev/null &
      watcher=$!
    fi
    exit_code=0
    "$CELETIS_HOST" "${CELETIS_ARGS[@]}" || exit_code=$?
    if [ -n "$watcher" ]; then
      kill "$watcher" 2>/dev/null || true
      wait "$watcher" 2>/dev/null || true
      if ! jq -e '.session_id != null' "$state/sessions/$n.json" >/dev/null; then
        [ -f "$watch_dir/error" ] || celetis_startup_error "$n" "the session ended before a saved turn had a verified identity"
        rm -rf "$watch_dir"
        return 1
      fi
      rm -rf "$watch_dir"
    fi
    last=$line
  done
  release "issue-$n"
}

if [ "$mode" = board ]; then
  if gone; then printf '%s\n' "$stale"; exit 1; fi
  doc=$("$next" --json </dev/null) || { printf '%s\n' "${doc:-stop cannot read the issues from GitHub}"; exit 1; }
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
  printf '%s' "$doc" | jq --argjson flow "$FLOW" --arg extra "$extra" --arg gates "$gates" --argjson runner "$runner" '
    ($extra | split("\n") | map(select(. != "") | split("\t") | {key: .[0], value: {
      step: (if .[1] == "" then null else .[1] end), locked: (.[2] == "true"), stuck: (.[3] == "true")}}) | from_entries) as $more
    | ["implement", "chore", "hotfix"] as $lands
    | {contract: 1, tracker: "GitHub",
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

take runner || die "another automatic runner has PID $holder"
while :; do
  pick=
  if gone; then say "$stale"; exit 1; fi
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
