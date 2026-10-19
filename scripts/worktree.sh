#!/usr/bin/env bash
# Every lane checks its branch out here, so parallel flows never switch the main checkout's branch.
set -euo pipefail

usage() {
  echo "usage: scripts/celetis worktree [--remove] <issue number>, e.g. 302 or #302" >&2
  exit 2
}

refuse() {
  echo "$1" >&2
  exit 1
}

. "$(dirname "$0")/worktree-lib.sh"

remove=0
if [ "${1:-}" = --remove ]; then
  remove=1
  shift
fi
[ $# -eq 1 ] || usage
n=${1#\#}
[[ $n =~ ^[1-9][0-9]*$ ]] || usage

main=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
setup=.claude/celetis-flow/worktree-setup.sh
# The marker sits in the git dir: a file in the working tree would make a new worktree dirty.
marker_of() { echo "$(git -C "$1" rev-parse --path-format=absolute --git-dir)/celetis-flow-setup-done"; }
git worktree prune
from_pr=0
branch=$(git branch --list --format='%(refname:lstrip=2)' "feat/$n-*" "fix/$n-*" "hotfix/$n-*" "chore/$n-*")
[[ $branch != *$'\n'* ]] || refuse "several branches match #$n: ${branch//$'\n'/ }; keep one"
if [ -z "$branch" ]; then
  [ "$remove" -eq 0 ] || exit 0
  heads=$(gh api --paginate 'repos/{owner}/{repo}/pulls?state=open&per_page=100' --jq '.[].head.ref') || refuse "cannot list the open PRs on GitHub"
  branch=$(grep -E "^(feat|fix|hotfix|chore)/$n-" <<<"$heads" || true)
  [[ $branch != *$'\n'* ]] || refuse "several open PRs match #$n: ${branch//$'\n'/ }"
  if [ -n "$branch" ]; then
    from_pr=1
  else
    issue=$(gh api "repos/{owner}/{repo}/issues/$n" --jq '.title, .labels[].name') || refuse "cannot read #$n on GitHub"
    lanes=$(tail -n +2 <<<"$issue" | grep -xE 'epic|enhancement|bug|hotfix|chore' | paste -sd ' ' - || true)
    case " $lanes " in
      *" epic "*) refuse "#$n is an epic: an epic has no branch; run each child's own lane" ;;
      " enhancement ") prefix=feat ;;
      " bug ") prefix=fix ;;
      " hotfix ") prefix=hotfix ;;
      " chore ") prefix=chore ;;
      "  ") refuse "#$n has no lane label; run /celetis:triage #$n first" ;;
      *) refuse "#$n has several lane labels ($lanes); keep one" ;;
    esac
    slug=$(head -n 1 <<<"$issue" | LC_ALL=C tr 'A-Z' 'a-z' | LC_ALL=C sed -E 's/[^a-z0-9]+/-/g; s/^-//; s/-$//')
    # 30 characters keep .claude/worktrees/<n>-<slug>/ plus the deepest path of a project inside Windows path limits.
    if [ ${#slug} -gt 30 ]; then
      slug=${slug:0:31}
      if [[ $slug == *-* ]]; then slug=${slug%-*}; else slug=${slug:0:30}; fi
    fi
    branch=$prefix/$n-${slug:-issue}
  fi
fi

path="$main/.claude/worktrees/${branch#*/}"
current=$(checkout_of "$branch")
has_branch=0
git show-ref --verify --quiet "refs/heads/$branch" && has_branch=1

if [ "$current" = "$main" ]; then
  echo "switch the main checkout off $branch first" >&2
  exit 1
fi

if [ "$remove" -eq 1 ]; then
  prs=$(gh api --paginate "repos/{owner}/{repo}/pulls?head={owner}:$branch&state=all&per_page=100" \
    --jq '.[] | (if .merged_at then "MERGED" else (.state | ascii_upcase) end) + " " + .head.sha') ||
    refuse "cannot list the PRs of $branch on GitHub"
  tip=$(git rev-parse "refs/heads/$branch")
  if grep -q '^OPEN ' <<<"$prs"; then
    refuse "the PR for $branch is OPEN; remove its worktree only after the merge"
  elif merged=$(grep '^MERGED ' <<<"$prs"); then
    grep -qx "MERGED $tip" <<<"$merged" ||
      refuse "local $branch is at $tip, its merged PR at ${merged//MERGED /}: the local branch has commits the merged PR does not contain"
  else
    issue=$(gh api "repos/{owner}/{repo}/issues/$n" --jq '.state, .labels[].name') || refuse "cannot read #$n on GitHub"
    [ "${issue%%$'\n'*}" = closed ] || grep -qx epic <<<"$issue" ||
      refuse "#$n is open and $branch has no merged PR; remove its worktree after the merge, or after the issue closes"
    local_only=$(git rev-list -n 1 "refs/heads/$branch" --not --exclude="origin/prototype/$n-*" --remotes=origin)
    [ -z "$local_only" ] ||
      refuse "$branch has commits that no origin branch contains; run git push origin $branch, then remove its worktree"
  fi
  if [ -n "$current" ] && [ "$(git rev-parse --show-toplevel)" = "$current" ]; then
    echo "leave $current before removing it" >&2
    exit 1
  fi
  remove_lane "$n" "$branch" "$current"
  exit 0
fi

if [ -n "$current" ]; then
  if [ -f "$(marker_of "$current")" ]; then
    echo "$current"
    exit 0
  fi
  path=$current
elif [ "$has_branch" -eq 1 ]; then
  git worktree add "$path" "$branch" >&2
elif [ "$from_pr" -eq 1 ]; then
  git fetch -q origin "$branch" >&2
  git worktree add --track -b "$branch" "$path" "origin/$branch" >&2
else
  trunk=$(gh api 'repos/{owner}/{repo}' --jq .default_branch) || refuse "cannot read the default branch from GitHub"
  git fetch -q origin "$trunk" >&2
  git worktree add --no-track -b "$branch" "$path" "origin/$trunk" >&2
fi

fail() {
  echo "worktree setup failed: $1" >&2
  if [ -z "$current" ]; then
    cd "$main"
    git worktree remove --force "$path" >&2 || true
    [ "$has_branch" -eq 1 ] || git branch -D "$branch" >&2 || true
  fi
  exit 1
}

cd "$path"
if [ -f "$setup" ]; then
  bash "$setup" "$main" >&2 || fail "$setup"
fi
touch "$(marker_of .)" || fail "mark setup done"
echo "$path"
