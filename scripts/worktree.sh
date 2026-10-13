#!/usr/bin/env bash
# Every lane checks its branch out here, so parallel flows never switch the main checkout's branch.
set -euo pipefail

usage() {
  echo "usage: scripts/worktree.sh [--remove] <issue number>, e.g. 302 or #302" >&2
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
marker=backend/.venv/.worktree-setup-done
git worktree prune
from_pr=0
branch=$(git branch --list --format='%(refname:lstrip=2)' "feat/$n-*" "fix/$n-*" "hotfix/$n-*" "chore/$n-*")
[[ $branch != *$'\n'* ]] || refuse "several branches match #$n: ${branch//$'\n'/ }; keep one"
if [ -z "$branch" ]; then
  [ "$remove" -eq 0 ] || exit 0
  heads=$(gh pr list --state open --limit 200 --json headRefName --jq '.[].headRefName') || refuse "cannot list the open PRs on GitHub"
  branch=$(grep -E "^(feat|fix|hotfix|chore)/$n-" <<<"$heads" || true)
  [[ $branch != *$'\n'* ]] || refuse "several open PRs match #$n: ${branch//$'\n'/ }"
  if [ -n "$branch" ]; then
    from_pr=1
  else
    issue=$(gh issue view "$n" --json title,labels --jq '.title, .labels[].name') || refuse "cannot read #$n on GitHub"
    lanes=$(tail -n +2 <<<"$issue" | grep -xE 'epic|enhancement|bug|hotfix|chore' | paste -sd ' ' - || true)
    case " $lanes " in
      *" epic "*) refuse "#$n is an epic: an epic has no branch; run each child's own lane" ;;
      " enhancement ") prefix=feat ;;
      " bug ") prefix=fix ;;
      " hotfix ") prefix=hotfix ;;
      " chore ") prefix=chore ;;
      "  ") refuse "#$n has no lane label; run /triage #$n first" ;;
      *) refuse "#$n has several lane labels ($lanes); keep one" ;;
    esac
    slug=$(head -n 1 <<<"$issue" | LC_ALL=C tr 'A-Z' 'a-z' | LC_ALL=C sed -E 's/[^a-z0-9]+/-/g; s/^-//; s/-$//')
    # 30 characters keep .claude/worktrees/<n>-<slug>/frontend/node_modules/... inside Windows path limits.
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
  prs=$(gh pr list --head "$branch" --state all --json state,headRefOid --jq '.[] | .state + " " + .headRefOid') ||
    refuse "cannot list the PRs of $branch on GitHub"
  tip=$(git rev-parse "refs/heads/$branch")
  if grep -q '^OPEN ' <<<"$prs"; then
    refuse "the PR for $branch is OPEN; remove its worktree only after the merge"
  elif merged=$(grep '^MERGED ' <<<"$prs"); then
    grep -qx "MERGED $tip" <<<"$merged" ||
      refuse "local $branch is at $tip, its merged PR at ${merged//MERGED /}: the local branch has commits the merged PR does not contain"
  else
    issue=$(gh issue view "$n" --json state,labels --jq '.state, .labels[].name') || refuse "cannot read #$n on GitHub"
    [ "${issue%%$'\n'*}" = CLOSED ] || grep -qx epic <<<"$issue" ||
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
  if [ -f "$current/$marker" ]; then
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
  git fetch -q origin master >&2
  git worktree add --no-track -b "$branch" "$path" origin/master >&2
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
uv venv -q --clear --python 3.12 backend/.venv >&2 || fail "uv venv"
uv pip install -q --python backend/.venv \
  -r backend/requirements.txt -r backend/api/requirements.txt -e ./backend \
  -r backend/requirements-dev.txt >&2 || fail "uv pip install"
npm --prefix frontend ci >&2 || fail "npm ci"
for f in backend/face_landmarker.task .env docker-compose.override.yml; do
  if [ -f "$main/$f" ]; then cp "$main/$f" "$f" || fail "copy $f"; fi
done
touch "$marker" || fail "mark setup done"
echo "$path"
