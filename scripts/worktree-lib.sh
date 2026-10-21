# Sourced by scripts/worktree.sh, scripts/land.sh, and scripts/setup.sh.

# The marker sits in the git dir: a file in the working tree would make a new worktree dirty.
marker_of() { echo "$(git -C "$1" rev-parse --path-format=absolute --git-dir)/celetis-flow-setup-done"; }

run_setup() {
  local checkout=$1 config=$2 main=$3 setup
  setup=$(printf '%s\n' "$config" | jq -jr '.worktreeSetup // ""'; printf '.')
  setup=${setup%.}
  [ -n "$setup" ] || return 0
  (cd "$checkout" && bash -c "$setup" celetis-worktree-setup "$main" >&2) || return
  touch "$(marker_of "$checkout")" || return 1
}

checkout_of() {
  git worktree list --porcelain | awk -v ref="refs/heads/$1" '
    /^worktree / { wt = substr($0, 10) }
    $0 == "branch " ref { print wt }'
}

remove_checkout() {
  git worktree unlock "$1" 2>/dev/null || true
  git worktree remove "$1"
}

# Prototypes go first: each caller finds the issue by its lane branch, so a rerun finishes a partial removal.
remove_lane() {
  local n=$1 branch=$2 checkout=$3 prototypes pushed prototype at
  prototypes=$(git branch --list --format='%(refname:lstrip=2)' "prototype/$n-*")
  pushed=$(git ls-remote --heads origin "refs/heads/prototype/$n-*" | cut -f2)
  for prototype in $prototypes; do
    at=$(checkout_of "$prototype")
    [ -z "$at" ] || remove_checkout "$at"
    git branch -D "$prototype" >&2
  done
  [ -z "$pushed" ] || git push -q origin --delete $pushed >&2
  [ -z "$checkout" ] || remove_checkout "$checkout"
  git branch -D "$branch" >&2
}
