#!/usr/bin/env bash
# The one landing path of an agent (ADR-0008). .claude/celetis-flow/landing.json names the mechanism: pr or merge.
set -euo pipefail

die() { printf 'land: %s\n' "$1" >&2; exit 1; }

usage="usage: scripts/celetis land <issue number> '<type>(<area>): <what>', e.g. scripts/celetis land 415 'feat(agent-harness): the build step lands the change'"
conventional='^[a-z]+(\([^()]+\))?!?: [^ ]'
[ $# -eq 2 ] || { echo "$usage" >&2; exit 2; }
n=${1#\#}
subject=$2
[[ $n =~ ^[1-9][0-9]*$ && $subject =~ $conventional && $subject != *$'\n'* && $subject != *"(#$n)" ]] ||
  { echo "$usage" >&2; exit 2; }

here=$(cd "$(dirname "$0")" && pwd)
. "$here/worktree-lib.sh"
common=$(git rev-parse --path-format=absolute --git-common-dir)
main=$(dirname "$common")
landing=$(jq -r '.landing // empty' "$main/.claude/celetis-flow/landing.json" 2>/dev/null) || landing=
case $landing in
  pr | merge) ;;
  *) echo 'land: .claude/celetis-flow/landing.json must name the landing mechanism: {"landing": "pr"} or {"landing": "merge"}' >&2; exit 2 ;;
esac

# scripts/next-step.sh reads this lock: the runner does not end the session while the landing runs.
lock="$common/celetis-flow/land-$n.lock"
mkdir -p "$common/celetis-flow"
echo "$$" >"$lock"
landed=
at_exit() {
  local status=$?
  [ "$(cat "$lock" 2>/dev/null)" != "$$" ] || rm -f "$lock"
  if [ -n "$landed" ] && [ "$status" -ne 0 ]; then
    echo "land: the change is on $trunk, but the removal of $branch stopped; run scripts/celetis land again" >&2
    exit 1
  fi
}
trap at_exit EXIT

trunk=$(gh api 'repos/{owner}/{repo}' --jq .default_branch) || die "cannot read the default branch from GitHub"
branch=$(git branch --list --format='%(refname:lstrip=2)' "feat/$n-*" "fix/$n-*" "hotfix/$n-*" "chore/$n-*")
[ -n "$branch" ] || die "no lane branch matches #$n; nothing to land"
[[ $branch != *$'\n'* ]] || die "several branches match #$n: ${branch//$'\n'/ }; keep one"
checkout=$(checkout_of "$branch")
[ "$checkout" != "$main" ] || die "switch the main checkout off $branch first"
if [ -n "$checkout" ]; then
  [ "$(git rev-parse --show-toplevel)" != "$checkout" ] || die "leave $checkout first: run scripts/celetis land from the main checkout"
  [ -z "$(git -C "$checkout" status --porcelain)" ] || die "the lane worktree is dirty: $checkout; commit first"
fi
git fetch -q origin "$trunk" || die "cannot fetch $trunk from origin"
tip=$(git rev-parse "refs/heads/$branch")
[ -n "$(git rev-list -n 1 "origin/$trunk..$branch")" ] || die "$branch has no commit that $trunk lacks; nothing to land"

stale="merge origin/$trunk into $branch, run the verify gate of the project again, then land again"

close_issue() {
  gh api --silent "repos/{owner}/{repo}/issues/$1/comments" -f body="$2" &&
    gh api --silent -X PATCH "repos/{owner}/{repo}/issues/$1" -f state=closed -f state_reason=completed
}

land_merge() {
  local tree commit
  tree=$(git merge-tree --write-tree "origin/$trunk" "$branch" 2>/dev/null) || tree=
  if [ "$tree" = "$(git rev-parse "origin/$trunk^{tree}")" ]; then
    commit=$(git log -n 1 --format=%H --fixed-strings --grep="(#$n)" "origin/$trunk")
  else
    [ -z "$(git -C "$main" status --porcelain)" ] || die "the main checkout is dirty: $main; commit or stash first"
    [ "$(git -C "$main" branch --show-current)" = "$trunk" ] || die "the main checkout is not on $trunk: $main"
    [ "$(git -C "$main" rev-parse HEAD)" = "$(git rev-parse "origin/$trunk")" ] ||
      die "the main checkout is not level with origin/$trunk; run git pull, or push, there first"
    git merge-base --is-ancestor "origin/$trunk" "$branch" || die "$branch does not contain the head of $trunk; $stale"
    # The branch contains the trunk head, so its tree is the squash tree; the main checkout moves only after the push.
    commit=$(git commit-tree "$branch^{tree}" -p "origin/$trunk" -m "$subject (#$n)")
    git push -q origin "$commit:refs/heads/$trunk" || die "cannot push $trunk to origin; $trunk is as it was"
    git -C "$main" merge -q --ff-only "$commit" ||
      die "the change is on origin/$trunk, but the main checkout did not move; run git pull there, then run scripts/celetis land again"
  fi
  [ "$(gh api "repos/{owner}/{repo}/issues/$n" --jq .state)" = closed ] ||
    close_issue "$n" "Landed on $trunk${commit:+ in $commit}." ||
    die "the change is on $trunk, but #$n is open; run scripts/celetis land again"
}

buckets_of() {
  {
    gh api --paginate "repos/{owner}/{repo}/commits/$1/check-runs?per_page=100" --jq '.check_runs[] |
      if .status != "completed" then "pending"
      elif .conclusion == "success" then "pass"
      elif .conclusion == "skipped" or .conclusion == "neutral" then "skipping"
      elif .conclusion == "cancelled" then "cancel"
      elif .conclusion == "failure" or .conclusion == "timed_out" or .conclusion == "action_required" then "fail"
      else "pending" end' &&
      gh api --paginate "repos/{owner}/{repo}/commits/$1/status?per_page=100" --jq '.statuses[] |
        if .state == "success" then "pass" elif .state == "error" or .state == "failure" then "fail" else "pending" end'
  } | LC_ALL=C sort -u | paste -sd ' ' -
}

green() {
  # After a push, the PR starts its checks on $tip only when it shows $tip.
  [ "$(gh api "repos/{owner}/{repo}/pulls/$pr" --jq .head.sha 2>/dev/null)" = "$tip" ] ||
    { buckets="the PR does not show $tip yet"; return 1; }
  buckets=$(buckets_of "$tip" 2>/dev/null) || buckets=""
  case $buckets in
    pass | "pass skipping") return 0 ;;
    "" | *pending*) return 1 ;;
    skipping) die "no check ran on PR #$pr: each check was skipped: $url" ;;
    *) die "PR #$pr has a check that is not green ($buckets): $url" ;;
  esac
}

wait_green() {
  local i
  for ((i = 0; i < 60; i++)); do
    green && return 0
    sleep 15
  done
  return 1
}

land_pr() {
  local merged open lane head base
  merged=$(gh api --paginate "repos/{owner}/{repo}/pulls?head={owner}:$(jq -rn --arg b "$branch" '$b | @uri')&state=closed&per_page=100" \
    --jq '.[] | select(.merged_at) | "\(.base.ref) \(.head.sha)"') || die "cannot list the PRs of $branch on GitHub"
  ! grep -qxF "$trunk $tip" <<<"$merged" || return 0
  git merge-tree --write-tree "origin/$trunk" "$branch" >/dev/null 2>&1 || die "$branch conflicts with $trunk; $stale"
  open=$(gh api --paginate 'repos/{owner}/{repo}/pulls?state=open&per_page=100' \
    --jq '.[] | "\(.head.ref) \(.base.ref) \(.number) \(.html_url)"') || die "cannot list the open PRs on GitHub"
  lane=$(grep -E "^(feat|fix|hotfix|chore)/$n-" <<<"$open" || true)
  while read -r head base pr url; do
    [ -z "$head" ] || [ "$base" = "$trunk" ] || die "PR #$pr of #$n has the base $base, not $trunk; change its base, or close it: $url"
  done <<<"$lane"
  [[ $lane != *$'\n'* ]] || die "several open PRs match #$n: $(cut -d' ' -f1 <<<"$lane" | paste -sd ' ' -); keep one"
  read -r head base pr url <<<"$lane"
  [ -z "$lane" ] || [ "$head" = "$branch" ] || die "PR #$pr of #$n is on $head, not on $branch; keep one branch: $url"
  git push -q origin "$branch" || die "cannot push $branch to origin"
  if [ -z "$lane" ]; then
    url=$(gh api 'repos/{owner}/{repo}/pulls' -f base="$trunk" -f head="$branch" -f title="$subject (#$n)" -f body="Closes #$n" --jq .html_url) ||
      die "cannot open the PR of $branch"
    pr=${url##*/}
    [[ $pr =~ ^[0-9]+$ ]] || die "cannot read the number of the new PR: $url"
  fi
  echo "Waiting up to 15 minutes for the checks of PR #$pr at $tip"
  wait_green || die "the checks of PR #$pr did not finish in 15 minutes (${buckets:-no check runs}): $url"
  gh api --silent -X PUT "repos/{owner}/{repo}/pulls/$pr/merge" -f merge_method=squash -f sha="$tip" || die "cannot merge PR #$pr at $tip; the PR stays open: $url"
}

close_epic() {
  local parent number state open
  parent=$(gh api "repos/{owner}/{repo}/issues/$n/parent" --jq '"\(.number) \(.state)"' 2>&1) || {
    [[ $parent == *"HTTP 404"* ]] || echo "land: cannot read the parent of #$n; close its epic by hand: $parent"
    return 0
  }
  read -r number state <<<"$parent"
  [ "$state" = open ] || return 0
  open=$(gh api --paginate "repos/{owner}/{repo}/issues/$number/sub_issues" \
    --jq ".[] | select(.state == \"open\" and .number != $n) | .number" 2>&1) ||
    { echo "land: cannot read the sub-issues of #$number; close the epic by hand: $open"; return 0; }
  [ -z "$open" ] || return 0
  close_issue "$number" "Each sub-issue is closed: #$n landed last." ||
    echo "land: cannot close the epic #$number; close it by hand"
}

# GitHub deletes the branch of a merged PR at a moment of its own, so no read comes before the delete.
delete_pushed() {
  local refusal left
  refusal=$(git push -q origin --delete "$branch" 2>&1) && return 0
  left=$(git ls-remote --heads origin "refs/heads/$branch") && [ -z "$left" ] && return 0
  printf '%s\n' "$refusal" >&2
  return 1
}

"land_$landing"
landed=1
echo "land: #$n is on $trunk"
close_epic
delete_pushed
# A plain call: in an || list, set -e is off inside remove_lane, and it deletes the lane after a checkout that it could not remove.
remove_lane "$n" "$branch" "$checkout"
echo "land: $branch and its worktree are gone"
