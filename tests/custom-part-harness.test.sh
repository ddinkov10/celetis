#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat >"$tmp/bin/claude" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = --version ]; then echo "custom fixture"; exit 0; fi
settings=
fixture_root=
plugin=
prompt=
while [ $# -gt 0 ]; do
  case $1 in
    --settings) settings=$2; shift ;;
    --plugin-dir) plugin=$2; shift ;;
    --add-dir) fixture_root=$2; shift ;;
  esac
  prompt=$1
  shift
done
printf 'unrelated fixture file\n' >"$fixture_root/not-evidence"
for suffix in input.json jsonl err status; do
  printf 'unrelated lookalike\n' >"$fixture_root/not-evidence.$suffix"
done
checkout=$(git rev-parse --show-toplevel 2>/dev/null || true)
path=${checkout:+$checkout/.celetis.yaml}
answer='scripts/celetis --host claude next-step'
count=1
entered=
if [[ $prompt == 'Enter the existing worktree at '* ]]; then
  entered=${prompt#Enter the existing worktree at }
  entered=${entered%% with EnterWorktree.*}
  path="$entered/.celetis.yaml"
fi
source_text=
[ -z "$path" ] || [ ! -f "$path" ] || source_text=$(cat "$path")
if [[ $prompt == 'First invoke /celetis:writing-for-agents'* ]]; then
  count=2
  answer="$answer"$'\nCUSTOM_HANDOFF_WRITING'
elif [[ $prompt == 'Read the lesson-review rules'* ]]; then
  count=2
  answer="$answer"$'\nCUSTOM_BORROWED_REVIEW\nCUSTOM_BORROWED_LESSON'
fi
case $source_text in
  *'Include CUSTOM_FROM_ROOT '*) answer="$answer"$'\nCUSTOM_FROM_ROOT' ;;
  *'Include CUSTOM_FROM_LANE '*) answer="$answer"$'\nCUSTOM_FROM_LANE' ;;
esac
case ${checkout##*/} in
  malformed|duplicate-key|wrong-type|folded|ambiguous|unknown-field|symlink)
    answer="Invalid $path at custom.guide. Entry stopped." ;;
esac
[ -z "$path" ] || count=${count:-1}
[ -n "$path" ] || count=0
if [ "${checkout##*/}" = symlink ]; then
  count=0
  [ "${CUSTOM_FAULT:-}" != symlink-followed ] || count=1
fi
denied=$(jq -r '.permissions.deny[]? | select(startswith("Read("))' <<<"$settings")
jq -cn --arg path "$path" --arg answer "$answer" --arg entered "$entered" --arg plugin "$plugin" \
  --arg source "$source_text" --argjson count "$count" \
  --arg denied "$denied" --arg fault "${CUSTOM_FAULT:-}" '
  {type:"assistant",message:{role:"assistant",content:[
    {type:"tool_use",id:"host-1",name:"Read",input:{file_path:($plugin+"/docs/hosts/entry.md")}}
  ]},parent_tool_use_id:null} as $host_call |
  {type:"user",message:{role:"user",content:[
    {type:"tool_result",tool_use_id:"host-1",content:"Host entry"}
  ]},parent_tool_use_id:null} as $host_reply |
  {file_path:$path} as $input |
  {type:"assistant", message:{role:"assistant",content:[
    {type:"tool_use",id:"read-1",name:"Read",input:$input}
  ]},parent_tool_use_id:null} as $call |
  {type:"user",message:{role:"user",content:[
    {type:"tool_result",tool_use_id:"read-1",content:$source}
  ]},parent_tool_use_id:null} as $reply |
  {type:"result",subtype:"success",is_error:false,result:$answer,permission_denials:[]} as $result |
  if $denied == "" then
    ([if $entered != "" then
        ($call | .message.content[0] = {type:"tool_use",id:"enter-1",name:"EnterWorktree",input:{path:$entered}}),
        ($reply | .message.content[0].tool_use_id = "enter-1")
      else empty end] +
      [range(0;([$count,1]|max)) as $i |
        ($host_call | .message.content[0].id = "host-\($i+1)"),
        ($host_reply | .message.content[0].tool_use_id = "host-\($i+1)"),
        (if $i < $count then ($call | .message.content[0].id = "read-\($i+1)"),
        ($reply | .message.content[0].tool_use_id = "read-\($i+1)") else empty end)] + [$result] |
      if $fault == "bootstrap-wrong-path" then
        map(if .type == "assistant" and .message.content[0].input.file_path == ($plugin+"/docs/hosts/entry.md") then .message.content[0].input.file_path = $plugin+"/skills/docs/hosts/entry.md" else . end)
      elif $fault == "bootstrap-product-skill" then
        [($call | .message.content[0] = {type:"tool_use",id:"scan-1",name:"Read",input:{file_path:(($path|rtrimstr("/.celetis.yaml"))+"/SKILL.md")}})] + .
      elif $fault == "bootstrap-product-first" then
        [($call | .message.content[0] = {type:"tool_use",id:"scan-1",name:"Glob",input:{path:($path|rtrimstr("/.celetis.yaml")),pattern:".git"}})] + .
      elif $fault == "success-missing-result" then map(select(.type != "user"))
      elif $fault == "success-result-error" then map(if .type == "user" then .message.content[0].is_error = true else . end)
      elif $fault == "success-wrong-path" then
        map(if .type == "assistant" then .message.content[0].input.file_path += ".other" else . end)
      elif $fault == "success-extra-read" then [$call,$reply] + .
      elif $fault == "success-unrelated" then map(if .type == "result" then .result += "\nUNRELATED_CUSTOM_MUST_NOT_RUN" else . end)
      elif $fault == "success-setup" then map(if .type == "result" then .result += "\nSETUP_MUST_NOT_RUN" else . end)
      elif $fault == "invalid-continues" and ($answer | startswith("Invalid ")) then map(if .type == "result" then .result = "scripts/celetis --host claude next-step" else . end)
      elif $fault == "borrowed-reread" and ($answer | contains("CUSTOM_BORROWED_REVIEW")) then [$call,$reply] + .
      else . end)[]
  else
    ($reply | .message.content[0] += {is_error:true,content:("Permission to use Read has been denied for " + $path)}) as $error |
    ($result | .result = "The config read was denied. Entry stopped." |
      .permission_denials = [{tool_name:"Read",tool_use_id:"read-1",tool_input:$input}]) as $stop |
    ([$host_call,$host_reply] + ([$call,$error,$stop] |
      if $fault == "unrelated-block" then
        [($result | .result = "Cannot read the setup file. Entry stopped.")]
      elif $fault == "wrong-path" then
        .[0].message.content[0].input.file_path += ".other" |
        .[2].permission_denials[0].tool_input.file_path += ".other"
      elif $fault == "missing-denial" then .[2].permission_denials = []
      elif $fault == "wrong-denial-id" then .[2].permission_denials[0].tool_use_id = "other-read"
      elif $fault == "wrong-result-id" then .[1].message.content[0].tool_use_id = "other-read"
      elif $fault == "missing-error" then .[1].message.content[0].content = "unrelated error"
      elif $fault == "read-succeeded" then .[1] = $reply
      elif $fault == "later-read" or $fault == "later-grep" or $fault == "later-shell" then
        .[0:2] + [($call | .message.content[0] =
          {type:"tool_use",id:"read-2",name:(if $fault == "later-read" then "Read" elif $fault == "later-grep" then "Grep" else "Bash" end),
           input:{file_path:$path,path:$path,pattern:".*",command:("cat " + $path)}})] + .[2:]
      else . end))[]
  end'
[ "${CUSTOM_FAULT:-}" != client-exit ] || exit 7
MOCK
chmod +x "$tmp/bin/claude"
fails=0
if PATH="$tmp/bin:$PATH" /bin/bash tests/manual/custom-part.test.sh --output-dir "$tmp/valid-evidence" >"$tmp/valid" 2>&1; then
  echo 'ok: native custom-read fixtures pass'
else
  echo 'FAIL: rejected a valid custom-read fixture'; cat "$tmp/valid"; fails=$((fails + 1))
fi
streams=("$tmp/valid-evidence/"*.jsonl)
if [ "${#streams[@]}" -eq 24 ] && [ -f "$tmp/valid-evidence/denied-read.input.json" ] &&
    jq -e '.prompt == "/celetis:guide see the next step of an issue" and
      .tools == "Skill,Read,Glob,Grep" and (.settings.permissions.deny | length) == 1' \
      "$tmp/valid-evidence/denied-read.input.json" >/dev/null &&
    [ "$(cat "$tmp/valid-evidence/denied-read.status")" = 0 ]; then
  echo 'ok: keeps the twenty-four case streams and denied-read inputs after PASS'
else
  echo 'FAIL: lost evidence after PASS'; fails=$((fails + 1))
fi
for fault in unrelated-block wrong-path missing-denial wrong-denial-id wrong-result-id missing-error read-succeeded later-read later-grep later-shell; do
  if CUSTOM_FAULT=$fault PATH="$tmp/bin:$PATH" /bin/bash tests/manual/custom-part.test.sh --output-dir "$tmp/$fault-evidence" >"$tmp/$fault" 2>&1; then
    echo "FAIL: accepted $fault"; fails=$((fails + 1))
  elif grep -q '^FAIL: denied-read$' "$tmp/$fault" && [ "$(grep -c '^FAIL:' "$tmp/$fault")" -eq 1 ]; then
    echo "ok: rejects $fault"
  else
    echo "FAIL: $fault failed outside denied-read"; cat "$tmp/$fault"; fails=$((fails + 1))
  fi
done
if [ -f "$tmp/unrelated-block-evidence/denied-read.jsonl" ] &&
    [ -f "$tmp/unrelated-block-evidence/denied-read.err" ] &&
    [ -f "$tmp/unrelated-block-evidence/denied-read.input.json" ] &&
    [ "$(cat "$tmp/unrelated-block-evidence/denied-read.status")" = 0 ]; then
  echo 'ok: keeps evidence after checker failure'
else
  echo 'FAIL: lost evidence after checker failure'; fails=$((fails + 1))
fi
for result in valid unrelated-block; do
  files=("$tmp/$result-evidence/"*)
  good=yes
  [ "${#files[@]}" -eq 97 ] || good=no
  for name in no-shell ask-cat deny-cat ask-git deny-git subfolder worktree outside missing missing-lane enter-worktree denied-read malformed duplicate-key wrong-type folded ambiguous unknown-field symlink missing-custom empty-custom empty-instruction handoff borrowed; do
    for suffix in input.json jsonl err status; do
      [ -f "$tmp/$result-evidence/$name.$suffix" ] || good=no
    done
  done
  if [ "$good" = yes ]; then
    echo "ok: $result keeps exactly the 97 generated files"
  else
    echo "FAIL: $result evidence includes unrelated files or omits generated files"; fails=$((fails + 1))
  fi
done
for fault in bootstrap-wrong-path bootstrap-product-first bootstrap-product-skill success-wrong-path success-extra-read success-unrelated success-setup success-missing-result success-result-error invalid-continues borrowed-reread symlink-followed; do
  case $fault in
    success-*|bootstrap-*) target=no-shell ;;
    invalid-continues) target=malformed ;;
    borrowed-reread) target=borrowed ;;
    symlink-followed) target=symlink ;;
  esac
  if CUSTOM_FAULT=$fault PATH="$tmp/bin:$PATH" /bin/bash tests/manual/custom-part.test.sh --output-dir "$tmp/$fault-evidence" >"$tmp/$fault" 2>&1; then
    echo "FAIL: accepted $fault"; fails=$((fails + 1))
  elif grep -q "^FAIL: $target$" "$tmp/$fault"; then
    echo "ok: rejects $fault"
  else
    echo "FAIL: $fault did not reach the checker"; cat "$tmp/$fault"; fails=$((fails + 1))
  fi
done
if jq -e '.config.path == (.cwd + "/.celetis.yaml") and
    (.config.source | contains("custom:") and contains("UNRELATED_CUSTOM_MUST_NOT_RUN") and contains("SETUP_MUST_NOT_RUN")) and
    (.config.sha256 | test("^[0-9a-f]{64}$")) and (.pluginSources | length) >= 5' "$tmp/valid-evidence/no-shell.input.json" >/dev/null &&
    [ -f "$tmp/valid-evidence/version" ]; then
  echo 'ok: preserves YAML sources, paths, hashes, restrictions, and runtime version'
else
  echo 'FAIL: missing native-entry source evidence'; fails=$((fails + 1))
fi
status=0
CUSTOM_FAULT=client-exit PATH="$tmp/bin:$PATH" /bin/bash tests/manual/custom-part.test.sh \
  --output-dir "$tmp/client-exit-evidence" >"$tmp/client-exit" 2>&1 || status=$?
files=("$tmp/client-exit-evidence/"*)
if [ "$status" -eq 2 ] &&
    grep -q '^ERROR: no-shell: client exited with status 7$' "$tmp/client-exit" &&
    [ "${#files[@]}" -eq 5 ] &&
    [ "$(cat "$tmp/client-exit-evidence/no-shell.status")" = 7 ] &&
    [ -f "$tmp/client-exit-evidence/no-shell.err" ] &&
    [ -f "$tmp/client-exit-evidence/no-shell.input.json" ] &&
    jq -se 'any(.[]; .type == "result" and .is_error == false and
      (.result | contains("CUSTOM_FROM_ROOT")))' "$tmp/client-exit-evidence/no-shell.jsonl" >/dev/null; then
  echo 'ok: rejects a failed client with valid text and keeps its five generated artifacts'
else
  echo 'FAIL: accepted a failed client or lost its evidence'; cat "$tmp/client-exit"; fails=$((fails + 1))
fi
checker="$tmp/checker"
sed -n '/^check() {$/,/^}$/p' tests/manual/custom-part.test.sh >"$checker"
for fault in missing empty word negative range multiline; do
  folder="$tmp/status-$fault"
  mkdir "$folder"
  cp "$tmp/valid-evidence/"no-shell.* "$folder/"
  expected='invalid client exit status'
  case $fault in
    missing) rm "$folder/no-shell.status"; expected='missing client exit status' ;;
    empty) : >"$folder/no-shell.status" ;;
    word) printf 'status=0\n' >"$folder/no-shell.status" ;;
    negative) printf '%s\n' -1 >"$folder/no-shell.status" ;;
    range) printf '256\n' >"$folder/no-shell.status" ;;
    multiline) printf '0\n7\n' >"$folder/no-shell.status" ;;
  esac
  status=0
  (
    tmp=$folder
    failed=0
    source "$checker"
    check no-shell CUSTOM_FROM_ROOT "$folder" 1
  ) >"$tmp/status-$fault.log" 2>&1 || status=$?
  if [ "$status" -eq 2 ] && grep -q "^ERROR: no-shell: $expected$" "$tmp/status-$fault.log"; then
    echo "ok: rejects $fault client status"
  else
    echo "FAIL: accepted $fault client status"; cat "$tmp/status-$fault.log"; fails=$((fails + 1))
  fi
done
[ "$fails" -eq 0 ]
echo PASS
