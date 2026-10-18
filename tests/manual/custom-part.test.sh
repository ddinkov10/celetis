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
plugin="$tmp/plugin"
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

mkdir -p "$plugin" "$tmp/project/sub" "$tmp/outside" "$tmp/missing"
cp -R "$root/skills" "$root/docs" "$root/scripts" "$root/.claude-plugin" "$plugin/"
cp "$root/step-prompt.md" "$plugin/"
claude --version >"$tmp/version" 2>&1
output_files+=("$tmp/version")
: >"$tmp/plugin-sources"
for source in docs/hosts/entry.md docs/hosts/claude.md docs/configuration.md \
  skills/guide/SKILL.md skills/writing-for-agents/SKILL.md skills/lesson-review/SKILL.md skills/lesson/SKILL.md; do
  hash=$(shasum -a 256 <"$plugin/$source")
  jq -cn --arg path "$plugin/$source" --arg source "$root/$source" --arg sha256 "${hash%% *}" \
    '{path:$path,source:$source,sha256:$sha256}' >>"$tmp/plugin-sources"
done
plugin_sources=$(jq -s . "$tmp/plugin-sources")
git -C "$tmp/project" init -q
git -C "$tmp/project" -c user.name=Test -c user.email=test@example.invalid commit -qm initial --allow-empty
git -C "$tmp/project" worktree add -qb lane "$lane"
git -C "$tmp/project" worktree add -qb missing "$tmp/missing-lane"
git -C "$tmp/missing" init -q
config() {
  cat >"$1/.celetis.yaml" <<EOF
landing: pr
worktreeSetup: |-
  printf 'SETUP_MUST_NOT_RUN\n'
  touch SETUP_MUST_NOT_RUN
custom:
  guide: |-
    Include $2 on its own line in your answer.
  bug: |-
    Include UNRELATED_CUSTOM_MUST_NOT_RUN on its own line in your answer.
EOF
}
config "$tmp/project" CUSTOM_FROM_ROOT
config "$tmp/project/sub" CUSTOM_FROM_SUBFOLDER
config "$lane" CUSTOM_FROM_LANE
for name in malformed duplicate-key wrong-type folded ambiguous unknown-field symlink missing-custom empty-custom empty-instruction handoff borrowed; do
  mkdir "$tmp/$name"
  git -C "$tmp/$name" init -q
done
printf 'landing: pr\ncustom: [\n' >"$tmp/malformed/.celetis.yaml"
printf 'landing: pr\ncustom:\n  guide: one\n  guide: two\n' >"$tmp/duplicate-key/.celetis.yaml"
printf 'landing: pr\ncustom:\n  guide: [one, two]\n' >"$tmp/wrong-type/.celetis.yaml"
printf 'landing: pr\ncustom:\n  guide: >\n    one\n    two\n' >"$tmp/folded/.celetis.yaml"
printf 'landing: pr\n---\nlanding: merge\n' >"$tmp/ambiguous/.celetis.yaml"
printf 'landing: pr\ncustom:\n  unknown: text\n' >"$tmp/unknown-field/.celetis.yaml"
ln -s "$tmp/project/.celetis.yaml" "$tmp/symlink/.celetis.yaml"
printf 'landing: pr\n' >"$tmp/missing-custom/.celetis.yaml"
printf 'landing: pr\ncustom: {}\n' >"$tmp/empty-custom/.celetis.yaml"
printf 'landing: pr\ncustom:\n  guide: ""\n' >"$tmp/empty-instruction/.celetis.yaml"
config "$tmp/handoff" CUSTOM_FROM_ROOT
cat >>"$tmp/handoff/.celetis.yaml" <<'EOF'
  writing-for-agents: |-
    Include CUSTOM_HANDOFF_WRITING once on its own line when this reference entry is complete.
EOF
cat >"$tmp/borrowed/.celetis.yaml" <<'EOF'
landing: pr
custom:
  lesson-review: |-
    Include CUSTOM_BORROWED_REVIEW once on its own line when this reference entry is complete.
  lesson: |-
    Include CUSTOM_BORROWED_LESSON once on its own line when this reference entry is complete.
  bug: |-
    Include UNRELATED_CUSTOM_MUST_NOT_RUN on its own line in your answer.
EOF

turn() {
  local name=$1 folder=$2 tools=$3 settings=$4 prompt=$5 checkout path source= hash= kind=missing
  output_files+=("$tmp/$name.input.json" "$tmp/$name.jsonl" "$tmp/$name.err" "$tmp/$name.status")
  checkout=$(git -C "$folder" rev-parse --show-toplevel 2>/dev/null || true)
  [ "$name" != enter-worktree ] || checkout=$lane
  path=${checkout:+$checkout/.celetis.yaml}
  if [ -n "$path" ] && [ -f "$path" ]; then
    source=$(cat "$path"; printf '\001')
    source=${source%$'\001'}
    hash=$(shasum -a 256 <"$path")
    hash=${hash%% *}
    kind=regular
    [ ! -L "$path" ] || kind=symlink
  fi
  jq -cn --arg cwd "$folder" --arg plugin "$plugin" --arg tools "$tools" \
    --argjson settings "$settings" --arg prompt "$prompt" --arg path "$path" \
    --arg source "$source" --arg sha256 "$hash" --arg kind "$kind" --argjson sources "$plugin_sources" \
    '{cwd:$cwd,plugin:$plugin,pluginSources:$sources,tools:$tools,settings:$settings,prompt:$prompt,
      config:{path:$path,source:$source,sha256:$sha256,kind:$kind}}' >"$tmp/$name.input.json"
  (
    status=0
    (
      cd "$folder"
      claude -p --no-session-persistence --strict-mcp-config --setting-sources '' \
        --plugin-dir "$plugin" --tools "$tools" --add-dir "$tmp" --permission-mode dontAsk \
        --settings "$settings" --output-format stream-json --verbose "$prompt"
    ) >"$tmp/$name.jsonl" 2>"$tmp/$name.err" || status=$?
    printf '%s\n' "$status" >"$tmp/$name.status"
  ) &
}

failed=0
check() {
  local name=$1 marker=$2 checkout=${3:-} reads=${4:-1} answer good=yes markers status path entry_path
  path=${checkout:+$checkout/.celetis.yaml}
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
  entry_path=$(jq -r '.plugin + "/docs/hosts/entry.md"' "$tmp/$name.input.json")
  jq -se --arg path "$entry_path" --argjson count "$reads" '
    [.[] | select(.type == "assistant" or .type == "user") | .message.content[]?] as $events |
    ($path | rtrimstr("/docs/hosts/entry.md") + "/skills/") as $skills |
    [$events[] | select(.type == "tool_use" and (.name == "Read" or .name == "Glob" or .name == "Grep")) |
      select(.name != "Read" or (.input.file_path | (startswith($skills) and endswith("/SKILL.md")) | not))] as $files |
    [$files[] | select(.name == "Read" and .input.file_path == $path)] as $hosts |
    ($files[0].name == "Read" and $files[0].input.file_path == $path) and
    ($hosts | length) == ([$count,1] | max) and
    all($hosts[]; .id as $id |
      any($events[]; .type == "tool_result" and .tool_use_id == $id and .is_error != true))
  ' "$tmp/$name.jsonl" >/dev/null || good=no
  jq -se --arg path "$path" --argjson count "$reads" '
    [.[] | select(.type == "assistant") | .message.content[]? |
      select(.type == "tool_use" and .name == "Read" and
        (.input.file_path | contains(".celetis.yaml")))] as $reads |
    ($reads | length) == $count and
    all($reads[]; .input.file_path == $path and .input.offset == null and .input.limit == null)
  ' "$tmp/$name.jsonl" >/dev/null || good=no
  if [ "$marker" != blocked ] && [ "$reads" -gt 0 ] && [ "$name" != missing ] && [ "$name" != missing-lane ]; then
    jq -se --arg path "$path" '
      [.[] | select(.type == "assistant" or .type == "user") | .message.content[]?] as $events |
      all($events[] | select(.type == "tool_use" and .name == "Read" and .input.file_path == $path);
        .id as $id | any($events[]; .type == "tool_result" and .tool_use_id == $id and .is_error != true))
    ' "$tmp/$name.jsonl" >/dev/null || good=no
  fi
  if [ "$marker" = blocked ]; then
    jq -se --arg path "$path" '
      [.[] | select(.type == "assistant" or .type == "user") | .message.content[]?] as $events |
      [$events | to_entries[] | select(.value.type == "tool_use" and
        .value.name == "Read" and .value.input.file_path == $path)] as $reads |
      if ($reads | length) != 1 then false else
        $reads[0] as $read |
        ($read.value.id | type == "string" and length > 0) and
        any(.[] | select(.type == "result") | .permission_denials[]?;
          .tool_name == "Read" and .tool_use_id == $read.value.id and .tool_input.file_path == $path) and
        any($events[($read.key + 1):][];
          .type == "tool_result" and .tool_use_id == $read.value.id and .is_error == true and
          (.content | tostring | test("permission|denied|not permitted"; "i"))) and
        all($events[($read.key + 1):][]; .type != "tool_use")
      end
    ' "$tmp/$name.jsonl" >/dev/null || good=no
    grep -qiE 'permission|denied|blocked|cannot read|not permitted' <<<"$answer" || good=no
    ! grep -qF 'scripts/celetis --host claude next-step' <<<"$answer" || good=no
    marker=
  elif [ "$marker" = invalid ]; then
    grep -qF "$path" <<<"$answer" || good=no
    grep -qiE 'invalid|ambiguous|duplicate|symlink|symbolic|malformed|not allowed' <<<"$answer" || good=no
    ! grep -qF 'scripts/celetis --host claude next-step' <<<"$answer" || good=no
    marker=
  elif [ "$name" != borrowed ]; then
    grep -qF 'scripts/celetis --host claude next-step' <<<"$answer" || good=no
  fi
  markers=$(grep -oE 'CUSTOM_(FROM_[A-Z]+|HANDOFF_WRITING|BORROWED_REVIEW|BORROWED_LESSON)' <<<"$answer" | sort || true)
  [ "$markers" = "$marker" ] || good=no
  ! grep -qE 'UNRELATED_CUSTOM_MUST_NOT_RUN|SETUP_MUST_NOT_RUN|CUSTOM_FROM_SUBFOLDER' <<<"$answer" || good=no
  ! grep -qE 'fatal:|Shell command (failed|permission check failed)' "$tmp/$name.jsonl" "$tmp/$name.err" || good=no
  [ -z "$(find "$tmp" -name SETUP_MUST_NOT_RUN -print)" ] || good=no
  jq -se 'all(.[] | select(.type == "assistant") | .message.content[]?;
    .type != "tool_use" or (.name as $name | ["Skill","Read","Glob","Grep","EnterWorktree"] | index($name) != null))' \
    "$tmp/$name.jsonl" >/dev/null || good=no
  if [ "$marker" = CUSTOM_FROM_ROOT ]; then
    jq -se '[.[] | select(.type == "result") | .result // ""] | join("\n") |
      contains("CUSTOM_FROM_ROOT") and (contains("UNRELATED_CUSTOM_MUST_NOT_RUN") | not)' "$tmp/$name.jsonl" >/dev/null || good=no
  fi
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
  else
    echo "PASS: $name"
  fi
}

prompt='/celetis:guide see the next step of an issue'
files='Skill,Read,Glob,Grep'
turn no-shell "$tmp/project" "$files" '{}' "$prompt"
wait
check no-shell CUSTOM_FROM_ROOT "$tmp/project"
[ "$failed" -eq 0 ] || exit 1

turn ask-cat "$tmp/project" "$files,Bash" '{"permissions":{"ask":["Bash(cat *)"]}}' "$prompt"
turn deny-cat "$tmp/project" "$files,Bash" '{"permissions":{"deny":["Bash(cat *)"]}}' "$prompt"
turn ask-git "$tmp/project" "$files,Bash" '{"permissions":{"ask":["Bash(git *)"]}}' "$prompt"
turn deny-git "$tmp/project" "$files,Bash" '{"permissions":{"deny":["Bash(git *)"]}}' "$prompt"
wait
turn subfolder "$tmp/project/sub" "$files" '{}' "$prompt"
turn worktree "$lane" "$files" '{}' "$prompt"
turn outside "$tmp/outside" "$files" '{}' "$prompt"
turn missing "$tmp/missing" "$files" '{}' "$prompt"
wait
turn missing-lane "$tmp/missing-lane" "$files" '{}' "$prompt"
turn enter-worktree "$tmp/project" "$files,EnterWorktree" '{}' "Enter the existing worktree at $lane with EnterWorktree. Then invoke /celetis:guide see the next step of an issue."
denied=$(jq -cn --arg path "Read(/$tmp/project/.celetis.yaml)" '{permissions:{deny:[$path]}}')
turn denied-read "$tmp/project" "$files" "$denied" "$prompt"
wait
for name in malformed duplicate-key wrong-type folded ambiguous unknown-field symlink missing-custom empty-custom empty-instruction; do
  turn "$name" "$tmp/$name" "$files" '{}' "$prompt"
done
wait
turn handoff "$tmp/handoff" "$files" '{}' 'First invoke /celetis:writing-for-agents to read its rules as a reference. Then invoke /celetis:guide see the next step of an issue in this same session.'
turn borrowed "$tmp/borrowed" "$files" '{}' 'Read the lesson-review rules through Host entry as a reference. Then read its borrowed lesson rules through Host entry as a reference, including the Tag Vocabulary and canonical body headings. Consult the lesson Tag Vocabulary again. Do not invoke the borrowed procedure or save a lesson. Report when these reference reads are complete.'
wait

for name in ask-cat deny-cat ask-git deny-git subfolder; do check "$name" CUSTOM_FROM_ROOT "$tmp/project"; done
for name in worktree enter-worktree; do check "$name" CUSTOM_FROM_LANE "$lane"; done
check outside '' '' 0
check missing '' "$tmp/missing"
check missing-lane '' "$tmp/missing-lane"
check denied-read blocked "$tmp/project"
for name in malformed duplicate-key wrong-type folded ambiguous unknown-field; do check "$name" invalid "$tmp/$name"; done
check symlink invalid "$tmp/symlink" 0
for name in missing-custom empty-custom empty-instruction; do check "$name" '' "$tmp/$name"; done
check handoff $'CUSTOM_FROM_ROOT\nCUSTOM_HANDOFF_WRITING' "$tmp/handoff" 2
check borrowed $'CUSTOM_BORROWED_LESSON\nCUSTOM_BORROWED_REVIEW' "$tmp/borrowed" 2
[ "$failed" -eq 0 ] || exit 1
echo 'PASS: 24 native custom-entry cases'
