#!/usr/bin/env bash
# RESOLVER encodes "Resolving an issue's state" in docs/issue-tracker.md; change them together.
set -euo pipefail

RESOLVER='
def labeled($x): any(.labels[]; .name == $x);
def commented($p): any(.comments[]; .body | startswith($p));
def refused: [.comments[].body | select(startswith("## "))] | last // "" | startswith("## Landing refused");
def blocked($n; $head; $reason; $act):
  {line: "stop #\($n) \($head). \($act)", state: "blocked", reason: $reason, act: $act};
def resolve($n):
  . as $i
  | if $i.state == "closed" then
      if $i | labeled("wontfix") then {line: "stop #\($n) is closed as wontfix."}
      else {line: "stop #\($n) is finished.", state: "done"} end
    elif $i | labeled("needs-info") then blocked($n; "needs info"; "needs info"; "Answer the questions on the issue, then remove the label.")
    elif $i | labeled("ready-for-human") then blocked($n; "is ready-for-human"; (if $i | refused then "landing refused" else "ready for your step" end); "Do the human step (e.g. the hotfix ship checklist), then remove the label.")
    elif $i | labeled("epic") then {line: "stop #\($n) is an epic. Each child runs its own flow."}
    else
      (if $i | (labeled("bug") or labeled("enhancement") or labeled("hotfix") or labeled("chore")) | not then "run /celetis:triage #\($n)"
       elif ($i | labeled("enhancement")) and (($i.body // "") | startswith("Spec:") | not) then "run /celetis:feature #\($n)"
       elif ($i | labeled("bug")) and ($i | commented("## Root cause") | not) then "run /celetis:bug #\($n)"
       elif $i | labeled("chore") then "run /celetis:chore #\($n)"
       elif $i | labeled("hotfix") then "run /celetis:hotfix #\($n)"
       elif $i | commented("## Plan") | not then "run /celetis:plan #\($n)"
       else "run /celetis:implement #\($n)" end) as $line
      | {line: $line, state: "ready"}
    end;
def line($n): resolve($n).line;'

usage="usage: scripts/celetis next-step <issue number> | --open | --json, e.g. scripts/celetis next-step 276"
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
  pid=$(cat "$common/celetis-flow/land-$1.lock" 2>/dev/null) || return 1
  case $pid in '' | *[!0-9]*) return 1 ;; esac
  case $(ps -p "$pid" -o command= 2>/dev/null) in *land.sh*) ;; *) return 1 ;; esac
}
landing_line() { printf 'stop the landing of #%s runs; wait until scripts/celetis land ends\n' "$1"; }

with_comments() {
  local issue number count
  while IFS= read -r issue; do
    read -r number count <<<"$(jq -r '"\(.number) \(.comments)"' <<<"$issue")"
    { printf '%s\n' "$issue"
      [ "$count" = 0 ] ||
        gh api --paginate "repos/{owner}/{repo}/issues/$number/comments?per_page=100" --jq '.[] | tojson' </dev/null
    } | jq -cs '.[0] + {comments: .[1:]}' || return
  done
}

open_issues() {
  gh api --paginate 'repos/{owner}/{repo}/issues?state=open&per_page=100' --jq '.[] | select(.pull_request | not) | tojson' |
    with_comments | jq -s .
}

with_pr_state() {
  local pr number sha
  while IFS= read -r pr; do
    read -r number sha <<<"$(jq -r '"\(.number) \(.head.sha)"' <<<"$pr")"
    { printf '%s\n' "$pr"
      gh api --paginate "repos/{owner}/{repo}/commits/$sha/check-runs?per_page=100" \
        --jq '.check_runs[] | {run: {status, conclusion}} | tojson' </dev/null &&
        gh api --paginate "repos/{owner}/{repo}/commits/$sha/status?per_page=100" \
          --jq '.statuses[] | {status: .state} | tojson' </dev/null &&
        gh api --paginate "repos/{owner}/{repo}/pulls/$number/reviews?per_page=100" \
          --jq '.[] | select(.state | IN("APPROVED", "CHANGES_REQUESTED", "DISMISSED")) | {review: {user: .user.login, state}} | tojson' </dev/null
    } | jq -cs '.[0] as $pr | [.[1:][].run // empty] as $runs | [.[1:][].status // empty] as $statuses
      | {headRefName: $pr.head.ref, number: $pr.number, url: $pr.html_url, isDraft: $pr.draft,
         checks: (if $runs + $statuses == [] then null
           elif any($runs[]; .conclusion | IN("failure", "timed_out", "cancelled", "action_required", "startup_failure"))
             or any($statuses[]; IN("failure", "error")) then "fail"
           elif any($runs[]; .status != "completed") or any($statuses[]; . == "pending") then "pending"
           else "pass" end),
         review: ([.[1:][].review // empty] | group_by(.user) | map(last.state)
           | if index("CHANGES_REQUESTED") then "changes" elif index("APPROVED") then "approved"
             elif ($pr.requested_reviewers + $pr.requested_teams | length) > 0 then "required" else null end)}' || return
  done
}

if [ "$1" = --json ]; then
  since=$(jq -rn 'now - 1209600 | strftime("%Y-%m-%d")')
  open=$(open_issues) &&
    closed=$(gh api --paginate "repos/{owner}/{repo}/issues?state=closed&since=${since}T00:00:00Z&per_page=100" \
      --jq '.[] | select(.pull_request | not) | tojson' | jq -s --arg since "$since" 'map(select(.closed_at >= $since))') &&
    prs=$(gh api --paginate 'repos/{owner}/{repo}/pulls?state=open&per_page=100' \
      --jq '.[] | select(.head.ref | test("/[0-9]+-")) | tojson' | with_pr_state | jq -s .) &&
    issues=$(printf '%s\n%s\n' "$open" "$closed" | jq -cs 'add | unique_by(.number)') &&
    rows=$(printf '%s\n%s\n' "$issues" "$prs" | jq -cs "$RESOLVER"' .[1] as $prs | .[0] | map((.number | tostring) as $n | resolve($n) as $r | {
      number, title, url: .html_url,
      type: ([.labels[].name] | if index("bug") then "bug" elif index("enhancement") then "feature" elif index("chore") then "chore" elif index("hotfix") then "hotfix" else null end),
      updatedAt: .updated_at, closedAt: .closed_at, line: $r.line, state: $r.state, reason: $r.reason, act: $r.act,
      pr: ([$prs[] | select(.headRefName | contains("/\($n)-"))][0] | if . then {number, url, draft: .isDraft, checks, review} else null end)})') ||
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
  issues=$(open_issues) &&
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
issue=$(gh api "repos/{owner}/{repo}/issues/$n" --jq tojson | with_comments) &&
  printf '%s\n' "$issue" | jq -r --arg n "$n" "$RESOLVER"' line($n)' ||
  { printf 'stop cannot read #%s from GitHub\n' "$n"; exit 1; }
