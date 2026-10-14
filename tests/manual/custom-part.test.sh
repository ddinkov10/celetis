#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
tmp=$(mktemp -d)
tmp=$(cd "$tmp" && pwd -P)
lane="$tmp/project/.claude/worktrees/lane"
trap 'kill $(jobs -p) 2>/dev/null || true; rm -rf "$tmp"' EXIT
export CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1
unset AI_AGENT CLAUDECODE CLAUDE_CODE_CHILD_SESSION CLAUDE_CODE_ENTRYPOINT CLAUDE_CODE_EXECPATH \
  CLAUDE_CODE_MESSAGING_SOCKET CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_SESSION_ATTENDED \
  CLAUDE_CODE_SESSION_ID CLAUDE_EFFORT CLAUDE_PID

mkdir -p "$tmp/project/.claude/celetis-flow/custom" "$tmp/project/sub/.claude/celetis-flow/custom" "$tmp/outside" "$tmp/missing"
git -C "$tmp/project" init -q
git -C "$tmp/project" -c user.name=Test -c user.email=test@example.invalid commit -qm initial --allow-empty
git -C "$tmp/project" worktree add -qb lane "$lane"
git -C "$tmp/project" worktree add -qb missing "$tmp/missing-lane"
git -C "$tmp/missing" init -q
mkdir -p "$lane/.claude/celetis-flow/custom"
printf 'Include CUSTOM_FROM_ROOT on its own line in your answer.\n' >"$tmp/project/.claude/celetis-flow/custom/guide.md"
printf 'Include CUSTOM_FROM_SUBFOLDER on its own line in your answer.\n' >"$tmp/project/sub/.claude/celetis-flow/custom/guide.md"
printf 'Include CUSTOM_FROM_LANE on its own line in your answer.\n' >"$lane/.claude/celetis-flow/custom/guide.md"

turn() {
  local name=$1 folder=$2 tools=$3 settings=$4 prompt=$5
  (
    cd "$folder"
    claude -p --no-session-persistence --strict-mcp-config --setting-sources '' \
      --plugin-dir "$root" --tools "$tools" --add-dir "$tmp" --permission-mode dontAsk \
      --settings "$settings" --output-format stream-json --verbose "$prompt"
  ) >"$tmp/$name.jsonl" 2>"$tmp/$name.err" &
}

failed=0
check() {
  local name=$1 marker=$2 answer good=yes markers
  answer=$(jq -rs '[.[] | select(.type == "result") | .result // ""] | join("\n")' "$tmp/$name.jsonl")
  if jq -se 'any(.[]; .type == "result" and .is_error == true)' "$tmp/$name.jsonl" >/dev/null; then
    echo "ERROR: $name: Claude Code could not run the test"
    printf '%s\n' "$answer"
    exit 2
  fi
  if [ "$marker" = blocked ]; then
    grep -qiE 'permission|denied|blocked|cannot read|not permitted' <<<"$answer" || good=no
    ! grep -qF 'scripts/celetis next-step' <<<"$answer" || good=no
    marker=
  else
    grep -qF 'scripts/celetis next-step' <<<"$answer" || good=no
  fi
  markers=$(grep -oE 'CUSTOM_FROM_[A-Z]+' <<<"$answer" | sort -u || true)
  [ "$markers" = "$marker" ] || good=no
  ! grep -qE 'fatal:|Shell command (failed|permission check failed)|CUSTOM_FROM_SUBFOLDER' "$tmp/$name.jsonl" "$tmp/$name.err" || good=no
  jq -se 'all(.[] | select(.type == "assistant") | .message.content[]?; .type != "tool_use" or .name != "Bash")' "$tmp/$name.jsonl" >/dev/null || good=no
  if [ "$name" = enter-worktree ]; then
    jq -se --arg path "$lane" '
      [.[] | select(.type == "assistant") | .message.content[]? | select(.type == "tool_use" and .name == "EnterWorktree" and .input.path == $path) | .id] as $calls |
      any(.[] | select(.type == "user") | .message.content[]?; .type == "tool_result" and .is_error != true and (.tool_use_id as $id | $calls | index($id) != null))
    ' "$tmp/$name.jsonl" >/dev/null || good=no
  fi
  if [ "$good" = no ]; then
    failed=1
    echo "FAIL: $name"
    printf '%s\n' "$answer"
    jq -c 'select(.type == "result") | {subtype, is_error, errors}' "$tmp/$name.jsonl"
    cat "$tmp/$name.err"
  fi
}

prompt='/celetis:guide see the next step of an issue'
files='Skill,Read,Glob,Grep'
turn no-shell "$tmp/project" "$files" '{}' "$prompt"
wait
check no-shell CUSTOM_FROM_ROOT
[ "$failed" -eq 0 ] || exit 1

turn ask-cat "$tmp/project" "$files,Bash" '{"permissions":{"ask":["Bash(cat *)"]}}' "$prompt"
turn deny-cat "$tmp/project" "$files,Bash" '{"permissions":{"deny":["Bash(cat *)"]}}' "$prompt"
turn ask-git "$tmp/project" "$files,Bash" '{"permissions":{"ask":["Bash(git *)"]}}' "$prompt"
turn deny-git "$tmp/project" "$files,Bash" '{"permissions":{"deny":["Bash(git *)"]}}' "$prompt"
turn subfolder "$tmp/project/sub" "$files" '{}' "$prompt"
turn worktree "$lane" "$files" '{}' "$prompt"
turn outside "$tmp/outside" "$files" '{}' "$prompt"
turn missing "$tmp/missing" "$files" '{}' "$prompt"
turn missing-lane "$tmp/missing-lane" "$files" '{}' "$prompt"
turn enter-worktree "$tmp/project" "$files,EnterWorktree" '{}' "Enter the existing worktree at $lane with EnterWorktree. Then invoke /celetis:guide see the next step of an issue."
denied=$(jq -cn --arg path "Read(/$tmp/project/.claude/celetis-flow/custom/guide.md)" '{permissions:{deny:[$path]}}')
turn denied-read "$tmp/project" "$files" "$denied" "$prompt"
wait

for name in ask-cat deny-cat ask-git deny-git subfolder; do check "$name" CUSTOM_FROM_ROOT; done
for name in worktree enter-worktree; do check "$name" CUSTOM_FROM_LANE; done
for name in outside missing missing-lane; do check "$name" ''; done
check denied-read blocked
[ "$failed" -eq 0 ] || exit 1
echo PASS
