def observation:
  select(.type == "system" and .subtype == "ui_log" and .plugin == "celetis-entry-observer") |
  . as $row | (try (.text | fromjson) catch empty) + {session:$row.session_id};
. as $rows |
[$rows | to_entries[] as $item | $item.value | observation + {order:$item.key}] as $observed |
[$rows[] | select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | .id] as $ordinary |
def begins($record; $event):
  any($observed[]; .event == $event and .id == $record.id and .input == $record.input and
    .origin == $record.origin and .session == $record.session and .order < $record.order);
[$rows | to_entries[] as $item | $item.value as $row |
  ($row | (observation + {order:$item.key}) // null) as $record |
  if $record.event == "fs.stat.result" and begins($record; "fs.stat.start") then
    {type:"native_metadata",path:$record.input.path,result:$record.result,session_id:$record.session}
  elif $record.event == "tool.start" and ($ordinary | index($record.id)) == null then
    {type:"assistant",native:true,session_id:$record.session,message:{role:"assistant",content:[
      {type:"tool_use",id:$record.id,name:$record.input.tool,input:($record.input | del(.tool,.tool_use_id,.agentId))}]}}
  elif $record.event == "tool.result" and begins($record; "tool.start") and ($ordinary | index($record.id)) == null then
    {type:"user",native:true,session_id:$record.session,tool_use_result:$record.result.result,message:{role:"user",content:[
      {type:"tool_result",tool_use_id:$record.id,is_error:($record.result.isError == true or $record.result.deny != null),
        content:($record.result.text // $record.result.deny // ($record.result.result | tojson))}]}}
  elif $record.event == "tool.check" and $record.result.decision == "deny" then
    {type:"native_denial",id:$record.id,path:$record.input.input.file_path,reason:$record.result.reason,rule:$record.result.rule}
  else $row end] as $events |
[$events[] | select(.type == "native_denial") | {tool_name:"Read",tool_use_id:.id,tool_input:{file_path:.path},native:true}] as $denials |
$events[] | if .type == "result" then .permission_denials = ((.permission_denials // []) + $denials | unique_by(.tool_use_id)) else . end
