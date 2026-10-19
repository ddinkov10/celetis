#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
if [ "${CELETIS_FLOW_SKIP_BOARD_CHECK:-}" = 1 ]; then
  echo 'board-agent: SKIP (CELETIS_FLOW_SKIP_BOARD_CHECK=1)'
  exit 0
fi
tmp=$(mktemp -d)
export BOARD_TEST="$tmp/state" BOARD_PLUGIN="$tmp/installed package" BOARD_PRODUCT="$tmp/product checkout"
export CLAUDE_CONFIG_DIR="$tmp/claude" CODEX_HOME="$tmp/codex"
export CELETIS_TEST_HERDR_FIXTURES="$root/tests/fixtures/herdr"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
unset CELETIS_AGENT HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
trap 'kill $(cat "$BOARD_TEST/pids" 2>/dev/null) 2>/dev/null || true; rm -rf "$tmp"' EXIT
mkdir -p "$BOARD_TEST" "$BOARD_PLUGIN" "$BOARD_PRODUCT/scripts" "$BOARD_PRODUCT/.claude/celetis-flow" "$tmp/bin"
BOARD_PRODUCT=$(cd "$BOARD_PRODUCT" && pwd -P)
board=${AGENT_BOARD:-}
if [ -z "$board" ]; then
  (cd "$tmp" && npm pack --pack-destination "$tmp" 'github:ddinkov10/agent-board#semver:^2') >"$tmp/package-name"
  tar -xzf "$tmp/$(tail -1 "$tmp/package-name")" -C "$tmp"
  board="$tmp/package/cli.mjs"
fi
cp -R "$root/scripts" "$root/.claude-plugin" "$BOARD_PLUGIN/"
mkdir -p "$BOARD_PLUGIN/skills/guide"
echo fixture >"$BOARD_PLUGIN/skills/guide/SKILL.md"
echo fixture >"$BOARD_PLUGIN/step-prompt.md"
cp "$root/scripts/celetis" "$BOARD_PRODUCT/scripts/celetis"
cp "$root/.claude/celetis-flow/board.json" "$BOARD_PRODUCT/.claude/celetis-flow/board.json"
cat >"$tmp/bin/gh" <<'EOF'
#!/bin/bash
[ "$1" = api ] || { echo "HTTP 403: GitHub GraphQL is not available from Claude Code sessions" >&2; exit 1; }
filter=. endpoint=
while [ $# -gt 0 ]; do case $1 in --jq) filter=$2; shift ;; repos/*) endpoint=$1 ;; esac; shift; done
case $endpoint in
  'repos/{owner}/{repo}/issues?state=open&'*) json=$(cat "$BOARD_TEST/issues.json") ;;
  'repos/{owner}/{repo}/issues/'*/comments'?'*) json='[]' ;;
  'repos/{owner}/{repo}/issues/'*) json=$(jq --argjson n "${endpoint##*/}" '.[] | select(.number == $n)' "$BOARD_TEST/issues.json") ;;
  'repos/{owner}/{repo}/issues?state=closed&'* | 'repos/{owner}/{repo}/pulls?state=open&'*) json='[]' ;;
  *) exit 1 ;;
esac
printf '%s\n' "$json" | jq -r "$filter"
EOF
cat >"$tmp/bin/agent" <<'EOF'
#!/bin/bash
set -euo pipefail
S=$BOARD_TEST
host=${0##*/}
echo "$$" >>"$S/pids"
if [ "$1" = plugin ]; then
  if [ "${2:-}" = list ]; then
    jq -nc --arg p "$BOARD_PLUGIN" '[{id:"celetis@celetis",scope:"user",enabled:true,installPath:$p}]'
  fi
  exit 0
fi
if [ "$1" = app-server ]; then
  while IFS= read -r line; do
    method=$(printf '%s\n' "$line" | jq -r .method)
    id=$(printf '%s\n' "$line" | jq -r .id)
    case $method in
      initialize) printf '{"id":%s,"result":{}}\n' "$id" ;;
      initialized) ;;
      skills/list)
        jq -nc --argjson id "$id" --arg p "$BOARD_PLUGIN" --arg cwd "$PWD" '{id:$id,result:{data:[{cwd:$cwd,skills:[{name:"celetis:guide",pluginId:"celetis@celetis",enabled:true,path:($p+"/skills/guide/SKILL.md")}]}]}}' ;;
      config/read) printf '{"id":%s,"result":{"config":{"developer_instructions":null}}}\n' "$id" ;;
      thread/read)
        jq -nc --argjson id "$id" --arg sid "$(cat "$S/id")" --arg cwd "$PWD" --argjson created "$(cat "$S/created")" '{id:$id,result:{thread:{id:$sid,cwd:$cwd,createdAt:$created,ephemeral:false}}}' ;;
      thread/turns/list) printf '{"id":%s,"result":{"data":[{"id":"turn"}]}}\n' "$id" ;;
      *) exit 1 ;;
    esac
  done
  exit 0
fi
jq -nc --arg host "$host" --arg cwd "$PWD" --args '{host:$host,cwd:$cwd,args:$ARGS.positional}' -- "$@" >>"$S/calls"
if [ "$1" = resume ] || [ "$1" = --resume ]; then exit 0; fi
for prompt; do :; done
n=$(printf '%s' "$prompt" | sed -n 's/.*#\([0-9][0-9]*\).*/\1/p')
id="00000000-0000-4000-8000-00000000000$n"
echo "$id" >"$S/id"
date +%s >"$S/created"
mkdir -p "$CLAUDE_CONFIG_DIR/projects/fixture"
jq -nc --arg id "$id" --arg cwd "$PWD" --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{type:"user",sessionId:$id,cwd:$cwd,timestamp:$timestamp,message:{role:"user",content:"fixture"}}' >"$CLAUDE_CONFIG_DIR/projects/fixture/$id.jsonl"
touch "$S/live"
record="$(git rev-parse --git-common-dir)/celetis-flow/sessions/$n.json"
for attempt in {1..100}; do
  if jq -e --arg id "$id" '.session_id == $id' "$record" >/dev/null 2>&1; then
    rm "$S/live"
    exit 0
  fi
  /bin/sleep 0.05
done
rm "$S/live"
echo 'fixture: the runner did not verify the saved session' >&2
exit 1
EOF
cp "$tmp/bin/agent" "$tmp/bin/claude"
cp "$tmp/bin/agent" "$tmp/bin/codex"
rm "$tmp/bin/agent"
cat >"$tmp/bin/herdr" <<'EOF'
#!/bin/bash
set -euo pipefail
S=$BOARD_TEST
case "$1 $2" in
  'api snapshot') echo '{"result":{"snapshot":{"agents":[],"tabs":[]}}}' ;;
  'workspace list') echo '{"result":{"workspaces":[]}}' ;;
  'workspace create') echo '{"result":{"root_pane":{"pane_id":"w1:p1"},"tab":{"tab_id":"w1:t1"}}}' ;;
  'tab rename') echo '{"result":{}}' ;;
  'pane run')
    printf '%s\n' "$4" >>"$S/commands"
    echo "$$" >>"$S/pids"
    cd "$BOARD_PRODUCT"
    export HERDR_ENV=1 HERDR_PANE_ID=w1:p1 HERDR_TAB_ID=w1:t1
    /bin/bash -c "$4" >>"$S/run-output" 2>&1 || { cat "$S/run-output" >&2; exit 1; }
    echo '{"result":{}}' ;;
  'agent get')
    [ -f "$S/live" ] || exit 1
    jq -c --arg id "$(cat "$S/id")" --arg cwd "$PWD" --arg pane "$HERDR_PANE_ID" '.result.agent |= (.agent_status = "idle" | .cwd = $cwd | .foreground_cwd = $cwd | .pane_id = $pane | .agent_session.value = $id)' "$CELETIS_TEST_HERDR_FIXTURES/$CELETIS_AGENT.json" ;;
  'agent wait') while [ -f "$S/live" ]; do /bin/sleep 0.05; done; exit 1 ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$tmp/bin/"*
for command in bash jq git dirname mkdir cat mktemp mkfifo rm sleep mv ps touch perl date tr grep sed; do
  ln -s "$(command -v "$command")" "$tmp/bin/$command"
done
node=$(command -v node)
git init -q "$BOARD_PRODUCT"
git -C "$BOARD_PRODUCT" add .
git -C "$BOARD_PRODUCT" commit -qm fixture
git -C "$BOARD_PRODUCT" config celetis-flow.agent claude
jq -nc '[range(7;11) | {number:.,title:"Fixture issue",html_url:("https://example.test/issues/"+tostring),state:"open",labels:[{name:"enhancement"}],body:"Spec: fixture",comments:0,updated_at:"2026-10-01T00:00:00Z",closed_at:null}]' >"$BOARD_TEST/issues.json"
cat >"$tmp/test.mjs" <<'EOF'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { readFile, rename } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [entry] = process.argv.slice(2)
const { createBoard, runData } = await import(pathToFileURL(join(dirname(resolve(entry)), 'server.mjs')))
const { readConfig } = await import(pathToFileURL(join(dirname(resolve(entry)), 'config.mjs')))
const main = process.env.BOARD_PRODUCT
const state = process.env.BOARD_TEST
const config = await readConfig(main)
const source = JSON.parse(await readFile(join(main, '.claude/celetis-flow/board.json'), 'utf8'))
assert.deepEqual(source.run, ['scripts/celetis', '--agent', '{agent}', 'celetis-flow', '{n}'], 'Run must pass the board selection to the launcher')
assert.deepEqual(source.data, ['scripts/celetis', 'celetis-flow', '--board'])
assert.deepEqual(source.resume, ['scripts/celetis', 'celetis-flow', '--resume', '{n}'])
let time = Date.now()
const server = createBoard({ main, config, now: () => time })
server.listen(0, '127.0.0.1')
try {
  await once(server, 'listening')
  const url = `http://127.0.0.1:${server.address().port}`
  const post = async (path, body = {}) => {
    const response = await fetch(`${url}/api/${path}`, { method: 'POST', headers: { origin: url, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return { status: response.status, body: await response.json() }
  }
  const ok = async (path, body) => assert.deepEqual(await post(path, body), { status: 200, body: { ok: true } })
  const git = (...args) => execFileSync('git', ['-C', main, ...args], { encoding: 'utf8' })
  const preference = () => git('config', '--get', 'celetis-flow.agent').trim()
  const otherConfig = () => git('config', '--local', '--list').split('\n').filter(line => !line.startsWith('celetis-flow.agent=')).sort()
  const calls = async () => (await readFile(join(state, 'calls'), 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  const producer = async () => {
    const data = await runData(main, config.data)
    assert.equal(data.error, null)
    return JSON.parse(data.output)
  }
  const initial = await (await fetch(`${url}/api/board`)).json()
  assert.equal(initial.defaultAgent, 'claude')
  assert.deepEqual(initial.agents, { claude: { available: true, cause: null }, codex: { available: true, cause: null } })
  const before = otherConfig()
  await ok('agent', { agent: 'codex' })
  assert.equal(preference(), 'codex')
  assert.deepEqual(otherConfig(), before, 'the board must write only celetis-flow.agent')
  assert.equal((await producer()).defaultAgent, 'codex')
  const changed = git('config', '--local', '--list')
  await ok('run', { number: 7, agent: 'claude' })
  assert.equal((await calls()).at(-1).host, 'claude')
  assert.equal(git('config', '--local', '--list'), changed, 'Run must not change the project preference')
  await ok('run', { number: 8 })
  assert.equal((await calls()).at(-1).host, 'codex')
  assert.equal(git('config', '--local', '--list'), changed)
  const saved = JSON.parse(await readFile(join(main, '.git/celetis-flow/sessions/8.json'), 'utf8'))
  assert.equal(saved.host, 'codex')
  assert.equal(saved.session_id, '00000000-0000-4000-8000-000000000008')
  await ok('agent', { agent: 'claude' })
  assert.equal((await producer()).defaultAgent, 'claude')
  time += 31_000
  await ok('resume', { number: 8 })
  assert.deepEqual((await calls()).at(-1), { host: 'codex', cwd: main, args: ['resume', '--no-daemon', saved.session_id] })
  assert.equal(preference(), 'claude')
  const started = (await calls()).length
  const commands = await readFile(join(state, 'commands'), 'utf8')
  await rename(join(process.env.PATH, 'codex'), join(state, 'hidden-codex'))
  await ok('refresh')
  assert.equal((await producer()).agents.codex.available, false)
  for (const agent of ['codex', 'unknown']) {
    assert.equal((await post('run', { number: 9, agent })).status, 409)
    assert.equal((await post('agent', { agent })).status, 409)
  }
  assert.equal((await calls()).length, started, 'a refused choice must start no agent')
  assert.equal(await readFile(join(state, 'commands'), 'utf8'), commands, 'a refused choice must open no command')
  assert.equal(preference(), 'claude')
  assert.deepEqual(otherConfig(), before)
  assert.equal(git('status', '--porcelain'), '')
  console.log('board-agent: PASS')
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
EOF
PATH="$tmp/bin" "$node" "$tmp/test.mjs" "$board"
