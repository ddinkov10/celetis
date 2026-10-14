#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat >"$tmp/bin/claude" <<'MOCK'
#!/usr/bin/env bash
set -eu
if [ "${1:-}" = --version ]; then echo 'manual fixture'; exit 0; fi
answer=
while [ $# -gt 0 ]; do
  case $1 in --output-last-message) answer=$2; shift ;; esac
  shift
done
prompt=$(cat)
k=$(printf '%s\n' "$prompt" | sed -n 's/^Case \([0-9][0-9]*\).*/\1/p')
case $prompt in *'A person started the session by hand'*) mode=hand ;; *) mode=step ;; esac
out='Then: my step ends'
if [ "$mode" = step ]; then
  case $k in
    1 | 2) out=$'## Stopped\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    3) out=$'## Landing refused\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    4 | 8) out=$'## Before landing\ngh issue comment 7 --body-file /tmp/reason\ngh issue edit 7 --remove-label ready-for-agent --add-label ready-for-human\nThen: my step ends' ;;
    5 | 7 | 15) out='Then: I wait for the person' ;;
    6) out=$'Fix the cause\ngh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    9) out=$'gh issue edit 7 --add-label needs-info\nThen: my step ends' ;;
    10 | 17)
      if [ -n "$answer" ]; then out=$'scripts/celetis --host codex land 7 subject\nThen: my step ends'
      else out=$'scripts/celetis --host claude land 7 subject\nThen: my step ends'; fi ;;
    11) out=$'gh issue edit 7 --add-label ready-for-agent\nThen: my step ends' ;;
    13 | 16) out=$'gh issue edit 7 --add-label ready-for-human\nThen: my step ends' ;;
    12) out=$'gh issue edit 7 --add-label bug\nThen: my step ends' ;;
    14) out='Then: I go on with the repair and Verify loop' ;;
  esac
  if [ "$k" = 4 ]; then
    case ${MANUAL_FAULT:-} in
      land-bare) out="$out"$'\nscripts/celetis land 7 subject' ;;
      land-claude) out="$out"$'\nscripts/celetis --host claude land 7 subject' ;;
      land-codex) out="$out"$'\nscripts/celetis --host codex land 7 subject' ;;
      exit) exit 1 ;;
    esac
  fi
fi
if [ "$mode" = step ] && [ "$k" = 13 ] && [ "${MANUAL_FAULT:-}" = no-completion-land ]; then
  out="$out"$'\nscripts/celetis --host codex land 7 subject'
fi
case "$mode:$k:${MANUAL_FAULT:-}" in
  step:14:verify-land | step:16:stale-completion-land) out="$out"$'\nscripts/celetis --host codex land 7 subject' ;;
  step:15:approval-publish) out="$out"$'\ngh issue edit 7 --body-file /tmp/spec' ;;
  step:17:built-rebuild) out="$out"$'\ngh issue edit 7 --add-label ready-for-agent' ;;
esac
if [ -z "$answer" ]; then printf '%s\n' "$out"; exit 0; fi
printf '%s\n' "$out" >"$answer"
if [ "$mode" = step ] && [ "$k" = 4 ]; then
  case ${MANUAL_FAULT:-} in
    tool) echo '{"type":"item.completed","item":{"type":"command_execution","command":"true"}}' ;;
    error) echo '{"type":"error","message":"test failure"}' ;;
    reconnect) echo '{"type":"error","message":"Reconnecting... 1/5"}' ;;
    incomplete) echo '{"type":"error","message":"Reconnecting... 1/5"}'; exit 0 ;;
  esac
fi
echo '{"type":"turn.completed"}'
MOCK
cp "$tmp/bin/claude" "$tmp/bin/codex"
chmod +x "$tmp/bin/claude" "$tmp/bin/codex"
fails=0
for host in claude codex; do
  if PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --host "$host" >"$tmp/$host" 2>&1 &&
      [ "$(grep -c '^PASS: case ' "$tmp/$host")" -eq 21 ]; then
    echo "ok: $host runs all twenty-one scenarios"
  else
    echo "FAIL: $host omitted or rejected a valid fixture"; cat "$tmp/$host"; fails=$((fails + 1))
  fi
done
for fault in land-bare land-claude land-codex tool error exit incomplete; do
  if MANUAL_FAULT=$fault PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --host codex >"$tmp/$fault" 2>&1; then
    echo "FAIL: accepted $fault"; fails=$((fails + 1))
  elif grep -q '^FAIL: case 4 step:' "$tmp/$fault"; then
    echo "ok: rejects $fault"
  else
    echo "FAIL: $fault failed outside its scenario"; cat "$tmp/$fault"; fails=$((fails + 1))
  fi
done
if MANUAL_FAULT=reconnect PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --host codex >"$tmp/reconnect" 2>&1 &&
    grep -q '^WARN: case 4 step recovered 1 service event(s)$' "$tmp/reconnect"; then
  echo 'ok: a completed reconnect is reported'
else
  echo 'FAIL: completed reconnect'; cat "$tmp/reconnect"; fails=$((fails + 1))
fi
if MANUAL_FAULT=no-completion-land PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --host codex >"$tmp/no-completion-land" 2>&1; then
  echo 'FAIL: landed without completion evidence'; fails=$((fails + 1))
elif grep -q '^FAIL: case 13 step:' "$tmp/no-completion-land"; then
  echo 'ok: rejects landing without completion evidence'
else
  echo 'FAIL: missing-evidence scenario did not run'; cat "$tmp/no-completion-land"; fails=$((fails + 1))
fi
for pair in '14 step verify-land' '15 specify approval-publish' '16 step stale-completion-land' '17 step built-rebuild'; do
  set -- $pair
  if MANUAL_FAULT=$3 PATH="$tmp/bin:$PATH" /bin/bash tests/manual/step-prompt.test.sh --host codex >"$tmp/$3" 2>&1; then
    echo "FAIL: accepted $3"; fails=$((fails + 1))
  elif grep -q "^FAIL: case $1 $2:" "$tmp/$3"; then
    echo "ok: rejects $3"
  else
    echo "FAIL: $3 failed outside its scenario"; cat "$tmp/$3"; fails=$((fails + 1))
  fi
done
[ "$fails" -eq 0 ]
echo 'PASS'
