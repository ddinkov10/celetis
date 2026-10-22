#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
export BOARD_TEST="$tmp/state" BOARD_PLUGIN="$tmp/installed package" BOARD_PRODUCT="$tmp/product checkout"
export CLAUDE_CONFIG_DIR="$tmp/claude" CODEX_HOME="$tmp/codex"
export CELETIS_TEST_HERDR_FIXTURES="$root/tests/fixtures/herdr"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
unset CELETIS_AGENT HERDR_ENV HERDR_PANE_ID HERDR_TAB_ID
trap 'kill $(cat "$BOARD_TEST/pids" 2>/dev/null) 2>/dev/null || true; rm -rf "$tmp"' EXIT
mkdir -p "$BOARD_TEST" "$BOARD_PLUGIN" "$BOARD_PRODUCT/scripts" "$tmp/bin" "$tmp/stub"
BOARD_PRODUCT=$(cd "$BOARD_PRODUCT" && pwd -P)
cp -R "$root/scripts" "$root/.claude-plugin" "$root/board" "$BOARD_PLUGIN/"
board="$BOARD_PLUGIN/board/cli.mjs"
mkdir -p "$BOARD_PLUGIN/skills/guide"
echo fixture >"$BOARD_PLUGIN/skills/guide/SKILL.md"
echo fixture >"$BOARD_PLUGIN/step-prompt.md"
cp "$root/scripts/celetis" "$BOARD_PRODUCT/scripts/celetis"
printf 'landing: pr\nhost: claude\n' >"$BOARD_PRODUCT/.celetis.yaml"
cat >"$tmp/stub/node" <<'EOF'
#!/bin/bash
printf '%s\n' "$@" >"$BOARD_TEST/board-argv"
cat >"$BOARD_TEST/board-input.json"
EOF
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
for attempt in {1..600}; do
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
    cd "$BOARD_PRODUCT"
    export HERDR_ENV=1 HERDR_PANE_ID=w1:p1 HERDR_TAB_ID=w1:t1
    rm -f "$S/ran"
    ( /bin/bash -c "$4" >>"$S/run-output" 2>&1; echo "$?" >"$S/ran.tmp"; mv "$S/ran.tmp" "$S/ran" ) </dev/null >/dev/null 2>&1 &
    echo "$!" >>"$S/pids"
    echo '{"result":{}}' ;;
  'agent get')
    [ -f "$S/live" ] || exit 1
    jq -c --arg id "$(cat "$S/id")" --arg cwd "$PWD" --arg pane "$HERDR_PANE_ID" '.result.agent |= (.agent_status = "idle" | .cwd = $cwd | .foreground_cwd = $cwd | .pane_id = $pane | .agent_session.value = $id)' "$CELETIS_TEST_HERDR_FIXTURES/$CELETIS_AGENT.json" ;;
  'agent wait') while [ -f "$S/live" ]; do /bin/sleep 0.05; done; exit 1 ;;
  *) exit 1 ;;
esac
EOF
chmod +x "$tmp/bin/"* "$tmp/stub/node"
for command in bash jq yq bun git dirname mkdir cat mktemp mkfifo rm sleep mv ps touch perl date tr grep sed; do
  ln -s "$(command -v "$command")" "$tmp/bin/$command"
done
node=$(command -v node)
git init -q "$BOARD_PRODUCT"
git -C "$BOARD_PRODUCT" add .
git -C "$BOARD_PRODUCT" commit -qm fixture
git -C "$BOARD_PRODUCT" config celetis-flow.agent claude
(cd "$BOARD_PRODUCT" && PATH="$tmp/stub:$tmp/bin" /bin/bash "$BOARD_PLUGIN/scripts/board.sh")
[ "$(cat "$BOARD_TEST/board-argv")" = "$board"$'\n--config-stdin' ] || {
  echo "board-agent: FAIL: the adapter did not start $board: $(cat "$BOARD_TEST/board-argv")" >&2
  exit 1
}
jq -nc '[range(6;10) | {number:.,title:"Fixture issue",html_url:("https://example.test/issues/"+tostring),state:"open",labels:[{name:"enhancement"}],body:"Spec: fixture",comments:0,updated_at:"2026-10-01T00:00:00Z",closed_at:null}]' >"$BOARD_TEST/issues.json"
cat >"$tmp/test.mjs" <<'EOF'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [entry] = process.argv.slice(2)
const { createBoard, runData } = await import(pathToFileURL(join(dirname(resolve(entry)), 'server.mjs')))
const { parseConfig } = await import(pathToFileURL(join(dirname(resolve(entry)), 'config.mjs')))
const main = process.env.BOARD_PRODUCT
const state = process.env.BOARD_TEST
const source = JSON.parse(await readFile(join(state, 'board-input.json'), 'utf8'))
const config = await parseConfig(main, JSON.stringify(source), 'the input')
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
  const launched = async (path, body) => {
    await ok(path, body)
    for (let i = 0; i < 1200; i++) {
      const code = await readFile(join(state, 'ran'), 'utf8').catch(() => null)
      if (code !== null) return assert.equal(code.trim(), '0', await readFile(join(state, 'run-output'), 'utf8'))
      await new Promise(done => setTimeout(done, 50))
    }
    assert.fail(`the ${path} command did not end in 60 seconds`)
  }
  const refuseDefault = async agent => assert.deepEqual(await post('agent', { agent }), {
    status: 409,
    body: { error: 'The producer controls the default agent. Change it in the producer configuration.' }
  }, 'the board must refuse producer-default changes')
  const git = (...args) => execFileSync('git', ['-C', main, ...args], { encoding: 'utf8' })
  const preference = () => git('config', '--get', 'celetis-flow.agent').trim()
  const localConfig = () => git('config', '--local', '--null', '--list')
  const calls = async () => (await readFile(join(state, 'calls'), 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  const producer = async () => {
    const data = await runData(main, config.data)
    assert.equal(data.error, null)
    return JSON.parse(data.output)
  }
  const initial = await (await fetch(`${url}/api/board`)).json()
  assert.equal(initial.defaultAgent, 'claude')
  assert.deepEqual(initial.agents, { claude: { available: true, cause: null }, codex: { available: true, cause: null } })
  const yaml = await readFile(join(main, '.celetis.yaml'))
  assert.deepEqual(yaml, execFileSync('git', ['-C', main, 'show', 'HEAD:.celetis.yaml']))
  const before = localConfig()
  const gitConfig = await readFile(join(main, '.git/config'))
  assert.equal(preference(), 'claude')
  const initialCalls = await calls()
  await refuseDefault('codex')
  assert.deepEqual(await readFile(join(main, '.celetis.yaml')), yaml, 'a refused default must leave tracked YAML unchanged')
  assert.equal(localConfig(), before, 'a refused default must leave all local Git settings unchanged')
  assert.deepEqual(await readFile(join(main, '.git/config')), gitConfig, 'a refused default must leave the Git config bytes unchanged')
  assert.equal((await producer()).defaultAgent, 'claude', 'the producer must ignore the old Git preference')
  assert.equal((await (await fetch(`${url}/api/board`)).json()).defaultAgent, 'claude')
  assert.deepEqual(await calls(), initialCalls, 'a refused default must start no agent')
  assert.equal(await readFile(join(state, 'commands'), 'utf8').catch(() => ''), '', 'a refused default must open no command')
  assert.equal(git('status', '--porcelain'), '')
  await launched('run', { number: 6 })
  assert.equal((await calls()).at(-1).host, 'claude', 'an unqualified Run must keep the YAML default after refusal')
  assert.deepEqual(await readFile(join(main, '.celetis.yaml')), yaml)
  assert.equal(localConfig(), before)
  await writeFile(join(main, '.celetis.yaml'), 'landing: pr\nhost: codex\n')
  git('add', '.celetis.yaml')
  git('commit', '-qm', 'fixture Codex default')
  await ok('refresh')
  assert.equal((await producer()).defaultAgent, 'codex')
  await launched('run', { number: 7, agent: 'claude' })
  assert.equal((await calls()).at(-1).host, 'claude')
  assert.equal(localConfig(), before, 'Run must not change any local Git setting')
  await launched('run', { number: 8 })
  assert.equal((await calls()).at(-1).host, 'codex')
  assert.equal(localConfig(), before)
  const saved = JSON.parse(await readFile(join(main, '.git/celetis-flow/sessions/8.json'), 'utf8'))
  assert.equal(saved.host, 'codex')
  assert.equal(saved.session_id, '00000000-0000-4000-8000-000000000008')
  const codexYaml = await readFile(join(main, '.celetis.yaml'))
  await refuseDefault('claude')
  assert.deepEqual(await readFile(join(main, '.celetis.yaml')), codexYaml)
  assert.equal(localConfig(), before)
  assert.equal((await producer()).defaultAgent, 'codex')
  assert.equal((await (await fetch(`${url}/api/board`)).json()).defaultAgent, 'codex')
  await writeFile(join(main, '.celetis.yaml'), 'landing: pr\nhost: claude\n')
  git('add', '.celetis.yaml')
  git('commit', '-qm', 'fixture Claude default')
  await ok('refresh')
  assert.equal((await producer()).defaultAgent, 'claude')
  time += 31_000
  await launched('resume', { number: 8 })
  assert.deepEqual((await calls()).at(-1), { host: 'codex', cwd: main, args: ['resume', '--no-daemon', saved.session_id] })
  assert.equal(preference(), 'claude')
  const started = (await calls()).length
  const commands = await readFile(join(state, 'commands'), 'utf8')
  await rename(join(process.env.PATH, 'codex'), join(state, 'hidden-codex'))
  await ok('refresh')
  assert.equal((await producer()).agents.codex.available, false)
  for (const agent of ['codex', 'unknown']) {
    assert.equal((await post('run', { number: 9, agent })).status, 409)
    await refuseDefault(agent)
  }
  assert.equal((await calls()).length, started, 'a refused choice must start no agent')
  assert.equal(await readFile(join(state, 'commands'), 'utf8'), commands, 'a refused choice must open no command')
  assert.equal(preference(), 'claude')
  assert.equal(localConfig(), before)
  assert.deepEqual(await readFile(join(main, '.git/config')), gitConfig)
  assert.deepEqual(await readFile(join(main, '.celetis.yaml')), yaml)
  assert.equal(git('status', '--porcelain'), '')
  console.log('board-agent: PASS')
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
EOF
PATH="$tmp/bin" "$node" "$tmp/test.mjs" "$board"
