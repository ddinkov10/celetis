#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'cd /; rm -rf "$tmp"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export S="$tmp/state" ORIGIN="$tmp/origin.git"
harness="$tmp/harness"
mkdir -p "$tmp/bin" "$harness/scripts" "$harness/.claude/agent-flow"
cp "$here/land.sh" "$here/worktree-lib.sh" "$harness/scripts/"

fail() { echo "FAIL: $1"; exit 1; }

# The stub answers each read from a JSON file with the --json fields and the --jq filter of the call, so a filter of land.sh gets null for a field that its call does not ask for.
cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$S/gh-calls"
cp "$(git rev-parse --git-common-dir)/agent-flow/land-7.lock" "$S/lock-seen" 2>/dev/null || true
[ ! -f "$S/gh-fail" ] && [ ! -f "$S/fail-$1-$2" ] || { echo "HTTP 502" >&2; exit 1; }
filter=. fields=
args=("$@")
for ((i = 0; i < $#; i++)); do
  [ "${args[i]}" != --jq ] || filter=${args[i + 1]}
  [ "${args[i]}" != --json ] || fields=${args[i + 1]}
done
answer() {
  jq -r --arg fields "$fields" 'def asked: if $fields == "" then . else with_entries(select(.key as $k | $fields | split(",") | index($k))) end;
    (if type == "array" then map(asked) else asked end) | '"$filter" "$S/$1.json"
}
nth() {
  local k=$(($(cat "$S/$1" 2>/dev/null || echo 0) + 1))
  echo "$k" >"$S/$1"
  [ -f "$S/$2-$k.json" ] && echo "$2-$k" || echo "$2"
}
case "$1 $2" in
  "repo view") answer repo ;;
  "issue view") answer issue ;;
  "issue close")
    [ ! -f "$S/close-fail-$3" ] || { echo "close failed" >&2; exit 1; }
    printf '%s\n' "$*" >>"$S/closed" ;;
  "pr list") case "$*" in *"--state merged"*) answer merged ;; *) answer prs ;; esac ;;
  "pr create") printf '%s\n' "$*" >"$S/create-args"; echo "https://github.com/o/r/pull/9" ;;
  "pr view") answer "$(nth views view)" ;;
  "pr checks")
    f=$(nth polls checks)
    [ "$(jq length "$S/$f.json")" -gt 0 ] || { echo "no checks reported" >&2; exit 1; }
    answer "$f" ;;
  "pr merge")
    [ ! -f "$S/merge-fail" ] || { cat "$S/merge-fail" >&2; exit 1; }
    printf '%s\n' "$*" >"$S/merge-args"
    git --git-dir="$ORIGIN" for-each-ref --format='%(refname:short) %(objectname)' refs/heads >"$S/origin-at-merge"
    [ ! -f "$S/auto-delete" ] || git --git-dir="$ORIGIN" update-ref -d "refs/heads/$(cat "$S/auto-delete")" ;;
  "api "*)
    case "$*" in
      *"/parent"*)
        [ ! -f "$S/parent-fail" ] || { echo "gh: Bad Gateway (HTTP 502)" >&2; exit 1; }
        [ -f "$S/parent.json" ] || { echo '{"message":"No parent issue found","status":"404"}'; echo "gh: No parent issue found (HTTP 404)" >&2; exit 1; }
        answer parent ;;
      *"/sub_issues"*) answer subs ;;
      *) echo "stub gh: unexpected $*" >&2; exit 1 ;;
    esac ;;
  *) echo "stub gh: unexpected $*" >&2; exit 1 ;;
esac
EOF
printf '#!/usr/bin/env bash\necho x >>"$S/sleeps"\n' >"$tmp/bin/sleep"
# A git for one case, so not in $tmp/bin: origin answers no command on fix/7-crash.
mkdir "$tmp/deaf"
printf '#!/usr/bin/env bash\ncase " $* " in *" origin "*fix/7-crash*) echo "fatal: origin does not answer" >&2; exit 128 ;; esac\nexec %q "$@"\n' \
  "$(command -v git)" >"$tmp/deaf/git"
chmod +x "$tmp/bin/gh" "$tmp/bin/sleep" "$tmp/deaf/git"
export PATH="$tmp/bin:$PATH"

json() { printf '%s\n' "$2" >"$S/$1.json"; }
fresh() {
  cd /
  rm -rf "$tmp/repo" "$tmp/other" "$ORIGIN" "$S"
  mkdir -p "$S"
  printf '{"landing": "%s"}\n' "$1" >"$harness/.claude/agent-flow/landing.json"
  git init -q -b master "$tmp/repo"
  cd "$tmp/repo"
  echo app >app.txt
  printf '.claude/worktrees/\n' >.gitignore
  git add -A
  git commit -qm base
  git clone -q --bare . "$ORIGIN"
  git remote add origin "$ORIGIN"
  git fetch -q origin
  main=$(git rev-parse --show-toplevel)
  wt= branch= from=
  json repo '{"defaultBranchRef":{"name":"master"}}'
  json issue '{"state":"OPEN"}'
  json prs '[]'; json merged '[]'; json subs '[]'; json checks '[]'
}
lane() {
  branch=$1
  wt="$main/.claude/worktrees/${1#*/}"
  git worktree add -q -b "$1" "$wt" origin/master
  echo "${2:-work}" >"$wt/${3:-work.txt}"
  git -C "$wt" add -A
  git -C "$wt" commit -qm work
  tip=$(git rev-parse "$1")
  json view "{\"headRefOid\":\"$tip\"}"
}
upstream() {
  git clone -q "$ORIGIN" "$tmp/other"
  echo "${2:-theirs}" >"$tmp/other/${1:-up.txt}"
  git -C "$tmp/other" add -A
  git -C "$tmp/other" commit -qm upstream
  git -C "$tmp/other" push -q origin master
}
reject_push() { printf '#!/bin/sh\nexit 1\n' >"$ORIGIN/hooks/pre-receive"; chmod +x "$ORIGIN/hooks/pre-receive"; }
on_delete() {
  printf '#!/bin/sh\ncase $3 in *[!0]*) exit 0 ;; esac\n%s\nexit 1\n' "$1" >"$ORIGIN/hooks/update"
  chmod +x "$ORIGIN/hooks/update"
}
# GitHub deletes the branch of a merged PR at a moment of its own: with $lost, origin does it when the script deletes, and that delete fails.
lost='git update-ref -d "$1"'
prs() {
  local rows=
  while [ $# -gt 0 ]; do
    rows="$rows${rows:+,}{\"headRefName\":\"$1\",\"baseRefName\":\"master\",\"number\":$2,\"url\":\"https://github.com/o/r/pull/$2\"}"
    shift 2
  done
  json prs "[$rows]"
}
on_base() { json prs "$(jq -c --argjson pr "$1" --arg base "$2" '(.[] | select(.number == $pr)).baseRefName = $base' "$S/prs.json")"; }
merged() { json merged "[{\"headRefOid\":\"$1\",\"baseRefName\":\"${2:-master}\"}]"; }
checks() { json "${2:-checks}" "$(jq -cn '[$ARGS.positional[] | {bucket: .}]' --args $1)"; }

origin_master() { git --git-dir="$ORIGIN" rev-parse master; }
has_ref() { git show-ref --verify --quiet "refs/heads/$1"; }
on_origin() { git --git-dir="$ORIGIN" show-ref --verify --quiet "refs/heads/$1"; }
calls() { grep -cE -- "$1" "$S/gh-calls" 2>/dev/null || true; }
land() {
  before="$(origin_master) $(git rev-parse master)"
  status=0
  out=$(cd "${from:-$main}" && "$BASH" "$harness/scripts/land.sh" "$@" 2>&1) || status=$?
  [[ $out != *"/land.sh: line "* ]] || fail "land.sh printed an error of bash: $out"
}
has() { printf '%s\n' "$out" | grep -qF -- "$1" || fail "$2: missing [$1] in: $out"; }
no_lock() { ! ls "$main"/.git/agent-flow/*.lock >/dev/null 2>&1 || fail "$1 left its lock"; }
kept() {
  [ "$(origin_master) $(git rev-parse master)" = "$before" ] || fail "$1 moved the trunk"
  [ -z "$wt" ] || { [ -d "$wt" ] && has_ref "$branch"; } || fail "$1 removed the lane"
  no_lock "$1"
}
refused() {
  [ "$status" -eq 1 ] || fail "$2 exit $status, not 1: $out"
  has "land: $1" "$2"
  [ "$(grep -c '^land: ' <<<"$out")" -eq 1 ] || fail "$2 printed more than one land: line: $out"
  kept "$2"
  [ "$(calls '^pr merge')" -eq 0 ] && [ ! -f "$S/closed" ] || fail "$2 merged or closed: $(cat "$S/gh-calls")"
}
landed() {
  [ "$status" -eq 0 ] || fail "$1 exit $status: $out"
  [ ! -e "$wt" ] && ! has_ref "$branch" && ! on_origin "$branch" || fail "$1 left the worktree or the branch"
  has "land: $branch and its worktree are gone" "$1"
  [[ $out != *error:* ]] || fail "$1 printed an error of git: $out"
  no_lock "$1"
}
stopped() {
  [ "$status" -eq 1 ] && [ -d "$wt" ] && has_ref "$branch" || fail "$1 exit $status, or the lane is gone: $out"
  has "land: #7 is on master" "$1"
  has "land: the change is on master, but the removal of $branch stopped; run scripts/land.sh again" "$1"
  [ "$(grep -c 'run scripts/land.sh again' <<<"$out")" -eq 1 ] || fail "$1 does not say one time to run the script again: $out"
  no_lock "$1"
}
usage_error() {
  land "$@"
  [ "$status" -eq 2 ] || fail "bad arguments [$*] exit $status: $out"
  has "usage: scripts/land.sh <issue number>" "bad arguments [$*]"
}

fresh merge; lane fix/7-crash
usage_error
usage_error 7
usage_error abc 'fix(x): y'
usage_error 0 'fix(x): y'
usage_error 7 ''
usage_error 7 'the crash is gone'
usage_error 7 'fix(x): y (#7)'
usage_error 7 $'fix(x): y\nmore'
usage_error 7 'fix(x): y' extra
for value in '{"landing": "rebase"}' '{}' 'not json' ''; do
  printf '%s' "$value" >"$harness/.claude/agent-flow/landing.json"
  [ -n "$value" ] || rm "$harness/.claude/agent-flow/landing.json"
  land 7 'fix(x): y'
  [ "$status" -eq 2 ] || fail "landing.json [$value] exit $status: $out"
  has 'land: .claude/agent-flow/landing.json must name the landing mechanism' "landing.json [$value]"
done
[ ! -f "$S/gh-calls" ] || fail "a usage error or a bad landing.json called gh: $(cat "$S/gh-calls")"
no_lock "a usage error"

for m in merge pr; do
  fresh $m; lane fix/7-crash; touch "$S/gh-fail"
  land 7 'fix(x): y'; refused "cannot read the default branch from GitHub" "$m: gh down"; has "HTTP 502" "$m: gh down"
  fresh $m; land 7 'fix(x): y'; refused "no lane branch matches #7; nothing to land" "$m: no lane branch"
  fresh $m; lane fix/17-other; land 7 'fix(x): y'; refused "no lane branch matches #7" "$m: the branch of #17"
  fresh $m; lane prototype/7-look; land 7 'fix(x): y'; refused "no lane branch matches #7" "$m: a prototype branch"
  fresh $m; lane fix/7-crash; git branch -q feat/7-crash master
  land 7 'fix(x): y'; refused "several branches match #7: feat/7-crash fix/7-crash; keep one" "$m: two lane branches"
  fresh $m; lane fix/7-crash; from=$wt
  land 7 'fix(x): y'; refused "leave $wt first: run scripts/land.sh from the main checkout" "$m: inside the lane worktree"
  fresh $m; lane fix/7-crash; echo x >"$wt/new.txt"
  land 7 'fix(x): y'; refused "the lane worktree is dirty: $wt; commit first" "$m: a dirty lane worktree"
  fresh $m; lane fix/7-crash; git -C "$wt" reset -q --hard origin/master
  land 7 'fix(x): y'; refused "fix/7-crash has no commit that master lacks; nothing to land" "$m: a branch with no commit"
  fresh $m; git checkout -q -b fix/7-crash; git commit -q --allow-empty -m work
  land 7 'fix(x): y'; refused "switch the main checkout off fix/7-crash first" "$m: the lane branch in the main checkout"
done

fresh merge; lane fix/7-crash; echo dirty >"$main/new.txt"
land 7 'fix(x): y'; refused "the main checkout is dirty: $main; commit or stash first" "merge: a dirty main checkout"
fresh merge; lane fix/7-crash; git checkout -q -b side
land 7 'fix(x): y'; refused "the main checkout is not on master: $main" "merge: the main checkout off the trunk"
fresh merge; lane fix/7-crash; git commit -q --allow-empty -m local
land 7 'fix(x): y'; refused "the main checkout is not level with origin/master" "merge: the main checkout ahead"
fresh merge; lane fix/7-crash; upstream
land 7 'fix(x): y'; refused "the main checkout is not level with origin/master" "merge: the main checkout behind"
fresh merge; lane fix/7-crash; upstream; git pull -q origin master
land 7 'fix(x): y'
refused "fix/7-crash does not contain the head of master; merge origin/master into fix/7-crash, run scripts/verify.sh again, then land again" "merge: a stale branch"
fresh merge; lane fix/7-crash; reject_push
land 7 'fix(x): y'; refused "cannot push master to origin; master is as it was" "merge: a push that origin rejects"
[ -z "$(git status --porcelain)" ] || fail "merge: a rejected push left the main checkout dirty"

fresh merge; lane fix/7-crash
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
[ "$(cat "$S/closed")" = "issue close 7 --comment Landed on master in $new." ] || fail "merge: closed [$(cat "$S/closed")]"
! has_ref prototype/7-look && ! on_origin prototype/7-look && [ ! -e "$main/.claude/worktrees/prototype-7-look" ] || fail "merge: a prototype of #7 stays"
has_ref prototype/70-near && on_origin prototype/70-near || fail "merge: deleted the prototype of #70"
[ "$(calls '^pr ')" -eq 0 ] || fail "merge called gh pr: $(cat "$S/gh-calls")"
grep -qE '^[0-9]+$' "$S/lock-seen" || fail "the script held no lock while it ran"

fresh merge; lane fix/7-crash; json issue '{"state":"CLOSED"}'
land 7 'fix(x): y'; landed "merge: an issue that is closed"
[ ! -f "$S/closed" ] || fail "merge: closed an issue that was closed"

fresh merge; lane fix/7-crash; touch "$S/close-fail-7"
land 7 'fix(x): y'
[ "$status" -eq 1 ] && [ -d "$wt" ] || fail "merge: a failed close exit $status: $out"
has "land: the change is on master, but #7 is open; run scripts/land.sh again" "merge: a failed close"
new=$(origin_master)
rm "$S/close-fail-7"
land 7 'fix(x): another subject'; landed "merge: the second run after a failed close"
[ "$(origin_master)" = "$new" ] || fail "merge: the second run made a second commit"
[ "$(cat "$S/closed")" = "issue close 7 --comment Landed on master in $new." ] || fail "merge: the second run closed [$(cat "$S/closed")]"

fresh merge; lane fix/7-crash
git worktree add -q -b prototype/7-look "$main/.claude/worktrees/prototype-7-look" master
touch "$main/.claude/worktrees/prototype-7-look/scratch"
land 7 'fix(x): y'; stopped "a removal that stops"
has_ref prototype/7-look || fail "a removal that stops deleted the prototype branch of a checkout that stays"
rm "$main/.claude/worktrees/prototype-7-look/scratch"; json issue '{"state":"CLOSED"}'
land 7 'fix(x): y'; landed "merge: the second run after a removal that stopped"
[ "$(calls '^issue close')" -eq 1 ] || fail "merge: the second run closed the issue again"

fresh merge; lane fix/7-crash; git push -q origin fix/7-crash
PATH="$tmp/deaf:$PATH" land 7 'fix(x): y'; stopped "merge: an origin that does not answer at the delete"
has "fatal: origin does not answer" "merge: an origin that does not answer at the delete"
on_origin fix/7-crash || fail "merge: the branch left an origin that does not answer"
json issue '{"state":"CLOSED"}'
land 7 'fix(x): y'; landed "merge: the second run after an origin that did not answer"

fresh merge; lane fix/7-crash; touch "$main/.git/index.lock"
land 7 'fix(x): y'
[ "$status" -eq 1 ] && [ -d "$wt" ] && has_ref fix/7-crash || fail "merge: a main checkout that does not move exit $status: $out"
has "land: the change is on origin/master, but the main checkout did not move; run git pull there, then run scripts/land.sh again" "merge: a main checkout that does not move"
no_lock "merge: a main checkout that does not move"
new=$(origin_master)
rm "$main/.git/index.lock"; git pull -q origin master
land 7 'fix(x): another subject'; landed "merge: the second run after a main checkout that did not move"
[ "$(origin_master)" = "$new" ] || fail "merge: the second run after a main checkout that did not move made a second commit"

fresh merge; lane fix/7-crash; json parent '{"number":3,"state":"open"}'; json subs '[{"number":7,"state":"open"},{"number":8,"state":"closed"}]'
land 7 'fix(x): y'; landed "the last sub-issue"
grep -qxF "issue close 3 --comment Each sub-issue is closed: #7 landed last." "$S/closed" || fail "the last sub-issue did not close the epic: $(cat "$S/closed")"
fresh merge; lane fix/7-crash; json parent '{"number":3,"state":"open"}'; json subs '[{"number":7,"state":"closed"},{"number":8,"state":"open"}]'
land 7 'fix(x): y'; landed "a sub-issue with an open sibling"
[ "$(calls '^issue close 3')" -eq 0 ] || fail "closed an epic with an open sub-issue"
fresh merge; lane fix/7-crash; json parent '{"number":3,"state":"closed"}'
land 7 'fix(x): y'; landed "a closed epic"
[ "$(calls 'sub_issues|^issue close 3')" -eq 0 ] || fail "read or closed an epic that was closed"
fresh merge; lane fix/7-crash
land 7 'fix(x): y'; landed "no parent"
[ "$(calls 'sub_issues')" -eq 0 ] && [[ $out != *parent* ]] || fail "an issue with no parent: $out"
fresh merge; lane fix/7-crash; touch "$S/parent-fail"
land 7 'fix(x): y'; landed "a parent that gh cannot read"
has "land: cannot read the parent of #7; close its epic by hand" "a parent that gh cannot read"
fresh merge; lane fix/7-crash; json parent '{"number":3,"state":"open"}'; touch "$S/close-fail-3"
land 7 'fix(x): y'; landed "an epic that gh cannot close"
has "land: cannot close the epic #3; close it by hand" "an epic that gh cannot close"

fresh pr; lane fix/7-crash; checks pass; json parent '{"number":3,"state":"open"}'; json subs '[{"number":7,"state":"open"}]'
land 7 'fix(x): the crash is gone'
landed "pr"
[ "$(cat "$S/create-args")" = "pr create --base master --head fix/7-crash --title fix(x): the crash is gone (#7) --body Closes #7" ] || fail "pr: created [$(cat "$S/create-args")]"
[ "$(cat "$S/merge-args")" = "pr merge 9 --squash --match-head-commit $tip" ] || fail "pr: merged [$(cat "$S/merge-args")]"
grep -qx "fix/7-crash $tip" "$S/origin-at-merge" || fail "pr: the branch was not on origin at the merge"
[ "$(calls '^pr merge')" -eq 1 ] && [ ! -f "$S/sleeps" ] || fail "pr: more than one merge, or a sleep"
[ "$(cat "$S/closed")" = "issue close 3 --comment Each sub-issue is closed: #7 landed last." ] || fail "pr: closed [$(cat "$S/closed")]"
[ "${before#* }" = "$(git rev-parse master)" ] && [ -z "$(git status --porcelain)" ] || fail "pr touched the main checkout"

for b in feat/7-x fix/7-x hotfix/7-x chore/7-x; do
  fresh pr; lane $b; prs release-please--branches--master 12 $b 9 fix/17-other 10; checks "pass skipping"; echo $b >"$S/auto-delete"
  land 7 'fix(x): y'; landed "pr: an open PR of $b"
  [ ! -f "$S/create-args" ] || fail "pr: opened a second PR for $b"
  [ "$(cat "$S/merge-args")" = "pr merge 9 --squash --match-head-commit $tip" ] || fail "pr: merged [$(cat "$S/merge-args")] for $b"
done
fresh pr; lane fix/7-crash; prs fix/7-crash 9; checks pass; on_delete "$lost"
land 7 'fix(x): y'; landed "pr: origin loses the branch at the delete"
fresh pr; lane fix/7-crash; prs fix/7-crash 9; checks pass; on_delete :
land 7 'fix(x): y'; stopped "pr: a delete that origin refuses"
has "hook declined" "pr: a delete that origin refuses"
on_origin fix/7-crash || fail "pr: a refused delete removed the branch from origin"
rm "$ORIGIN/hooks/update"; merged "$tip"
land 7 'fix(x): y'; landed "pr: the second run after a delete that origin refused"
[ "$(calls '^pr merge')" -eq 1 ] || fail "pr: the second run merged again"
fresh pr; prs release-please--branches--master 12; checks pass
land 12 'fix(x): y'; refused "no lane branch matches #12; nothing to land" "pr: the number of the release PR"
fresh pr; lane fix/7-crash; upstream; checks pass
land 7 'fix(x): y'; landed "pr: a branch behind the trunk with no conflict"

fresh pr; lane fix/7-crash; prs fix/7-crash 9 feat/7-crash 10; checks pass
land 7 'fix(x): y'; refused "several open PRs match #7: fix/7-crash feat/7-crash; keep one" "pr: two lane PRs"
! on_origin fix/7-crash || fail "pr: pushed before the refusal of two lane PRs"
fresh pr; lane fix/7-crash; prs feat/7-other 10; checks pass
land 7 'fix(x): y'; refused "PR #10 of #7 is on feat/7-other, not on fix/7-crash; keep one branch" "pr: a PR on another branch"
fresh pr; lane fix/7-crash; prs fix/7-crash 10; on_base 10 production; checks pass
land 7 'fix(x): y'
refused "PR #10 of #7 has the base production, not master; change its base, or close it: https://github.com/o/r/pull/10" "pr: a lane PR on another base"
! on_origin fix/7-crash && [ "$(calls '^pr create')" -eq 0 ] || fail "pr: pushed, or opened a second PR, beside a lane PR on another base"
fresh pr; lane fix/7-crash; prs fix/7-crash 9 fix/7-crash 10; on_base 10 production; checks pass
land 7 'fix(x): y'; refused "PR #10 of #7 has the base production, not master" "pr: a lane PR on another base beside one on the trunk"
! on_origin fix/7-crash || fail "pr: pushed before the refusal of a lane PR on another base"
fresh pr; lane fix/7-crash mine app.txt; upstream app.txt theirs
land 7 'fix(x): y'
refused "fix/7-crash conflicts with master; merge origin/master into fix/7-crash, run scripts/verify.sh again, then land again" "pr: a conflict"
! on_origin fix/7-crash && [ "$(calls '^pr list --state open')" -eq 0 ] || fail "pr: a conflicting branch was pushed"
fresh pr; lane fix/7-crash; touch "$S/fail-pr-list"
land 7 'fix(x): y'; refused "cannot list the PRs of fix/7-crash on GitHub" "pr: gh pr list fails"
fresh pr; lane fix/7-crash; reject_push
land 7 'fix(x): y'; refused "cannot push fix/7-crash to origin" "pr: a push that origin rejects"
fresh pr; lane fix/7-crash; touch "$S/fail-pr-create"
land 7 'fix(x): y'; refused "cannot open the PR of fix/7-crash" "pr: gh pr create fails"

check_refusal() {
  fresh pr; lane fix/7-crash; prs fix/7-crash 9; checks "$1"
  land 7 'fix(x): y'; refused "$2" "pr: checks [$1]"
  on_origin fix/7-crash || fail "pr: a refusal removed the pushed branch"
}
check_refusal "fail pass" "PR #9 has a check that is not green (fail pass)"
check_refusal "cancel pass" "PR #9 has a check that is not green (cancel pass)"
check_refusal skipping "no check ran on PR #9: each check was skipped"
check_refusal "" "the checks of PR #9 did not finish in 15 minutes (no check runs)"
[ "$(cat "$S/polls")" -eq 60 ] || fail "no check runs polled $(cat "$S/polls") times, not 60"
check_refusal "pending pass" "the checks of PR #9 did not finish in 15 minutes (pass pending)"
[ "$(cat "$S/polls")" -eq 60 ] || fail "checks never finish polled $(cat "$S/polls") times, not 60"

fresh pr; lane fix/7-crash; prs fix/7-crash 9; checks "pending pass"; checks pass checks-3
land 7 'fix(x): y'; landed "pr: pending, then green"
[ "$(cat "$S/polls")" -eq 3 ] && [ "$(wc -l <"$S/sleeps")" -eq 2 ] || fail "pr: pending, then green polled $(cat "$S/polls") times"
fresh pr; lane fix/7-crash; prs fix/7-crash 9; checks ""; checks pass checks-2
land 7 'fix(x): y'; landed "pr: checks appear late"

old=0000000000000000000000000000000000000000
fresh pr; lane fix/7-crash; prs fix/7-crash 9; checks pass; json view "{\"headRefOid\":\"$old\"}"; json view-3 "{\"headRefOid\":\"$tip\"}"
land 7 'fix(x): y'; landed "pr: the PR shows the pushed head late"
[ "$(cat "$S/views")" -eq 3 ] && [ "$(cat "$S/polls")" -eq 1 ] || fail "pr: read the checks of an old head: $(cat "$S/views") views, $(cat "$S/polls") polls"
fresh pr; lane fix/7-crash; prs fix/7-crash 9; checks pass; json view "{\"headRefOid\":\"$old\"}"
land 7 'fix(x): y'; refused "the checks of PR #9 did not finish in 15 minutes (the PR does not show $tip yet)" "pr: the PR never shows the pushed head"
[ ! -f "$S/polls" ] || fail "pr: read the checks of an old head"

fresh pr; lane fix/7-crash; prs fix/7-crash 9; checks pass; echo "head branch was modified" >"$S/merge-fail"
land 7 'fix(x): y'
[ "$status" -eq 1 ] || fail "pr: a merge that GitHub rejects exit $status: $out"
has "head branch was modified" "pr: a merge that GitHub rejects"
has "land: cannot merge PR #9 at $tip; the PR stays open" "pr: a merge that GitHub rejects"
kept "pr: a merge that GitHub rejects"; on_origin fix/7-crash || fail "pr: a rejected merge removed the pushed branch"

fresh pr; lane fix/7-crash; merged "$tip"
land 7 'fix(x): y'; landed "pr: a PR that is merged at the local tip"
[ "$(calls '^pr (create|checks|merge)|^pr list --state open')" -eq 0 ] || fail "pr: a landed change was landed again: $(cat "$S/gh-calls")"
fresh pr; lane fix/7-crash; merged "$old"; checks pass
land 7 'fix(x): y'; landed "pr: a PR that is merged at another commit"
[ "$(calls '^pr merge')" -eq 1 ] || fail "pr: an older merged PR counted as this landing"
fresh pr; lane fix/7-crash; merged "$tip" production; checks pass
land 7 'fix(x): y'; landed "pr: a PR that is merged into another base at the local tip"
[ "$(calls '^pr create --base master ')" -eq 1 ] && [ "$(calls '^pr merge 9 ')" -eq 1 ] || fail "pr: a merge into another base counted as this landing: $(cat "$S/gh-calls")"

# .claude/settings.json denies a Bash command that holds this path, so a session cannot quote a message that names it.
! grep -q 'scripts/promote.sh' "$here/land.sh" "$here/worktree-lib.sh" || fail "land.sh names the promote script by its path"

echo "PASS"
