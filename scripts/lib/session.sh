#!/usr/bin/env bash

celetis_session_data() {
  jq -nc --argjson issue "$1" --arg host "$CELETIS_AGENT" --arg step "$2" --arg checkout "$3" --arg id "$4" \
    '{schema:1,host:$host,issue:$issue,step:$step,checkout:$checkout,session_id:(if $id == "" then null else $id end)}' |
    celetis_session_validate "$1" "$3"
}

celetis_session_write() (
  local issue=$1 step=$2 checkout=$3 id=$4 file temp
  # shellcheck disable=SC2154 # the script that sources this file sets state
  file="$state/sessions/$issue.json"
  mkdir -p "$state/sessions" || exit 1
  temp=$(mktemp "$state/sessions/.$issue.XXXXXX") || exit 1
  trap 'rm -f "$temp"' EXIT
  celetis_session_data "$issue" "$step" "$checkout" "$id" >"$temp" || exit 1
  mv -f "$temp" "$file"
)

celetis_session_saved() {
  local id=$1 checkout=$2 started_at=${3:-0} file reply
  case $CELETIS_AGENT in
    claude)
      for file in "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/projects/*/"$id.jsonl"; do
        [ -f "$file" ] || continue
        jq -ne --arg id "$id" --arg cwd "$checkout" --argjson start "$started_at" '
          first(inputs | select(.sessionId == $id and .type == "user" and .cwd == $cwd)
            | select(try (.timestamp | sub("\\.[0-9]+Z$";"Z") | fromdateiso8601 >= $start) catch false)) != null
        ' "$file" >/dev/null 2>&1 && return 0
      done
      return 1
      ;;
    codex)
      reply=$(celetis_codex_request thread/read "$(jq -nc --arg id "$id" '{threadId:$id,includeTurns:false}')") || return 1
      printf '%s\n' "$reply" | jq -e --arg id "$id" --arg cwd "$checkout" --argjson start "$started_at" '
        .result.thread | .id == $id and .cwd == $cwd and .ephemeral == false
          and (.createdAt | type == "number" and . >= $start)
      ' >/dev/null || return 1
      reply=$(celetis_codex_request thread/turns/list "$(jq -nc --arg id "$id" '{threadId:$id,limit:1,itemsView:"notLoaded"}')") || return 1
      printf '%s\n' "$reply" | jq -e '.result.data | type == "array" and length == 1 and (.[0].id | type == "string" and length > 0)' >/dev/null
      ;;
  esac
}

celetis_session_observe() {
  local issue=$1 step=$2 checkout=$3 reply=$4 prior_id=$5 started_at=$6 id
  id=$(printf '%s\n' "$reply" | jq -er --arg host "$CELETIS_AGENT" --arg prior "$prior_id" '
    .result.agent
    | if type != "object" or (.agent | IN("claude","codex") | not) or
        (.agent_status | IN("idle","working","blocked","done","unknown") | not) or
        (.agent != $host and ($prior == "" or .agent_session.value != $prior))
      then error("invalid agent") else . end
    | if .agent_session == null then ""
      elif .agent_session.agent != .agent or .agent_session.kind != "id" or
          (.agent_session.value | type) != "string" then error("invalid identity")
      else .agent_session.value end
  ' 2>/dev/null) || return 2
  [ -n "$id" ] || return 1
  celetis_session_data "$issue" "$step" "$checkout" "$id" >/dev/null 2>&1 || return 2
  [ "$id" != "$prior_id" ] || return 1
  celetis_session_saved "$id" "$checkout" "$started_at" >/dev/null 2>&1 || return 1
  celetis_session_write "$issue" "$step" "$checkout" "$id" || return 2
}

celetis_session_idle() {
  herdr agent get "$HERDR_PANE_ID" 2>/dev/null |
    jq -e --arg host "$CELETIS_AGENT" --arg id "$1" '
      .result.agent | .agent == $host and
        (.agent_status | IN("idle", "done")) and
        .agent_session.agent == $host and .agent_session.kind == "id" and
        .agent_session.value == $id
    ' >/dev/null 2>&1
}

celetis_host_arguments() {
  local issue=$1 step=$2 prompt=$3 root=$4 developer reply
  case $CELETIS_AGENT in
    claude)
      CELETIS_ARGS=(--permission-mode auto -n "#$issue $step")
      [ "$step" = specify ] || CELETIS_ARGS+=(--append-system-prompt-file "$root/step-prompt.md")
      CELETIS_ARGS+=("$prompt")
      ;;
    codex)
      CELETIS_ARGS=(--no-daemon)
      if [ "$step" != specify ]; then
        reply=$(celetis_codex_request config/read "$(jq -nc --arg cwd "$PWD" '{cwd:$cwd,includeLayers:false}')") || return 1
        IFS= read -r developer < <(printf '%s\n' "$reply" | jq -er --rawfile step "$root/step-prompt.md" '
          .result.config
          | if type != "object" or (.developer_instructions | type != "string" and . != null)
            then error("invalid effective developer instructions") else . end
          | (.developer_instructions // "") as $existing
          | "developer_instructions=" + ((if $existing == "" then $step else $existing + "\n\n" + $step end) | tojson)
        ') || return 1
        CELETIS_ARGS+=(-c "$developer")
      fi
      prompt=${prompt#/celetis:}
      CELETIS_ARGS+=("Use the celetis:${prompt%% *} skill for #$issue. Complete its Host entry startup reads before any response, including commentary.")
      ;;
  esac
}

celetis_startup_error() {
  local issue=$1 detail=$2
  printf 'celetis-flow: #%s %s startup: %s. Check the version, trust, and sign-in prompts in this pane. Complete the required action, then start the step again. Manual recovery: %s from the main checkout.\n' "$issue" "$CELETIS_AGENT" "$detail" "$(celetis_manual_recovery)" >&2
  herdr pane read "$HERDR_PANE_ID" --source recent-unwrapped --lines 40 >&2 2>/dev/null || true
}
