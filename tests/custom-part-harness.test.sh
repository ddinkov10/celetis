#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
root=$PWD
. "$root/tests/lib/pool.sh"
unset CUSTOM_PART_CASES
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat >"$tmp/bin/claude" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = --version ]; then echo "custom fixture"; exit 0; fi
[ -z "${CUSTOM_CALLS:-}" ] || printf 'called\n' >>"$CUSTOM_CALLS"
settings=
fixture_root=
plugin=
prompt=
input_format=
recording='For test evidence only, emit each actual lstat result as JSON with its absolute path and boolean file, directory, and symlink fields from isFile(), isDirectory(), and isSymbolicLink() on that result. For an actual ENOENT error, emit its exact path and code.'
while [ $# -gt 0 ]; do
  case $1 in
    --settings) settings=$2; shift ;;
    --plugin-dir) plugin=$2; shift ;;
    --add-dir) fixture_root=$2; shift ;;
    --input-format) input_format=$2; shift ;;
  esac
  prompt=$1
  shift
done
if [ "$input_format" = stream-json ]; then
  IFS= read -r first
  prompt=$(jq -r '.message.content' <<<"$first")
  entered=${prompt#Enter the existing worktree at }
  entered=${entered%% with EnterWorktree.*}
  if [ "${CUSTOM_FAULT:-}" != worktree-no-native-transition ]; then
    jq -cn --arg path "$entered" '
      {type:"assistant",session_id:"fixture-session",message:{role:"assistant",content:[{type:"tool_use",id:"enter-setup",name:"EnterWorktree",input:{path:$path}}]}},
      {type:"user",session_id:"fixture-session",message:{role:"user",content:[{type:"tool_result",tool_use_id:"enter-setup",content:$path}]},tool_use_result:{worktreePath:$path,worktreeBranch:"lane"}}'
  fi
  if [ "${CUSTOM_FAULT:-}" = worktree-pre-entry-read ]; then
    jq -cn --arg path "$PWD/.celetis.yaml" '{type:"assistant",message:{role:"assistant",content:[{type:"tool_use",id:"early-read",name:"Read",input:{file_path:$path}}]}}'
  fi
  jq -cn '{type:"result",subtype:"success",is_error:false,result:"Entered lane.",session_id:"fixture-session"}'
  IFS= read -r second || exit 2
  [ "$(jq -r '.message.content' <<<"$second")" = $'/celetis:guide see the next step of an issue\n\n'"$recording" ] || exit 2
elif [[ $prompt != *"$recording" ]]; then
  exit 2
fi
printf 'unrelated fixture file\n' >"$fixture_root/not-evidence"
for suffix in input.json jsonl err status; do
  printf 'unrelated lookalike\n' >"$fixture_root/not-evidence.$suffix"
done
checkout=$(git rev-parse --show-toplevel 2>/dev/null || true)
path=${checkout:+$checkout/.celetis.yaml}
answer='scripts/celetis --agent claude next-step'
count=1
entered=
if [[ $prompt == 'Enter the existing worktree at '* ]]; then
  entered=${prompt#Enter the existing worktree at }
  entered=${entered%% with EnterWorktree.*}
  path="$entered/.celetis.yaml"
fi
source_text=
if [ -n "$path" ] && [ -f "$path" ]; then
  source_text=$(cat "$path"; printf '\001')
  source_text=${source_text%$'\001'}
fi
kind=missing
git_kind=directory
if [ -n "$path" ]; then
  [ ! -f "$path" ] || kind=file
  [ ! -L "$path" ] || kind=symlink
  [ ! -f "${path%/.celetis.yaml}/.git" ] || git_kind=file
fi
if [[ $prompt == 'First invoke /celetis:writing-for-agents'* ]]; then
  count=2
  answer="$answer"$'\nCUSTOM_HANDOFF_WRITING'
elif [[ $prompt == '/celetis:lesson-review '* ]]; then
  count=2
  answer="$answer"$'\nCUSTOM_BORROWED_REVIEW\nCUSTOM_BORROWED_LESSON'
fi
case $source_text in
  *'Include CUSTOM_FROM_ROOT '*) answer="$answer"$'\nCUSTOM_FROM_ROOT' ;;
  *'Include CUSTOM_FROM_LANE '*) answer="$answer"$'\nCUSTOM_FROM_LANE' ;;
esac
case ${checkout##*/} in
  malformed|duplicate-key|wrong-type|folded|ambiguous|unknown-field|symlink)
    field=custom.guide
    case ${checkout##*/} in malformed|ambiguous|symlink) field='<document>' ;; unknown-field) field=custom.unknown ;; esac
    answer="Invalid $path at $field. Entry stopped."
    [ "${checkout##*/}:${CUSTOM_INVALID_STYLE:-}" != malformed:syntax ] || answer="Config $path has a syntax error at $field. Entry stopped."
    [ "${checkout##*/}" != folded ] || answer="Config $path failed validation at $field. Entry stopped." ;;
esac
[ -z "$path" ] || count=${count:-1}
[ -n "$path" ] || count=0
[ "$kind" != missing ] || count=0
if [ "${checkout##*/}" = symlink ]; then
  count=0
  [ "${CUSTOM_FAULT:-}" != symlink-followed ] || count=1
fi
denied=$(jq -r '.permissions.deny[]? | select(startswith("Read("))' <<<"$settings")
jq -cn --arg path "$path" --arg answer "$answer" --arg entered "$entered" --arg plugin "$plugin" \
  --arg source "$source_text" --argjson count "$count" --arg kind "$kind" --arg git_kind "$git_kind" --arg style "${CUSTOM_METADATA_STYLE:-}" \
  --arg denied "$denied" --arg fault "${CUSTOM_FAULT:-}" --arg input_format "$input_format" --arg binding "${CUSTOM_BOUND_ROOT:-}" '
  def metadata($path; $kind; $id):
    (if ($fault | startswith("metadata-relative-")) then "relative" else $style end) as $style |
    ($path | split("/") | last) as $name |
    ($path | rtrimstr("/" + $name)) as $base |
    {type:"assistant",message:{role:"assistant",content:[
      {type:"tool_use",id:$id,name:"mcp__node_repl__js",input:{code:
        (if $style == "relative" or $style == "relative-template" or $style == "relative-map" then
          "var fs=await import(\"node:fs/promises\"); var root=" + ($base|tojson) + "; var out={}; for (const p of [" + ($name|tojson) + "]) { try { var s=await fs.lstat(" +
          (if $style == "relative-template" then "`${root}/${p}`" else "root+\"/\"+p" end) +
          "); out[p]=" + (if $style == "relative-map" then "s.isSymbolicLink()?\"symlink\":s.isFile()?\"file\":s.isDirectory()?\"dir\":\"other\"" else "{file:s.isFile(),dir:s.isDirectory(),link:s.isSymbolicLink()}" end) + "; } catch(e) { out[p]=e.code; } } nodeRepl.write(JSON.stringify(out));"
        else "try { var metadata = await (await import(\"node:fs/promises\")).lstat(" + ($path|tojson) + "); nodeRepl.write(JSON.stringify(" +
          (if $style == "path-map" then "{[" + ($path|tojson) + "]:metadata.isSymbolicLink()?\"symlink\":metadata.isFile()?\"file\":metadata.isDirectory()?\"dir\":\"other\"}"
           elif $style == "path-object" then "{[" + ($path|tojson) + "]:{file:metadata.isFile(),dir:metadata.isDirectory(),link:metadata.isSymbolicLink()}}"
           elif $style == "tuple" then "[" + ($base|tojson) + "," + ($name|tojson) + ",metadata.isSymbolicLink()?\"symlink\":metadata.isFile()?\"file\":metadata.isDirectory()?\"dir\":\"other\"]"
           else "{path:" + ($path|tojson) + ",file:metadata.isFile(),directory:metadata.isDirectory(),symlink:metadata.isSymbolicLink()}" end) +
          ")); } catch(error) { nodeRepl.write(JSON.stringify(" +
          (if $style == "path-map" then "{[" + ($path|tojson) + "]:\"error: \"+error.code}"
           elif $style == "path-object" then "{[" + ($path|tojson) + "]:{code:error.code}}"
           elif $style == "tuple" then "[" + ($base|tojson) + "," + ($name|tojson) + ",error.code]"
           else "{path:" + ($path|tojson) + ",code:error.code}" end) + ")); }" end)}}
    ]},parent_tool_use_id:null},
    {type:"user",message:{role:"user",content:[
      {type:"tool_result",tool_use_id:$id,content:[{type:"text",text:
        (if $style == "relative-map" then {($name):(if $kind == "directory" then "dir" elif $kind == "missing" then "ENOENT" else $kind end)}
         elif $style == "relative" or $style == "relative-template" then
           {($name):(if $kind == "missing" then "ENOENT" else {file:($kind == "file"),dir:($kind == "directory"),link:($kind == "symlink")} end)}
         elif $style == "path-map" then {($path):(if $kind == "directory" then "dir" elif $kind == "missing" then "error: ENOENT" else $kind end)}
         elif $style == "path-object" then {($path):(if $kind == "missing" then {code:"ENOENT"} else {file:($kind == "file"),dir:($kind == "directory"),link:($kind == "symlink")} end)}
         elif $style == "tuple" then [$base,$name,(if $kind == "directory" then "dir" elif $kind == "missing" then "ENOENT" else $kind end)]
         elif $kind == "missing" then {path:$path,code:"ENOENT"}
         else {path:$path,file:($kind == "file"),directory:($kind == "directory"),symlink:($kind == "symlink")} end | tojson)}]}
    ]},parent_tool_use_id:null};
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
  ]},parent_tool_use_id:null,tool_use_result:{type:"text",file:{filePath:$path,content:$source,startLine:1,numLines:1,totalLines:1}}} as $reply |
  {type:"result",subtype:"success",is_error:false,result:($answer | sub("\nCUSTOM_HANDOFF_WRITING"; "")),permission_denials:[],session_id:"fixture-session"} as $result |
  if $denied == "" then
    ([if $entered != "" and $input_format != "stream-json" then
        ($call | .message.content[0] = {type:"tool_use",id:"enter-1",name:"EnterWorktree",input:{path:$entered}}),
        ($reply | .message.content[0].tool_use_id = "enter-1")
      else empty end] +
      [range(0;([$count,1]|max)) as $i |
        (if $i == 1 then
          ($call | .message.content[0] = {type:"tool_use",id:"skill-2",name:"Read",input:{file_path:($plugin+"/skills/"+(if $answer | contains("CUSTOM_BORROWED_REVIEW") then "lesson" else "guide" end)+"/SKILL.md")}}),
          ($reply | .message.content[0] = {type:"tool_result",tool_use_id:"skill-2",content:"Bundled skill"} | del(.tool_use_result))
        else empty end),
        (if $i == 0 or ($answer | contains("CUSTOM_BORROWED_REVIEW") | not) then
          ($host_call | .message.content[0].id = "host-\($i+1)"),
          ($host_reply | .message.content[0].tool_use_id = "host-\($i+1)" |
            if $i == 0 then . else .tool_use_result = {type:"file_unchanged",file:{filePath:($plugin+"/docs/hosts/entry.md")}} end) else empty end),
        (if $path != "" then
          (if $binding == "only-config" and $entered != "" then empty else metadata(($path|rtrimstr("/.celetis.yaml"))+"/.git"; $git_kind; "git-\($i+1)") end),
          metadata($path; $kind; "meta-\($i+1)") else empty end),
        (if $i < $count then ($call | .message.content[0].id = "read-\($i+1)"),
        ($reply | .message.content[0].tool_use_id = "read-\($i+1)" |
          if $i == 0 then . else
            .tool_use_result = {type:"file_unchanged",file:{filePath:$path}} |
            .message.content[0].content = "Wasted call — file unchanged since your last Read. Refer to that earlier tool_result instead."
          end) else empty end),
        (if $i == 0 and ($answer | contains("CUSTOM_HANDOFF_WRITING")) then
          {type:"assistant",message:{role:"assistant",content:[{type:"text",text:"CUSTOM_HANDOFF_WRITING"}]}}
        else empty end)] + [$result] |
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
      elif $fault == "startup-text" or ($fault == "startup-optional-text" and $kind == "missing" and $path != "") then
        .[0:2] + [{type:"assistant",message:{role:"assistant",content:[{type:"text",text:"Now checking startup metadata."}]}}] + .[2:]
      elif ($fault == "startup-borrowed-text" and ($answer | contains("CUSTOM_BORROWED_REVIEW"))) or
           ($fault == "startup-handoff-text" and ($answer | contains("CUSTOM_HANDOFF_WRITING"))) then
        . as $rows | (to_entries | map(select(.value.message.content[0].id == "read-2"))[0].key) as $at |
        $rows[0:$at] + [{type:"assistant",message:{role:"assistant",content:[{type:"text",text:"Now reading the second entry config."}]}}] + $rows[$at:]
      elif $fault == "git-directory-read" then .[0:4] + [
        ($call | .message.content[0].input.file_path = (($path|rtrimstr("/.celetis.yaml"))+"/.git")),
        ($reply | .message.content[0] += {is_error:true,content:"EISDIR"})] + .[4:]
      elif $fault == "git-file-early-read" and $entered != "" then .[0:2] + [
        ($call | .message.content[0].input.file_path = ($entered+"/.git")), $reply] + .[2:]
      elif $fault == "git-file-missing-kind" and $entered != "" then
        map(if .message.content[0].tool_use_id == "git-1" then .message.content[0].content[0].text |= (fromjson | del(.file) | tojson) else . end) |
        .[0:4] + [($call | .message.content[0].input.file_path = ($entered+"/.git")), $reply] + .[4:]
      elif $fault == "metadata-missing" then map(select(.message.content[0].id != "meta-1" and .message.content[0].tool_use_id != "meta-1"))
      elif $fault == "metadata-missing-result" then map(select(.message.content[0].tool_use_id != "meta-1"))
      elif $fault == "metadata-wrong-id" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].tool_use_id = "meta-other" else . end)
      elif $fault == "metadata-wrong-path" then map(
        if .message.content[0].id == "meta-1" then .message.content[0].input.code |= (split($path)|join($path+".other"))
        elif .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text |= (fromjson | .path += ".other" | tojson) else . end)
      elif $fault == "metadata-string-only" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ("lstat " + $path) else . end)
      elif $fault == "metadata-map-wrong-path" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ({($path+".other"):"file"}|tojson) else . end)
      elif $fault == "metadata-map-missing-path" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ({}|tojson) else . end)
      elif $fault == "metadata-map-wrong-kind" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ({($path):"dir"}|tojson) else . end)
      elif $fault == "metadata-map-missing-kind" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ({($path):null}|tojson) else . end)
      elif $fault == "metadata-map-symlink" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ({($path):"symlink"}|tojson) else . end)
      elif $fault == "metadata-relative-wrong-base" or $fault == "metadata-relative-decoy-root" then map(if .message.content[0].id == "meta-1" then
        .message.content[0].input.code |= (split($path|rtrimstr("/.celetis.yaml")) | join("/wrong-checkout")) |
        if $fault == "metadata-relative-decoy-root" then .message.content[0].input.code += (" var decoy=" + ($path|rtrimstr("/.celetis.yaml")|tojson) + ";") else . end
        else . end)
      elif $fault == "metadata-relative-wrong-path" then map(if .message.content[0].id == "meta-1" then .message.content[0].input.code |= (split(".celetis.yaml")|join("other.yaml")) else . end)
      elif $fault == "metadata-relative-wrong-operand" then map(if .message.content[0].id == "meta-1" then .message.content[0].input.code |= (split("root+\"/\"+p")|join("\"/wrong-checkout/\"+p")) else . end)
      elif $fault == "metadata-relative-wrong-kind" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text |= (fromjson | .[".celetis.yaml"].file = false | tojson) else . end)
      elif $fault == "metadata-relative-missing-link" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text |= (fromjson | del(.[".celetis.yaml"].link) | tojson) else . end)
      elif $fault == "metadata-relative-symlink" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text |= (fromjson | .[".celetis.yaml"].link = true | tojson) else . end)
      elif $fault == "metadata-object-wrong-path" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ({($path+".other"):{file:true,link:false}}|tojson) else . end)
      elif $fault == "metadata-object-missing-link" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ({($path):{file:true}}|tojson) else . end)
      elif $fault == "metadata-object-symlink" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ({($path):{file:true,link:true}}|tojson) else . end)
      elif $fault == "metadata-tuple-wrong-base" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = (["/wrong-checkout",".celetis.yaml","file"]|tojson) else . end)
      elif $fault == "metadata-tuple-wrong-path" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ([($path|rtrimstr("/.celetis.yaml")),"other.yaml","file"]|tojson) else . end)
      elif $fault == "metadata-tuple-wrong-kind" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ([($path|rtrimstr("/.celetis.yaml")),".celetis.yaml","dir"]|tojson) else . end)
      elif $fault == "metadata-decoy-record" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ([{path:$path},{path:($path+".other"),file:true,link:false}]|tojson) else . end)
      elif $fault == "metadata-missing-decoy-error" and $kind == "missing" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text = ([{path:$path,code:"EACCES"},{path:($path+".other"),code:"ENOENT"}]|tojson) else . end)
      elif $fault == "metadata-symlink-bypass" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text |= (fromjson | .symlink = true | tojson) else . end)
      elif $fault == "metadata-error" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0] += {is_error:true,content:("EACCES " + $path)} else . end)
      elif $fault == "metadata-late" then .[0:4] + .[6:8] + .[4:6] + .[8:]
      elif $fault == "metadata-node-content" then map(if .message.content[0].id == "meta-1" then .message.content[0].input.code += " await fs.readFile(\".celetis.yaml\");" else . end)
      elif $fault == "metadata-node-process" then map(if .message.content[0].id == "meta-1" then .message.content[0].input.code += " await import(\"node:child_process\");" else . end)
      elif $fault == "metadata-node-parser" then map(if .message.content[0].id == "meta-1" then .message.content[0].input.code += " yaml.parse(\"landing: pr\");" else . end)
      elif $fault == "success-bare-command" then map(if .type == "result" then .result |= sub("scripts/celetis --agent claude"; "scripts/celetis") else . end)
      elif $fault == "worktree-session" and $entered != "" then map(if .type == "result" then .session_id = "other-session" else . end)
      elif $fault == "success-unrelated" then map(if .type == "result" then .result += "\nUNRELATED_CUSTOM_MUST_NOT_RUN" else . end)
      elif $fault == "success-setup" then map(if .type == "result" then .result += "\nSETUP_MUST_NOT_RUN" else . end)
      elif $fault == "invalid-continues" and ($answer | startswith("Invalid ")) then map(if .type == "result" then .result = "scripts/celetis --agent claude next-step" else . end)
      elif $fault == "invalid-missing-field" and ($answer | startswith("Invalid ")) then map(if .type == "result" then .result |= sub(" at .*\\. Entry stopped"; ". Entry stopped") else . end)
      elif $fault == "invalid-missing-stop" and ($answer | startswith("Invalid ")) then map(if .type == "result" then .result |= sub(" Entry stopped\\."; "") else . end)
      elif $fault == "invalid-missing-validity" and ($answer | startswith("Invalid ")) then map(if .type == "result" then .result |= sub("Invalid "; "Config ") else . end)
      elif $fault == "handoff-missing-marker" then map(select(.type != "assistant" or .message.content[0].text != "CUSTOM_HANDOFF_WRITING"))
      elif $fault == "handoff-duplicate-marker" then map(if .type == "assistant" and .message.content[0].text == "CUSTOM_HANDOFF_WRITING" then .message.content[0].text += "\nCUSTOM_HANDOFF_WRITING" else . end)
      elif $fault == "handoff-unrelated-marker" then map(if .type == "assistant" and .message.content[0].text == "CUSTOM_HANDOFF_WRITING" then .message.content[0].text += "\nUNRELATED_CUSTOM_MUST_NOT_RUN" else . end)
      elif $fault == "cache-without-prior-content" and ($answer | contains("CUSTOM_BORROWED_REVIEW")) then map(if .message.content[0].tool_use_id == "read-1" then .tool_use_result = {type:"file_unchanged",file:{filePath:$path}} else . end)
      elif $fault == "cache-wrong-path" and ($answer | contains("CUSTOM_BORROWED_REVIEW")) then map(if .tool_use_result.type == "file_unchanged" then .tool_use_result.file.filePath += ".other" else . end)
      elif $fault == "borrowed-reread" and ($answer | contains("CUSTOM_BORROWED_REVIEW")) then [$call,$reply] + .
      else . end)[]
  else
    ($reply | .message.content[0] += {is_error:true,content:("Permission to use Read has been denied for " + $path)}) as $error |
    ($result | .result = "The config read was denied. Entry stopped." |
      .permission_denials = [{tool_name:"Read",tool_use_id:"read-1",tool_input:$input}]) as $stop |
    ([$host_call,$host_reply,metadata(($path|rtrimstr("/.celetis.yaml"))+"/.git"; $git_kind; "git-1"),metadata($path; $kind; "meta-1")] + ([$call,$error,$stop] |
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
  end |
  if .type == "result" then
    {type:"assistant",message:{role:"assistant",content:[{type:"text",text:.result}]},parent_tool_use_id:null}, .
  else . end'
[ "${CUSTOM_FAULT:-}" != client-exit ] || exit 7
MOCK
chmod +x "$tmp/bin/claude"
checker="$tmp/checker"
sed -n '/^check() {$/,/^}$/p' tests/manual/custom-part.test.sh >"$checker"
style_cases='no-shell worktree missing missing-lane symlink handoff enter-worktree denied-read'
manual() {
  PATH="$tmp/bin:$PATH" /bin/bash tests/manual/custom-part.test.sh "$@"
}
passed() {
  local log=$1 name
  shift
  sed '$d' "$log" >"$log.cases"
  for name; do
    grep -qx "PASS: $name" "$log.cases" || return 1
  done
}
obsolete_option() {
  local status=0
  CUSTOM_CALLS="$tmp/missing-config-calls" manual --mcp-config obsolete >"$tmp/missing-config" 2>&1 || status=$?
  if [ "$status" -eq 2 ] && [ ! -f "$tmp/missing-config-calls" ] && grep -q '^usage:' "$tmp/missing-config"; then
    echo 'ok: obsolete MCP option stops before a model client'
  else
    echo 'FAIL: obsolete MCP option was accepted'; return 1
  fi
}
valid_run() {
  if manual --output-dir "$tmp/valid-evidence" >"$tmp/valid" 2>&1; then
    echo 'ok: native custom-read fixtures pass'
  else
    echo 'FAIL: rejected a valid custom-read fixture'; cat "$tmp/valid"; return 1
  fi
}
style_run() {
  local style=$1 pass=$2 fail=$3
  if CUSTOM_PART_CASES=$style_cases CUSTOM_METADATA_STYLE=$style manual >"$tmp/$style" 2>&1 &&
      passed "$tmp/$style" $style_cases; then
    echo "ok: $pass"
  else
    echo "FAIL: $fail"; cat "$tmp/$style"; return 1
  fi
}
syntax_run() {
  if CUSTOM_PART_CASES=malformed CUSTOM_INVALID_STYLE=syntax manual >"$tmp/syntax" 2>&1 && passed "$tmp/syntax" malformed; then
    echo 'ok: exact-path syntax error stops pass'
  else
    echo 'FAIL: rejected syntax error stops'; cat "$tmp/syntax"; return 1
  fi
}
no_transition_run() {
  local status=0
  CUSTOM_PART_CASES=enter-worktree CUSTOM_FAULT=worktree-no-native-transition manual --output-dir "$tmp/no-transition-evidence" >"$tmp/no-transition" 2>&1 || status=$?
  if [ "$status" -eq 2 ] && grep -q '^ERROR: enter-worktree: client exited with status 2$' "$tmp/no-transition" &&
      [ "$(cat "$tmp/no-transition-evidence/enter-worktree.status")" = 2 ]; then
    echo 'ok: missing native worktree transition stops the protocol'
  else
    echo 'FAIL: missing native worktree transition did not stop the protocol'; return 1
  fi
}
denied_fault() {
  local fault=$1 cases=denied-read
  [ "$fault" != unrelated-block ] || cases=
  if CUSTOM_PART_CASES=$cases CUSTOM_FAULT=$fault manual --output-dir "$tmp/$fault-evidence" >"$tmp/$fault" 2>&1; then
    echo "FAIL: accepted $fault"; return 1
  elif grep -q '^FAIL: denied-read$' "$tmp/$fault" && [ "$(grep -c '^FAIL:' "$tmp/$fault")" -eq 1 ]; then
    echo "ok: rejects $fault"
  else
    echo "FAIL: $fault failed outside denied-read"; cat "$tmp/$fault"; return 1
  fi
}
fault_run() {
  local fault=$1 target=$2
  if CUSTOM_PART_CASES=$target CUSTOM_FAULT=$fault manual --output-dir "$tmp/$fault-evidence" >"$tmp/$fault" 2>&1; then
    echo "FAIL: accepted $fault"; return 1
  elif grep -q "^FAIL: $target$" "$tmp/$fault"; then
    echo "ok: rejects $fault"
  else
    echo "FAIL: $fault did not reach the checker"; cat "$tmp/$fault"; return 1
  fi
}
client_exit_run() {
  local status=0 files
  CUSTOM_PART_CASES=no-shell CUSTOM_FAULT=client-exit manual --output-dir "$tmp/client-exit-evidence" >"$tmp/client-exit" 2>&1 || status=$?
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
    echo 'FAIL: accepted a failed client or lost its evidence'; cat "$tmp/client-exit"; return 1
  fi
}
bound_run() {
  if CUSTOM_PART_CASES=enter-worktree CUSTOM_BOUND_ROOT=only-config manual --output-dir "$tmp/bound-evidence" >"$tmp/bound" 2>&1 &&
      passed "$tmp/bound" enter-worktree; then
    echo 'ok: native current worktree binding needs only config metadata'
  else
    echo 'FAIL: rejected current native worktree binding without Git rediscovery'; cat "$tmp/bound"; return 1
  fi
}
evidence_checks() {
  local fails=0 streams files good result name suffix
  streams=("$tmp/valid-evidence/"*.jsonl)
  if [ "${#streams[@]}" -eq 24 ] && [ -f "$tmp/valid-evidence/denied-read.input.json" ] &&
      jq -e '.goal == "/celetis:guide see the next step of an issue" and
        (.metadataRecording | startswith("For test evidence only, emit each actual lstat result")) and
        .prompt == (.goal + "\n\n" + .metadataRecording) and
        .tools == "Skill,Read,Glob,Grep" and (.settings.permissions.deny | length) == 1' \
        "$tmp/valid-evidence/denied-read.input.json" >/dev/null &&
      [ "$(cat "$tmp/valid-evidence/denied-read.status")" = 0 ]; then
    echo 'ok: keeps the twenty-four case streams and denied-read inputs after PASS'
  else
    echo 'FAIL: lost evidence after PASS'; fails=$((fails + 1))
  fi
  if jq -e '(.messages | length) == 2 and .messages[0].message.content == .goal and
      (.messages[0].message.content | contains("Then wait for my guide invocation")) and
      .messages[1].message.content == ("/celetis:guide see the next step of an issue\n\n" + .metadataRecording) and
      (.metadataRecording | contains("CUSTOM_") or contains("Emit tool calls") or contains("/")) == false' "$tmp/valid-evidence/enter-worktree.input.json" >/dev/null &&
      jq -se '[.[] | select(.type == "result")] as $turns | ($turns | length) == 2 and
        ([$turns[].session_id] | unique | length) == 1' "$tmp/valid-evidence/enter-worktree.jsonl" >/dev/null; then
    echo 'ok: worktree transition and direct skill selection use two user turns in one session'
  else
    echo 'FAIL: worktree test did not preserve the two-turn native protocol'; fails=$((fails + 1))
  fi
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
  if jq -e '.config.path == (.cwd + "/.celetis.yaml") and
      (.config.source | contains("custom:") and contains("UNRELATED_CUSTOM_MUST_NOT_RUN") and contains("SETUP_MUST_NOT_RUN")) and
      (.config.sha256 | test("^[0-9a-f]{64}$")) and (.pluginSources | length) >= 5' "$tmp/valid-evidence/no-shell.input.json" >/dev/null &&
      [ -f "$tmp/valid-evidence/version" ]; then
    echo 'ok: preserves YAML sources, paths, hashes, restrictions, and runtime version'
  else
    echo 'FAIL: missing native-entry source evidence'; fails=$((fails + 1))
  fi
  [ "$fails" -eq 0 ]
}
schema_fault() {
  local name=$1 fault=$2 folder="$tmp/$1-$2" path answer field reject accept status=0
  if [ "$name" = folded ]; then
    field=custom.guide
    reject=": the config schema doesn't accept folded blocks for instruction strings"
    accept=': the config schema accepts folded blocks'
  else
    field=custom.unknown
    reject=" has a field the schema doesn't allow"
    accept=' has a field the schema allows'
  fi
  mkdir "$folder"
  cp "$tmp/valid-evidence/$name."* "$folder/"
  path=$(jq -r '.config.path' "$folder/$name.input.json")
  answer="Config $path at $field$reject. Entry stopped."
  case $fault in
    missing-path) answer=${answer//"$path"/} ;;
    missing-field) answer=${answer//"$field"/} ;;
    missing-validity) answer="Config $path at $field was read. Entry stopped." ;;
    missing-stop) answer=${answer// Entry stopped./} ;;
    affirmative) answer="Config $path at $field$accept. Entry stopped." ;;
    contradictory) answer="$answer This file is accepted as-is." ;;
    continued-goal) answer="$answer scripts/celetis --agent claude next-step" ;;
  esac
  jq -c --arg answer "$answer" '
    if .type == "result" then .result = $answer
    elif .type == "assistant" then .message.content |= map(if .type == "text" then .text = $answer else . end)
    else . end' "$folder/$name.jsonl" >"$folder/changed"
  mv "$folder/changed" "$folder/$name.jsonl"
  (
    tmp=$folder
    failed=0
    source "$checker"
    check "$name" invalid "${path%/.celetis.yaml}"
    exit "$failed"
  ) >"$folder/check.log" 2>&1 || status=$?
  if { [ "$fault" = good ] && [ "$status" -eq 0 ]; } ||
      { [ "$fault" != good ] && [ "$status" -eq 1 ] && grep -q "^FAIL: $name$" "$folder/check.log"; }; then
    echo "ok: $name schema rejection $fault"
  else
    echo "FAIL: $name schema rejection $fault"; cat "$folder/check.log"; return 1
  fi
}
bound_fault() {
  local fault=$1 folder="$tmp/bound-$1" status=0
  mkdir "$folder"
  cp "$tmp/bound-evidence/"enter-worktree.* "$folder/"
  jq -sc --arg fault "$fault" '
    if $fault == "absent" then map(del(.tool_use_result.worktreePath))
    elif $fault == "mismatched" then map(if .tool_use_result.worktreePath then .tool_use_result.worktreePath += ".other" else . end)
    elif $fault == "error" then map(if .message.content[0].tool_use_id == "enter-setup" then .message.content[0].is_error = true else . end)
    elif $fault == "stale-session" then map(if .tool_use_result.worktreePath then .session_id = "old-session" else . end)
    elif $fault == "stale-binding" or $fault == "old-result-after-transition" then . as $rows | .[0:2] + [
      {type:"assistant",session_id:"fixture-session",message:{role:"assistant",content:[{type:"tool_use",id:"enter-other",name:"EnterWorktree",input:{path:"/other-checkout"}}]}},
      {type:"user",session_id:"fixture-session",message:{role:"user",content:[{type:"tool_result",tool_use_id:"enter-other",content:"/other-checkout"}]},tool_use_result:{worktreePath:"/other-checkout"}}] +
      (if $fault == "old-result-after-transition" then [$rows[1]] else [] end) + .[2:]
    elif $fault == "missing-config-kind" then map(select(.message.content[0].tool_use_id != "meta-1"))
    elif $fault == "late-config-kind" then . as $rows | map(select(.message.content[0].tool_use_id != "meta-1")) + [$rows[] | select(.message.content[0].tool_use_id == "meta-1")]
    elif $fault == "symlink-config" then map(if .message.content[0].tool_use_id == "meta-1" then .message.content[0].content[0].text |= (fromjson | .symlink = true | tojson) else . end)
    else error("unknown fault") end | .[]' "$folder/enter-worktree.jsonl" >"$folder/changed"
  mv "$folder/changed" "$folder/enter-worktree.jsonl"
  (
    tmp=$folder
    lane=$(jq -r '.git.path | rtrimstr("/.git")' "$folder/enter-worktree.input.json")
    failed=0
    source "$checker"
    check enter-worktree CUSTOM_FROM_LANE "$lane"
    exit "$failed"
  ) >"$folder/check.log" 2>&1 || status=$?
  if [ "$status" -eq 1 ] && grep -q '^FAIL: enter-worktree$' "$folder/check.log"; then
    echo "ok: rejects bound-root $fault"
  else
    echo "FAIL: accepted bound-root $fault"; cat "$folder/check.log"; return 1
  fi
}
status_fault() {
  local fault=$1 folder="$tmp/status-$1" expected='invalid client exit status' status=0
  mkdir "$folder"
  cp "$tmp/valid-evidence/"no-shell.* "$folder/"
  case $fault in
    missing) rm "$folder/no-shell.status"; expected='missing client exit status' ;;
    empty) : >"$folder/no-shell.status" ;;
    word) printf 'status=0\n' >"$folder/no-shell.status" ;;
    negative) printf '%s\n' -1 >"$folder/no-shell.status" ;;
    range) printf '256\n' >"$folder/no-shell.status" ;;
    multiline) printf '0\n7\n' >"$folder/no-shell.status" ;;
  esac
  (
    tmp=$folder
    failed=0
    source "$checker"
    check no-shell CUSTOM_FROM_ROOT "$folder" 1
  ) >"$tmp/status-$fault.log" 2>&1 || status=$?
  if [ "$status" -eq 2 ] && grep -q "^ERROR: no-shell: $expected$" "$tmp/status-$fault.log"; then
    echo "ok: rejects $fault client status"
  else
    echo "FAIL: accepted $fault client status"; cat "$tmp/status-$fault.log"; return 1
  fi
}

pool_run valid valid_run
pool_run unrelated-block denied_fault unrelated-block
pool_run obsolete-option obsolete_option
pool_run path-map style_run path-map 'exact path-to-kind metadata maps pass' 'rejected exact path-to-kind metadata maps'
for style in relative relative-template relative-map path-object tuple; do
  pool_run "$style" style_run "$style" "bound $style metadata records pass" "rejected bound $style metadata records"
done
pool_run syntax syntax_run
pool_run no-transition no_transition_run
for fault in wrong-path missing-denial wrong-denial-id wrong-result-id missing-error read-succeeded later-read later-grep later-shell; do
  pool_run "$fault" denied_fault "$fault"
done
for fault in bootstrap-wrong-path bootstrap-product-first bootstrap-product-skill success-wrong-path success-extra-read success-bare-command success-unrelated success-setup success-missing-result success-result-error startup-text startup-optional-text startup-borrowed-text startup-handoff-text invalid-continues invalid-missing-field invalid-missing-stop invalid-missing-validity git-directory-read git-file-early-read git-file-missing-kind worktree-session worktree-pre-entry-read metadata-missing metadata-missing-result metadata-wrong-id metadata-wrong-path metadata-string-only metadata-map-wrong-path metadata-map-missing-path metadata-map-wrong-kind metadata-map-missing-kind metadata-map-symlink metadata-relative-wrong-base metadata-relative-decoy-root metadata-relative-wrong-path metadata-relative-wrong-operand metadata-relative-wrong-kind metadata-relative-missing-link metadata-relative-symlink metadata-object-wrong-path metadata-object-missing-link metadata-object-symlink metadata-tuple-wrong-base metadata-tuple-wrong-path metadata-tuple-wrong-kind metadata-decoy-record metadata-missing-decoy-error metadata-symlink-bypass metadata-error metadata-late metadata-node-content metadata-node-process metadata-node-parser cache-without-prior-content cache-wrong-path handoff-missing-marker handoff-duplicate-marker handoff-unrelated-marker borrowed-reread symlink-followed; do
  case $fault in
    startup-text) target=no-shell ;;
    startup-optional-text) target=missing ;;
    startup-borrowed-text) target=borrowed ;;
    startup-handoff-text) target=handoff ;;
    metadata-missing-decoy-error) target=missing ;;
    git-file-*|worktree-*) target=enter-worktree ;;
    success-*|bootstrap-*|git-directory-*|metadata-*) target=no-shell ;;
    invalid-*) target=malformed ;;
    handoff-*) target=handoff ;;
    borrowed-reread|cache-*) target=borrowed ;;
    symlink-followed) target=symlink ;;
  esac
  pool_run "$fault" fault_run "$fault" "$target"
done
pool_run client-exit client_exit_run
pool_run bound bound_run
failed=0
pool_wait || failed=1

pool_run evidence evidence_checks
for name in folded unknown-field; do
  for fault in good missing-path missing-field missing-validity missing-stop affirmative contradictory continued-goal; do
    pool_run "$name-$fault" schema_fault "$name" "$fault"
  done
done
for fault in absent mismatched error stale-session stale-binding old-result-after-transition missing-config-kind late-config-kind symlink-config; do
  pool_run "bound-$fault" bound_fault "$fault"
done
for fault in missing empty word negative range multiline; do
  pool_run "status-$fault" status_fault "$fault"
done
pool_wait || failed=1
[ "$failed" -eq 0 ]
echo PASS
