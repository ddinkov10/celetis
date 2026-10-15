#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat >"$tmp/bin/claude" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
settings=
fixture_root=
prompt=
while [ $# -gt 0 ]; do
  case $1 in
    --settings) settings=$2; shift ;;
    --add-dir) fixture_root=$2; shift ;;
  esac
  prompt=$1
  shift
done
printf 'unrelated fixture file\n' >"$fixture_root/not-evidence"
path="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.claude/celetis-flow/custom/guide.md"
answer='scripts/celetis --host claude next-step'
name=Read
if [[ $prompt == 'Enter the existing worktree at '* ]]; then
  path=${prompt#Enter the existing worktree at }
  path=${path%% with EnterWorktree.*}
  name=EnterWorktree
  answer="$answer"$'\nCUSTOM_FROM_LANE'
elif [ -f "$path" ]; then
  answer="$answer"$'\n'"$(sed -n 's/^Include \(CUSTOM_FROM_[A-Z]*\) .*/\1/p' "$path")"
fi
denied=$(jq -r '.permissions.deny[]? | select(startswith("Read("))' <<<"$settings")
jq -cn --arg path "$path" --arg name "$name" --arg answer "$answer" \
  --arg denied "$denied" --arg fault "${CUSTOM_FAULT:-}" '
  (if $name == "Read" then {file_path:$path} else {path:$path} end) as $input |
  {type:"assistant", message:{role:"assistant",content:[
    {type:"tool_use",id:"read-1",name:$name,input:$input}
  ]},parent_tool_use_id:null} as $call |
  {type:"user",message:{role:"user",content:[
    {type:"tool_result",tool_use_id:"read-1",content:"fixture file"}
  ]},parent_tool_use_id:null} as $reply |
  {type:"result",subtype:"success",is_error:false,result:$answer,permission_denials:[]} as $result |
  if $denied == "" then $call,$reply,$result else
    ($reply | .message.content[0] += {is_error:true,content:"Permission to use Read has been denied."}) as $error |
    ($result | .result = "The custom read was denied. Entry stopped." |
      .permission_denials = [{tool_name:"Read",tool_use_id:"read-1",tool_input:$input}]) as $stop |
    ([$call,$error,$stop] |
      if $fault == "unrelated-block" then
        [($result | .result = "Cannot read the setup file. Entry stopped.")]
      elif $fault == "wrong-path" then
        .[0].message.content[0].input.file_path += ".other" |
        .[2].permission_denials[0].tool_input.file_path += ".other"
      elif $fault == "missing-denial" then .[2].permission_denials = []
      elif $fault == "wrong-denial-id" then .[2].permission_denials[0].tool_use_id = "other-read"
      elif $fault == "wrong-result-id" then .[1].message.content[0].tool_use_id = "other-read"
      elif $fault == "read-succeeded" then .[1] = $reply
      elif $fault == "later-read" or $fault == "later-grep" then
        .[0:2] + [($call | .message.content[0] =
          {type:"tool_use",id:"read-2",name:(if $fault == "later-read" then "Read" else "Grep" end),
           input:{file_path:$path,path:$path,pattern:".*"}})] + .[2:]
      else . end)[]
  end'
MOCK
chmod +x "$tmp/bin/claude"
fails=0
if PATH="$tmp/bin:$PATH" /bin/bash tests/manual/custom-part.test.sh --output-dir "$tmp/valid-evidence" >"$tmp/valid" 2>&1; then
  echo 'ok: native custom-read fixtures pass'
else
  echo 'FAIL: rejected a valid custom-read fixture'; cat "$tmp/valid"; fails=$((fails + 1))
fi
streams=("$tmp/valid-evidence/"*.jsonl)
if [ "${#streams[@]}" -eq 12 ] && [ -f "$tmp/valid-evidence/denied-read.input.json" ] &&
    jq -e '.prompt == "/celetis:guide see the next step of an issue" and
      .tools == "Skill,Read,Glob,Grep" and (.settings.permissions.deny | length) == 1' \
      "$tmp/valid-evidence/denied-read.input.json" >/dev/null &&
    [ "$(cat "$tmp/valid-evidence/denied-read.status")" = 0 ]; then
  echo 'ok: keeps the twelve case streams and denied-read inputs after PASS'
else
  echo 'FAIL: lost evidence after PASS'; fails=$((fails + 1))
fi
if [ ! -e "$tmp/valid-evidence/not-evidence" ]; then
  echo 'ok: keeps only generated case evidence'
else
  echo 'FAIL: copied an unrelated fixture file'; fails=$((fails + 1))
fi
for fault in unrelated-block wrong-path missing-denial wrong-denial-id wrong-result-id read-succeeded later-read later-grep; do
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
[ "$fails" -eq 0 ]
echo PASS
