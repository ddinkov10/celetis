#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
adapter="$root/scripts/board.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/main checkout"
capture="$tmp/capture"
mkdir -p "$repo/scripts" "$repo/sub" "$tmp/bin"
repo=$(cd "$repo" && pwd -P)
export BOARD_CAPTURE="$capture" BOARD_REAL_NPX="$(command -v npx)" BOARD_FLOW="$root/scripts/celetis-flow.sh"
export BOARD_PRODUCER_LOG="$tmp/producer"
unset PORT CELETIS_AGENT
cat >"$tmp/bin/npx" <<'EOF'
#!/bin/bash
set -euo pipefail
printf '%s\n' "$@" >"$BOARD_CAPTURE/argv"
pwd -P >"$BOARD_CAPTURE/cwd"
printf '%s' "${PORT-}" >"$BOARD_CAPTURE/port"
cat >"$BOARD_CAPTURE/config.json"
if [ "${BOARD_CHECK:-0}" = 1 ]; then
  if [ -n "${AGENT_BOARD:-}" ]; then
    exec node "$AGENT_BOARD" check --config-stdin <"$BOARD_CAPTURE/config.json"
  fi
  exec "$BOARD_REAL_NPX" "$1" "$2" check "$3" <"$BOARD_CAPTURE/config.json"
fi
exit "${BOARD_NPX_STATUS:-0}"
EOF
cat >"$tmp/bin/gh" <<'EOF'
#!/bin/bash
[ "$1" = api ] || exit 1
filter=. endpoint=
while [ $# -gt 0 ]; do case $1 in --jq) filter=$2; shift ;; repos/*) endpoint=$1 ;; esac; shift; done
case $endpoint in
  'repos/{owner}/{repo}/issues?state='* | 'repos/{owner}/{repo}/pulls?state=open&'*) echo '[]' | jq -r "$filter" ;;
  *) exit 1 ;;
esac
EOF
cat >"$repo/scripts/celetis" <<'EOF'
#!/bin/bash
printf '%s\n' "$*" >>"$BOARD_PRODUCER_LOG"
[ "$1" = celetis-flow ] || exit 1
shift
exec /bin/bash "$BOARD_FLOW" "$@"
EOF
chmod +x "$tmp/bin/npx" "$tmp/bin/gh" "$repo/scripts/celetis"
printf 'landing: pr\nboard:\n  port: 4404\n' >"$repo/.celetis.yaml"
git -C "$repo" init -q
git -C "$repo" -c user.name=fixture -c user.email=fixture@example.test add .
git -C "$repo" -c user.name=fixture -c user.email=fixture@example.test commit -qm fixture
git -C "$repo" worktree add -qb lane "$repo/.claude/worktrees/lane"
mkdir "$repo/.claude/worktrees/lane/sub"
printf 'landing: merge\nboard: {port: 4999}\n' >"$repo/.claude/worktrees/lane/.celetis.yaml"
printf 'landing: merge\nboard: {port: 4555}\n' >"$repo/sub/.celetis.yaml"
fails=0
check() {
  local label=$1
  shift
  if "$@" >/dev/null; then printf 'ok   %s\n' "$label"; else
    printf 'FAIL %s: status=%s stdout=[%s] stderr=[%s]\n' "$label" "${code:-}" "${out:-}" "${err:-}"
    fails=$((fails + 1))
  fi
}
run_board() {
  local folder=$1
  shift
  rm -rf "$capture"
  mkdir "$capture"
  code=0
  out=$(cd "$folder" && PATH="$tmp/bin:$PATH" /bin/bash "$adapter" "$@" 2>"$tmp/stderr") || code=$?
  err=$(cat "$tmp/stderr")
}
config_is() { jq -e "$1" "$capture/config.json" >/dev/null 2>&1; }
refused() { [ "$code" -ne 0 ] && [ ! -e "$capture/argv" ]; }
expected='{"data":["scripts/celetis","celetis-flow","--board"],"run":["scripts/celetis","--agent","{agent}","celetis-flow","{n}"],"resume":["scripts/celetis","celetis-flow","--resume","{n}"],"port":4404}'
before=$(git -C "$repo" status --porcelain --untracked-files=all)
run_board "$repo"
check board_stdin_contract_start test "$code:$out:$err" = '0::'
check board_stdin_contract_json config_is ". == $expected"
check board_stdin_contract_argv test "$(cat "$capture/argv" 2>/dev/null || true)" = $'--yes\ngithub:ddinkov10/agent-board#v2.2.1\n--config-stdin'
check board_source_main test "$(cat "$capture/cwd" 2>/dev/null || true)" = "$repo"
check board_source_no_config_file test ! -e "$repo/.claude/celetis-flow"
check board_source_no_project_write test "$(git -C "$repo" status --porcelain --untracked-files=all)" = "$before"
run_board "$repo/sub"
check board_source_subfolder test "$code:$(cat "$capture/cwd" 2>/dev/null || true)" = "0:$repo"
check board_source_ignores_subfolder config_is '.port == 4404'
printf 'landing: pr\n' >"$repo/.celetis.yaml"
run_board "$repo"
check board_stdin_contract_default_port config_is '.port == 4403'
PORT=4517 run_board "$repo"
check board_stdin_contract_inherited_port test "$(cat "$capture/port" 2>/dev/null || true)" = 4517
check board_stdin_contract_keeps_config_port config_is '.port == 4403'
BOARD_NPX_STATUS=7 run_board "$repo"
check board_stdin_contract_child_status test "$code" = 7
for folder in "$repo/.claude/worktrees/lane" "$repo/.claude/worktrees/lane/sub"; do
  run_board "$folder"
  check board_refusal_lane refused
  check board_refusal_lane_path test "${err#*"$repo"}" != "$err"
done
run_board "$repo" extra
check board_refusal_arguments refused
for bad in missing invalid unknown; do
  case $bad in
    missing) rm "$repo/.celetis.yaml" ;;
    invalid) printf 'landing: [\n' >"$repo/.celetis.yaml" ;;
    unknown) printf 'landing: pr\nboard: {other: 4404}\n' >"$repo/.celetis.yaml" ;;
  esac
  run_board "$repo"
  check "board_refusal_$bad" refused
  check "board_refusal_${bad}_path" test "${err#*"$repo/.celetis.yaml"}" != "$err"
done
printf 'landing: pr\nboard: {port: 4404}\n' >"$repo/.celetis.yaml"
source "$root/scripts/celetis"
config=$(celetis_config_read "$root")
check no_old_setup_config test -f "$root/.celetis.yaml"
check no_old_setup_symlink test ! -L "$root/.celetis.yaml"
check no_old_setup_tracked test -z "$(git -C "$root" ls-files .claude/celetis-flow)"
check board_source_repository_port jq -e '.board.port == 4404' <<<"$config"
check board_source_repository_gates jq -e '. as $config | ["triage","specify","bug","chore","hotfix","plan","implement"] | all(.[]; ($config.gates[.] // "me") == "me")' <<<"$config"

if [ "${CELETIS_FLOW_SKIP_BOARD_CHECK:-}" = 1 ]; then
  echo 'board consumer: SKIP (CELETIS_FLOW_SKIP_BOARD_CHECK=1)'
elif [ ! -f "$adapter" ]; then
  check board_consumer_requires_adapter false
else
  BOARD_CHECK=1 run_board "$repo"
  check board_consumer_actual_producer test "$code:$out" = '0:agent-board: contract 1, 0 issues, ok'
  check board_consumer_producer_command test "$(cat "$BOARD_PRODUCER_LOG")" = 'celetis-flow --board'
  check board_consumer_no_config_file test ! -e "$repo/.claude/celetis-flow"
  cp "$repo/scripts/celetis" "$tmp/saved-launcher"
  for bad in external lane missing mode directory; do
    rm -rf "$repo/scripts/celetis"
    case $bad in
      external) ln -s "$tmp/saved-launcher" "$repo/scripts/celetis" ;;
      lane)
        cp "$tmp/saved-launcher" "$repo/.claude/worktrees/lane/launcher"
        ln -s "$repo/.claude/worktrees/lane/launcher" "$repo/scripts/celetis" ;;
      missing) ;;
      mode) cp "$tmp/saved-launcher" "$repo/scripts/celetis"; chmod -x "$repo/scripts/celetis" ;;
      directory) mkdir "$repo/scripts/celetis" ;;
    esac
    rm "$BOARD_PRODUCER_LOG"
    BOARD_CHECK=1 run_board "$repo"
    check "board_consumer_refuses_$bad" test "$code" = 1
    check "board_consumer_diagnostic_$bad" test "${err#*'config stdin:'}" != "$err"
    check "board_consumer_no_producer_$bad" test ! -e "$BOARD_PRODUCER_LOG"
    touch "$BOARD_PRODUCER_LOG"
  done
  rm -rf "$repo/scripts/celetis"
  cp "$tmp/saved-launcher" "$repo/scripts/celetis"
  for input in '{' '{"unknown":true}' '{"data":[]}' '{"run":["scripts/celetis","{agent}"]}' '{"resume":["scripts/celetis","{agent}","{n}"]}' '{"port":0}'; do
    code=0
    if [ -n "${AGENT_BOARD:-}" ]; then
      out=$(printf '%s' "$input" | (cd "$repo" && node "$AGENT_BOARD" check --config-stdin) 2>"$tmp/stderr") || code=$?
    else
      out=$(printf '%s' "$input" | (cd "$repo" && "$BOARD_REAL_NPX" --yes 'github:ddinkov10/agent-board#v2.2.1' check --config-stdin) 2>"$tmp/stderr") || code=$?
    fi
    err=$(cat "$tmp/stderr")
    check board_consumer_bad_config test "$code" = 1
    check board_consumer_bad_config_diagnostic test "${err#*'config stdin:'}" != "$err"
  done
fi
printf 'board tests: %s failures\n' "$fails"
[ "$fails" -eq 0 ]
