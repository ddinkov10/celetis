#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'cd /; rm -rf "$tmp"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
. "$here/lib/pool.sh"
config=.celetis.yaml
mkdir -p "$tmp/bin"
ln -s "$here/.." "$tmp/plug in"
land_sh="$tmp/plug in/scripts/land.sh"

fail() {
  echo "FAIL: $1"
  exit 1
}

cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$S/gh-calls"
[ -f "$S/lock-seen" ] || cp "$(git rev-parse --git-common-dir)/celetis-flow/land-7.lock" "$S/lock-seen" 2>/dev/null || true
[ "$1" = api ] || { echo "HTTP 403: GitHub GraphQL is not available from Claude Code sessions" >&2; exit 1; }
shift
method= filter=. paginate= endpoint= fields=()
while [ $# -gt 0 ]; do
  case $1 in
    --paginate) paginate=1 ;;
    --silent) ;;
    --jq) filter=$2; shift ;;
    -X) method=$2; shift ;;
    -f) fields+=("$2"); shift ;;
    -*) echo "stub gh: unknown flag $1" >&2; exit 1 ;;
    *) endpoint=$1 ;;
  esac
  shift
done
[ -n "$method" ] || { [ ${#fields[@]} -eq 0 ] && method=GET || method=POST; }
path=${endpoint%%\?*}
[ ! -f "$S/gh-fail" ] && [ ! -f "$S/fail-$method-${path##*/}" ] || { echo "HTTP 502" >&2; exit 1; }
answer() { jq -r "$filter" "$S/$1.json"; }
list() {
  [ -n "$paginate" ] && [[ $endpoint == *per_page=100* ]] || { echo "stub gh: a list without --paginate and per_page=100: $endpoint" >&2; exit 1; }
  answer "$1"
}
field() { local f; for f in "${fields[@]}"; do [ "${f%%=*}" != "$1" ] || echo "${f#*=}"; done; }
nth() {
  local k=0
  { read -r k <"$S/$1"; } 2>/dev/null || true
  k=$((k + 1))
  echo "$k" >"$S/$1"
  [ -f "$S/$2-$k.json" ] && echo "$2-$k" || echo "$2"
}
repo='repos/{owner}/{repo}'
case "$method $endpoint" in
  "GET $repo") answer repo ;;
  "GET $repo/issues/"*/parent)
    [ ! -f "$S/parent-fail" ] || { echo "gh: Bad Gateway (HTTP 502)" >&2; exit 1; }
    [ -f "$S/parent.json" ] || { echo '{"message":"No parent issue found","status":"404"}'; echo "gh: No parent issue found (HTTP 404)" >&2; exit 1; }
    answer parent ;;
  "GET $repo/issues/"*/sub_issues) answer subs ;;
  "GET $repo/issues/"*) answer issue ;;
  "POST $repo/issues/"*/comments | "PATCH $repo/issues/"*)
    n=${path%/comments}; n=${n##*/}
    [ ! -f "$S/close-fail-$n" ] || { echo "close failed" >&2; exit 1; }
    if [ "$method" = POST ]; then echo "comment $n $(field body)"; else echo "close $n $(field state) $(field state_reason)"; fi >>"$S/closed" ;;
  "GET $repo/pulls?state=open&"*) list prs ;;
  "GET $repo/pulls?head={owner}:"*"&state=closed&"*)
    head=${endpoint#*:}
    head=$(perl -pe 's/\+/ /g; s/%([0-9A-Fa-f]{2})/chr hex $1/ge' <<<"${head%%&*}")
    jq --arg head "$head" 'map(select(.head.ref == $head))' "$S/merged.json" >"$S/merged-of-head.json"
    list merged-of-head ;;
  "POST $repo/pulls")
    printf '%s\n' "${fields[*]}" >"$S/create-args"
    echo '{"number":9,"html_url":"https://github.com/o/r/pull/9"}' | jq -r "$filter" ;;
  "GET $repo/pulls/"*) answer "$(nth views view)" ;;
  "PUT $repo/pulls/"*/merge)
    [ ! -f "$S/merge-fail" ] || { cat "$S/merge-fail" >&2; exit 1; }
    pr=${path%/merge}
    printf '%s\n' "${pr##*/} ${fields[*]}" >"$S/merge-args"
    git --git-dir="$ORIGIN" for-each-ref --format='%(refname:short) %(objectname)' refs/heads >"$S/origin-at-merge"
    squash=$(git --git-dir="$ORIGIN" commit-tree "$(git --git-dir="$ORIGIN" merge-tree --write-tree master "$(field sha)")" -p master -m "squash of ${pr##*/}")
    git --git-dir="$ORIGIN" update-ref refs/heads/master "$squash"
    [ ! -f "$S/auto-delete" ] || git --git-dir="$ORIGIN" update-ref -d "refs/heads/$(cat "$S/auto-delete")" ;;
  "GET $repo/commits/"*"/check-runs?"*) list "$(nth polls checks)" ;;
  "GET $repo/commits/"*"/status?"*) list status ;;
  "GET $repo/actions/runs?head_sha="*) list "$(nth run-lists runs)" ;;
  "GET $repo/actions/runs/"*) answer "$(nth run-polls run)" ;;
  "POST $repo/actions/runs/"*/rerun-failed-jobs)
    run=${path%/rerun-failed-jobs}
    echo "${run##*/}" >>"$S/reruns" ;;
  *) echo "stub gh: unexpected $method $endpoint" >&2; exit 1 ;;
esac
EOF
printf '#!/bin/sh\necho x >>"$S/sleeps"\n' >"$tmp/bin/sleep"
# A git for one case, so not in $tmp/bin: origin answers no command on fix/7-crash.
mkdir "$tmp/deaf"
printf '#!/usr/bin/env bash\ncase " $* " in *" origin "*fix/7-crash*) echo "fatal: origin does not answer" >&2; exit 128 ;; esac\nexec %q "$@"\n' \
  "$(command -v git)" >"$tmp/deaf/git"
chmod +x "$tmp/bin/gh" "$tmp/bin/sleep" "$tmp/deaf/git"
export PATH="$tmp/bin:$PATH"

json() { printf '%s\n' "$2" >"$S/$1.json"; }
template() {
  local t="$tmp/template-$1" other=pr
  [ "$1" != pr ] || other=merge
  git init -q -b master "$t/main checkout"
  cd "$t/main checkout"
  echo app >app.txt
  printf '.claude/worktrees/\n' >.gitignore
  printf 'landing: %s\nworktreeSetup: touch "$S/setup-ran"\n' "$1" >"$config"
  mkdir -p .claude/celetis-flow
  printf '{"landing":"%s"}\n' "$other" >.claude/celetis-flow/landing.json
  git add -A
  git commit -qm base
  git clone -q --bare . "$t/origin.git"
  git remote add origin "$t/origin.git"
  git fetch -q origin
  cd /
}
fresh() {
  cd /
  rm -rf "$repo" "$g/other" "$ORIGIN" "$S"
  mkdir -p "$S"
  cp -R "$tmp/template-$1/main checkout" "$repo"
  cp -R "$tmp/template-$1/origin.git" "$ORIGIN"
  cd "$repo"
  git remote set-url origin "$ORIGIN"
  main=$(pwd -P)
  wt= branch= from=
  json repo '{"default_branch":"master"}'
  json issue '{"state":"open"}'
  json prs '[]'
  json merged '[]'
  json subs '[]'
  json checks '{"check_runs":[]}'
  json status '{"statuses":[]}'
  json runs '{"workflow_runs":[]}'
  json run '{"run_attempt":2,"status":"completed"}'
}
lane() {
  branch=$1
  wt="$main/.claude/worktrees/${1#*/}"
  git worktree add -q -b "$1" "$wt" origin/master
  echo "${2:-work}" >"$wt/${3:-work.txt}"
  if [ "${LANE_CONFLICT:-}" = 1 ]; then
    other='pr'
    [ "$(yq .landing "$main/$config")" != pr ] || other=merge
    printf 'landing: %s\n' "$other" >"$wt/$config"
  fi
  git -C "$wt" add -A
  git -C "$wt" commit -qm work
  tip=$(git rev-parse "$1")
  json view "{\"head\":{\"sha\":\"$tip\"}}"
}
upstream() {
  git clone -q "$ORIGIN" "$g/other"
  echo "${2:-theirs}" >"$g/other/${1:-up.txt}"
  git -C "$g/other" add -A
  git -C "$g/other" commit -qm upstream
  git -C "$g/other" push -q origin master
}
reject_push() {
  printf '#!/bin/sh\nexit 1\n' >"$ORIGIN/hooks/pre-receive"
  chmod +x "$ORIGIN/hooks/pre-receive"
}
on_delete() {
  printf '#!/bin/sh\ncase $3 in *[!0]*) exit 0 ;; esac\n%s\nexit 1\n' "$1" >"$ORIGIN/hooks/update"
  chmod +x "$ORIGIN/hooks/update"
}
# GitHub deletes the branch of a merged PR at a moment of its own: with $lost, origin does it when the script deletes, and that delete fails.
lost='git update-ref -d "$1"'
prs() {
  local rows=
  while [ $# -gt 0 ]; do
    rows="$rows${rows:+,}{\"head\":{\"ref\":\"$1\"},\"base\":{\"ref\":\"master\"},\"number\":$2,\"html_url\":\"https://github.com/o/r/pull/$2\"}"
    shift 2
  done
  json prs "[$rows]"
}
on_base() { json prs "$(jq -c --argjson pr "$1" --arg base "$2" '(.[] | select(.number == $pr)).base.ref = $base' "$S/prs.json")"; }
merged() { json merged "[{\"state\":\"closed\",\"merged_at\":\"2026-10-19T00:00:00Z\",\"base\":{\"ref\":\"${2:-master}\"},\"head\":{\"ref\":\"$branch\",\"sha\":\"$1\"}}]"; }
checks() {
  # shellcheck disable=SC2086 # $1 is a list of check states
  json "${2:-checks}" "$(jq -cn '{check_runs: [$ARGS.positional | to_entries[] | (.value | split("@")) as [$w, $app] |
    {pass: "success", fail: "failure", timeout: "timed_out", action: "action_required", skipping: "skipped", cancel: "cancelled"}[$w] as $c |
    {id: (100 + .key), name: "job \(.key)", app: {slug: ($app // "github-actions")}, check_suite: {id: 50},
      details_url: "https://github.com/o/r/actions/runs/5/job/\(100 + .key)", status: (if $c then "completed" else "in_progress" end), conclusion: $c}]}' --args $1)"
}
runs_at() { json "${2:-runs}" "{\"workflow_runs\":[{\"check_suite_id\":50,\"id\":5,\"run_attempt\":$1,\"status\":\"${3:-completed}\"}]}"; }

origin_master() { git --git-dir="$ORIGIN" rev-parse master; }
has_ref() { git show-ref --verify --quiet "refs/heads/$1"; }
on_origin() { git --git-dir="$ORIGIN" show-ref --verify --quiet "refs/heads/$1"; }
calls() { grep -cE -- "$1" "$S/gh-calls" 2>/dev/null || true; }
land() {
  before="$(origin_master) $(git rev-parse master)"
  status=0
  out=$(cd "${from:-$main}" && "$BASH" "$land_sh" "$@" 2>&1) || status=$?
  [[ $out != *"/land.sh: line "* ]] || fail "land.sh printed an error of bash: $out"
}
has() { grep -qF -- "$1" <<<"$out" || fail "$2: missing [$1] in: $out"; }
no_lock() { ! ls "$main"/.git/celetis-flow/*.lock >/dev/null 2>&1 || fail "$1 left its lock"; }
kept() {
  [ "$(origin_master) $(git rev-parse master)" = "$before" ] || fail "$1 moved the trunk"
  [ -z "$wt" ] || { [ -d "$wt" ] && has_ref "$branch"; } || fail "$1 removed the lane"
  no_lock "$1"
  [ ! -e "$S/setup-ran" ] || fail "$1 ran worktree setup"
}
refused() {
  [ "$status" -eq 1 ] || fail "$2 exit $status, not 1: $out"
  has "land: $1" "$2"
  [ "$(grep -c '^land: ' <<<"$out")" -eq 1 ] || fail "$2 printed more than one land: line: $out"
  kept "$2"
  [ "$(calls '/pulls/[0-9]+/merge')" -eq 0 ] && [ ! -f "$S/closed" ] || fail "$2 merged or closed: $(cat "$S/gh-calls")"
}
landed() {
  [ "$status" -eq 0 ] || fail "$1 exit $status: $out"
  [ ! -e "$wt" ] && ! has_ref "$branch" && ! on_origin "$branch" || fail "$1 left the worktree or the branch"
  has "land: $branch and its worktree are gone" "$1"
  [[ $out != *error:* ]] || fail "$1 printed an error of git: $out"
  no_lock "$1"
  [ ! -e "$S/setup-ran" ] || fail "$1 ran worktree setup"
}
stopped() {
  [ "$status" -eq 1 ] && [ -d "$wt" ] && has_ref "$branch" || fail "$1 exit $status, or the lane is gone: $out"
  has "land: #7 is on master" "$1"
  has "land: the change is on master, but the removal of $branch stopped; run scripts/celetis land again" "$1"
  [ "$(grep -c 'run scripts/celetis land again' <<<"$out")" -eq 1 ] || fail "$1 does not say one time to run the script again: $out"
  no_lock "$1"
  [ ! -e "$S/setup-ran" ] || fail "$1 ran worktree setup"
}
usage="usage: scripts/celetis land <issue number> '<type>(<area>): <what>', e.g. scripts/celetis land 415 'feat(agent-harness): the build step lands the change'"
usage_error() {
  land "$@"
  [ "$status" -eq 2 ] || fail "bad arguments [$*] exit $status: $out"
  has "$usage" "bad arguments [$*]"
}
old=0000000000000000000000000000000000000000

usage_and_config() {
  fresh merge
  lane fix/7-crash
  usage_error
  usage_error 7
  usage_error abc 'fix(x): y'
  usage_error 0 'fix(x): y'
  usage_error 7 ''
  usage_error 7 'the crash is gone'
  usage_error 7 'fix(x): y (#7)'
  usage_error 7 $'fix(x): y\nmore'
  usage_error 7 'fix(x): y' extra
  for value in 'landing: rebase' '{}' 'not yaml: [' ''; do
    printf '%s' "$value" >"$main/$config"
    [ -n "$value" ] || rm "$main/$config"
    land 7 'fix(x): y'
    [ "$status" -eq 2 ] || fail ".celetis.yaml [$value] exit $status: $out"
    has "$main/.celetis.yaml:" ".celetis.yaml [$value]"
    kept "bad config"
    ! on_origin "$branch" || fail "bad config pushed the lane branch"
    [ ! -d "$main/.git/celetis-flow" ] || fail "bad config created the state directory"
  done
  [ ! -f "$S/gh-calls" ] || fail "a usage error or a bad .celetis.yaml called gh: $(cat "$S/gh-calls")"
  no_lock "a usage error"
}

lane_refusals() {
  local m=$1
  fresh "$m"
  lane fix/7-crash
  touch "$S/gh-fail"
  land 7 'fix(x): y'
  refused "cannot read the default branch from GitHub" "$m: gh down"
  has "HTTP 502" "$m: gh down"
  fresh "$m"
  land 7 'fix(x): y'
  refused "no lane branch matches #7; nothing to land" "$m: no lane branch"
  fresh "$m"
  lane fix/17-other
  land 7 'fix(x): y'
  refused "no lane branch matches #7" "$m: the branch of #17"
  fresh "$m"
  lane prototype/7-look
  land 7 'fix(x): y'
  refused "no lane branch matches #7" "$m: a prototype branch"
  fresh "$m"
  lane fix/7-crash
  git branch -q feat/7-crash master
  land 7 'fix(x): y'
  refused "several branches match #7: feat/7-crash fix/7-crash; keep one" "$m: two lane branches"
  fresh "$m"
  lane fix/7-crash
  from=$wt
  land 7 'fix(x): y'
  refused "leave $wt first: run scripts/celetis land from the main checkout" "$m: inside the lane worktree"
  fresh "$m"
  lane fix/7-crash
  echo x >"$wt/new.txt"
  land 7 'fix(x): y'
  refused "the lane worktree is dirty: $wt; commit first" "$m: a dirty lane worktree"
  fresh "$m"
  lane fix/7-crash
  git -C "$wt" reset -q --hard origin/master
  land 7 'fix(x): y'
  refused "fix/7-crash has no commit that master lacks; nothing to land" "$m: a branch with no commit"
  fresh "$m"
  git checkout -q -b fix/7-crash
  git commit -q --allow-empty -m work
  land 7 'fix(x): y'
  refused "switch the main checkout off fix/7-crash first" "$m: the lane branch in the main checkout"
}

merge_refusals() {
  fresh merge
  lane fix/7-crash
  echo dirty >"$main/new.txt"
  land 7 'fix(x): y'
  refused "the main checkout is dirty: $main; commit or stash first" "merge: a dirty main checkout"
  fresh merge
  lane fix/7-crash
  git checkout -q -b side
  land 7 'fix(x): y'
  refused "the main checkout is not on master: $main" "merge: the main checkout off the trunk"
  fresh merge
  lane fix/7-crash
  git commit -q --allow-empty -m local
  land 7 'fix(x): y'
  refused "the main checkout is not level with origin/master" "merge: the main checkout ahead"
  fresh merge
  lane fix/7-crash
  upstream
  land 7 'fix(x): y'
  refused "the main checkout is not level with origin/master" "merge: the main checkout behind"
  fresh merge
  lane fix/7-crash
  upstream
  git pull -q origin master
  land 7 'fix(x): y'
  refused "fix/7-crash does not contain the head of master; merge origin/master into fix/7-crash, run the verify gate of the project again, then land again" "merge: a stale branch"
  fresh merge
  lane fix/7-crash
  reject_push
  land 7 'fix(x): y'
  refused "cannot push master to origin; master is as it was" "merge: a push that origin rejects"
  [ -z "$(git status --porcelain)" ] || fail "merge: a rejected push left the main checkout dirty"
}

merge_landing() {
  fresh merge
  LANE_CONFLICT=1 lane fix/7-crash
  git worktree add -q -b prototype/7-look "$main/.claude/worktrees/prototype-7-look" master
  git branch -q prototype/70-near master
  git push -q origin prototype/7-look prototype/70-near fix/7-crash
  land '#7' 'fix(x): the crash is gone'
  landed "merge"
  new=$(origin_master)
  [ "$(git rev-parse "$new^")" = "${before%% *}" ] || fail "merge: the trunk did not get one commit on its old head"
  [ "$(git log -1 --format=%s "$new")" = "fix(x): the crash is gone (#7)" ] || fail "merge: subject $(git log -1 --format=%s "$new")"
  [ "$(git rev-parse "$new^{tree}")" = "$(git rev-parse "$tip^{tree}")" ] || fail "merge: the squash tree is not the tree of the branch"
  [ "$(git rev-parse HEAD)" = "$new" ] && [ -f work.txt ] && [ -z "$(git status --porcelain)" ] || fail "merge: the main checkout did not move to the commit"
  [ "$(cat "$S/closed")" = "comment 7 Landed on master in $new."$'\n'"close 7 closed completed" ] || fail "merge: closed [$(cat "$S/closed")]"
  ! has_ref prototype/7-look && ! on_origin prototype/7-look && [ ! -e "$main/.claude/worktrees/prototype-7-look" ] || fail "merge: a prototype of #7 stays"
  has_ref prototype/70-near && on_origin prototype/70-near || fail "merge: deleted the prototype of #70"
  [ "$(calls '/(pulls|commits)')" -eq 0 ] || fail "merge read or wrote a PR: $(cat "$S/gh-calls")"
  grep -qE '^[0-9]+$' "$S/lock-seen" || fail "the script held no lock while it ran"

  fresh merge
  lane fix/7-crash
  json issue '{"state":"closed"}'
  land 7 'fix(x): y'
  landed "merge: an issue that is closed"
  [ ! -f "$S/closed" ] || fail "merge: closed an issue that was closed"
}

merge_retries() {
  fresh merge
  lane fix/7-crash
  touch "$S/close-fail-7"
  land 7 'fix(x): y'
  [ "$status" -eq 1 ] && [ -d "$wt" ] || fail "merge: a failed close exit $status: $out"
  has "land: the change is on master, but #7 is open; run scripts/celetis land again" "merge: a failed close"
  new=$(origin_master)
  rm "$S/close-fail-7"
  land 7 'fix(x): another subject'
  landed "merge: the second run after a failed close"
  [ "$(origin_master)" = "$new" ] || fail "merge: the second run made a second commit"
  [ "$(cat "$S/closed")" = "comment 7 Landed on master in $new."$'\n'"close 7 closed completed" ] || fail "merge: the second run closed [$(cat "$S/closed")]"

  fresh merge
  lane fix/7-crash
  git worktree add -q -b prototype/7-look "$main/.claude/worktrees/prototype-7-look" master
  touch "$main/.claude/worktrees/prototype-7-look/scratch"
  land 7 'fix(x): y'
  stopped "a removal that stops"
  has_ref prototype/7-look || fail "a removal that stops deleted the prototype branch of a checkout that stays"
  rm "$main/.claude/worktrees/prototype-7-look/scratch"
  json issue '{"state":"closed"}'
  land 7 'fix(x): y'
  landed "merge: the second run after a removal that stopped"
  [ "$(calls 'PATCH .*/issues/7 ')" -eq 1 ] || fail "merge: the second run closed the issue again"

  fresh merge
  lane fix/7-crash
  git push -q origin fix/7-crash
  PATH="$tmp/deaf:$PATH" land 7 'fix(x): y'
  stopped "merge: an origin that does not answer at the delete"
  has "fatal: origin does not answer" "merge: an origin that does not answer at the delete"
  on_origin fix/7-crash || fail "merge: the branch left an origin that does not answer"
  json issue '{"state":"closed"}'
  land 7 'fix(x): y'
  landed "merge: the second run after an origin that did not answer"

  fresh merge
  lane fix/7-crash
  touch "$main/.git/index.lock"
  land 7 'fix(x): y'
  [ "$status" -eq 1 ] && [ -d "$wt" ] && has_ref fix/7-crash || fail "merge: a main checkout that does not move exit $status: $out"
  has "land: the change is on origin/master, but the main checkout did not move; run git pull there, then run scripts/celetis land again" "merge: a main checkout that does not move"
  no_lock "merge: a main checkout that does not move"
  new=$(origin_master)
  rm "$main/.git/index.lock"
  git pull -q origin master
  land 7 'fix(x): another subject'
  landed "merge: the second run after a main checkout that did not move"
  [ "$(origin_master)" = "$new" ] || fail "merge: the second run after a main checkout that did not move made a second commit"
}

epics() {
  fresh merge
  lane fix/7-crash
  json parent '{"number":3,"state":"open"}'
  json subs '[{"number":7,"state":"open"},{"number":8,"state":"closed"}]'
  land 7 'fix(x): y'
  landed "the last sub-issue"
  [ "$(tail -n 2 "$S/closed")" = "comment 3 Each sub-issue is closed: #7 landed last."$'\n'"close 3 closed completed" ] ||
    fail "the last sub-issue did not close the epic: $(cat "$S/closed")"
  fresh merge
  lane fix/7-crash
  json parent '{"number":3,"state":"open"}'
  json subs '[{"number":7,"state":"closed"},{"number":8,"state":"open"}]'
  land 7 'fix(x): y'
  landed "a sub-issue with an open sibling"
  [ "$(calls 'issues/3(/comments)? ')" -eq 0 ] || fail "closed an epic with an open sub-issue"
  fresh merge
  lane fix/7-crash
  json parent '{"number":3,"state":"closed"}'
  land 7 'fix(x): y'
  landed "a closed epic"
  [ "$(calls 'sub_issues|issues/3(/comments)? ')" -eq 0 ] || fail "read or closed an epic that was closed"
  fresh merge
  lane fix/7-crash
  land 7 'fix(x): y'
  landed "no parent"
  [ "$(calls 'sub_issues')" -eq 0 ] && [[ $out != *parent* ]] || fail "an issue with no parent: $out"
  fresh merge
  lane fix/7-crash
  touch "$S/parent-fail"
  land 7 'fix(x): y'
  landed "a parent that gh cannot read"
  has "land: cannot read the parent of #7; close its epic by hand" "a parent that gh cannot read"
  fresh merge
  lane fix/7-crash
  json parent '{"number":3,"state":"open"}'
  touch "$S/close-fail-3"
  land 7 'fix(x): y'
  landed "an epic that gh cannot close"
  has "land: cannot close the epic #3; close it by hand" "an epic that gh cannot close"
}

pr_landing() {
  fresh pr
  LANE_CONFLICT=1 lane fix/7-crash
  checks pass
  json parent '{"number":3,"state":"open"}'
  json subs '[{"number":7,"state":"open"}]'
  land 7 'fix(x): the crash is gone'
  landed "pr"
  [ "$(calls 'actions/')" -eq 0 ] || fail "pr: a green PR read or re-ran a workflow run: $(cat "$S/gh-calls")"
  [ "$(cat "$S/create-args")" = "base=master head=fix/7-crash title=fix(x): the crash is gone (#7) body=Closes #7" ] || fail "pr: created [$(cat "$S/create-args")]"
  [ "$(cat "$S/merge-args")" = "9 merge_method=squash sha=$tip" ] || fail "pr: merged [$(cat "$S/merge-args")]"
  grep -qF "commits/$tip/check-runs?" "$S/gh-calls" && grep -qF "commits/$tip/status?" "$S/gh-calls" || fail "pr: read the checks of another commit: $(cat "$S/gh-calls")"
  grep -qx "fix/7-crash $tip" "$S/origin-at-merge" || fail "pr: the branch was not on origin at the merge"
  [ "$(calls '/pulls/[0-9]+/merge')" -eq 1 ] && [ ! -f "$S/sleeps" ] || fail "pr: more than one merge, or a sleep"
  [ "$(cat "$S/closed")" = "comment 3 Each sub-issue is closed: #7 landed last."$'\n'"close 3 closed completed" ] || fail "pr: closed [$(cat "$S/closed")]"
  [ "$(git rev-parse master)" = "$(origin_master)" ] && [ "$(origin_master)" != "${before%% *}" ] && [ -z "$(git status --porcelain)" ] ||
    fail "pr: the main checkout did not move to origin/master"
  [[ $out != *"did not move"* ]] || fail "pr: warned with a main checkout that moved: $out"
  fresh pr
  lane fix/7-crash
  checks pass
  mkdir "$main/sub"
  from="$main/sub"
  land 7 'fix(x): y'
  landed "pr: from a folder of the main checkout"
  for b in feat/7-x fix/7-x hotfix/7-x chore/7-x; do
    fresh pr
    lane $b
    prs release/next 12 $b 9 fix/17-other 10
    checks "pass skipping"
    echo $b >"$S/auto-delete"
    land 7 'fix(x): y'
    landed "pr: an open PR of $b"
    [ ! -f "$S/create-args" ] || fail "pr: opened a second PR for $b"
    [ "$(cat "$S/merge-args")" = "9 merge_method=squash sha=$tip" ] || fail "pr: merged [$(cat "$S/merge-args")] for $b"
  done
}

pr_delete_and_stale() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks pass
  on_delete "$lost"
  land 7 'fix(x): y'
  landed "pr: origin loses the branch at the delete"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks pass
  on_delete :
  land 7 'fix(x): y'
  stopped "pr: a delete that origin refuses"
  has "hook declined" "pr: a delete that origin refuses"
  on_origin fix/7-crash || fail "pr: a refused delete removed the branch from origin"
  rm "$ORIGIN/hooks/update"
  merged "$tip"
  land 7 'fix(x): y'
  landed "pr: the second run after a delete that origin refused"
  [ "$(calls '/pulls/[0-9]+/merge')" -eq 1 ] || fail "pr: the second run merged again"
  fresh pr
  prs release/next 12
  checks pass
  land 12 'fix(x): y'
  refused "no lane branch matches #12; nothing to land" "pr: the number of the release PR"
  fresh pr
  lane fix/7-crash
  upstream
  checks pass
  land 7 'fix(x): y'
  landed "pr: a branch behind the trunk with no conflict"
}

pr_refusals() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9 feat/7-crash 10
  checks pass
  land 7 'fix(x): y'
  refused "several open PRs match #7: fix/7-crash feat/7-crash; keep one" "pr: two lane PRs"
  ! on_origin fix/7-crash || fail "pr: pushed before the refusal of two lane PRs"
  fresh pr
  lane fix/7-crash
  prs feat/7-other 10
  checks pass
  land 7 'fix(x): y'
  refused "PR #10 of #7 is on feat/7-other, not on fix/7-crash; keep one branch" "pr: a PR on another branch"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 10
  on_base 10 develop
  checks pass
  land 7 'fix(x): y'
  refused "PR #10 of #7 has the base develop, not master; change its base, or close it: https://github.com/o/r/pull/10" "pr: a lane PR on another base"
  ! on_origin fix/7-crash && [ ! -f "$S/create-args" ] || fail "pr: pushed, or opened a second PR, beside a lane PR on another base"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9 fix/7-crash 10
  on_base 10 develop
  checks pass
  land 7 'fix(x): y'
  refused "PR #10 of #7 has the base develop, not master" "pr: a lane PR on another base beside one on the trunk"
  ! on_origin fix/7-crash || fail "pr: pushed before the refusal of a lane PR on another base"
  fresh pr
  lane fix/7-crash mine app.txt
  upstream app.txt theirs
  land 7 'fix(x): y'
  refused "fix/7-crash conflicts with master; merge origin/master into fix/7-crash, run the verify gate of the project again, then land again" "pr: a conflict"
  ! on_origin fix/7-crash && [ "$(calls 'pulls\?state=open')" -eq 0 ] || fail "pr: a conflicting branch was pushed"
  fresh pr
  lane fix/7-crash
  touch "$S/fail-GET-pulls"
  land 7 'fix(x): y'
  refused "cannot list the PRs of fix/7-crash on GitHub" "pr: the PR list fails"
  fresh pr
  lane fix/7-crash
  reject_push
  land 7 'fix(x): y'
  refused "cannot push fix/7-crash to origin" "pr: a push that origin rejects"
  fresh pr
  lane fix/7-crash
  touch "$S/fail-POST-pulls"
  land 7 'fix(x): y'
  refused "cannot open the PR of fix/7-crash" "pr: the PR create fails"
}

check_refusal() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "$1"
  land 7 'fix(x): y'
  refused "$2" "pr: checks [$1]"
  on_origin fix/7-crash || fail "pr: a refusal removed the pushed branch"
}

checks_not_green() {
  check_refusal "fail pass" "PR #9 has a check that is not green (fail pass)"
  check_refusal "cancel pass" "PR #9 has a check that is not green (cancel pass)"
  check_refusal skipping "no check ran on PR #9: each check was skipped"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks pass
  json status '{"statuses":[{"state":"failure"}]}'
  land 7 'fix(x): y'
  refused "PR #9 has a check that is not green (fail pass)" "pr: a commit status that fails"
}

checks_none() {
  check_refusal "" "the checks of PR #9 did not finish in 15 minutes (no check runs)"
  [ "$(cat "$S/polls")" -eq 60 ] || fail "no check runs polled $(cat "$S/polls") times, not 60"
}

checks_pending() {
  check_refusal "pending pass" "the checks of PR #9 did not finish in 15 minutes (pass pending)"
  [ "$(cat "$S/polls")" -eq 60 ] || fail "checks never finish polled $(cat "$S/polls") times, not 60"
}

status_pending() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks pass
  json status '{"statuses":[{"state":"pending"}]}'
  land 7 'fix(x): y'
  refused "the checks of PR #9 did not finish in 15 minutes (pass pending)" "pr: a commit status that is pending"
  [ "$(cat "$S/polls")" -eq 60 ] || fail "a pending commit status polled $(cat "$S/polls") times, not 60"
}

gh_call_fails() {
  local call=$1
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks pass
  json status '{"statuses":[{"state":"success"}]}'
  touch "$S/fail-GET-$call"
  land 7 'fix(x): y'
  refused "the checks of PR #9 did not finish in 15 minutes (no check runs)" "pr: a $call call that fails"
}

checks_wait() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "pending pass"
  checks pass checks-3
  land 7 'fix(x): y'
  landed "pr: pending, then green"
  [ "$(cat "$S/polls")" -eq 3 ] && [ "$(wc -l <"$S/sleeps")" -eq 2 ] || fail "pr: pending, then green polled $(cat "$S/polls") times"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks ""
  checks pass checks-2
  land 7 'fix(x): y'
  landed "pr: checks appear late"

  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks pass
  json view "{\"head\":{\"sha\":\"$old\"}}"
  json view-3 "{\"head\":{\"sha\":\"$tip\"}}"
  land 7 'fix(x): y'
  landed "pr: the PR shows the pushed head late"
  [ "$(cat "$S/views")" -eq 3 ] && [ "$(cat "$S/polls")" -eq 1 ] || fail "pr: read the checks of an old head: $(cat "$S/views") views, $(cat "$S/polls") polls"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks pass
  json view "{\"head\":{\"sha\":\"$old\"}}"
  land 7 'fix(x): y'
  refused "the checks of PR #9 did not finish in 15 minutes (the PR does not show $tip yet)" "pr: the PR never shows the pushed head"
  [ ! -f "$S/polls" ] || fail "pr: read the checks of an old head"
}

rerun_passes() {
  local w
  for w in fail timeout; do
    fresh pr
    lane fix/7-crash
    prs fix/7-crash 9
    checks "$w pass"
    checks "pass pass" checks-3
    runs_at 1
    land 7 'fix(x): y'
    landed "pr: a $w check that passes on its re-run"
    [ "$(cat "$S/reruns")" = 5 ] || fail "pr: a $w check re-ran [$(cat "$S/reruns")], not 5"
    [ "$(cat "$S/merge-args")" = "9 merge_method=squash sha=$tip" ] || fail "pr: a $w check merged [$(cat "$S/merge-args")]"
    has "Waiting up to 15 more minutes for the re-run of the failed checks of PR #9 at $tip" "pr: a $w check that passes on its re-run"
    has "land: the check job 0 of PR #9 failed, then passed on its re-run; look for a flaky test: https://github.com/o/r/actions/runs/5/job/100" "pr: a $w check that passes on its re-run"
    [ "$(grep -oE 'rerun-failed-jobs|/pulls/9/merge' "$S/gh-calls" | paste -sd ' ' -)" = "rerun-failed-jobs /pulls/9/merge" ] ||
      fail "pr: a $w check did not re-run once before the merge: $(cat "$S/gh-calls")"
  done
}

rerun_two_in_one_run() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail fail pass"
  checks "pass pass pass" checks-3
  runs_at 1
  land 7 'fix(x): y'
  landed "pr: two failed checks of one run"
  [ "$(cat "$S/reruns")" = 5 ] || fail "pr: two failed checks of one run re-ran [$(cat "$S/reruns")], not 5 once"
  has "land: the check job 0 of PR #9 failed, then passed on its re-run; look for a flaky test: https://github.com/o/r/actions/runs/5/job/100" "pr: two failed checks of one run"
  has "land: the check job 1 of PR #9 failed, then passed on its re-run; look for a flaky test: https://github.com/o/r/actions/runs/5/job/101" "pr: two failed checks of one run"
}

rerun_stale_first_poll() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  checks "pass pass" checks-3
  runs_at 1
  json run '{"run_attempt":1,"status":"completed"}'
  json run-2 '{"run_attempt":2,"status":"in_progress"}'
  json run-3 '{"run_attempt":2,"status":"completed"}'
  land 7 'fix(x): y'
  landed "pr: a re-run that starts late"
  [ "$(cat "$S/run-polls")" -eq 3 ] || fail "pr: a re-run that starts late read the run $(cat "$S/run-polls") times, not 3"
  [ "$(cat "$S/reruns")" = 5 ] || fail "pr: a re-run that starts late re-ran [$(cat "$S/reruns")], not 5"
  [[ $out != *"not green"* ]] || fail "pr: a re-run that starts late counted as red: $out"
}

rerun_fails_again() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  runs_at 1
  land 7 'fix(x): y'
  refused "PR #9 has a check that is not green after the re-run (fail pass): https://github.com/o/r/pull/9" "pr: a check that fails on its re-run"
  [ "$(cat "$S/reruns")" = 5 ] || fail "pr: a check that fails on its re-run re-ran [$(cat "$S/reruns")], not 5 once"
}

rerun_refusal() {
  land 7 'fix(x): y'
  refused "PR #9 has a check that is not green ($1)" "pr: $2"
  [ ! -f "$S/reruns" ] && [[ $out != *"more minutes"* ]] || fail "pr: $2 re-ran, or waited again: $out"
}

rerun_refusals() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  runs_at 2
  rerun_refusal "fail pass" "a failed check of a run at attempt 2"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  runs_at 1
  json status '{"statuses":[{"state":"failure"}]}'
  rerun_refusal "fail pass" "a failed check beside a commit status that fails"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail@other-ci pass"
  runs_at 1
  rerun_refusal "fail pass" "a failed check of another app"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "cancel pass"
  runs_at 1
  rerun_refusal "cancel pass" "a cancelled check"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "action pass"
  runs_at 1
  rerun_refusal "fail pass" "a check that waits for an approval"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail fail"
  json checks "$(jq -c '.check_runs[1].check_suite.id = 51' "$S/checks.json")"
  json runs '{"workflow_runs":[{"check_suite_id":50,"id":5,"run_attempt":1,"status":"completed"},{"check_suite_id":51,"id":6,"run_attempt":2,"status":"completed"}]}'
  rerun_refusal fail "failed checks of two runs, one at attempt 2"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  checks "pass pass" checks-2
  runs_at 1
  rerun_refusal "fail pass" "a failed check that is gone at the re-run decision"
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  runs_at 1
  touch "$S/fail-GET-runs"
  rerun_refusal "fail pass" "a failed check whose workflow runs cannot be read"
}

rerun_run_not_done() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  checks "pass pass" checks-5
  runs_at 1 runs in_progress
  runs_at 1 runs-2
  land 7 'fix(x): y'
  landed "pr: a failed check of a workflow run that still runs"
  [ "$(cat "$S/reruns")" = 5 ] || fail "pr: a failed check of a workflow run that still runs re-ran [$(cat "$S/reruns")], not 5 once"
  [ "$(grep -oE 'head_sha=|rerun-failed-jobs|/pulls/9/merge' "$S/gh-calls" | paste -sd ' ' -)" = "head_sha= head_sha= rerun-failed-jobs /pulls/9/merge" ] ||
    fail "pr: a failed check of a workflow run that still runs re-ran before the run was done: $(cat "$S/gh-calls")"
  has "land: the check job 0 of PR #9 failed, then passed on its re-run; look for a flaky test: https://github.com/o/r/actions/runs/5/job/100" "pr: a failed check of a workflow run that still runs"
}

rerun_run_never_done() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  runs_at 1 runs in_progress
  land 7 'fix(x): y'
  refused "the checks of PR #9 did not finish in 15 minutes (the workflow run of a failed check is not done): https://github.com/o/r/pull/9" "pr: a failed check of a workflow run that never ends"
  [ ! -f "$S/reruns" ] && [ "$(cat "$S/run-lists")" -eq 60 ] || fail "pr: a failed check of a workflow run that never ends re-ran, or read the runs $(cat "$S/run-lists") times, not 60"
}

rerun_two_runs() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail fail pass"
  json checks "$(jq -c '.check_runs[1] |= (.check_suite.id = 51 | .details_url = "https://github.com/o/r/actions/runs/6/job/101")' "$S/checks.json")"
  checks "pass pass pass" checks-3
  json runs '{"workflow_runs":[{"check_suite_id":50,"id":5,"run_attempt":1,"status":"completed"},{"check_suite_id":51,"id":6,"run_attempt":1,"status":"completed"}]}'
  land 7 'fix(x): y'
  landed "pr: failed checks of two workflow runs"
  [ "$(cat "$S/reruns")" = $'5\n6' ] || fail "pr: failed checks of two workflow runs re-ran [$(cat "$S/reruns")], not 5 and 6"
  [ "$(calls 'actions/runs/5 ')" -eq 1 ] && [ "$(calls 'actions/runs/6 ')" -eq 1 ] || fail "pr: failed checks of two workflow runs did not read each re-run: $(cat "$S/gh-calls")"
  has "land: the check job 0 of PR #9 failed, then passed on its re-run; look for a flaky test: https://github.com/o/r/actions/runs/5/job/100" "pr: failed checks of two workflow runs"
  has "land: the check job 1 of PR #9 failed, then passed on its re-run; look for a flaky test: https://github.com/o/r/actions/runs/6/job/101" "pr: failed checks of two workflow runs"
}

rerun_merge_rejected() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  checks "pass pass" checks-3
  runs_at 1
  echo "head branch was modified" >"$S/merge-fail"
  land 7 'fix(x): y'
  [ "$status" -eq 1 ] && [ "$(grep -c '^land: ' <<<"$out")" -eq 1 ] || fail "pr: a merge that GitHub rejects after a re-run exit $status, or more than one land: line: $out"
  has "land: cannot merge PR #9 at $tip; the PR stays open" "pr: a merge that GitHub rejects after a re-run"
  kept "pr: a merge that GitHub rejects after a re-run"
}

rerun_github_refuses() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  runs_at 1
  touch "$S/fail-POST-rerun-failed-jobs"
  land 7 'fix(x): y'
  refused "GitHub refused the re-run of the failed checks of PR #9: https://github.com/o/r/pull/9" "pr: a re-run that GitHub refuses"
  has "HTTP 502" "pr: a re-run that GitHub refuses"
}

rerun_wait_runs_out() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks "fail pass"
  checks pass checks-3
  runs_at 1
  json run '{"run_attempt":2,"status":"in_progress"}'
  land 7 'fix(x): y'
  refused "the checks of PR #9 did not finish in 15 minutes after the re-run (the re-run is not done): https://github.com/o/r/pull/9" "pr: a re-run that does not finish"
  [ "$(cat "$S/run-polls")" -eq 60 ] || fail "pr: a re-run that does not finish read the run $(cat "$S/run-polls") times, not 60"
  [ "$(cat "$S/reruns")" = 5 ] || fail "pr: a re-run that does not finish re-ran [$(cat "$S/reruns")], not 5 once"
  has "Waiting up to 15 minutes for the checks of PR #9 at $tip" "pr: a re-run that does not finish"
  has "Waiting up to 15 more minutes for the re-run of the failed checks of PR #9 at $tip" "pr: a re-run that does not finish"
}

pr_merged() {
  fresh pr
  lane fix/7-crash
  prs fix/7-crash 9
  checks pass
  echo "head branch was modified" >"$S/merge-fail"
  land 7 'fix(x): y'
  [ "$status" -eq 1 ] || fail "pr: a merge that GitHub rejects exit $status: $out"
  has "head branch was modified" "pr: a merge that GitHub rejects"
  has "land: cannot merge PR #9 at $tip; the PR stays open" "pr: a merge that GitHub rejects"
  kept "pr: a merge that GitHub rejects"
  on_origin fix/7-crash || fail "pr: a rejected merge removed the pushed branch"

  fresh pr
  lane fix/7-crash
  merged "$tip"
  land 7 'fix(x): y'
  landed "pr: a PR that is merged at the local tip"
  [ "$(calls '/(pulls|commits)')" -eq 1 ] || fail "pr: a landed change was landed again: $(cat "$S/gh-calls")"
  grep -qF 'pulls?head={owner}:fix%2F7-crash&state=closed&' "$S/gh-calls" || fail "pr: the merged lookup does not name head={owner}:fix%2F7-crash: $(cat "$S/gh-calls")"
  fresh pr
  lane fix/7-c++
  merged "$tip"
  land 7 'fix(x): y'
  landed "pr: a PR that is merged at the local tip of a branch with + in its name"
  [ "$(calls '/(pulls|commits)')" -eq 1 ] || fail "pr: the merged lookup did not find the merged PR of fix/7-c++: $(cat "$S/gh-calls")"
  fresh pr
  lane fix/7-crash
  merged "$tip"
  json merged "$(jq -c '.[0].merged_at = null' "$S/merged.json")"
  checks pass
  land 7 'fix(x): y'
  landed "pr: a PR that is closed at the local tip with no merge"
  [ "$(calls '/pulls/[0-9]+/merge')" -eq 1 ] || fail "pr: a closed PR with no merge counted as this landing"
  fresh pr
  lane fix/7-crash
  merged "$old"
  checks pass
  land 7 'fix(x): y'
  landed "pr: a PR that is merged at another commit"
  [ "$(calls '/pulls/[0-9]+/merge')" -eq 1 ] || fail "pr: an older merged PR counted as this landing"
  fresh pr
  lane fix/7-crash
  merged "$tip" develop
  checks pass
  land 7 'fix(x): y'
  landed "pr: a PR that is merged into another base at the local tip"
  [ "$(calls ' -f base=master ')" -eq 1 ] && [ "$(calls '/pulls/9/merge')" -eq 1 ] || fail "pr: a merge into another base counted as this landing: $(cat "$S/gh-calls")"
  fresh pr
  lane fix/7-crash
  merged "$tip"
  upstream
  land 7 'fix(x): y'
  landed "pr: a PR that is merged, with origin/master ahead"
  [ "$(git rev-parse master)" = "$(origin_master)" ] || fail "pr: a PR that is merged did not move the main checkout"
  [[ $out != *"did not move"* ]] || fail "pr: warned on a PR that is merged: $out"
}

pr_main_checkout() {
  local state
  for state in 'git commit -q --allow-empty -m local' 'git checkout -q -b side' 'git checkout -q --detach' 'echo mine >work.txt'; do
    fresh pr
    lane fix/7-crash
    checks pass
    eval "$state"
    head=$(git rev-parse HEAD)
    land 7 'fix(x): y'
    landed "pr: [$state] in the main checkout"
    has "land: the main checkout did not move to origin/master; run git pull on master there" "pr: [$state]"
    [ "$(grep -c 'did not move' <<<"$out")" -eq 1 ] || fail "pr: [$state] did not print the warning once: $out"
    [ "$(git rev-parse HEAD)" = "$head" ] || fail "pr: [$state] moved the main checkout"
    [ ! -f work.txt ] || [ "$(cat work.txt)" = mine ] || fail "pr: [$state] overwrote a local file"
  done
  fresh pr
  lane fix/7-crash
  checks pass
  echo changed >app.txt
  land 7 'fix(x): y'
  landed "pr: a local change that the merge does not touch"
  [ "$(git rev-parse master)" = "$(origin_master)" ] && [ "$(cat app.txt)" = changed ] && [[ $out != *"did not move"* ]] ||
    fail "pr: a local change that the merge does not touch: $out"
}

group() {
  g="$tmp/$1"
  shift
  mkdir "$g"
  export S="$g/state" ORIGIN="$g/origin.git"
  repo="$g/main checkout"
  "$@"
}
run() { pool_run "$1" group "$@"; }

template merge
template pr
run rerun_run_never_done rerun_run_never_done
run checks_none checks_none
run checks_pending checks_pending
run status_pending status_pending
run rerun_wait_runs_out rerun_wait_runs_out
run rerun_refusals rerun_refusals
run gh_call_fails-check-runs gh_call_fails check-runs
run gh_call_fails-status gh_call_fails status
run checks_wait checks_wait
run rerun_passes rerun_passes
run rerun_two_in_one_run rerun_two_in_one_run
run rerun_stale_first_poll rerun_stale_first_poll
run rerun_fails_again rerun_fails_again
run rerun_github_refuses rerun_github_refuses
run rerun_run_not_done rerun_run_not_done
run rerun_two_runs rerun_two_runs
run rerun_merge_rejected rerun_merge_rejected
run usage_and_config usage_and_config
run lane_refusals-merge lane_refusals merge
run lane_refusals-pr lane_refusals pr
run merge_refusals merge_refusals
run merge_landing merge_landing
run merge_retries merge_retries
run epics epics
run pr_landing pr_landing
run pr_delete_and_stale pr_delete_and_stale
run pr_refusals pr_refusals
run checks_not_green checks_not_green
run pr_merged pr_merged
run pr_main_checkout pr_main_checkout
pool_wait || exit 1

echo "PASS"
