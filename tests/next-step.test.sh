#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
ln -s "$here" "$tmp/plug in"
next="$tmp/plug in/scripts/next-step.sh"
trap 'kill "${landing:-}" 2>/dev/null || true; rm -rf "$tmp"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export NEXT_STEP_TEST_STATE="$tmp/state"
S=$NEXT_STEP_TEST_STATE
bin="$tmp/bin"
mkdir -p "$bin"

fail() { echo "FAIL: $1"; exit 1; }

# The fake reads all of stdin, as a real command can, so a gh call in a read loop must not take the lines of the loop.
cat >"$bin/gh" <<'EOF'
#!/usr/bin/env bash
S=$NEXT_STEP_TEST_STATE
cat >/dev/null
printf '%s\n' "$*" >>"$S/gh-calls"
[ "$1" = api ] || { echo "HTTP 403: GitHub GraphQL is not available from Claude Code sessions" >&2; exit 1; }
shift
paginate= filter=. endpoint=
while [ $# -gt 0 ]; do
  case $1 in
    --paginate) paginate=1 ;;
    --jq) filter=$2; shift ;;
    -*) echo "fake gh: unknown flag $1" >&2; exit 1 ;;
    *) endpoint=$1 ;;
  esac
  shift
done
path=${endpoint%%\?*}
part=${path#repos/*/*/}
[ ! -f "$S/gh-fail" ] && [ ! -f "$S/fail-${part//\//-}" ] || { echo "HTTP 502" >&2; exit 1; }
# A list prints pages of $S/page-size items, and the filter reads each page, as with gh api --paginate --jq.
list() {
  [ -n "$paginate" ] && [[ $endpoint == *per_page=100* ]] || { echo "fake gh: a list without --paginate and per_page=100: $endpoint" >&2; exit 1; }
  jq -c --argjson size "$(cat "$S/page-size" 2>/dev/null || echo 100)" \
    '. as $all | [range(0; length; $size) as $i | $all[$i:$i + $size]] | (if . == [] then [[]] else . end)[] | '"${1:-.}" |
    jq -r "$filter"
}
repo='repos/{owner}/{repo}'
case $path in
  "$repo/issues/"*/comments)
    n=${path%/comments}
    cat "$S/issues.json" "$S/issue.json" 2>/dev/null |
      jq -s --argjson n "${n##*/}" '[.[0][], .[1] | select(.number == $n)][0].comments // []' | list ;;
  "$repo/issues/"*)
    [ -f "$S/issue.json" ] || { echo "no issue" >&2; exit 1; }
    jq -r "(.comments |= length) | $filter" "$S/issue.json" ;;
  "$repo/issues")
    case $endpoint in
      *'?state=open&'*) state=open since= ;;
      *'?state=closed&since='*) state=closed since=${endpoint#*since=} ;;
      *) echo "fake gh: unexpected $endpoint" >&2; exit 1 ;;
    esac
    jq --arg state "$state" --arg since "${since%%&*}" \
      'map(select(.state == $state and .updated_at >= $since) | .comments |= length)' "$S/issues.json" | list ;;
  "$repo/pulls") jq 'map(del(.runs, .statuses, .reviews))' "$S/prs.json" | list ;;
  "$repo/commits/"*/check-runs)
    sha=${path%/check-runs}
    jq --arg sha "${sha##*/}" 'map(select(.head.sha == $sha) | .runs[])' "$S/prs.json" | list '{check_runs: .}' ;;
  "$repo/commits/"*/status)
    sha=${path%/status}
    jq --arg sha "${sha##*/}" 'map(select(.head.sha == $sha) | .statuses[])' "$S/prs.json" |
      list '{state: ($all | map(.state) | if index("failure") or index("error") then "failure" elif index("pending") or . == [] then "pending" else "success" end), statuses: .}' ;;
  "$repo/pulls/"*/reviews)
    n=${path%/reviews}
    jq --argjson n "${n##*/}" 'map(select(.number == $n) | .reviews[])' "$S/prs.json" | list ;;
  *) echo "fake gh: unexpected $endpoint" >&2; exit 1 ;;
esac
EOF
chmod +x "$bin/gh"
export PATH="$bin:$PATH"

repo="$tmp/repo"
git init -q "$repo"
git -C "$repo" config core.autocrlf false
printf x >"$repo/a.txt"
printf '.claude/worktrees/\n' >"$repo/.gitignore"
git -C "$repo" add -A
git -C "$repo" commit -qm base
main=$(dirname "$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)")

reset() { rm -rf "$S"; mkdir -p "$S"; echo '[]' >"$S/prs.json"; echo '[]' >"$S/issues.json"; }

fixture() {
  local n=$1 state=$2 labels=$3 body=$4
  shift 4
  jq -n --argjson n "$n" --arg s "$state" --arg l "$labels" --arg b "$body" --argjson days "${days:-0}" '{
      number: $n, title: "Issue \($n)", state: $s, html_url: "https://github.com/o/r/issues/\($n)",
      labels: ($l | split(",") | map(select(. != "") | {name: .})), body: (if $b == "" then null else $b end),
      comments: ($ARGS.positional | map({body: .})), updated_at: (now | todate),
      closed_at: (if $s == "closed" then now - $days * 86400 | todate else null end)}' --args "$@"
}
issue() { fixture 7 "$@" >"$S/issue.json"; }

run_next() {
  set +e
  (cd "${from:-$repo}" && "$BASH" "$next" "$@" >"$tmp/out" 2>"$tmp/err" </dev/null)
  code=$?
  set -e
  out=$(cat "$tmp/out")
  err=$(cat "$tmp/err")
}

one_line() { [ "$(wc -l <"$tmp/out")" -eq 1 ] && [ "$out" = "$1" ]; }

expect() {
  run_next 7
  [ "$code" -eq 0 ] && one_line "$1" || fail "expected [$1], got $code [$out] $err"
}

endpoints() { sed -E 's/^api (--paginate )?([^ ]*).*/\2/; s/since=[0-9]{4}-[0-9]{2}-[0-9]{2}T/since=<date>T/' "$S/gh-calls"; }
comments_calls() { local n; for n; do echo "repos/{owner}/{repo}/issues/$n/comments?per_page=100"; done; }
json_calls() {
  local n
  {
    echo 'repos/{owner}/{repo}/issues?state=open&per_page=100'
    echo 'repos/{owner}/{repo}/issues?state=closed&since=<date>T00:00:00Z&per_page=100'
    echo 'repos/{owner}/{repo}/pulls?state=open&per_page=100'
    comments_calls $1
    for n in $2; do
      echo "repos/{owner}/{repo}/commits/sha$n/check-runs?per_page=100"
      echo "repos/{owner}/{repo}/commits/sha$n/status?per_page=100"
      echo "repos/{owner}/{repo}/pulls/$n/reviews?per_page=100"
    done
  } | LC_ALL=C sort
}

reset; issue closed wontfix ""; expect "stop #7 is closed as wontfix."
reset; issue closed bug ""; expect "stop #7 is finished."
reset; issue closed enhancement,ready-for-human "Spec: x" "## Plan" "## Landing refused"; expect "stop #7 is finished."
reset; issue closed bug,wontfix ""; expect "stop #7 is closed as wontfix."
reset; issue open bug,needs-info ""; expect "stop #7 needs info. Answer the questions on the issue, then remove the label."
reset; issue open hotfix,ready-for-human ""; expect "stop #7 is ready-for-human. Do the human step (e.g. the hotfix ship checklist), then remove the label."
reset; issue open enhancement,ready-for-human "Spec: x" "## Plan" "## Before landing"; expect "stop #7 is ready-for-human. Do the human step (e.g. the hotfix ship checklist), then remove the label."
reset; issue open enhancement,ready-for-human "Spec: x" "## Plan" "## Landing refused"; expect "stop #7 is ready-for-human. Do the human step (e.g. the hotfix ship checklist), then remove the label."
reset; issue open epic ""; expect "stop #7 is an epic. Each child runs its own flow."
reset; issue open needs-triage "It breaks"; expect "run /celetis:triage #7"
reset; issue open enhancement "Intent: add X"; expect "run /celetis:feature #7"
reset; issue open enhancement ""; expect "run /celetis:feature #7"
reset; issue open enhancement,needs-info "Intent: add X"; expect "stop #7 needs info. Answer the questions on the issue, then remove the label."
reset; issue open bug "It breaks"; expect "run /celetis:bug #7"
reset; issue open chore ""; expect "run /celetis:chore #7"
reset; issue open hotfix ""; expect "run /celetis:hotfix #7"
reset; issue open enhancement "Spec: 2026-09-25"; expect "run /celetis:plan #7"
reset; issue open bug "" "## Root cause"; expect "run /celetis:plan #7"
reset; issue open enhancement "Spec: x" "see ## Plan"; expect "run /celetis:plan #7"
reset; issue open enhancement "Spec: x" "## Plan"; expect "run /celetis:implement #7"
reset; issue open bug "" "## Root cause" "## Plan"; expect "run /celetis:implement #7"
reset; issue open chore "" "## Landing refused"; expect "run /celetis:chore #7"
reset; issue open enhancement "Spec: x" "## Plan" "## Landing refused"; expect "run /celetis:implement #7"
reset; issue open enhancement $'Spec: x\n`y`' $'## Plan\n\n1. `a`'; expect "run /celetis:implement #7"
reset; issue open enhancement $'Intent: add X\nSpec: later'; expect "run /celetis:feature #7"
[ "$(endpoints)" = 'repos/{owner}/{repo}/issues/7' ] || fail "the form with a number must read #7, no comment of an issue with no comment, and no PR: $(cat "$S/gh-calls")"
reset; echo 1 >"$S/page-size"; issue open bug "" "## Root cause" "## Plan"; expect "run /celetis:implement #7"
[ "$(endpoints)" = 'repos/{owner}/{repo}/issues/7
repos/{owner}/{repo}/issues/7/comments?per_page=100' ] || fail "the form with a number must read the 2 comments of #7 in one call, and no PR: $(cat "$S/gh-calls")"

reset; issue open chore ""
run_next '#7'
[ "$code" -eq 0 ] && one_line "run /celetis:chore #7" || fail "#7 as the argument: $code [$out] $err"

reset; issue open bug ""; touch "$S/gh-fail"
run_next 7
[ "$code" -eq 1 ] && one_line "stop cannot read #7 from GitHub" || fail "gh failure: $code [$out] $err"
printf '%s' "$err" | grep -q "HTTP 502" || fail "gh's own message must reach stderr: $err"

reset
run_next 7
[ "$code" -eq 1 ] && one_line "stop cannot read #7 from GitHub" || fail "missing issue: $code [$out] $err"
printf '%s' "$err" | grep -q "no issue" || fail "gh's own message must reach stderr: $err"

reset; issue open chore ""
for args in "" abc 7abc "#" "7 8" --all "--open 7" "--json 7"; do
  run_next $args
  [ "$code" -eq 2 ] && [ -z "$out" ] && printf '%s' "$err" | grep -qxF "usage: scripts/celetis next-step <issue number> | --open | --json, e.g. scripts/celetis next-step 276" || fail "bad arguments [$args]: $code [$out] $err"
done
[ ! -f "$S/gh-calls" ] || fail "a usage error called gh: $(cat "$S/gh-calls")"

reset; issue open chore ""
echo dirty >"$repo/new.txt"
run_next 7
[ "$code" -eq 0 ] && one_line "stop the working tree is dirty: $main; commit or stash first" || fail "dirty main checkout: $code [$out] $err"
[ ! -f "$S/gh-calls" ] || fail "a dirty tree must stop before any gh call: $(cat "$S/gh-calls")"
rm "$repo/new.txt"

lane="$repo/.claude/worktrees/7-crash"
git -C "$repo" worktree add -q -b fix/7-crash "$lane"
reset; issue open bug ""
echo x >"$lane/half-done.txt"
run_next 7
[ "$code" -eq 0 ] && one_line "stop the working tree is dirty: $main/.claude/worktrees/7-crash; commit or stash first" || fail "dirty lane worktree: $code [$out] $err"
from=$lane run_next 7
[ "$code" -eq 0 ] && one_line "stop the working tree is dirty: $main/.claude/worktrees/7-crash; commit or stash first" || fail "dirty lane worktree, run from it: $code [$out] $err"
[ ! -f "$S/gh-calls" ] || fail "a dirty lane worktree must stop before any gh call: $(cat "$S/gh-calls")"
rm "$lane/half-done.txt"
from=$lane run_next 7
[ "$code" -eq 0 ] && one_line "run /celetis:bug #7" || fail "run from a clean lane worktree: $code [$out] $err"
mkdir "$repo/sub"
from=$repo/sub run_next 7
[ "$code" -eq 0 ] && one_line "run /celetis:bug #7" || fail "run from a subfolder of the repository: $code [$out] $err"
rmdir "$repo/sub"
echo dirty >"$repo/new.txt"
from=$lane run_next 7
[ "$code" -eq 0 ] && one_line "stop the working tree is dirty: $main; commit or stash first" || fail "dirty main checkout, run from a lane worktree: $code [$out] $err"
rm "$repo/new.txt"
git -C "$repo" worktree remove --force "$lane"

other="$repo/.claude/worktrees/17-other"
git -C "$repo" worktree add -q -b fix/17-other "$other"
echo x >"$other/half-done.txt"
reset; issue open chore ""
run_next 7
[ "$code" -eq 0 ] && one_line "run /celetis:chore #7" || fail "a dirty #17 worktree stopped #7: $code [$out] $err"
git -C "$repo" worktree remove --force "$other"

reset; issue open chore ""
from=$tmp run_next 7
[ "$code" -ne 0 ] && [ -z "$out" ] && [ ! -f "$S/gh-calls" ] || fail "outside a repository: $code [$out] $(cat "$S/gh-calls" 2>/dev/null)"

open_issue() {
  local n=$1
  shift
  { cat "$S/issues.json"; fixture "$n" "${state:-open}" "$@"; } | jq -s '.[0] + [.[1]]' >"$S/issues.tmp"
  mv "$S/issues.tmp" "$S/issues.json"
}
row() { printf '%s\t%s' "$1" "$2"; }

reset; open_issue 9 epic ""; open_issue 7 needs-triage "It breaks"; open_issue 8 enhancement "Spec: x" "## Plan"
run_next --open
[ "$code" -eq 0 ] && [ "$out" = "$(row 7 "run /celetis:triage #7")
$(row 8 "run /celetis:implement #8")
$(row 9 "stop #9 is an epic. Each child runs its own flow.")" ] || fail "--open must print one row for each open issue, lowest number first: $code [$out] $err"
[ "$(endpoints | LC_ALL=C sort)" = "$({ echo 'repos/{owner}/{repo}/issues?state=open&per_page=100'; comments_calls 8; } | LC_ALL=C sort)" ] ||
  fail "--open must read the open issues once and the comments of each open issue that has a comment: $(cat "$S/gh-calls")"

both() {
  reset; issue open "$@"; run_next 7; single=$out
  open_issue 7 "$@"; run_next --open
  [ "$code" -eq 0 ] && [ "$out" = "$(row 7 "$single")" ] || fail "--open differs from the form with a number for [$*]: [$out] [$single]"
}
both bug,needs-info ""
both hotfix,ready-for-human ""
both enhancement,ready-for-human "Spec: x" "## Plan" "## Landing refused"
both enhancement "Intent: add X"
both bug "It breaks"
both chore ""
both hotfix ""
both enhancement "Spec: x"
both bug "" "## Root cause" "## Plan"
both enhancement ""
both enhancement $'Spec: x\n`y`' $'## Plan\n\n1. `a`'

reset
run_next --open
[ "$code" -eq 0 ] && [ -z "$out" ] || fail "--open with no open issue: $code [$out] $err"

lane="$repo/.claude/worktrees/7-batch"
git -C "$repo" worktree add -q -b fix/7-batch "$lane"
reset; open_issue 7 chore ""; open_issue 8 chore ""
echo x >"$lane/half-done.txt"
run_next --open
[ "$out" = "$(row 7 "stop the working tree is dirty: $main/.claude/worktrees/7-batch; commit or stash first")
$(row 8 "run /celetis:chore #8")" ] || fail "--open with a dirty lane worktree: [$out] $err"
echo dirty >"$repo/new.txt"
from=$lane run_next --open
[ "$out" = "$(row 7 "stop the working tree is dirty: $main; commit or stash first")
$(row 8 "stop the working tree is dirty: $main; commit or stash first")" ] || fail "--open with a dirty main checkout: [$out] $err"
rm "$repo/new.txt" "$lane/half-done.txt"
git -C "$repo" worktree remove --force "$lane"

reset; open_issue 7 chore ""; touch "$S/gh-fail"
run_next --open
[ "$code" -eq 1 ] && one_line "stop cannot read the open issues from GitHub" || fail "--open with gh down: $code [$out] $err"
printf '%s' "$err" | grep -q "HTTP 502" || fail "gh's own message must reach stderr: $err"

mkdir -p "$tmp/install dir/scripts"
cat >"$tmp/install dir/scripts/land.sh" <<'EOF'
#!/usr/bin/env bash
trap 'kill $!' TERM
/bin/sleep 30 &
wait
EOF
lock="$repo/.git/celetis-flow/land-7.lock"
mkdir -p "$repo/.git/celetis-flow"
reset; issue open enhancement "Spec: x" "## Plan"; open_issue 7 enhancement "Spec: x" "## Plan"; open_issue 8 chore ""
bash "$tmp/install dir/scripts/land.sh" 7 "feat(x): y" &
landing=$!
echo "$landing" >"$lock"
run_next 7
[ "$code" -eq 0 ] && one_line "stop the landing of #7 runs; wait until scripts/celetis land ends" || fail "a live landing: $code [$out] $err"
[ ! -f "$S/gh-calls" ] || fail "a live landing must stop before any gh call: $(cat "$S/gh-calls")"
run_next --open
[ "$out" = "$(row 7 "stop the landing of #7 runs; wait until scripts/celetis land ends")
$(row 8 "run /celetis:chore #8")" ] || fail "--open with a live landing: [$out] $err"
kill "$landing"; wait "$landing" 2>/dev/null || true
for stale in "$landing" "$$" garbage; do
  echo "$stale" >"$lock"
  run_next 7
  [ "$code" -eq 0 ] && one_line "run /celetis:implement #7" || fail "a lock of [$stale] must hold nothing: $code [$out] $err"
done
rm "$lock"

prs() {
  jq -n 'def run($status; $conclusion): {$status, $conclusion}; def review($login; $state): {user: {$login}, $state};
    '"$1"' | map({number: .[0], html_url: "https://github.com/o/r/pull/\(.[0])", head: {ref: .[1], sha: "sha\(.[0])"}, draft: .[2],
      runs: .[3], statuses: (.[4] | map({state: .})), reviews: .[5],
      requested_reviewers: (.[6] // [] | map({login: .})), requested_teams: (.[7] // [] | map({slug: .}))})' >"$S/prs.json"
}

reset; for n in 7 8 9 10 11 12; do open_issue "$n" chore ""; done
prs '[[21, "fix/17-other", false, [], [], []],
  [22, "chore/8-a", false, [run("in_progress"; null), run("completed"; "timed_out")], [], [review("a"; "CHANGES_REQUESTED")]],
  [23, "chore/8-b", false, [run("completed"; "success")], [], [review("a"; "APPROVED")]],
  [24, "chore/9-a", true, [run("completed"; "success")], ["pending"], [], ["r"]],
  [25, "chore/10-a", false, [run("completed"; "skipped")], ["success"], [review("a"; "APPROVED")]],
  [26, "chore/11-a", false, [run("queued"; null)], ["error"], []],
  [27, "chore/12-a", false, [], [], []],
  [28, "dependabot/npm_and_yarn/x-1.2.3", false, [run("completed"; "failure")], ["error"], [review("a"; "APPROVED")]]]'
run_next --json
[ "$code" -eq 0 ] && [ "$(printf '%s' "$out" | jq -c '[.noRun, (.issues[0] | [.number, .type, .state, .line, .path])]')" = '[null,[7,"chore","ready","run /celetis:chore #7",null]]' ] || fail "--json must print the rows of the board: $code [$out] $err"
[ "$(printf '%s' "$out" | jq -c '.issues[1].pr')" = '{"number":22,"url":"https://github.com/o/r/pull/22","draft":false,"checks":"fail","review":"changes"}' ] || fail "--json, the first open PR of an issue: [$out]"
[ "$(printf '%s' "$out" | jq -c '[.issues[].pr | if . then [.number, .draft, .checks, .review] else . end]')" = '[null,[22,false,"fail","changes"],[24,true,"pending","required"],[25,false,"pass","approved"],[26,false,"fail",null],[27,false,null,null]]' ] || fail "--json, the open PR of each issue, with its checks and its review: [$out]"
[ "$(endpoints | LC_ALL=C sort)" = "$(json_calls "" "21 22 23 24 25 26 27")" ] ||
  fail "--json must read the three lists, no comment of an issue with no comment, and the check runs, the commit status, and the reviews of each open PR whose branch holds /<number>-: $(cat "$S/gh-calls")"
reset; open_issue 7 bug,needs-info ""; open_issue 8 hotfix,ready-for-human ""; open_issue 9 epic ""; open_issue 12 chore ""
state=closed open_issue 10 bug ""; state=closed open_issue 11 bug,wontfix ""
batch="$repo/.claude/worktrees/12-batch"
git -C "$repo" worktree add -q -b chore/12-batch "$batch"
echo x >"$batch/half-done.txt"
run_next --json
[ "$(printf '%s' "$out" | jq -c '[.issues[] | [.number, .state, .reason, .act, .path]]')" = "[[7,\"blocked\",\"needs info\",\"Answer the questions on the issue, then remove the label.\",null],[8,\"blocked\",\"ready for your step\",\"Do the human step (e.g. the hotfix ship checklist), then remove the label.\",null],[10,\"done\",null,null,null],[12,\"dirty\",null,null,\"$main/.claude/worktrees/12-batch\"]]" ] || fail "--json, the state of each row, and no row for an epic or a wontfix: [$out]"
echo dirty >"$repo/new.txt"
run_next --json
[ "$(printf '%s' "$out" | jq -r .noRun)" = "The main checkout is dirty: $main. Commit or stash first." ] || fail "--json with a dirty main checkout: [$out]"
rm "$repo/new.txt"
git -C "$repo" worktree remove --force "$batch"
touch "$S/gh-fail"
run_next --json
[ "$code" -eq 1 ] && one_line "stop cannot read the issues from GitHub" || fail "--json with gh down: $code [$out] $err"

refusal=$'## Landing refused\r\nland: PR #9 has a check that is not green (fail)'
act="Do the human step (e.g. the hotfix ship checklist), then remove the label."
reasons() { printf '%s' "$out" | jq -c '[.issues[] | [.number, .state, .reason]]'; }
reset
open_issue 7 enhancement,ready-for-human "Spec: x" "## Plan" "$refusal"
open_issue 8 chore,ready-for-human "" "$refusal" "I ran the job again."
open_issue 9 hotfix,ready-for-human "" "$refusal" "## Before landing" "## Landing refused"
open_issue 10 enhancement,ready-for-human "Spec: x" "## Plan" "$refusal" "### A note"
open_issue 11 enhancement,ready-for-human "Spec: x" "## Plan" "$refusal" "## Before landing"
open_issue 12 enhancement,ready-for-human "Spec: x" "## Plan" "$refusal" "## Stopped"
open_issue 13 enhancement,ready-for-human "Spec: x" "$refusal" "## Plan"
open_issue 14 enhancement,ready-for-human "Spec: x" "## Plan"
open_issue 15 enhancement,ready-for-human "Spec: x" "## Plan" "see ## Landing refused"
open_issue 16 enhancement,ready-for-human "Spec: x" "## Plan" $'\n## Landing refused'
open_issue 17 enhancement,needs-info,ready-for-human "Spec: x" "## Plan" "$refusal"
open_issue 18 enhancement "Spec: x" "## Plan" "$refusal"
state=closed open_issue 19 enhancement,ready-for-human "Spec: x" "## Plan" "$refusal"
run_next --json
r='"blocked","landing refused"'; y='"blocked","ready for your step"'
[ "$code" -eq 0 ] && [ "$(reasons)" = "[[7,$r],[8,$r],[9,$r],[10,$r],[11,$y],[12,$y],[13,$y],[14,$y],[15,$y],[16,$y],[17,\"blocked\",\"needs info\"],[18,\"ready\",null],[19,\"done\",null]]" ] || fail "--json, the reason of each ready-for-human row: $code [$(reasons)] $err"
[ "$(printf '%s' "$out" | jq -c '.issues[0] | [.line, .act]')" = "[\"stop #7 is ready-for-human. $act\",\"$act\"]" ] || fail "--json, a refused landing must keep the line and the act: [$out]"
[ "$(endpoints | LC_ALL=C sort)" = "$(json_calls "7 8 9 10 11 12 13 14 15 16 17 18" "")" ] ||
  fail "--json must read the comments of each open issue, and of no closed issue, for a refused landing: $(cat "$S/gh-calls")"
refused="$repo/.claude/worktrees/7-refused"
git -C "$repo" worktree add -q -b feat/7-refused "$refused"
echo x >"$refused/half-done.txt"
run_next --json
[ "$(printf '%s' "$out" | jq -c '.issues[0] | [.state, .path]')" = "[\"dirty\",\"$main/.claude/worktrees/7-refused\"]" ] || fail "--json, a dirty lane worktree comes before a refused landing: [$out]"
git -C "$repo" worktree remove --force "$refused"

reset; open_issue 7 chore "" "A note"; open_issue 8 chore "" "A note"; state=closed open_issue 9 bug ""; state=closed open_issue 10 bug ""
days=15 state=closed open_issue 11 bug ""
jq 'map(if .number == 8 or .number == 10 then .pull_request = {html_url: "https://github.com/o/r/pull/\(.number)"} else . end)' "$S/issues.json" >"$S/issues.tmp"
mv "$S/issues.tmp" "$S/issues.json"
run_next --open
[ "$code" -eq 0 ] && [ "$out" = "$(row 7 "run /celetis:chore #7")" ] &&
  [ "$(endpoints | LC_ALL=C sort)" = "$({ echo 'repos/{owner}/{repo}/issues?state=open&per_page=100'; comments_calls 7; } | LC_ALL=C sort)" ] ||
  fail "--open must give a PR in the list of issues no row, and read no comment of it: $code [$out] $err $(cat "$S/gh-calls")"
run_next --json
[ "$code" -eq 0 ] && [ "$(printf '%s' "$out" | jq -c '[.issues[].number]')" = '[7,9]' ] ||
  fail "--json must give no row to a PR in the list of issues, or to an issue that closed 15 days ago: $code [$out] $err"
[ "$(printf '%s' "$out" | jq -c '.issues[1] | [.title, .url, .updatedAt, .closedAt]')" = "$(jq -c '.[] | select(.number == 9) | [.title, .html_url, .updated_at, .closed_at]' "$S/issues.json")" ] ||
  fail "--json must take the title, the URL, and the times of a row from the issue: [$out]"

reset; echo 1 >"$S/page-size"
open_issue 7 bug "" "## Root cause" "## Plan"; open_issue 8 chore ""; state=closed open_issue 9 bug ""; state=closed open_issue 10 bug ""
prs '[[22, "fix/17-other", false, [], [], []],
  [21, "chore/8-a", false, [run("completed"; "success"), run("completed"; "failure")], [], [review("a"; "APPROVED"), review("b"; "CHANGES_REQUESTED")]],
  [23, "fix/7-a", false, [run("completed"; "success")], ["success", "pending"], []]]'
run_next --open
[ "$code" -eq 0 ] && [ "$out" = "$(row 7 "run /celetis:implement #7")
$(row 8 "run /celetis:chore #8")" ] || fail "--open must read each page of the issues and of the comments: $code [$out] $err"
run_next --json
[ "$code" -eq 0 ] && [ "$(printf '%s' "$out" | jq -c '[.issues[] | [.number, .line, .pr.number, .pr.checks, .pr.review]]')" = '[[7,"run /celetis:implement #7",23,"pending",null],[8,"run /celetis:chore #8",21,"fail","changes"],[9,"stop #9 is finished.",null,null,null],[10,"stop #10 is finished.",null,null,null]]' ] ||
  fail "--json must read each page of each list: $code [$out] $err"

reset; for n in 7 8 9 10 11 12 13 14; do open_issue "$n" chore ""; done
prs '[[31, "chore/7-a", false, [], ["failure"], [review("a"; "CHANGES_REQUESTED"), review("a"; "APPROVED")]],
  [32, "chore/8-a", false, [run("completed"; "success")], ["pending"], [review("a"; "APPROVED"), review("a"; "CHANGES_REQUESTED")]],
  [33, "chore/9-a", false, [], [], [review("a"; "APPROVED"), review("b"; "CHANGES_REQUESTED")]],
  [34, "chore/10-a", false, [], [], [review("a"; "APPROVED"), review("a"; "COMMENTED")], ["b"]],
  [35, "chore/11-a", false, [], [], [review("a"; "CHANGES_REQUESTED"), review("a"; "DISMISSED")]],
  [36, "chore/12-a", false, [], [], [review("a"; "CHANGES_REQUESTED"), review("a"; "DISMISSED")], [], ["t"]],
  [37, "chore/13-a", false, [], [], [], ["r"]],
  [38, "chore/14-a", false, [], [], [review("a"; "COMMENTED")]]]'
run_next --json
[ "$code" -eq 0 ] && [ "$(printf '%s' "$out" | jq -c '[.issues[].pr | [.number, .checks, .review]]')" = '[[31,"fail","approved"],[32,"pending","changes"],[33,null,"changes"],[34,null,"approved"],[35,null,null],[36,null,"required"],[37,null,"required"],[38,null,null]]' ] ||
  fail "--json, the checks with a commit status, and the review from the last review of each reviewer: $code [$out] $err"

reset; issue open chore "" "A note"; open_issue 7 chore "" "A note"; open_issue 8 chore ""; touch "$S/fail-issues-7-comments"
run_next 7
[ "$code" -eq 1 ] && one_line "stop cannot read #7 from GitHub" || fail "the comments of #7 cannot be read: $code [$out] $err"
run_next --open
[ "$code" -eq 1 ] && one_line "stop cannot read the open issues from GitHub" || fail "--open, the comments of one issue cannot be read: $code [$out] $err"
run_next --json
[ "$code" -eq 1 ] && one_line "stop cannot read the issues from GitHub" || fail "--json, the comments of one issue cannot be read: $code [$out] $err"
for part in commits-sha21-check-runs commits-sha21-status pulls-21-reviews; do
  reset; open_issue 8 chore ""; prs '[[21, "chore/8-a", false, [], [], []], [22, "chore/8-b", false, [], [], []]]'; touch "$S/fail-$part"
  run_next --json
  [ "$code" -eq 1 ] && one_line "stop cannot read the issues from GitHub" || fail "--json, a read of $part fails: $code [$out] $err"
  printf '%s' "$err" | grep -q "HTTP 502" || fail "gh's own message must reach stderr: $err"
done

echo "PASS"
