#!/usr/bin/env bash
# The runner of the agent flow (docs/agent-flow.md). No loop that reads a list holds a session: the stdin of a session is the terminal.
set -euo pipefail

usage="usage: scripts/celetis agent-flow [<issue number>...] | --board | --resume <issue number>, e.g. scripts/celetis agent-flow 373 374; with no number, the automatic runner"
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

die() { printf 'agent-flow: %s\n' "$1" >&2; exit 1; }

for tool in claude gh jq git; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not on PATH"
done

here=$(cd "$(dirname "$0")" && pwd)
root=$(dirname "$here")
common=$(git rev-parse --path-format=absolute --git-common-dir)
main=$(dirname "$common")
next="$here/next-step.sh"
flow="$main/.claude/agent-flow"
state="$common/agent-flow"
record="$state/no-progress"
mkdir -p "$state"
cd "$main"

[ -n "$mode" ] || mode=numbers
[ "$mode" != numbers ] || [ -n "$issues" ] || mode=auto
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
  printf 'agent-flow: %s\n' "$1"
}

gate() {
  local value
  value=$(git config --get "agent-flow.gate.$1" 2>/dev/null) ||
    value=$(jq -r --arg step "$1" '.[$step] // "me"' "$flow/gates.json" 2>/dev/null)
  [ "$value" = auto ] && echo auto || echo me
}

holder_of() {
  local pid
  pid=$(cat "$state/$1.lock" 2>/dev/null) || return 1
  case $pid in '' | *[!0-9]* | "$$") return 1 ;; esac
  case $(ps -p "$pid" -o command= 2>/dev/null) in
    *agent-flow.sh*) echo "$pid" ;;
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

# herdr ends a wait with an error when its agent exits, so the loop ends with the session.
end_when_done() {
  local n=$1 start_line=$2 tries=0 line
  until herdr agent get "$HERDR_PANE_ID" >/dev/null 2>&1; do
    tries=$((tries + 1))
    [ "$tries" -le 60 ] || return 0
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
  { claude plugin marketplace update celetis && claude plugin update celetis@celetis --scope user; } >/dev/null 2>&1 </dev/null ||
    say "the plugin update failed; the session starts on the installed version"
}

run_issue() {
  local n=$1 first=$2 line last= prompt step watcher
  take "issue-$n" || { say "another agent-flow.sh (PID $holder) works on #$n"; return 0; }
  while :; do
    line=$("$next" "$n" </dev/null) || true
    case $line in
      "run "*) ;;
      "") say "#$n: next-step.sh printed no line"; break ;;
      *) say "$line"; break ;;
    esac
    prompt=${line#run }
    if [ "$line" = "$last" ]; then
      say "no progress: $prompt"
      recorded "$n" "$line" || printf '%s\t%s\n' "$n" "$line" >>"$record"
      break
    fi
    step=$(step_of "$line")
    if [ "$first" != any ] && [ "$(gate "$step")" != auto ]; then
      say "the gate of $step is me: scripts/celetis agent-flow $n starts $prompt"
      break
    fi
    first=gated
    say "start: $prompt"
    started=1
    update_plugin
    watcher=
    if [ -n "${HERDR_PANE_ID:-}" ]; then
      [ -z "${HERDR_TAB_ID:-}" ] || herdr tab rename "$HERDR_TAB_ID" "#$n $step" >/dev/null 2>&1 || true
      end_when_done "$n" "$line" </dev/null >/dev/null 2>&1 &
      watcher=$!
    fi
    set -- --permission-mode auto -n "#$n $step"
    # No step text for specify: rule 2 of that text forbids a wait for a review, and specify waits for the approval of the design.
    [ "$step" = specify ] || set -- "$@" --append-system-prompt-file "$root/step-prompt.md"
    claude "$@" "$prompt" || true
    [ -z "$watcher" ] || kill "$watcher" 2>/dev/null || true
    last=$line
  done
  release "issue-$n"
}

if [ "$mode" = resume ]; then
  line=
  while IFS=$'\t' read -r row_n row_line; do
    [ "$row_n" != "$issues" ] || line=$row_line
  done < <(cat "$record" 2>/dev/null)
  [ -n "$line" ] || die "#$issues has no step with no progress"
  exec claude --resume "#$issues $(step_of "$line")"
fi

if [ "$mode" = board ]; then
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
           elif $m.stuck then .state = "stuck" | .act = "claude --resume \"#\($i.number) \($m.step)\""
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
