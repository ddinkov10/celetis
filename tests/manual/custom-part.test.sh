#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
output_dir=
while [ $# -gt 0 ]; do
  case $1 in
    --output-dir) [ $# -ge 2 ] || exit 2; output_dir=$2; shift 2 ;;
    *) echo "usage: $0 [--output-dir DIR]" >&2; exit 2 ;;
  esac
done
if [ -n "$output_dir" ]; then
  mkdir -p "$output_dir"
  output_dir=$(cd "$output_dir" && pwd)
fi
tmp=$(mktemp -d)
tmp=$(cd "$tmp" && pwd -P)
lane="$tmp/project/.claude/worktrees/lane"
output_files=()
cleanup() {
  local status=$? file
  kill $(jobs -p) 2>/dev/null || true
  if [ -n "$output_dir" ] && [ "${#output_files[@]}" -gt 0 ]; then
    for file in "${output_files[@]}"; do
      [ ! -f "$file" ] || cp "$file" "$output_dir/" || status=1
    done
  fi
  rm -rf "$tmp"
  exit "$status"
}
trap cleanup EXIT
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
  output_files+=("$tmp/$name.input.json" "$tmp/$name.jsonl" "$tmp/$name.err" "$tmp/$name.status")
  jq -cn --arg cwd "$folder" --arg plugin "$root" --arg tools "$tools" \
    --argjson settings "$settings" --arg prompt "$prompt" \
    '{cwd:$cwd,plugin:$plugin,tools:$tools,settings:$settings,prompt:$prompt}' >"$tmp/$name.input.json"
  (
    status=0
    (
      cd "$folder"
      claude -p --no-session-persistence --strict-mcp-config --setting-sources '' \
        --plugin-dir "$root" --tools "$tools" --add-dir "$tmp" --permission-mode dontAsk \
        --settings "$settings" --output-format stream-json --verbose "$prompt"
    ) >"$tmp/$name.jsonl" 2>"$tmp/$name.err" || status=$?
    printf '%s\n' "$status" >"$tmp/$name.status"
  ) &
}

failed=0
check() {
  local name=$1 marker=$2 answer good=yes markers status
  if [ ! -f "$tmp/$name.status" ]; then
    echo "ERROR: $name: missing client exit status"
    exit 2
  elif ! status=$(cat "$tmp/$name.status") || ! [[ $status =~ ^(0|[1-9][0-9]{0,2})$ ]] || [ "$status" -gt 255 ]; then
    echo "ERROR: $name: invalid client exit status"
    exit 2
  elif [ "$status" -ne 0 ]; then
    echo "ERROR: $name: client exited with status $status"
    exit 2
  fi
  answer=$(jq -rs '[.[] | select(.type == "result") | .result // ""] | join("\n")' "$tmp/$name.jsonl")
  if jq -se 'any(.[]; .type == "result" and .is_error == true)' "$tmp/$name.jsonl" >/dev/null; then
    echo "ERROR: $name: Claude Code could not run the test"
    printf '%s\n' "$answer"
    exit 2
  fi
  if [ "$marker" = blocked ]; then
    jq -se --arg path "$tmp/project/.claude/celetis-flow/custom/guide.md" '
      [.[] | select(.type == "assistant" or .type == "user") | .message.content[]?] as $events |
      [$events | to_entries[] | select(.value.type == "tool_use" and
        .value.name == "Read" and .value.input.file_path == $path)] as $reads |
      if ($reads | length) != 1 then false else
        $reads[0] as $read |
        ($read.value.id | type == "string" and length > 0) and
        any(.[] | select(.type == "result") | .permission_denials[]?;
          .tool_name == "Read" and .tool_use_id == $read.value.id and .tool_input.file_path == $path) and
        any($events[($read.key + 1):][];
          .type == "tool_result" and .tool_use_id == $read.value.id and .is_error == true) and
        all($events[($read.key + 1):][]; .type != "tool_use")
      end
    ' "$tmp/$name.jsonl" >/dev/null || good=no
    grep -qiE 'permission|denied|blocked|cannot read|not permitted' <<<"$answer" || good=no
    ! grep -qF 'scripts/celetis --agent claude next-step' <<<"$answer" || good=no
    marker=
  else
    grep -qF 'scripts/celetis --agent claude next-step' <<<"$answer" || good=no
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
