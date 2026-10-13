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

cat >"$bin/gh" <<'EOF'
#!/usr/bin/env bash
S=$NEXT_STEP_TEST_STATE
printf '%s\n' "$*" >>"$S/gh-calls"
[ ! -f "$S/gh-fail" ] || { echo "HTTP 502" >&2; exit 1; }
case "$1 $2" in
  "issue view") [ -f "$S/issue.json" ] || { echo "no issue" >&2; exit 1; }; cat "$S/issue.json" ;;
  "pr list") cat "$S/prs.json" ;;
  "issue list") cat "$S/issues.json" ;;
  *) echo "fake gh: unexpected $*" >&2; exit 1 ;;
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

issue() {
  local state=$1 labels=$2 body=$3
  shift 3
  jq -n --arg s "$state" --arg l "$labels" --arg b "$body" \
    '{state: $s, labels: ($l | split(",") | map(select(. != "") | {name: .})), body: $b, comments: ($ARGS.positional | map({body: .}))}' \
    --args "$@" >"$S/issue.json"
}

run_next() {
  set +e
  (cd "${from:-$repo}" && "$BASH" "$next" "$@" >"$tmp/out" 2>"$tmp/err")
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

reset; issue CLOSED wontfix ""; expect "stop #7 is closed as wontfix."
reset; issue CLOSED bug ""; expect "stop #7 is finished."
reset; issue CLOSED enhancement,ready-for-human "Spec: x" "## Plan" "## Landing refused"; expect "stop #7 is finished."
reset; issue CLOSED bug,wontfix ""; expect "stop #7 is closed as wontfix."
reset; issue OPEN bug,needs-info ""; expect "stop #7 needs info. Answer the questions on the issue, then remove the label."
reset; issue OPEN hotfix,ready-for-human ""; expect "stop #7 is ready-for-human. Do the human step (e.g. the hotfix ship checklist), then remove the label."
reset; issue OPEN enhancement,ready-for-human "Spec: x" "## Plan" "## Before landing"; expect "stop #7 is ready-for-human. Do the human step (e.g. the hotfix ship checklist), then remove the label."
reset; issue OPEN enhancement,ready-for-human "Spec: x" "## Plan" "## Landing refused"; expect "stop #7 is ready-for-human. Do the human step (e.g. the hotfix ship checklist), then remove the label."
reset; issue OPEN epic ""; expect "stop #7 is an epic. Each child runs its own flow."
reset; issue OPEN needs-triage "It breaks"; expect "run /celetis:triage #7"
reset; issue OPEN enhancement "Intent: add X"; expect "run /celetis:feature #7"
reset; issue OPEN enhancement ""; expect "run /celetis:feature #7"
reset; issue OPEN enhancement,needs-info "Intent: add X"; expect "stop #7 needs info. Answer the questions on the issue, then remove the label."
reset; issue OPEN bug "It breaks"; expect "run /celetis:bug #7"
reset; issue OPEN chore ""; expect "run /celetis:chore #7"
reset; issue OPEN hotfix ""; expect "run /celetis:hotfix #7"
reset; issue OPEN enhancement "Spec: 2026-09-25"; expect "run /celetis:plan #7"
reset; issue OPEN bug "" "## Root cause"; expect "run /celetis:plan #7"
reset; issue OPEN enhancement "Spec: x" "see ## Plan"; expect "run /celetis:plan #7"
reset; issue OPEN enhancement "Spec: x" "## Plan"; expect "run /celetis:implement #7"
reset; issue OPEN bug "" "## Root cause" "## Plan"; expect "run /celetis:implement #7"
reset; issue OPEN chore "" "## Landing refused"; expect "run /celetis:chore #7"
reset; issue OPEN enhancement "Spec: x" "## Plan" "## Landing refused"; expect "run /celetis:implement #7"
[ "$(cat "$S/gh-calls")" = "issue view 7 --json state,labels,body,comments" ] || fail "the form with a number must make 1 gh call and read no PR: $(cat "$S/gh-calls")"

reset; issue OPEN chore ""
run_next '#7'
[ "$code" -eq 0 ] && one_line "run /celetis:chore #7" || fail "#7 as the argument: $code [$out] $err"

reset; issue OPEN bug ""; touch "$S/gh-fail"
run_next 7
[ "$code" -eq 1 ] && one_line "stop cannot read #7 from GitHub" || fail "gh failure: $code [$out] $err"
printf '%s' "$err" | grep -q "HTTP 502" || fail "gh's own message must reach stderr: $err"

reset
run_next 7
[ "$code" -eq 1 ] && one_line "stop cannot read #7 from GitHub" || fail "missing issue: $code [$out] $err"
printf '%s' "$err" | grep -q "no issue" || fail "gh's own message must reach stderr: $err"

reset; issue OPEN chore ""
for args in "" abc 7abc "#" "7 8" --all "--open 7" "--json 7"; do
  run_next $args
  [ "$code" -eq 2 ] && [ -z "$out" ] && printf '%s' "$err" | grep -qxF "usage: scripts/celetis next-step <issue number> | --open | --json, e.g. scripts/celetis next-step 276" || fail "bad arguments [$args]: $code [$out] $err"
done
[ ! -f "$S/gh-calls" ] || fail "a usage error called gh: $(cat "$S/gh-calls")"

reset; issue OPEN chore ""
echo dirty >"$repo/new.txt"
run_next 7
[ "$code" -eq 0 ] && one_line "stop the working tree is dirty: $main; commit or stash first" || fail "dirty main checkout: $code [$out] $err"
[ ! -f "$S/gh-calls" ] || fail "a dirty tree must stop before any gh call: $(cat "$S/gh-calls")"
rm "$repo/new.txt"

lane="$repo/.claude/worktrees/7-crash"
git -C "$repo" worktree add -q -b fix/7-crash "$lane"
reset; issue OPEN bug ""
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
reset; issue OPEN chore ""
run_next 7
[ "$code" -eq 0 ] && one_line "run /celetis:chore #7" || fail "a dirty #17 worktree stopped #7: $code [$out] $err"
git -C "$repo" worktree remove --force "$other"

reset; issue OPEN chore ""
from=$tmp run_next 7
[ "$code" -ne 0 ] && [ -z "$out" ] && [ ! -f "$S/gh-calls" ] || fail "outside a repository: $code [$out] $(cat "$S/gh-calls" 2>/dev/null)"

open_issue() {
  local n=$1 labels=$2 body=$3
  shift 3
  jq --argjson n "$n" --arg s "${state:-OPEN}" --arg l "$labels" --arg b "$body" \
    '. + [{number: $n, state: $s, labels: ($l | split(",") | map(select(. != "") | {name: .})), body: $b, comments: ($ARGS.positional | map({body: .}))}]' \
    "$S/issues.json" --args "$@" >"$S/issues.tmp"
  mv "$S/issues.tmp" "$S/issues.json"
}
row() { printf '%s\t%s' "$1" "$2"; }

reset; open_issue 9 epic ""; open_issue 7 needs-triage "It breaks"; open_issue 8 enhancement "Spec: x" "## Plan"
run_next --open
[ "$code" -eq 0 ] && [ "$out" = "$(row 7 "run /celetis:triage #7")
$(row 8 "run /celetis:implement #8")
$(row 9 "stop #9 is an epic. Each child runs its own flow.")" ] || fail "--open must print one row for each open issue, lowest number first: $code [$out] $err"
[ "$(cat "$S/gh-calls")" = "issue list --state open --limit 200 --json number,state,labels,body,comments" ] || fail "--open must make 1 gh call: $(cat "$S/gh-calls")"

both() {
  reset; issue OPEN "$@"; run_next 7; single=$out
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
lock="$repo/.git/agent-flow/land-7.lock"
mkdir -p "$repo/.git/agent-flow"
reset; issue OPEN enhancement "Spec: x" "## Plan"; open_issue 7 enhancement "Spec: x" "## Plan"; open_issue 8 chore ""
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

reset; for n in 7 8 9 10 11 12; do open_issue "$n" chore ""; done
jq -n 'def check($status; $conclusion): {__typename: "CheckRun", $status, $conclusion}; def context($state): {__typename: "StatusContext", $state};
  [[21, "fix/17-other", false, "", []],
    [22, "chore/8-a", false, "CHANGES_REQUESTED", [check("IN_PROGRESS"; ""), check("COMPLETED"; "TIMED_OUT")]],
    [23, "chore/8-b", false, "APPROVED", [check("COMPLETED"; "SUCCESS")]],
    [24, "chore/9-a", true, "REVIEW_REQUIRED", [check("COMPLETED"; "SUCCESS"), context("EXPECTED")]],
    [25, "chore/10-a", false, "APPROVED", [check("COMPLETED"; "SKIPPED"), context("SUCCESS")]],
    [26, "chore/11-a", false, "", [context("ERROR"), check("QUEUED"; "")]],
    [27, "chore/12-a", false, "", []]]
  | map({number: .[0], url: "https://github.com/o/r/pull/\(.[0])", headRefName: .[1], isDraft: .[2], reviewDecision: .[3], statusCheckRollup: .[4]})' >"$S/prs.json"
run_next --json
[ "$code" -eq 0 ] && [ "$(printf '%s' "$out" | jq -c '[.noRun, (.issues[0] | [.number, .type, .state, .line, .path])]')" = '[null,[7,"chore","ready","run /celetis:chore #7",null]]' ] || fail "--json must print the rows of the board: $code [$out] $err"
[ "$(printf '%s' "$out" | jq -c '.issues[1].pr')" = '{"number":22,"url":"https://github.com/o/r/pull/22","draft":false,"checks":"fail","review":"changes"}' ] || fail "--json, the first open PR of an issue: [$out]"
[ "$(printf '%s' "$out" | jq -c '[.issues[].pr | if . then [.number, .draft, .checks, .review] else . end]')" = '[null,[22,false,"fail","changes"],[24,true,"pending","required"],[25,false,"pass","approved"],[26,false,"fail",null],[27,false,null,null]]' ] || fail "--json, the open PR of each issue, with its checks and its review: [$out]"
[ "$(wc -l <"$S/gh-calls" | tr -d ' ')" -eq 3 ] && grep -qxF 'pr list --state open --limit 200 --json headRefName,number,url,isDraft,statusCheckRollup,reviewDecision' "$S/gh-calls" || fail "--json must make 3 gh calls: $(cat "$S/gh-calls")"
reset; open_issue 7 bug,needs-info ""; open_issue 8 hotfix,ready-for-human ""; open_issue 9 epic ""; open_issue 12 chore ""
state=CLOSED open_issue 10 bug ""; state=CLOSED open_issue 11 bug,wontfix ""
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
state=CLOSED open_issue 19 enhancement,ready-for-human "Spec: x" "## Plan" "$refusal"
run_next --json
r='"blocked","landing refused"'; y='"blocked","ready for your step"'
[ "$code" -eq 0 ] && [ "$(reasons)" = "[[7,$r],[8,$r],[9,$r],[10,$r],[11,$y],[12,$y],[13,$y],[14,$y],[15,$y],[16,$y],[17,\"blocked\",\"needs info\"],[18,\"ready\",null],[19,\"done\",null]]" ] || fail "--json, the reason of each ready-for-human row: $code [$(reasons)] $err"
[ "$(printf '%s' "$out" | jq -c '.issues[0] | [.line, .act]')" = "[\"stop #7 is ready-for-human. $act\",\"$act\"]" ] || fail "--json, a refused landing must keep the line and the act: [$out]"
[ "$(wc -l <"$S/gh-calls" | tr -d ' ')" -eq 3 ] || fail "--json must make 3 gh calls for a refused landing: $(cat "$S/gh-calls")"
refused="$repo/.claude/worktrees/7-refused"
git -C "$repo" worktree add -q -b feat/7-refused "$refused"
echo x >"$refused/half-done.txt"
run_next --json
[ "$(printf '%s' "$out" | jq -c '.issues[0] | [.state, .path]')" = "[\"dirty\",\"$main/.claude/worktrees/7-refused\"]" ] || fail "--json, a dirty lane worktree comes before a refused landing: [$out]"
git -C "$repo" worktree remove --force "$refused"

echo "PASS"
