#!/usr/bin/env bash
# RESOLVER encodes "Resolving an issue's state" in docs/agents/issue-tracker.md; change them together.
# No stop line names the promote script's path: .claude/settings.json denies a command that holds it.
set -euo pipefail

RESOLVER='
def labeled($x): any(.labels[]; .name == $x);
def commented($p): any(.comments[]; .body | startswith($p));
def refused: [.comments[].body | select(startswith("## "))] | last // "" | startswith("## Landing refused");
def blocked($n; $head; $reason; $act):
  {line: "stop #\($n) \($head). \($act)", state: "blocked", reason: $reason, act: $act};
def resolve($n):
  . as $i
  | if $i.state == "CLOSED" then
      if $i | labeled("wontfix") then {line: "stop #\($n) is closed as wontfix."}
      else {line: "stop #\($n) is finished. Run the promote script when ready.", state: "done"} end
    elif $i | labeled("needs-info") then blocked($n; "needs info"; "needs info"; "Answer the questions on the issue, then remove the label.")
    elif $i | labeled("ready-for-human") then blocked($n; "is ready-for-human"; (if $i | refused then "landing refused" else "ready for your step" end); "Do the human step (e.g. the hotfix ship checklist), then remove the label.")
    elif $i | labeled("epic") then {line: "stop #\($n) is an epic. Each child runs its own flow."}
    else
      (if $i | (labeled("bug") or labeled("enhancement") or labeled("hotfix") or labeled("chore")) | not then "run /triage #\($n)"
       elif ($i | labeled("enhancement")) and (($i.body // "") | startswith("Spec:") | not) then "run /feature #\($n)"
       elif ($i | labeled("bug")) and ($i | commented("## Root cause") | not) then "run /bug #\($n)"
       elif $i | labeled("chore") then "run /chore #\($n)"
       elif $i | labeled("hotfix") then "run /hotfix #\($n)"
       elif $i | commented("## Plan") | not then "run /plan #\($n)"
       else "run /implement #\($n)" end) as $line
      | {line: $line, state: "ready"}
    end;
def line($n): resolve($n).line;'

usage="usage: next-step.sh <issue number> | --open | --json, e.g. next-step.sh 276"
[ $# -eq 1 ] || { printf '%s\n' "$usage" >&2; exit 2; }
n=${1#\#}
[ "$1" = --open ] || [ "$1" = --json ] || case $n in '' | *[!0-9]*) printf '%s\n' "$usage" >&2; exit 2 ;; esac

common=$(git rev-parse --path-format=absolute --git-common-dir)
main=$(dirname "$common")
dirty() { [ -d "$1" ] && [ -n "$(git -C "$1" status --porcelain)" ]; }
dirty_line() { printf 'stop the working tree is dirty: %s; commit or stash first\n' "$1"; }
# scripts/land.sh holds this lock while it runs. The line does not start with "stop #<n> ", so the runner keeps the session open.
landing() {
  local pid
  pid=$(cat "$common/agent-flow/land-$1.lock" 2>/dev/null) || return 1
  case $pid in '' | *[!0-9]*) return 1 ;; esac
  case $(ps -p "$pid" -o command= 2>/dev/null) in *land.sh*) ;; *) return 1 ;; esac
}
landing_line() { printf 'stop the landing of #%s runs; wait until scripts/land.sh ends\n' "$1"; }

if [ "$1" = --json ]; then
  since=$(jq -rn 'now - 1209600 | strftime("%Y-%m-%d")')
  fields=number,title,url,state,labels,comments,updatedAt,closedAt
  open=$(gh issue list --state open --limit 200 --json "$fields,body") &&
    closed=$(gh issue list --state closed --search "closed:>=$since" --limit 200 --json "$fields") &&
    prs=$(gh pr list --state open --limit 200 --json headRefName,number,url,isDraft,statusCheckRollup,reviewDecision) &&
    issues=$(printf '%s\n%s\n' "$open" "$closed" | jq -cs 'add | unique_by(.number)') &&
    rows=$(printf '%s\n%s\n' "$issues" "$prs" | jq -cs "$RESOLVER"' .[1] as $prs | .[0] | map((.number | tostring) as $n | resolve($n) as $r | {
      number, title, url,
      type: ([.labels[].name] | if index("bug") then "bug" elif index("enhancement") then "feature" elif index("chore") then "chore" elif index("hotfix") then "hotfix" else null end),
      updatedAt, closedAt, line: $r.line, state: $r.state, reason: $r.reason, act: $r.act,
      pr: ([$prs[] | select(.headRefName | contains("/\($n)-"))][0] | if . then {number, url, draft: .isDraft,
        checks: ([.statusCheckRollup[]?] as $c | if $c == [] then null
          elif any($c[]; if .__typename == "CheckRun" then .conclusion | IN("FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE") else .state | IN("FAILURE", "ERROR") end) then "fail"
          elif any($c[]; if .__typename == "CheckRun" then .status != "COMPLETED" else .state | IN("PENDING", "EXPECTED") end) then "pending"
          else "pass" end),
        review: ({APPROVED: "approved", CHANGES_REQUESTED: "changes", REVIEW_REQUIRED: "required"}[.reviewDecision // ""])} else null end)})') ||
    { printf 'stop cannot read the issues from GitHub\n'; exit 1; }
  main_dirty=
  ! dirty "$main" || main_dirty=$main
  lanes=
  for wt in "$main"/.claude/worktrees/[0-9]*-*; do
    ! dirty "$wt" || lanes="$lanes$wt"$'\n'
  done
  printf '%s' "$rows" | jq --arg main "$main_dirty" --arg lanes "$lanes" '
    ($lanes | split("\n") | map(select(. != ""))) as $dirty
    | {noRun: (if $main == "" then null else "The main checkout is dirty: \($main). Commit or stash first." end),
       issues: (map(select(.state != null)
         | . as $i
         | ([$dirty[] | select(test("/\($i.number)-[^/]*$"))][0]) as $path
         | if $i.state != "done" and $path then .state = "dirty" | .path = $path else . end))}'
  exit 0
fi

if [ "$1" = --open ]; then
  issues=$(gh issue list --state open --limit 200 --json number,state,labels,body,comments) &&
    rows=$(printf '%s\n' "$issues" |
      jq -r "$RESOLVER"' sort_by(.number)[] | (.number | tostring) as $n | "\($n)\t\(line($n))"') ||
    { printf 'stop cannot read the open issues from GitHub\n'; exit 1; }
  all=
  ! dirty "$main" || all=$(dirty_line "$main")
  while IFS=$'\t' read -r n line; do
    [ -n "$n" ] || continue
    ! landing "$n" || line=$(landing_line "$n")
    for wt in "$main"/.claude/worktrees/"$n"-*; do
      ! dirty "$wt" || { line=$(dirty_line "$wt"); break; }
    done
    printf '%s\t%s\n' "$n" "${all:-$line}"
  done <<<"$rows"
  exit 0
fi

for wt in "$main" "$main"/.claude/worktrees/"$n"-*; do
  ! dirty "$wt" || { dirty_line "$wt"; exit 0; }
done
! landing "$n" || { landing_line "$n"; exit 0; }

# jq reads the JSON on stdin, not as an argument: a plan comment can exceed Windows' 32 KiB command-line limit.
issue=$(gh issue view "$n" --json state,labels,body,comments) &&
  printf '%s\n' "$issue" | jq -r --arg n "$n" "$RESOLVER"' line($n)' ||
  { printf 'stop cannot read #%s from GitHub\n' "$n"; exit 1; }
