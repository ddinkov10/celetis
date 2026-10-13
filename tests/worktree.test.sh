#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'cd /; rm -rf "$tmp"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t

fail() { echo "FAIL: $1"; exit 1; }

mkdir -p "$tmp/bin"
for tool in uv npm; do
  printf '#!/usr/bin/env bash\necho "%s $*" >>"$SETUP_LOG"\n[ "${FAIL_TOOL:-}" != %s ] || exit 1\n' "$tool" "$tool" >"$tmp/bin/$tool"
done
echo '[ "$1" != venv ] || mkdir -p "${!#}"' >>"$tmp/bin/uv"
cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "$*" >>"$GH_LOG"
case "$1 $2" in
  "issue view")
    [ -z "${ISSUE_MISSING:-}" ] || { echo "Could not resolve to an issue" >&2; exit 1; }
    case "$*" in
      *state,labels*) printf '%s\n' "$ISSUE_STATE" $ISSUE_LABELS ;;
      *) printf '%s\n' "$ISSUE_TITLE" $ISSUE_LABELS ;;
    esac ;;
  "pr list")
    [ -z "${PR_LIST_FAIL:-}" ] || { echo "To get started with GitHub CLI, please run:  gh auth login" >&2; exit 4; }
    case "$*" in
      *--head*)
        case "$*" in *"--state all"*) ;; *) echo "pr list without --state all" >&2; exit 1 ;; esac
        printf '%s\n' "$PRS" ;;
      *) printf '%s\n' $OPEN_HEADS ;;
    esac ;;
esac
EOF
chmod +x "$tmp/bin/"*
export PATH="$tmp/bin:$PATH" SETUP_LOG="$tmp/setup.log" GH_LOG="$tmp/gh.log" PRS='OPEN 0' \
  OPEN_HEADS= ISSUE_LABELS=enhancement ISSUE_TITLE=Probe ISSUE_STATE=OPEN
touch "$SETUP_LOG" "$GH_LOG"

wt() { bash "$here/worktree.sh" "$@"; }
code_of() { set +e; wt "$@" >/dev/null 2>&1; local c=$?; set -e; echo "$c"; }
stderr_of() { wt "$@" 2>&1 >/dev/null || true; }
has_ref() { git show-ref --verify --quiet "refs/heads/$1"; }
on_origin() { git ls-remote --exit-code --heads origin "refs/heads/$1" >/dev/null; }
branches() { git branch --list --format='%(refname:short)' "*/$1-*" | paste -sd ' ' -; }
no_worktree() { ! compgen -G ".claude/worktrees/$1-*" >/dev/null; }
slug_of() { local p; p=$(ISSUE_TITLE=$2 wt "$1") && echo "${p##*/$1-}"; }
marker=backend/.venv/.worktree-setup-done

git init -q -b master "$tmp/repo"
cd "$tmp/repo"
mkdir backend
echo app >backend/app.py
echo model >backend/face_landmarker.task
printf 'backend/face_landmarker.task\n.claude/worktrees/\nbackend/.venv/\n.env\ndocker-compose.override.yml\n' >.gitignore
git add -A
git commit -qm base
echo env >.env
echo override >docker-compose.override.yml
git clone -q --bare . "$tmp/origin.git"
git remote add origin "$tmp/origin.git"
git fetch -q origin
git clone -q "$tmp/origin.git" "$tmp/other"
git -C "$tmp/other" commit -q --allow-empty -m upstream
git -C "$tmp/other" push -q origin HEAD:master
upstream=$(git -C "$tmp/other" rev-parse HEAD)
main=$(git rev-parse --show-toplevel)

out=$(wt 1)
[ "$out" = "$main/.claude/worktrees/1-probe" ] || fail "wrong path: $out"
[ "$(git -C "$out" branch --show-current)" = feat/1-probe ] || fail "enhancement label did not name a feat/ branch"
[ "$(git -C "$out" rev-parse HEAD)" = "$upstream" ] || fail "not based on a fresh origin/master"
[ -z "$(git -C "$out" config --get branch.feat/1-probe.merge || true)" ] || fail "branch tracks origin/master"
[ -f "$out/backend/face_landmarker.task" ] || fail "model not copied"
[ -f "$out/.env" ] && [ -f "$out/docker-compose.override.yml" ] || fail "local config not copied"
[ "$(wc -l <"$SETUP_LOG")" -eq 3 ] || fail "setup did not run exactly once"
[ -f "$out/$marker" ] || fail "setup not marked done"

: >"$GH_LOG"
[ "$(ISSUE_TITLE='A renamed title' wt '#1')" = "$out" ] || fail "rerun by #<n> returned another path"
[ "$(cd "$out" && wt 1)" = "$out" ] || fail "rerun from inside the issue's worktree returned another path"
[ "$(branches 1)" = feat/1-probe ] || fail "rerun created a second branch: $(branches 1)"
[ ! -s "$GH_LOG" ] || fail "re-entering a local branch called gh: $(cat "$GH_LOG")"
[ "$(wc -l <"$SETUP_LOG")" -eq 3 ] || fail "rerun ran setup again"

rm "$out/$marker"
[ "$(wt 1)" = "$out" ] || fail "resumed setup returned another path"
[ "$(wc -l <"$SETUP_LOG")" -eq 6 ] || fail "interrupted setup not run again"
[ -f "$out/$marker" ] || fail "resumed setup not marked done"

rm "$out/$marker"
[ "$(FAIL_TOOL=npm code_of 1)" -eq 1 ] || fail "failed resumed setup not reported"
[ -d "$out" ] && has_ref feat/1-probe || fail "failed resumed setup removed work"

nested=$(cd "$out" && ISSUE_LABELS=bug ISSUE_TITLE=Nested wt 2)
[ "$nested" = "$main/.claude/worktrees/2-nested" ] || fail "worktree nested inside another: $nested"
has_ref fix/2-nested || fail "bug label did not name a fix/ branch"

git worktree add -q -b chore/3-elsewhere "$tmp/elsewhere"
before=$(wc -l <"$SETUP_LOG")
[ "$(wt 3)" = "$(git -C "$tmp/elsewhere" rev-parse --show-toplevel)" ] || fail "existing worktree not reused"
[ "$(wc -l <"$SETUP_LOG")" -eq $((before + 3)) ] || fail "unmarked existing worktree not set up once"

for arg in feat/4-old-form 4x 01 '#' ''; do
  [ "$(code_of "$arg")" -eq 2 ] || fail "invalid argument '$arg' not refused"
done

git checkout -q -b chore/5-inplace
[ "$(code_of 5)" -eq 1 ] || fail "main checkout branch not refused"
no_worktree 5 || fail "created a worktree for the main checkout's branch"
git checkout -q master

[ "$(ISSUE_LABELS=bug ISSUE_TITLE=Broken FAIL_TOOL=npm code_of 6)" -eq 1 ] || fail "failed setup not reported"
no_worktree 6 || fail "failed setup left the worktree"
[ -z "$(branches 6)" ] || fail "failed setup left a new branch"

git branch -q fix/7-kept
[ "$(FAIL_TOOL=uv code_of 7)" -eq 1 ] || fail "failed setup not reported for an existing branch"
no_worktree 7 || fail "failed setup left the worktree of an existing branch"
has_ref fix/7-kept || fail "failed setup deleted an existing branch"

gone=$(ISSUE_TITLE=Gone wt 8)
rm -rf "$gone"
again=$(wt 8) || fail "deleted worktree not recreated"
[ "$again" = "$gone" ] || fail "deleted worktree recreated elsewhere: $again"
[ -f "$gone/$marker" ] || fail "deleted worktree not set up again"

[ "$(ISSUE_LABELS=hotfix slug_of 9 Fire)" = fire ] && has_ref hotfix/9-fire || fail "hotfix label did not name a hotfix/ branch"
[ "$(ISSUE_LABELS='ready-for-agent chore' slug_of 10 Tidy)" = tidy ] && has_ref chore/10-tidy || fail "chore label did not name a chore/ branch"
[ "$(slug_of 11 'Lane commands: stop when the issue has no branch!')" = lane-commands-stop-when-the ] || fail "slug not cut at the last - within 30 characters"
[ "$(slug_of 12 'Aaaaaaaaa Bbbbbbbbb Cccccccccc dd')" = aaaaaaaaa-bbbbbbbbb-cccccccccc ] || fail "30-character slug ending on a whole word was cut"
[ "$(slug_of 13 'Supercalifragilisticexpialidocious fix')" = supercalifragilisticexpialidoc ] || fail "first word over 30 characters not hard-cut"
[ "$(slug_of 14 '!!! ???')" = issue ] || fail "empty slug not replaced by issue"
[ "$(slug_of 15 'Грешка в PDF')" = pdf ] || fail "non-ASCII title not reduced to an ASCII slug"

git -C "$tmp/other" checkout -q -b fix/16-remote-work
git -C "$tmp/other" commit -q --allow-empty -m remote-work
git -C "$tmp/other" push -q origin fix/16-remote-work
remote_tip=$(git -C "$tmp/other" rev-parse HEAD)
pr_out=$(OPEN_HEADS='feat/160-other fix/16-remote-work' ISSUE_TITLE='Another title' wt 16)
[ "$pr_out" = "$main/.claude/worktrees/16-remote-work" ] || fail "open PR's branch not re-entered: $pr_out"
[ "$(git -C "$pr_out" rev-parse HEAD)" = "$remote_tip" ] || fail "open PR's branch not at its remote tip"
[ "$(git config --get branch.fix/16-remote-work.remote)" = origin ] || fail "open PR's branch does not track origin"
[ "$(git config --get branch.fix/16-remote-work.merge)" = refs/heads/fix/16-remote-work ] || fail "open PR's branch tracks the wrong ref"
[ "$(branches 16)" = fix/16-remote-work ] || fail "open PR's issue got another branch: $(branches 16)"

git -C "$tmp/other" checkout -q -b fix/25-remote-setup
git -C "$tmp/other" push -q origin fix/25-remote-setup
[ "$(OPEN_HEADS=fix/25-remote-setup FAIL_TOOL=npm code_of 25)" -eq 1 ] || fail "failed setup of an open PR's branch not reported"
no_worktree 25 || fail "failed setup left the worktree of an open PR's branch"
[ -z "$(branches 25)" ] || fail "failed setup left the local branch of an open PR's branch"
git ls-remote --exit-code origin refs/heads/fix/25-remote-setup >/dev/null || fail "failed setup deleted the open PR's branch on origin"

git -C "$tmp/other" checkout -q -b feat/17-merged-long-ago
git -C "$tmp/other" commit -q --allow-empty -m merged
git -C "$tmp/other" push -q origin feat/17-merged-long-ago
git fetch -q origin
[ "$(slug_of 17 'Fresh start')" = fresh-start ] || fail "merged PR's leftover remote branch re-entered"
[ "$(git rev-parse feat/17-fresh-start)" = "$upstream" ] || fail "new branch not based on origin/master"
[ "$(branches 17)" = feat/17-fresh-start ] || fail "merged PR's leftover remote branch checked out: $(branches 17)"

git branch -q feat/18-a
git branch -q fix/18-b
[ "$(code_of 18)" -eq 1 ] || fail "two local branches not refused"
[ "$(code_of --remove 18)" -eq 1 ] || fail "--remove with two local branches not refused"
no_worktree 18 && [ "$(branches 18)" = "feat/18-a fix/18-b" ] || fail "refusing two local branches changed them"
[ "$(OPEN_HEADS='feat/19-a fix/19-b' code_of 19)" -eq 1 ] || fail "two open PRs not refused"
[ "$(ISSUE_LABELS='enhancement epic' code_of 20)" -eq 1 ] || fail "epic not refused"
[[ $(ISSUE_LABELS='enhancement epic' stderr_of 20) == *epic* ]] || fail "epic refusal does not say epic"
[ "$(ISSUE_LABELS=needs-triage code_of 21)" -eq 1 ] || fail "issue without a lane label not refused"
[[ $(ISSUE_LABELS=needs-triage stderr_of 21) == *"/triage #21"* ]] || fail "issue without a lane label not sent to /triage"
[ "$(ISSUE_LABELS='bug enhancement' code_of 22)" -eq 1 ] || fail "issue with two lane labels not refused"
[ "$(ISSUE_MISSING=1 code_of 23)" -eq 1 ] || fail "unreadable issue not refused"
[ "$(PR_LIST_FAIL=1 code_of 24)" -eq 1 ] || fail "failed open-PR listing not refused"
for n in 19 20 21 22 23 24; do
  no_worktree "$n" && [ -z "$(branches "$n")" ] || fail "refusal for #$n created a branch or a worktree"
done

proto="$main/.claude/worktrees/prototype-1-probe-ui"
git worktree add -q -b prototype/1-probe-ui "$proto" master
git branch -q prototype/1-alt master
git branch -q prototype/1-gone master
git branch -q prototype/10-near master
git push -q origin prototype/1-probe-ui prototype/1-gone prototype/10-near
git branch -q -D prototype/1-gone
prototype_kept() {
  [ -d "$proto" ] && has_ref prototype/1-probe-ui && has_ref prototype/1-alt &&
    on_origin prototype/1-probe-ui && on_origin prototype/1-gone
}

[ "$(code_of --remove 1)" -eq 1 ] || fail "removed with an open PR"
[ "$(PRS=$'CLOSED 0\nOPEN 0' ISSUE_STATE=CLOSED code_of --remove 1)" -eq 1 ] || fail "removed with an open PR beside a closed one"
[ "$(PRS= code_of --remove 1)" -eq 1 ] || fail "removed with no PR on an open issue"
[[ $(PRS= stderr_of --remove 1) == *"#1 is open"*"no merged PR"* ]] || fail "open-issue refusal does not name the open issue and the missing merge"
[ "$(PRS= ISSUE_LABELS='enhancement epics' code_of --remove 1)" -eq 1 ] || fail "a label that only contains epic counted as epic"
[ "$(PR_LIST_FAIL=1 ISSUE_STATE=CLOSED code_of --remove 1)" -eq 1 ] || fail "removed after a failed PR lookup"
[ "$(PRS= ISSUE_MISSING=1 code_of --remove 1)" -eq 1 ] || fail "removed after a failed issue lookup"
[ -d "$out" ] && has_ref feat/1-probe || fail "a refused removal deleted work"
prototype_kept || fail "a refused removal deleted the prototype"

export PRS="MERGED $(git rev-parse feat/1-probe)"
git -C "$out" commit -q --allow-empty -m unpushed
[ "$(code_of --remove 1)" -eq 1 ] || fail "removed a branch with commits the merged PR lacks"
[ -d "$out" ] && has_ref feat/1-probe || fail "a refused removal deleted unmerged commits"
prototype_kept || fail "a removal refused for unmerged commits deleted the prototype"
PRS=$'CLOSED 0\n'"MERGED $(git rev-parse feat/1-probe)"

[ "$(cd "$out" && code_of --remove 1)" -eq 1 ] || fail "removed the worktree the caller is inside"
prototype_kept || fail "a removal refused inside the worktree deleted the prototype"

git remote set-url origin "$tmp/missing.git"
[ "$(code_of --remove 1)" -ne 0 ] || fail "removed with origin unreachable"
git remote set-url origin "$tmp/origin.git"
[ -d "$out" ] && has_ref feat/1-probe && prototype_kept || fail "a removal with origin unreachable deleted work"

touch "$proto/scratch"
[ "$(code_of --remove 1)" -ne 0 ] || fail "removed a prototype checkout with an uncommitted file"
[ -f "$proto/scratch" ] && has_ref prototype/1-probe-ui && on_origin prototype/1-probe-ui ||
  fail "a refused removal deleted the prototype's uncommitted file"
[ -d "$out" ] && has_ref feat/1-probe || fail "a refused prototype removal deleted the lane"
rm "$proto/scratch"

git worktree lock "$proto"
touch "$out/scratch"
[ "$(code_of --remove 1)" -ne 0 ] || fail "removed a worktree with an uncommitted file"
[ -d "$out" ] && has_ref feat/1-probe || fail "a refused removal deleted an uncommitted file"
[ ! -e "$proto" ] || fail "locked prototype checkout not removed before the lane"
rm "$out/scratch"
git worktree lock "$out"
wt --remove '#1'
[ ! -e "$out" ] || fail "merged worktree not removed"
! has_ref feat/1-probe || fail "merged branch not deleted"
! has_ref prototype/1-probe-ui && ! has_ref prototype/1-alt || fail "local prototype branch not deleted"
! on_origin prototype/1-probe-ui && ! on_origin prototype/1-gone || fail "prototype branch not deleted on origin"
has_ref prototype/10-near && on_origin prototype/10-near || fail "deleted another issue's prototype"
: >"$GH_LOG"
[ "$(code_of --remove 1)" -eq 0 ] || fail "removing an issue with no branch did not exit 0"
[ ! -s "$GH_LOG" ] || fail "removing an issue with no branch called gh"

export PRS= ISSUE_STATE=CLOSED
git branch -q prototype/2-sketch master
git push -q origin prototype/2-sketch
[ "$(cd "$nested" && code_of --remove 2)" -eq 1 ] || fail "removed a closed issue's worktree the caller is inside"
[ -d "$nested" ] && has_ref fix/2-nested && has_ref prototype/2-sketch || fail "a closed-issue removal refused inside the worktree deleted work"
git -C "$nested" commit -q --allow-empty -m lane-only
git branch -q -f prototype/2-sketch fix/2-nested
git push -q -f origin prototype/2-sketch
[ "$(code_of --remove 2)" -eq 1 ] || fail "removed a branch whose only origin copy is its own prototype"
[ -d "$nested" ] && has_ref fix/2-nested && has_ref prototype/2-sketch && on_origin prototype/2-sketch ||
  fail "a removal refused for commits only the prototype holds deleted work"
git -C "$nested" reset -q --hard HEAD~1
git branch -q -f prototype/2-sketch master
git push -q -f origin prototype/2-sketch
wt --remove 2
[ ! -e "$nested" ] && ! has_ref fix/2-nested || fail "closed issue with no PR: lane not removed"
! has_ref prototype/2-sketch && ! on_origin prototype/2-sketch || fail "closed issue with no PR: prototype not deleted"

ISSUE_STATE=OPEN ISSUE_LABELS=epic wt --remove 8
[ ! -e "$gone" ] && ! has_ref feat/8-gone || fail "open epic with no PR: lane not removed"

PRS="CLOSED $remote_tip" wt --remove 16
[ ! -e "$pr_out" ] && ! has_ref fix/16-remote-work || fail "closed issue with a closed PR: lane not removed"
on_origin fix/16-remote-work || fail "a removal deleted the lane branch on origin"

tidy="$main/.claude/worktrees/10-tidy"
git -C "$tidy" commit -q --allow-empty -m local-only
[ "$(code_of --remove 10)" -eq 1 ] || fail "removed a closed issue's branch with commits origin lacks"
[[ $(stderr_of --remove 10) == *"git push origin chore/10-tidy"* ]] || fail "local-commits refusal does not say to push the branch"
[ -d "$tidy" ] && has_ref chore/10-tidy || fail "a removal refused for local commits deleted work"
git push -q origin chore/10-tidy
wt --remove 10
[ ! -e "$tidy" ] && ! has_ref chore/10-tidy || fail "closed issue's pushed branch not removed"

echo "PASS"
