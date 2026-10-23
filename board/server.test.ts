import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBoard, run, runData } from './server.ts';
import { entries, executable, test, values } from './test-support.ts';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const ago = (seconds: any) => new Date(NOW - seconds * 1000).toISOString();
const FLOW: any = {
  lanes: {
    feature: ['triage', 'specify', 'plan', 'implement'],
    bug: ['triage', 'bug', 'plan', 'implement'],
    chore: ['triage', 'chore'],
    hotfix: ['triage', 'hotfix'],
  },
  stages: [
    { name: 'Triage', steps: ['triage'] },
    { name: 'Define', steps: ['specify', 'bug', 'chore', 'hotfix'] },
    { name: 'Plan', steps: ['plan'] },
    { name: 'Implement', steps: ['implement'] },
  ],
  steps: { plan: { gate: 'auto' }, implement: { gate: 'me', hint: 'It lands the change when the build is done.' } },
};
const row = (number: any, state: any, extra = {}) => ({
  number,
  title: `Issue ${number}`,
  url: `https://example.test/issues/${number}`,
  type: 'bug',
  state,
  updatedAt: ago(600),
  closedAt: null,
  pr: null,
  ...extra,
});
const ready = (number: any, step: any, extra = {}) => row(number, 'ready', { step, ...extra });
const BOARD: any = {
  contract: 1,
  tracker: 'GitHub',
  flow: FLOW,
  noRun: null,
  runner: false,
  issues: [ready(402, 'plan', { started: true }), ready(9, 'specify'), row(5, 'starting', { step: 'bug' })],
};
const STUCK: any = { ...BOARD, issues: [row(388, 'stuck', { step: 'implement', act: 'x' }), ready(402, 'plan')] };
const CONFIG: any = {
  data: ["/co/it's/data.sh", '--board'],
  run: ["/co/it's/run.sh", '{n}'],
  resume: ["/co/it's/run.sh", '--resume', '{n}'],
  port: null,
};
const NO_CONFIG: any = { data: null, run: null, resume: null, port: null };
const ok = (value: any) => ({ code: 0, stdout: JSON.stringify(value), stderr: '' });
const out = (stdout: any, code = 0) => ({ code, stdout, stderr: '' });
const LIST = {
  result: {
    workspaces: [
      { label: 'other', workspace_id: 'w1' },
      { label: 'fwrh', workspace_id: 'w2' },
    ],
  },
};
const MADE = { result: { tab: { tab_id: 'w2:t9' }, root_pane: { pane_id: 'w2:p9' } } };
const herdrOk = (args: any) => (args[1] === 'list' ? ok(LIST) : args[1] === 'create' ? ok(MADE) : ok({ result: {} }));
const NOT_FOUND =
  '{"error":{"code":"workspace_not_found","message":"workspace no-such-workspace not found"},"id":"cli:tab:create"}';
const agent = (terminal: any, label: any, extra = {}) => ({
  terminal: {
    terminal_id: terminal,
    pane_id: `w2:${terminal}`,
    tab_id: `t-${terminal}`,
    agent: 'claude',
    agent_status: 'idle',
    cwd: '/repo/fwrh',
    ...extra,
  },
  tab: { tab_id: `t-${terminal}`, label },
});
const SCREEN = '  ● Bash(git push)\n\n────────────\n │ Bash command\t│\n\n   git push -u origin x\x1b\n ❯ 1. Yes\n';
const JSON_TYPE: any = { 'Content-Type': 'application/json' };

const start = async (t: any, { herdr, agents = [], board = BOARD, main = '/repo/fwrh', config = CONFIG }: any = {}) => {
  const world: any = {
    board,
    agents,
    clock: NOW,
    calls: [],
    options: new Map(),
    screen: () => ({ code: 0, stdout: SCREEN, stderr: '' }),
    git: () => ({ code: 0, stdout: ' 3 files changed, 18 insertions(+), 4 deletions(-)\n', stderr: '' }),
    data: () =>
      typeof world.board === 'string'
        ? { code: 1, stdout: 'stop cannot read the issues from GitHub\n', stderr: `${world.board}\nmore\n` }
        : ok(world.board),
  };
  const fromWorld = (args: any) => {
    if (args[0] === 'api')
      return ok({
        result: {
          type: 'session_snapshot',
          snapshot: { tabs: world.agents.map((a: any) => a.tab), agents: world.agents.map((a: any) => a.terminal) },
        },
      });
    return args[0] === 'agent' && args[1] === 'read' ? world.screen(args) : herdrOk(args);
  };
  const exec = async (file: any, args: any, options: any) => {
    const call = [file, ...args];
    world.calls.push(call);
    world.options.set(call, options);
    if (file === 'herdr') return (herdr ?? fromWorld)(args);
    if (file === 'git') return world.git(args);
    return world.data();
  };
  const server = createBoard({ main, config, exec, now: () => world.clock });
  await new Promise<any>((done) => server.listen(0, '127.0.0.1', () => done(undefined)));
  t.after(() => server.close());
  const { port } = server.address() as { port: number };
  world.port = port;
  world.origin = `http://127.0.0.1:${port}`;
  world.call = (method: any, path: any, headers = {}, body: any) =>
    new Promise<any>((done, fail) => {
      request({ host: '127.0.0.1', port, method, path, headers }, (response) => {
        let text = '';
        response
          .setEncoding('utf8')
          .on('data', (chunk) => {
            text += chunk;
          })
          .on('end', () =>
            done({
              status: response.statusCode,
              headers: response.headers,
              text,
              json: text.startsWith('{') ? JSON.parse(text) : null,
            }),
          );
      })
        .on('error', fail)
        .end(body);
    });
  world.get = (path: any) => world.call('GET', path);
  world.post = (path: any, value: any) =>
    world.call('POST', path, { ...JSON_TYPE, Origin: world.origin }, JSON.stringify(value));
  world.herdr = () =>
    world.calls
      .filter((call: any) => call[0] === 'herdr' && call[1] !== 'api' && call[2] !== 'read')
      .map((call: any) => call.slice(1));
  world.snapshots = () => world.calls.filter((call: any) => call[0] === 'herdr' && call[1] === 'api').length;
  world.screens = () =>
    world.calls.filter((call: any) => call[0] === 'herdr' && call[2] === 'read').map((call: any) => call.slice(1));
  world.reads = () => world.calls.filter((call: any) => call[0] !== 'herdr' && call[0] !== 'git');
  world.gits = () => world.calls.filter((call: any) => call[0] === 'git').map((call: any) => call.slice(1));
  world.card = async (number: any) =>
    (values((await world.get('/api/board')).json.columns) as any[])
      .flat()
      .find((c) => c.number === number && c.sessionId === null);
  return world;
};

test('GET /api/board reads the data with the data command of the config and places the cards', async (t) => {
  const w = await start(t);
  const { status, json, headers } = await w.get('/api/board');
  assert.equal(status, 200);
  assert.match(headers['content-type'], /^application\/json/);
  assert.deepEqual(Object.keys(json).sort(), [
    'agents',
    'can',
    'columns',
    'defaultAgent',
    'flow',
    'herdr',
    'noRun',
    'repo',
    'runner',
    'source',
    'tracker',
  ]);
  assert.deepEqual(
    [json.noRun, json.tracker, json.source, json.repo, json.can],
    [
      null,
      'GitHub',
      { isSet: true, readAt: '2026-10-08T12:00:00.000Z', error: null },
      'fwrh',
      { run: true, resume: true },
    ],
  );
  assert.deepEqual(json.flow, FLOW);
  assert.deepEqual(
    Object.fromEntries(entries(json.columns).map(([key, cards]) => [key, cards.map((c: any) => c.number)])),
    { needs: [402], running: [5], idle: [9], done: [] },
  );
  assert.deepEqual(w.reads(), [["/co/it's/data.sh", '--board']]);
  assert.deepEqual(w.options.get(w.reads()[0]), { cwd: '/repo/fwrh', timeout: 60_000 });
});

test('the first request waits for the first read of the data', async (t) => {
  const w = await start(t);
  w.data = () => new Promise<any>((done) => setImmediate(() => done(ok(BOARD))));
  assert.deepEqual(
    (await w.get('/api/board')).json.columns.needs.map((c: any) => c.number),
    [402],
  );
});

test('the data of the issues is read again only when it is older than 60 seconds', async (t) => {
  const w = await start(t);
  await w.get('/api/board');
  w.clock += 60_000;
  await w.get('/api/board');
  assert.equal(w.reads().length, 1);
  w.clock += 1;
  await w.get('/api/board');
  assert.equal(w.reads().length, 2);
});

test('the end of a session starts one read of the issues, and the card of the issue gets Run', async (t) => {
  const w = await start(t, { agents: [agent('s1', '#5 bug', { agent_status: 'working' })] });
  assert.deepEqual(
    (await w.get('/api/board')).json.columns.running.map((c: any) => c.sessionId),
    ['s1'],
  );
  w.agents = [];
  w.board = { ...BOARD, issues: [ready(5, 'plan')] };
  w.clock += 5000;
  assert.deepEqual([(await w.card(5)).state, w.reads().length], ['starts', 2]);
  assert.deepEqual([(await w.card(5)).run, (await w.card(5)).step, w.reads().length], [true, 'plan', 2]);
});

test('a read that fails keeps the last good data and names the error', async (t) => {
  const w = await start(t);
  await w.get('/api/board');
  w.board = 'HTTP 502';
  w.clock += 5000;
  assert.equal((await w.post('/api/refresh', {})).status, 200);
  const { json } = await w.get('/api/board');
  assert.deepEqual(json.source, { isSet: true, readAt: '2026-10-08T12:00:00.000Z', error: 'HTTP 502' });
  assert.deepEqual(
    json.columns.needs.map((c: any) => c.number),
    [402],
  );
});

const withLane = (key: any, steps: any) => ok({ ...BOARD, flow: { ...FLOW, lanes: { ...FLOW.lanes, [key]: steps } } });
for (const [name, output, error] of [
  [
    'gives a row with a state outside the six',
    ok({ ...BOARD, issues: [row(1, 'waiting'), ready(2, 'plan')] }),
    'issues[0].state: "waiting" is not a state of contract 1',
  ],
  [
    'gives a URL that is not https:// or http://',
    ok({ ...BOARD, issues: [ready(1, 'plan', { url: 'javascript:alert(1)' })] }),
    'issues[0].url: is not an https:// or http:// URL or null',
  ],
  [
    'gives a lane key that is not lowercase letters',
    withLane('Bug', ['triage']),
    'flow.lanes.Bug: is not a name of lowercase letters only',
  ],
  [
    'gives a step name that is not lowercase letters',
    withLane('chore', ['triage', 'chore', 'do-it']),
    'flow.lanes.chore[2]: is not a name of lowercase letters only',
  ],
  ['exits 0 with no output', out(''), 'the data is not JSON'],
  ['exits 0 with a text line before the JSON', out('npm warn\n{}'), 'the data is not JSON'],
  ['exits 1 with a line on stdout and no stderr', out('stop cannot read\n', 1), 'stop cannot read'],
  ['exits 3 with no output', out('', 3), 'the data command exited 3'],
]) {
  test(`a data command that ${name} keeps the cards of the last good read, and the error is its first cause`, async (t) => {
    const w = await start(t);
    await w.get('/api/board');
    w.data = () => output;
    w.clock += 5000;
    assert.equal((await w.post('/api/refresh', {})).status, 200);
    const { json } = await w.get('/api/board');
    assert.deepEqual(json.source, { isSet: true, readAt: '2026-10-08T12:00:00.000Z', error });
    assert.deepEqual(
      values(json.columns)
        .flat()
        .map((c) => c.number),
      [402, 5, 9],
    );
  });
}

test('a document with another contract drops the last good read: no issue card, and the session cards stay', async (t) => {
  const w = await start(t, { agents: [agent('s1', '#402 plan')] });
  const cards = async () =>
    values((await w.get('/api/board')).json.columns)
      .flat()
      .map((c) => [c.sessionId ?? c.number, c.step, c.title]);
  assert.deepEqual(await cards(), [
    ['s1', 'plan', 'Issue 402'],
    [5, 'bug', 'Issue 5'],
    [9, 'specify', 'Issue 9'],
  ]);
  w.board = { ...BOARD, contract: 2 };
  w.clock += 5000;
  assert.equal((await w.post('/api/refresh', {})).status, 200);
  const { json } = await w.get('/api/board');
  assert.deepEqual(json.source, {
    isSet: true,
    readAt: null,
    error: 'the data has contract 2; this board reads contract 1',
  });
  assert.deepEqual([json.flow, json.tracker, json.runner, json.noRun], [null, null, null, null]);
  assert.deepEqual(await cards(), [['s1', null, '#402 plan']]);
  w.board = BOARD;
  assert.equal((await w.post('/api/refresh', {})).status, 200);
  assert.deepEqual((await w.get('/api/board')).json.source, {
    isSet: true,
    readAt: '2026-10-08T12:00:05.000Z',
    error: null,
  });
  assert.deepEqual(await cards(), [
    ['s1', 'plan', 'Issue 402'],
    [5, 'bug', 'Issue 5'],
    [9, 'specify', 'Issue 9'],
  ]);
});

test('a first read that fails gives the error and no issue card', async (t) => {
  const w = await start(t, { board: 'HTTP 502' });
  const { status, json } = await w.get('/api/board');
  assert.equal(status, 200);
  assert.deepEqual(json.source, { isSet: true, readAt: null, error: 'HTTP 502' });
  assert.deepEqual(values(json.columns).flat(), []);
});

test('with no data entry in the config, the board reads nothing and shows the session cards only', async (t) => {
  const w = await start(t, { config: NO_CONFIG, agents: [agent('s1', '#402 plan')] });
  const { status, json } = await w.get('/api/board');
  assert.equal(status, 200);
  assert.deepEqual(
    [json.source, json.flow, json.tracker, json.can],
    [{ isSet: false, readAt: null, error: null }, null, null, { run: false, resume: false }],
  );
  assert.deepEqual(
    values(json.columns)
      .flat()
      .map((c) => [c.sessionId, c.number, c.step, c.title]),
    [['s1', 402, null, '#402 plan']],
  );
  assert.equal((await w.post('/api/refresh', {})).status, 200);
  w.agents = [];
  assert.deepEqual(values((await w.get('/api/board')).json.columns).flat(), []);
  assert.deepEqual(w.reads(), []);
});

test('a herdr agent of the repository takes the place of its issue, and an agent of another folder makes no card', async (t) => {
  const w = await start(t, { agents: [agent('s1', '#402 plan'), agent('s2', '#9 specify', { cwd: '/repo/other' })] });
  const { json } = await w.get('/api/board');
  assert.deepEqual(
    json.columns.needs.map((c: any) => [c.sessionId, c.number, c.step, c.state, c.waitFor, c.agent, c.go]),
    [['s1', 402, 'plan', 'waits', 'turn', 'claude', true]],
  );
  assert.deepEqual(
    json.columns.idle.map((c: any) => c.number),
    [9],
  );
});

test('the step word of a tab label counts only when the flow of the data names that step', async (t) => {
  const needs = async (world: any) =>
    (await (await start(t, world)).get('/api/board')).json.columns.needs.map((c: any) => [
      c.sessionId,
      c.number,
      c.step,
    ]);
  assert.deepEqual(await needs({ agents: [agent('s1', '#402 review')] }), [['s1', 402, null]]);
  assert.deepEqual(await needs({ agents: [agent('s1', '#402 plan')], board: 'HTTP 502' }), [['s1', 402, null]]);
});

test('each session card shows the last lines of its pane with no rule, box, or control characters, and a local read does not read them again', async (t) => {
  const w = await start(t, {
    agents: [
      agent('s1', '#402 plan', { agent_status: 'blocked' }),
      agent('s2', 'notes', { pane_id: '--help' }),
      agent('s3', 'more', { pane_id: ['w2:s3'] }),
    ],
  });
  const screenOf = async (path: any) =>
    values((await w.get(path)).json.columns)
      .flat()
      .filter((c) => c.sessionId)
      .map((c) => [c.sessionId, c.screen]);
  assert.deepEqual(await screenOf('/api/board'), [
    ['s1', ['● Bash(git push)', 'Bash command', 'git push -u origin x', '❯ 1. Yes']],
    ['s2', []],
    ['s3', []],
  ]);
  assert.deepEqual(w.screens(), [['agent', 'read', 'w2:s1', '--source', 'visible']]);
  w.screen = () => ({ code: 0, stdout: 'later\n', stderr: '' });
  assert.deepEqual((await screenOf('/api/board?local=1'))[0], [
    's1',
    ['● Bash(git push)', 'Bash command', 'git push -u origin x', '❯ 1. Yes'],
  ]);
  assert.equal(w.screens().length, 1);
  w.screen = () => ({ code: 1, stdout: '', stderr: 'agent_not_idle' });
  assert.deepEqual((await screenOf('/api/board'))[0], [
    's1',
    ['● Bash(git push)', 'Bash command', 'git push -u origin x', '❯ 1. Yes'],
  ]);
  w.screen = () => ({ code: 0, stdout: Array.from({ length: 30 }, (_, n) => `line ${n}`).join('\n'), stderr: '' });
  const lines = ((await screenOf('/api/board'))[0] as any)[1];
  assert.deepEqual([lines.length, lines[0], lines.at(-1)], [16, 'line 14', 'line 29']);
});

test('a session keeps its since while its state stays, idle and done count as one state, and a new state starts a new since', async (t) => {
  const w = await start(t, { agents: [agent('s1', '#402 plan')] });
  const since = async () =>
    (await w.get('/api/board')).json.columns.needs[0]?.since ??
    (await w.get('/api/board')).json.columns.running[0].since;
  assert.equal(await since(), '2026-10-08T12:00:00.000Z');
  w.clock += 30_000;
  w.agents = [agent('s1', '#402 plan', { agent_status: 'done' })];
  assert.equal(await since(), '2026-10-08T12:00:00.000Z');
  w.clock += 30_000;
  w.agents = [agent('s1', '#402 plan', { agent_status: 'working' })];
  assert.equal(await since(), '2026-10-08T12:01:00.000Z');
  w.clock += 30_000;
  w.agents = [agent('s1', '#402 plan', { agent_status: 'idle' })];
  assert.equal(await since(), '2026-10-08T12:01:30.000Z');
});

test('Run makes one tab with no focus and runs the run command of the config in it', async (t) => {
  const w = await start(t);
  await w.get('/api/board');
  assert.deepEqual([(await w.post('/api/run', { number: 402 })).json], [{ ok: true }]);
  assert.deepEqual(w.herdr(), [
    ['workspace', 'list'],
    ['tab', 'create', '--workspace', 'w2', '--cwd', '/repo/fwrh', '--label', '#402 plan', '--no-focus'],
    ['pane', 'run', 'w2:p9', `'/co/it'\\''s/run.sh' 402 && exit`],
  ]);
  assert.equal(w.reads().length, 2);
  assert.equal((await w.card(402)).run, false);
  assert.equal((await w.post('/api/run', { number: 402 })).status, 409);
  assert.equal(w.herdr().length, 3);
  w.clock += 30_000;
  assert.equal((await w.card(402)).run, true);
});

test('Run on a card with the step specify runs the run command, as on each other card', async (t) => {
  const w = await start(t);
  await w.get('/api/board');
  await w.post('/api/run', { number: 9 });
  assert.deepEqual(w.herdr().slice(1), [
    ['tab', 'create', '--workspace', 'w2', '--cwd', '/repo/fwrh', '--label', '#9 specify', '--no-focus'],
    ['pane', 'run', 'w2:p9', `'/co/it'\\''s/run.sh' 9 && exit`],
  ]);
});

test('POST /api/run with absent agent uses the default in every {agent} item', async (t) => {
  const agents = { claude: { available: true, cause: null }, opencode: { available: true, cause: null } };
  const w = await start(t, {
    board: { ...BOARD, agents, defaultAgent: 'claude' },
    config: { ...CONFIG, run: ["/co/it's/run.sh", '{agent}', '--agent', '{agent}', '{n}'] },
  });
  await w.get('/api/board');
  const { status, json } = await w.post('/api/run', { number: 402 });
  assert.equal(status, 200);
  assert.deepEqual(json, { ok: true });
  assert.deepEqual(w.herdr(), [
    ['workspace', 'list'],
    ['tab', 'create', '--workspace', 'w2', '--cwd', '/repo/fwrh', '--label', '#402 plan', '--no-focus'],
    ['pane', 'run', 'w2:p9', `'/co/it'\\''s/run.sh' 'claude' '--agent' 'claude' 402 && exit`],
  ]);
});

test('POST /api/run with an available override substitutes the override', async (t) => {
  const agents = { claude: { available: true, cause: null }, opencode: { available: true, cause: null } };
  const w = await start(t, {
    board: { ...BOARD, agents, defaultAgent: 'claude' },
    config: { ...CONFIG, run: ["/co/it's/run.sh", '--agent', '{agent}', '{n}'] },
  });
  await w.get('/api/board');
  assert.deepEqual((await w.post('/api/run', { number: 402, agent: 'opencode' })).json, { ok: true });
  assert.deepEqual(w.herdr()[1], [
    'tab',
    'create',
    '--workspace',
    'w2',
    '--cwd',
    '/repo/fwrh',
    '--label',
    '#402 plan',
    '--no-focus',
  ]);
  assert.equal(w.herdr().at(-1).at(-1), `'/co/it'\\''s/run.sh' '--agent' 'opencode' 402 && exit`);
  assert.equal((await w.get('/api/board')).json.defaultAgent, 'claude');
  assert.equal((await w.post('/api/run', { number: 9 })).status, 200);
  assert.equal(w.herdr().at(-1).at(-1), `'/co/it'\\''s/run.sh' '--agent' 'claude' 9 && exit`);
  w.board = { ...BOARD, agents, defaultAgent: 'opencode' };
  w.clock += 5000;
  assert.equal((await w.post('/api/refresh', {})).status, 200);
  assert.equal((await w.get('/api/board')).json.defaultAgent, 'opencode');
  w.clock += 30_000;
  assert.equal((await w.post('/api/run', { number: 402 })).status, 200);
  assert.equal(w.herdr().at(-1).at(-1), `'/co/it'\\''s/run.sh' '--agent' 'opencode' 402 && exit`);
});

test('an in-flight Run keeps its resolved agent while the next press uses the new default', async (t) => {
  const agents = { claude: { available: true, cause: null }, opencode: { available: true, cause: null } };
  const config = { ...CONFIG, run: ["/co/it's/run.sh", '--agent', '{agent}', '{n}'] };
  let delay = true;
  const herdr = async (args: any) => {
    if (delay && args[1] === 'list') await new Promise<any>((done) => setTimeout(done, 80));
    return herdrOk(args);
  };
  const w = await start(t, { board: { ...BOARD, agents, defaultAgent: 'claude' }, config, herdr });
  await w.get('/api/board');
  const pending = w.post('/api/run', { number: 402 });
  await new Promise<any>((done) => setTimeout(done, 10));
  w.board = { ...BOARD, agents, defaultAgent: 'opencode' };
  w.clock += 5000;
  assert.equal((await w.post('/api/refresh', {})).status, 200);
  delay = false;
  assert.equal((await pending).status, 200);
  assert.equal(
    w
      .herdr()
      .filter((call: any) => call[0] === 'pane')
      .at(-1)
      .at(-1),
    `'/co/it'\\''s/run.sh' '--agent' 'claude' 402 && exit`,
  );
  assert.equal((await w.post('/api/run', { number: 9 })).status, 200);
  assert.equal(w.herdr().at(-1).at(-1), `'/co/it'\\''s/run.sh' '--agent' 'opencode' 9 && exit`);
});

test('POST /api/run with unknown/unavailable/no-effective agent gets 409 with no herdr call', async (t) => {
  const agents = {
    claude: { available: true, cause: null },
    broken: { available: false, cause: 'binary missing\nsecond line' },
  };
  const configAgent = { ...CONFIG, run: ["/co/it's/run.sh", '--agent', '{agent}', '{n}'] };
  const boardAgent = { ...BOARD, agents, defaultAgent: 'claude' };
  for (const [agent, expected] of [
    ['nope', '#402 has no agent "nope"'],
    ['Claude', '#402 has no agent "Claude"'],
    ['a-b', '#402 has no agent "a-b"'],
    ['', '#402 has no agent ""'],
    [{}, '#402 has no agent "[object Object]"'],
    [123, '#402 has no agent "123"'],
    ['a; rm -rf ~', '#402 has no agent "a; rm -rf ~"'],
  ]) {
    const w = await start(t, { board: boardAgent, config: configAgent });
    await w.get('/api/board');
    const { status, json } = await w.post('/api/run', { number: 402, agent });
    assert.deepEqual([agent, status, json], [agent, 409, { error: expected }]);
    assert.deepEqual(w.herdr(), []);
  }
  {
    const w = await start(t, { board: boardAgent, config: configAgent });
    await w.get('/api/board');
    const { status, json } = await w.post('/api/run', { number: 402, agent: 'broken' });
    assert.deepEqual([status, json], [409, { error: 'binary missing' }]);
    assert.deepEqual(w.herdr(), []);
  }
  {
    const cause = `fi\x00rst\x7fline ${'a'.repeat(500)}\nsecond\x00line`;
    const agents2 = { claude: { available: true, cause: null }, broken: { available: false, cause } };
    const w = await start(t, { board: { ...BOARD, agents: agents2, defaultAgent: 'claude' }, config: configAgent });
    await w.get('/api/board');
    const { status, json } = await w.post('/api/run', { number: 402, agent: 'broken' });
    assert.equal(status, 409);
    assert.equal(json.error, `${'firstline'} ${'a'.repeat(500)}`.slice(0, 200));
    assert.ok(!json.error.includes('\n'));
    assert.ok(!/[\u0000-\u001f\u007f]/.test(json.error));
    assert.ok(json.error.length <= 200);
    assert.deepEqual(w.herdr(), []);
  }
  {
    const w = await start(t, { board: BOARD, config: configAgent });
    await w.get('/api/board');
    assert.deepEqual(await w.post('/api/run', { number: 402 }).then((r: any) => [r.status, r.json]), [
      409,
      { error: '#402 has no agent to run with' },
    ]);
    assert.deepEqual(w.herdr(), []);
    const { status, json } = await w.post('/api/run', { number: 402, agent: 'claude' });
    assert.deepEqual([status, json], [409, { error: '#402 has no agent "claude"' }]);
    assert.deepEqual(w.herdr(), []);
  }
  {
    const w = await start(t, { board: { ...BOARD, agents, defaultAgent: null }, config: configAgent });
    await w.get('/api/board');
    const { status, json } = await w.post('/api/run', { number: 402 });
    assert.deepEqual([status, json], [409, { error: '#402 has no agent to run with' }]);
    assert.deepEqual(w.herdr(), []);
  }
  {
    const w = await start(t, { board: 'HTTP 502', config: configAgent });
    await w.get('/api/board');
    assert.deepEqual(await w.post('/api/run', { number: 402 }).then((r: any) => [r.status, r.json]), [
      409,
      { error: '#402 has no agent to run with' },
    ]);
    assert.deepEqual(w.herdr(), []);
    const { status, json } = await w.post('/api/run', { number: 402, agent: 'claude' });
    assert.deepEqual([status, json], [409, { error: '#402 has no agent "claude"' }]);
    assert.deepEqual(w.herdr(), []);
  }
  {
    const w = await start(t, { board: { ...BOARD, agents, defaultAgent: 'broken' }, config: CONFIG });
    await w.get('/api/board');
    const { status, json } = await w.post('/api/run', { number: 402 });
    assert.deepEqual([status, json], [409, { error: 'binary missing' }]);
    assert.deepEqual(w.herdr(), []);
  }
});

test('POST /api/run with absent agent and legacy config runs the legacy line', async (t) => {
  const w = await start(t);
  await w.get('/api/board');
  const { status, json } = await w.post('/api/run', { number: 402 });
  assert.equal(status, 200);
  assert.deepEqual(json, { ok: true });
  const line = w.herdr().at(-1).at(-1);
  assert.equal(line, `'/co/it'\\''s/run.sh' 402 && exit`);
  assert.ok(!line.includes('claude') && !line.includes('opencode'));
});

test('POST /api/run with an explicit agent and legacy config gets 409 with no herdr call', async (t) => {
  const agents = { claude: { available: true, cause: null }, opencode: { available: true, cause: null } };
  const w = await start(t, { board: { ...BOARD, agents, defaultAgent: 'claude' } });
  await w.get('/api/board');
  const { status, json } = await w.post('/api/run', { number: 402, agent: 'opencode' });
  assert.deepEqual([status, json], [409, { error: '#402 has no agent "opencode"' }]);
  assert.deepEqual(w.herdr(), []);
});

test('with an {agent} run, the current 409s still hold with no herdr call', async (t) => {
  const agents = { claude: { available: true, cause: null }, opencode: { available: true, cause: null } };
  const configAgent = { ...CONFIG, run: ["/co/it's/run.sh", '--agent', '{agent}', '{n}'] };
  const w = await start(t, { board: { ...BOARD, agents, defaultAgent: 'claude' }, config: configAgent });
  await w.get('/api/board');
  for (const number of [5, 777]) {
    const { status, json } = await w.post('/api/run', { number });
    assert.equal(status, 409);
    assert.match(json.error, /^#\d+ /);
  }
  const noRun = 'The main checkout is dirty: /repo/fwrh. Commit or stash first.';
  const w2 = await start(t, { board: { ...BOARD, agents, defaultAgent: 'claude', noRun }, config: configAgent });
  await w2.get('/api/board');
  assert.equal((await w2.post('/api/run', { number: 402 })).status, 409);
  assert.deepEqual(w2.herdr(), []);
  assert.equal((await w.post('/api/run', { number: 402, agent: 'claude' })).status, 200);
  assert.equal((await w.post('/api/run', { number: 402, agent: 'claude' })).status, 409);
  assert.equal(w.herdr().filter((call: any) => call[0] === 'tab').length, 1);
});

test('the shell of a pane reads each item of the line as one word: a path with a space and a quote, and items with shell characters', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "board it's "));
  t.after(() => rm(folder, { recursive: true }));
  const script = join(folder, 'run.ts');
  await executable(script, `console.log(process.argv.slice(2).join('\\n'));`);
  const items = [
    "it's",
    'a b',
    '$(echo c)',
    "a'b $(touch marker)",
    '`echo d`',
    '"e"; f | g && h > i',
    '\\',
    '*',
    '~',
    '#',
  ];
  const agents = { claude: { available: true, cause: null } };
  const w = await start(t, {
    board: { ...BOARD, agents, defaultAgent: 'claude' },
    config: { ...CONFIG, run: [script, ...items, '--agent', '{agent}', '{n}'] },
  });
  await w.get('/api/board');
  assert.equal((await w.post('/api/run', { number: 402, agent: 'claude' })).status, 200);
  const line = w.herdr().at(-1).at(-1);
  assert.equal(await Bun.file(join(folder, 'marker')).exists(), false);
  assert.deepEqual(await run('/bin/sh', ['-c', line], { cwd: folder }), {
    code: 0,
    stdout: [...items, '--agent', 'claude', '402', ''].join('\n'),
    stderr: '',
  });
  assert.equal(await Bun.file(join(folder, 'marker')).exists(), false);
});

test('Run makes the workspace of the repository when no workspace has its label', async (t) => {
  const none = (args: any) =>
    args[1] === 'list' ? ok({ result: { workspaces: [{ label: 'other', workspace_id: 'w1' }] } }) : herdrOk(args);
  const w = await start(t, { herdr: none });
  await w.get('/api/board');
  await w.post('/api/run', { number: 402 });
  assert.deepEqual(
    w
      .herdr()
      .slice(1)
      .map((call: any) => call.slice(0, 2).concat(call.slice(-1))),
    [
      ['workspace', 'create', '--no-focus'],
      ['tab', 'rename', '#402 plan'],
      ['pane', 'run', `'/co/it'\\''s/run.sh' 402 && exit`],
    ],
  );
  assert.deepEqual(w.herdr()[2], ['tab', 'rename', 'w2:t9', '#402 plan']);
  assert.deepEqual(w.herdr()[1], ['workspace', 'create', '--cwd', '/repo/fwrh', '--label', 'fwrh', '--no-focus']);
});

test('Run is refused for a card with no Run, with no herdr call', async (t) => {
  const w = await start(t);
  assert.equal((await w.post('/api/run', { number: 402 })).status, 409);
  await w.get('/api/board');
  for (const number of [5, 777]) {
    const { status, json } = await w.post('/api/run', { number });
    assert.equal(status, 409);
    assert.match(json.error, /^#\d+ /);
  }
  assert.deepEqual(w.herdr(), []);
});

for (const [key, path, number, cards] of [
  [
    'run',
    '/api/run',
    402,
    [
      [388, false, true],
      [402, false, false],
    ],
  ],
  [
    'resume',
    '/api/resume',
    388,
    [
      [388, true, false],
      [402, true, false],
    ],
  ],
] as const) {
  test(`with no ${key} entry in the config, no card has that press, and the press gets 409 with no herdr call`, async (t) => {
    const w = await start(t, { config: { ...CONFIG, [key]: null }, board: STUCK });
    const { json } = await w.get('/api/board');
    assert.deepEqual(json.can, { run: true, resume: true, [key]: false });
    assert.deepEqual(
      values(json.columns)
        .flat()
        .map((c) => [c.number, c.run, c.resume])
        .sort(),
      cards,
    );
    assert.equal((await w.post(path, { number })).status, 409);
    assert.deepEqual(w.herdr(), []);
  });
}

test('with a noRun text in the data, the board passes it on, no card has Run or Resume, and each press gets 409 with no herdr call', async (t) => {
  const noRun = 'The main checkout is dirty: /repo/fwrh. Commit or stash first.';
  const w = await start(t, { board: { ...STUCK, noRun } });
  const { json } = await w.get('/api/board');
  assert.equal(json.noRun, noRun);
  assert.deepEqual(
    values(json.columns)
      .flat()
      .map((c) => [c.number, c.run, c.resume])
      .sort(),
    [
      [388, false, false],
      [402, false, false],
    ],
  );
  for (const [path, number] of [
    ['/api/run', 402],
    ['/api/run', 388],
    ['/api/resume', 388],
  ])
    assert.equal((await w.post(path, { number })).status, 409);
  assert.deepEqual(w.herdr(), []);
});

test('a press that the state of the row does not allow, and a press on an issue with a session, get 409 with no herdr call', async (t) => {
  const w = await start(t, {
    agents: [agent('s1', '#6 plan')],
    board: {
      ...BOARD,
      issues: [
        row(1, 'blocked', { reason: 'needs info' }),
        row(2, 'done', { closedAt: ago(60) }),
        row(3, 'dirty', { path: '/repo/fwrh/.claude/worktrees/3-x' }),
        row(4, 'starting'),
        ready(5, 'plan'),
        ready(6, 'plan'),
      ],
    },
  });
  await w.get('/api/board');
  for (const [path, numbers] of [
    ['/api/run', [1, 2, 3, 4, 6]],
    ['/api/resume', [1, 2, 3, 4, 5, 6]],
  ] as const) {
    for (const number of numbers) {
      const { status, json } = await w.post(path, { number });
      assert.deepEqual([path, number, status], [path, number, 409]);
      assert.match(json.error, /^#\d+ /);
    }
  }
  assert.deepEqual(w.herdr(), []);
});

test('two Run presses at the same moment make one tab', async (t) => {
  const w = await start(t);
  await w.get('/api/board');
  const statuses = (await Promise.all([w.post('/api/run', { number: 402 }), w.post('/api/run', { number: 402 })]))
    .map((r: any) => r.status)
    .sort();
  assert.deepEqual(statuses, [200, 409]);
  assert.equal(w.herdr().filter((call: any) => call[0] === 'tab').length, 1);
});

for (const [first, second] of [
  ['run', 'run'],
  ['resume', 'resume'],
  ['run', 'resume'],
]) {
  test(`a ${first} press and a ${second} press on one issue make one tab when each reads its card before the other starts`, async (t) => {
    const w = await start(t, { agents: [agent('s1', 'notes')], board: STUCK });
    await w.get('/api/board');
    w.clock += 15_000;
    const both = Promise.withResolvers();
    let waiting = 0;
    w.git = async () => {
      if (++waiting === 2) both.resolve();
      await both.promise;
      return out('');
    };
    const answers = await Promise.all([first, second].map((key) => w.post(`/api/${key}`, { number: 388 })));
    assert.deepEqual(answers.map((answer: any) => answer.status).sort(), [200, 409]);
    assert.equal(w.herdr().filter((call: any) => call[0] === 'tab').length, 1);
  });
}

for (const [name, herdr, error] of [
  [
    'exits with an error',
    () => ({ code: 1, stdout: '', stderr: 'error: the server does not run\nhint: herdr\n' }),
    'error: the server does not run',
  ],
  ['is not on PATH', () => ({ code: 1, stdout: '', stderr: 'spawn herdr ENOENT' }), 'spawn herdr ENOENT'],
  [
    'prints an error as JSON',
    (args: any) => (args[1] === 'list' ? ok(LIST) : ok({ error: { message: 'no such workspace' } })),
    'no such workspace',
  ],
  [
    'exits 1 with an error as JSON on stderr',
    (args: any) => (args[1] === 'list' ? ok(LIST) : { code: 1, stdout: '', stderr: `${NOT_FOUND}\n` }),
    'workspace no-such-workspace not found',
  ],
  [
    'gives a list with no workspaces array',
    (args: any) => (args[1] === 'list' ? ok({ result: {} }) : herdrOk(args)),
    'herdr gave no list of workspaces',
  ],
  [
    'gives a list that is not JSON',
    (args: any) => (args[1] === 'list' ? { code: 0, stdout: 'w1 other\nw2 fwrh\n', stderr: '' } : herdrOk(args)),
    'herdr gave no list of workspaces',
  ],
]) {
  test(`a herdr call that ${name} gives 502 with its first line, and the card keeps Run`, async (t) => {
    const w = await start(t, { herdr });
    await w.get('/api/board');
    const { status, json } = await w.post('/api/run', { number: 402 });
    assert.deepEqual([status, json], [502, { error }]);
    assert.deepEqual(
      w.herdr().filter((call: any) => call[0] === 'workspace' && call[1] === 'create'),
      [],
    );
    assert.equal((await w.card(402)).run, true);
  });
}

const made = (tab_id: any, pane_id: any) => ok({ result: { tab: { tab_id }, root_pane: { pane_id } } });
const listOf = (label: any, workspace_id: any) => ok({ result: { workspaces: [{ label, workspace_id }] } });
for (const [name, herdr, error, calls] of [
  [
    'the id of the workspace',
    (args: any) => (args[1] === 'list' ? listOf('fwrh', '--help') : herdrOk(args)),
    'herdr gave no id for the workspace',
    [['workspace', 'list']],
  ],
  [
    'the pane id of a new tab',
    (args: any) => (args[1] === 'create' ? made('w2:t9', 'w2:p9; rm -rf ~') : herdrOk(args)),
    'herdr gave no pane for the new tab',
    [
      ['workspace', 'list'],
      ['tab', 'create'],
    ],
  ],
  [
    'the pane id of a new workspace',
    (args: any) =>
      args[1] === 'list' ? listOf('other', 'w1') : args[1] === 'create' ? made('w2:t9', '--help') : herdrOk(args),
    'herdr gave no pane for the new tab',
    [
      ['workspace', 'list'],
      ['workspace', 'create'],
    ],
  ],
  [
    'the tab id of a new workspace',
    (args: any) =>
      args[1] === 'list' ? listOf('other', 'w1') : args[1] === 'create' ? made(['w2:t9'], 'w2:p9') : herdrOk(args),
    'herdr gave no id for the new tab',
    [
      ['workspace', 'list'],
      ['workspace', 'create'],
    ],
  ],
]) {
  test(`${name} goes into no herdr command when it is not a safe id: the press gets 502, and the card keeps Run`, async (t) => {
    const w = await start(t, { herdr });
    await w.get('/api/board');
    const { status, json } = await w.post('/api/run', { number: 402 });
    assert.deepEqual([status, json], [502, { error }]);
    assert.deepEqual(
      w.herdr().map((call: any) => call.slice(0, 2)),
      calls,
    );
    assert.equal((await w.card(402)).run, true);
  });
}

test('Go focuses the pane of the agent, found again in herdr by its terminal id', async (t) => {
  const w = await start(t, {
    agents: [
      agent('s1', 'a'),
      agent('s3', 'b', { pane_id: 'w2:p8; rm -rf ~' }),
      agent('s4', 'c', { pane_id: '--help' }),
      agent('s5', 'd', { pane_id: ['w2:p8'] }),
      agent('s6', 'e', { cwd: '/repo/other' }),
    ],
  });
  assert.deepEqual((await w.post('/api/go', { sessionId: 's1' })).json, { ok: true });
  assert.deepEqual(w.herdr(), [['agent', 'focus', 'w2:s1']]);
  for (const sessionId of ['s3', 's4', 's5']) assert.equal((await w.post('/api/go', { sessionId })).status, 409);
  for (const sessionId of ['s6', '../s1']) assert.equal((await w.post('/api/go', { sessionId })).status, 404);
  assert.equal((await w.post('/api/go', {})).status, 404);
  assert.equal(w.herdr().length, 1);
});

test('GET /api/board passes on agents and defaultAgent, null when the document lacks them', async (t) => {
  const w = await start(t);
  assert.deepEqual((await w.get('/api/board')).json.agents, null);
  assert.deepEqual((await w.get('/api/board')).json.defaultAgent, null);
  const agents = { claude: { available: true, cause: null }, opencode: { available: false, cause: 'no key' } };
  w.board = { ...BOARD, agents, defaultAgent: 'claude' };
  w.clock += 5000;
  assert.equal((await w.post('/api/refresh', {})).status, 200);
  const full = (await w.get('/api/board')).json;
  assert.deepEqual([full.agents, full.defaultAgent], [agents, 'claude']);
  w.board = { ...BOARD, contract: 2, agents, defaultAgent: 'claude' };
  w.clock += 5000;
  assert.equal((await w.post('/api/refresh', {})).status, 200);
  const dropped = (await w.get('/api/board')).json;
  assert.deepEqual([dropped.agents, dropped.defaultAgent], [null, null]);
  assert.deepEqual(
    values(dropped.columns)
      .flat()
      .filter((c) => c.sessionId === null),
    [],
  );
});

test('the board passes on the flow, the runner, and the state of herdr, and reads herdr at each request', async (t) => {
  const w = await start(t, { board: { ...BOARD, runner: true } });
  const first = (await w.get('/api/board')).json;
  assert.deepEqual([first.flow, first.runner, first.herdr], [FLOW, true, { ok: true, error: null }]);
  await w.get('/api/board?local=1');
  assert.equal(w.snapshots(), 2);
});

for (const [name, herdr, error] of [
  [
    'does not run',
    () => ({ code: 1, stdout: '', stderr: 'no herdr server is running at /tmp/herdr.sock\nmore\n' }),
    'no herdr server is running at /tmp/herdr.sock',
  ],
  [
    'gives an error as JSON',
    () => ({
      code: 1,
      stdout: '',
      stderr: '{"id":"cli:api:snapshot","error":{"code":"internal_error","message":"failed to read the session"}}\n',
    }),
    'failed to read the session',
  ],
  ['gives no snapshot', () => ok({ result: { type: 'session_snapshot' } }), 'herdr gave no snapshot'],
]) {
  test(`a herdr that ${name} shows as down with the first line of its error, and the issue cards stay`, async (t) => {
    const w = await start(t, { herdr });
    const { json } = await w.get('/api/board');
    assert.deepEqual(json.herdr, { ok: false, error });
    assert.deepEqual(
      json.columns.needs.map((c: any) => c.number),
      [402],
    );
  });
}

test('a local read uses the data it has: no read of the issues when it is old, and none when a session ends', async (t) => {
  const w = await start(t, { agents: [agent('s1', '#5 bug', { agent_status: 'working' })] });
  await w.get('/api/board');
  w.clock += 61_000;
  await w.get('/api/board?local=1');
  w.agents = [];
  assert.deepEqual(
    (await w.get('/api/board?local=1')).json.columns.running.map((c: any) => [c.number, c.sessionId]),
    [[5, null]],
  );
  assert.equal(w.reads().length, 1);
  await w.get('/api/board');
  assert.equal(w.reads().length, 2);
});

test('a session shows the lines changed in the lane worktree of its issue, or else in its folder, read each 15 seconds at most', async (t) => {
  const main = await mkdtemp(join(tmpdir(), 'board-'));
  t.after(() => rm(main, { recursive: true }));
  await mkdir(join(main, '.claude', 'worktrees', '5-x'), { recursive: true });
  const w = await start(t, {
    main,
    agents: [
      agent('s1', '#5 bug', { agent_status: 'working' }),
      agent('s2', 'notes', { agent_status: 'working', cwd: main }),
      agent('s3', '#6 bug', {
        agent_status: 'working',
        cwd: join(main, '.claude', 'worktrees', '..', '..', '..', 'etc'),
        foreground_cwd: join(main, '.claude', 'worktrees', '6-y'),
      }),
    ].map((a) => (a.terminal.cwd === '/repo/fwrh' ? { ...a, terminal: { ...a.terminal, cwd: main } } : a)),
  });
  const cards = (await w.get('/api/board')).json.columns.running;
  assert.deepEqual(cards.map((c: any) => [c.sessionId, c.cwd]).sort(), [
    ['s1', '.claude/worktrees/5-x'],
    ['s2', '.'],
    ['s3', '.claude/worktrees/6-y'],
  ]);
  assert.deepEqual(cards.map((c: any) => [c.sessionId, c.diff ?? null]).sort(), [
    ['s1', { files: 3, added: 18, removed: 4 }],
    ['s2', { files: 3, added: 18, removed: 4 }],
    ['s3', { files: 3, added: 18, removed: 4 }],
  ]);
  assert.deepEqual(
    w
      .gits()
      .map((args: any) => args[2])
      .sort(),
    [main, join(main, '.claude', 'worktrees', '5-x'), join(main, '.claude', 'worktrees', '6-y')].sort(),
  );
  assert.deepEqual(
    w.gits()[0].filter((arg: any) => arg !== w.gits()[0][2]),
    ['--no-optional-locks', '-C', 'diff', '--shortstat', '--merge-base', 'origin/HEAD'],
  );
  await w.get('/api/board');
  assert.equal(w.gits().length, 3);
  w.clock += 15_000;
  w.git = () => ({ code: 0, stdout: '', stderr: '' });
  assert.deepEqual(
    (await w.get('/api/board')).json.columns.running.map((c: any) => c.diff ?? null),
    [null, null, null],
  );
  w.clock += 15_000;
  w.git = () => ({ code: 128, stdout: '', stderr: 'fatal: bad revision' });
  assert.deepEqual(
    (await w.get('/api/board')).json.columns.running.map((c: any) => c.diff ?? null),
    [null, null, null],
  );
});

test('Resume makes one tab with the focus and runs the resume command of the config in it', async (t) => {
  const w = await start(t, { board: STUCK });
  await w.get('/api/board');
  assert.deepEqual((await w.post('/api/resume', { number: 388 })).json, { ok: true });
  assert.deepEqual(w.herdr(), [
    ['workspace', 'list'],
    ['tab', 'create', '--workspace', 'w2', '--cwd', '/repo/fwrh', '--label', '#388 implement'],
    ['pane', 'run', 'w2:p9', `'/co/it'\\''s/run.sh' '--resume' 388 && exit`],
  ]);
  assert.deepEqual([(await w.card(388)).run, (await w.card(388)).resume], [false, false]);
  assert.equal((await w.post('/api/resume', { number: 388 })).status, 409);
  assert.equal((await w.post('/api/resume', { number: 402 })).status, 409);
  assert.equal(w.herdr().length, 3);
});

test('Open shell opens a tab in the dirty lane worktree of the issue, and nowhere else', async (t) => {
  const w = await start(t, {
    board: {
      ...BOARD,
      issues: [
        row(407, 'dirty', { step: 'implement', path: '/repo/fwrh/.claude/worktrees/407-x' }),
        row(408, 'dirty', { path: '/elsewhere/408-x' }),
        row(409, 'dirty', { path: '/repo/fwrh' }),
        row(410, 'dirty', { path: '/repo/fwrh/.claude/worktrees/../../../elsewhere' }),
        ready(402, 'plan'),
      ],
    },
  });
  await w.get('/api/board');
  assert.deepEqual((await w.post('/api/shell', { number: 407 })).json, { ok: true });
  assert.deepEqual(w.herdr(), [
    ['workspace', 'list'],
    ['tab', 'create', '--workspace', 'w2', '--cwd', '/repo/fwrh/.claude/worktrees/407-x', '--label', '#407 shell'],
  ]);
  for (const number of [408, 409, 410, 402]) assert.equal((await w.post('/api/shell', { number })).status, 409);
  assert.equal(w.herdr().length, 2);
});

test('a press takes the number or the session id of the request, and no other field of it', async (t) => {
  const dirty = row(407, 'dirty', { path: '/repo/fwrh/.claude/worktrees/407-x' });
  const w = await start(t, { agents: [agent('s1', 'notes')], board: { ...STUCK, issues: [...STUCK.issues, dirty] } });
  await w.get('/api/board');
  const more = { command: 'touch x', step: 'x', label: 'x', cwd: '/elsewhere', path: '/elsewhere', paneId: 'w9:p9' };
  for (const [path, body] of [
    ['/api/run', { number: 402 }],
    ['/api/resume', { number: 388 }],
    ['/api/shell', { number: 407 }],
    ['/api/go', { sessionId: 's1' }],
  ] as const) {
    assert.deepEqual([path, (await w.post(path, { ...more, ...body })).status], [path, 200]);
  }
  assert.deepEqual(
    w.herdr().filter((call: any) => call[0] !== 'workspace'),
    [
      ['tab', 'create', '--workspace', 'w2', '--cwd', '/repo/fwrh', '--label', '#402 plan', '--no-focus'],
      ['pane', 'run', 'w2:p9', `'/co/it'\\''s/run.sh' 402 && exit`],
      ['tab', 'create', '--workspace', 'w2', '--cwd', '/repo/fwrh', '--label', '#388 implement'],
      ['pane', 'run', 'w2:p9', `'/co/it'\\''s/run.sh' '--resume' 388 && exit`],
      ['tab', 'create', '--workspace', 'w2', '--cwd', '/repo/fwrh/.claude/worktrees/407-x', '--label', '#407 shell'],
      ['agent', 'focus', 'w2:s1'],
    ],
  );
});

const REFUSED: any[] = [
  ['another Host', 403, 'GET', '/api/board', () => ({ Host: 'evil.test' })],
  ['the right name with another port', 403, 'GET', '/', () => ({ Host: '127.0.0.1:1' })],
  ['a POST with no Origin', 403, 'POST', '/api/run', () => JSON_TYPE, '{"number":402}'],
  [
    'a POST with another Origin',
    403,
    'POST',
    '/api/run',
    () => ({ ...JSON_TYPE, Origin: 'http://evil.test' }),
    '{"number":402}',
  ],
  [
    'a POST of a DNS-rebinding page',
    403,
    'POST',
    '/api/run',
    (w: any) => ({ ...JSON_TYPE, Host: `evil.test:${w.port}`, Origin: `http://evil.test:${w.port}` }),
    '{"number":402}',
  ],
  [
    'a POST with a form content type',
    403,
    'POST',
    '/api/run',
    (w: any) => ({ 'Content-Type': 'text/plain', Origin: w.origin }),
    '{"number":402}',
  ],
  [
    'a POST with a content type that only starts with application/json',
    403,
    'POST',
    '/api/run',
    (w: any) => ({ 'Content-Type': 'application/json-seq', Origin: w.origin }),
    '{"number":402}',
  ],
  ['a body that is not JSON', 400, 'POST', '/api/run', (w: any) => ({ ...JSON_TYPE, Origin: w.origin }), '{'],
  ['a body of null', 400, 'POST', '/api/run', (w: any) => ({ ...JSON_TYPE, Origin: w.origin }), 'null'],
  [
    'a number that is not digits',
    400,
    'POST',
    '/api/run',
    (w: any) => ({ ...JSON_TYPE, Origin: w.origin }),
    '{"number":"402; rm -rf ~"}',
  ],
  [
    'a Resume number that is not digits',
    400,
    'POST',
    '/api/resume',
    (w: any) => ({ ...JSON_TYPE, Origin: w.origin }),
    '{"number":"388 && rm -rf ~"}',
  ],
  [
    'an Open shell number that is not digits',
    400,
    'POST',
    '/api/shell',
    (w: any) => ({ ...JSON_TYPE, Origin: w.origin }),
    '{"number":[407]}',
  ],
  [
    'a Resume POST with another Origin',
    403,
    'POST',
    '/api/resume',
    () => ({ ...JSON_TYPE, Origin: 'http://evil.test' }),
    '{"number":388}',
  ],
  ['a number of zero', 400, 'POST', '/api/run', (w: any) => ({ ...JSON_TYPE, Origin: w.origin }), '{"number":0}'],
  [
    'a number of 24 digits',
    409,
    'POST',
    '/api/run',
    (w: any) => ({ ...JSON_TYPE, Origin: w.origin }),
    `{"number":"${'9'.repeat(24)}"}`,
  ],
  [
    'a body over 1024 characters',
    400,
    'POST',
    '/api/run',
    (w: any) => ({ ...JSON_TYPE, Origin: w.origin }),
    `{"number":402,"x":"${'a'.repeat(1100)}"}`,
  ],
  ['a path that the table does not name', 404, 'GET', '/api/nope', () => ({})],
  ['a file of the board that is not of the page', 404, 'GET', '/server.mjs', () => ({})],
  ['a GET of a POST path', 404, 'GET', '/api/run', () => ({})],
  ['a POST of the page', 404, 'POST', '/', (w: any) => ({ ...JSON_TYPE, Origin: w.origin }), '{}'],
];
for (const [name, expected, method, path, headers, body] of REFUSED) {
  test(`${name} gets ${expected} and one line, with no herdr call`, async (t) => {
    const w = await start(t);
    await w.get('/api/board');
    const { status, json } = await w.call(method, path, headers(w), body);
    assert.equal(status, expected);
    assert.match(json.error, /^[^\n]+$/);
    assert.deepEqual(w.herdr(), []);
  });
}

test('the Host localhost with the port of the server is accepted', async (t) => {
  const w = await start(t);
  assert.equal((await w.call('GET', '/api/board', { Host: `localhost:${w.port}` })).status, 200);
  const headers = { ...JSON_TYPE, Host: `localhost:${w.port}`, Origin: `http://localhost:${w.port}` };
  assert.equal((await w.call('POST', '/api/refresh', headers, '{}')).status, 200);
});

test('the content type application/json with a parameter is accepted', async (t) => {
  const w = await start(t);
  const headers = { 'Content-Type': 'application/json; charset=utf-8', Origin: w.origin };
  assert.equal((await w.call('POST', '/api/refresh', headers, '{}')).status, 200);
});

test('run starts a command with no shell, and gives its exit status, its output, and the cause of a command that does not start', async () => {
  const text = '$(echo a) `echo b`; echo c | cat && echo "d" \'e\' $HOME';
  assert.deepEqual(await run(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', text]), {
    code: 0,
    stdout: text,
    stderr: '',
  });
  assert.deepEqual(
    await run(process.execPath, ['-e', 'console.log("out"); console.error("err"); process.exitCode = 3']),
    { code: 3, stdout: 'out\n', stderr: 'err\n' },
  );
  assert.deepEqual(await run('agent-board-no-such-command', []), {
    code: 1,
    stdout: '',
    stderr: 'spawn agent-board-no-such-command ENOENT',
  });
});

test('runData starts the data command in the main checkout with the limit of 60 seconds, and gives its output or its first cause', async () => {
  const calls: any[] = [];
  const exec =
    (result: any) =>
    async (...call: any[]) => {
      calls.push(call);
      return result;
    };
  assert.deepEqual(await runData('/repo/fwrh', CONFIG.data, exec(out('{}\n'))), { output: '{}\n', error: null });
  assert.deepEqual(calls, [["/co/it's/data.sh", ['--board'], { cwd: '/repo/fwrh', timeout: 60_000 }]]);
  for (const [result, error] of [
    [{ code: 3, stdout: 'out\n', stderr: '\n boom \nmore\n' }, 'boom'],
    [out('stop cannot read\n', 1), 'stop cannot read'],
    [out('', 3), 'the data command exited 3'],
  ])
    assert.deepEqual(await runData('/repo/fwrh', CONFIG.data, exec(result)), { output: null, error });
});

test('each read and each press starts herdr, git, or the data command only, with no shell, and writes nothing in the main checkout', async (t) => {
  const main = await mkdtemp(join(tmpdir(), 'board-'));
  t.after(() => rm(main, { recursive: true }));
  const lane = join(main, '.claude', 'worktrees', '407-x');
  await mkdir(lane, { recursive: true });
  const tree = async () => (await readdir(main, { recursive: true })).sort();
  const before = await tree();
  const w = await start(t, {
    main,
    agents: [agent('s1', 'notes', { cwd: main })],
    board: { ...STUCK, issues: [...STUCK.issues, row(407, 'dirty', { path: lane })] },
  });
  await w.get('/api/board');
  for (const [path, body] of [
    ['/api/run', { number: 402 }],
    ['/api/resume', { number: 388 }],
    ['/api/shell', { number: 407 }],
    ['/api/go', { sessionId: 's1' }],
    ['/api/refresh', {}],
  ]) {
    assert.deepEqual([path, (await w.post(path, body)).status], [path, 200]);
  }
  assert.deepEqual([...new Set(w.calls.map((call: any) => call[0]))].sort(), ["/co/it's/data.sh", 'git', 'herdr']);
  for (const options of w.options.values()) assert.equal(options?.shell, undefined);
  assert.deepEqual(await tree(), before);
});

test('the server serves the files of the page with the policy of the page', async (t) => {
  const w = await start(t);
  for (const [path, type, mark] of [
    ['/', 'text/html', '<title>Agent board</title>'],
    ['/board.css', 'text/css', '--needs'],
    ['/board.js', 'text/javascript', '/api/board'],
    ['/view.mjs', 'text/javascript', 'laneTrack'],
    ['/ui.mjs', 'text/javascript', 'actionButton'],
    ['/panel.mjs', 'text/javascript', 'drawPanel'],
    ['/palette.mjs', 'text/javascript', 'openPalette'],
    ['/fonts/geist.woff2', 'font/woff2', 'wOF2'],
    ['/fonts/geist-mono.woff2', 'font/woff2', 'wOF2'],
  ] as const) {
    const { status, headers, text } = await w.get(path);
    assert.equal(status, 200);
    assert.ok(headers['content-type'].startsWith(type));
    assert.ok(text.includes(mark), path);
    assert.equal(
      headers['content-security-policy'],
      "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
  }
});

test('the page writes text only', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const name of ['./board.js', './view.mjs', './ui.mjs', './panel.mjs', './palette.mjs']) {
    const script = await readFile(new URL(name, import.meta.url), 'utf8');
    assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, name);
  }
});

test('POST /api/agent refuses default changes without a write', async (t) => {
  const agents = {
    claude: { available: true, cause: null },
    codex: { available: true, cause: null },
    broken: { available: false, cause: 'binary missing\nsecond line' },
  };
  const board = { ...BOARD, agents, defaultAgent: 'claude' };
  const cases: any[] = [
    ['available agent', { agent: 'codex' }],
    ['current agent', { agent: 'claude' }],
    ['unavailable agent', { agent: 'broken' }],
    ['unknown agent', { agent: 'nope' }],
    ['missing field', {}],
    ['null body', null],
    ...[null, '', 'Claude', 'a-b', 'a; rm -rf ~', 123, false, {}, []].map((agent) => [
      `agent ${JSON.stringify(agent)}`,
      { agent },
    ]),
    ...[123, false, 'codex', []].map((body) => [`body ${JSON.stringify(body)}`, body]),
    ['absent agent data', { agent: 'codex' }, BOARD],
    ['null default', { agent: 'codex' }, { ...board, defaultAgent: null }],
    ['unavailable default', { agent: 'codex' }, { ...board, defaultAgent: 'broken' }],
    ['failed first read', { agent: 'codex' }, 'HTTP 502'],
    ['failed later read', { agent: 'codex' }, board, 'HTTP 502'],
    ['dropped document', { agent: 'codex' }, board, { ...board, contract: 2 }],
  ];
  for (const [name, body, initial = board, next] of cases)
    await t.test(name, async (t) => {
      const w = await start(t, { board: initial });
      await w.get('/api/board');
      if (next !== undefined) {
        w.board = next;
        assert.equal((await w.post('/api/refresh', {})).status, 200);
      }
      const before = (await w.get('/api/board')).json;
      const calls = w.calls.length;
      const { status, json } = await w.post('/api/agent', body);
      assert.deepEqual(
        [status, json],
        [409, { error: 'The producer controls the default agent. Change it in the producer configuration.' }],
      );
      assert.equal(w.calls.length, calls);
      assert.deepEqual(w.gits(), []);
      assert.deepEqual((await w.get('/api/board')).json, before);
    });
});

test('POST /api/agent joins the trust checks with no git call', async (t) => {
  const agents = { claude: { available: true, cause: null }, codex: { available: true, cause: null } };
  const cases: any[] = [
    ['another Host', 403, 'POST', '/api/agent', () => ({ Host: 'evil.test' })],
    ['the right Host with another port', 403, 'POST', '/api/agent', () => ({ Host: '127.0.0.1:1' })],
    ['a POST with no Origin', 403, 'POST', '/api/agent', () => JSON_TYPE, '{"agent":"codex"}'],
    [
      'a POST with another Origin',
      403,
      'POST',
      '/api/agent',
      () => ({ ...JSON_TYPE, Origin: 'http://evil.test' }),
      '{"agent":"codex"}',
    ],
    [
      'a POST of a DNS-rebinding page',
      403,
      'POST',
      '/api/agent',
      (w: any) => ({ ...JSON_TYPE, Host: `evil.test:${w.port}`, Origin: `http://evil.test:${w.port}` }),
      '{"agent":"codex"}',
    ],
    ['a POST with no content type', 403, 'POST', '/api/agent', (w: any) => ({ Origin: w.origin }), '{"agent":"codex"}'],
    [
      'a POST with a form content type',
      403,
      'POST',
      '/api/agent',
      (w: any) => ({ 'Content-Type': 'text/plain', Origin: w.origin }),
      '{"agent":"codex"}',
    ],
    [
      'a POST with a content type that only starts with application/json',
      403,
      'POST',
      '/api/agent',
      (w: any) => ({ 'Content-Type': 'application/json-seq', Origin: w.origin }),
      '{"agent":"codex"}',
    ],
    ['a body that is not JSON', 400, 'POST', '/api/agent', (w: any) => ({ ...JSON_TYPE, Origin: w.origin }), '{'],
    [
      'a body over 1024 characters',
      400,
      'POST',
      '/api/agent',
      (w: any) => ({ ...JSON_TYPE, Origin: w.origin }),
      `{"agent":"codex","x":"${'a'.repeat(1100)}"}`,
    ],
    ['a GET of a POST path', 404, 'GET', '/api/agent', () => ({})],
  ];
  for (const [name, expected, method, path, headers, body] of cases) {
    const w = await start(t, { board: { ...BOARD, agents, defaultAgent: 'claude' } });
    const before = (await w.get('/api/board')).json;
    const calls = w.calls.length;
    const { status, json } = await w.call(method, path, headers(w), body);
    assert.deepEqual([name, status], [name, expected]);
    assert.match(json.error, /^[^\n]+$/);
    assert.equal(w.calls.length, calls, name);
    assert.deepEqual(w.gits(), [], name);
    assert.equal(w.reads().length, 1, name);
    assert.deepEqual((await w.get('/api/board')).json, before, name);
  }
});
