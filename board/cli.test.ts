import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { createConnection, createServer } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { after, entries, executable, isolatedArgs, test, values } from './test-support.ts';

const HERE = import.meta.dirname;
const FIXTURES = join(HERE, 'fixtures');
const CLI = join(HERE, 'cli.ts');
const LIMIT_MS = 30_000;
const FIXTURE_CONFIG = { data: ['flow/producer.ts'], run: ['flow/run.ts', '{n}'] };
const DOCUMENT = await readFile(join(FIXTURES, 'contract-1.json'), 'utf8');
const OK = { code: 0, stdout: 'agent-board: contract 1, 3 issues, ok\n', stderr: '' };
const NOT_DOT_GIT =
  'agent-board: the git directory is not the folder .git of a checkout (a bare repository or a submodule)';
const READ_FAILURE = 'stdin read failed';
const CONFIG_FORMS = [['--config-stdin'], ['check', '--config-stdin']];
const USAGE = {
  code: 2,
  stdout: '',
  stderr:
    'usage: agent-board --config-stdin | check --config-stdin | check --stdin (scripts/celetis board starts the board)\n',
};
const OUTSIDE = values(networkInterfaces())
  .flat()
  .find((address) => address?.family === 'IPv4' && !address.internal)?.address;

const BIN = await mkdtemp(join(tmpdir(), 'agent-board-bin-'));
after(() => rm(BIN, { recursive: true }));
await executable(join(BIN, 'herdr'), await readFile(join(FIXTURES, 'herdr.ts'), 'utf8'));
await writeFile(
  join(BIN, 'stdin-error.ts'),
  `Object.defineProperty(process,'stdin',{get(){throw new Error('stdin read failed')}}); await import(${JSON.stringify(CLI)});`,
);

const ENV = {
  ...Object.fromEntries(entries(process.env).filter(([key]) => !/^(GIT_|HERDR_|PORT$)/.test(key))),
  PATH: `${BIN}:${process.env.PATH}`,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Board',
  GIT_AUTHOR_EMAIL: 'board@example.test',
  GIT_COMMITTER_NAME: 'Board',
  GIT_COMMITTER_EMAIL: 'board@example.test',
};

const exec = promisify(execFile);
const git = (cwd: any, ...args: any[]) => exec('git', args, { cwd, env: ENV });
const put = async (path: any, text: any, mode = 0o644) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, { mode });
};
const script = (path: any, ...lines: any[]) => executable(path, lines.join('\n'));
const refusal = (line: any) => ({ code: 1, stdout: '', stderr: `${line}\n` });
const cardsOf = (columns: any, read: any) =>
  Object.fromEntries(entries(columns).map(([key, cards]) => [key, cards.map(read)]));

const temp = async (t: any) => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'agent-board-')));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return folder;
};

const repo = async (t: any, name = 'fix ture') => {
  const folder = join(await temp(t), name);
  await mkdir(folder);
  await git(folder, 'init', '-q', '-b', 'main');
  await git(folder, 'commit', '-q', '--allow-empty', '-m', 'first');
  return folder;
};

const fixture = async (t: any, name?: any) => {
  const folder = await repo(t, name);
  await mkdir(join(folder, 'flow'));
  for (const name of ['producer.ts', 'contract-1.json', 'run.ts'])
    if (name.endsWith('.ts'))
      await executable(join(folder, 'flow', name), await readFile(join(FIXTURES, name), 'utf8'));
    else await copyFile(join(FIXTURES, name), join(folder, 'flow', name));
  return folder;
};

const lane = async (folder: any) => {
  const path = join(folder, '.claude', 'worktrees', '7-x');
  await git(folder, 'worktree', 'add', '-q', path);
  return path;
};

const cli = (args: any, { cwd, env, input = '' }: any = {}) =>
  new Promise<any>((done) => {
    const child = execFile(
      process.execPath,
      [
        ...isolatedArgs,
        ...(env?.BOARD_OLD_BUN ? ['--define', 'Bun.version:"1.4.1"'] : []),
        env?.BOARD_OLD_BUN || env?.BOARD_READ_FAILURE ? join(BIN, 'stdin-error.ts') : CLI,
        ...args,
      ],
      { cwd, env: { ...ENV, ...env }, timeout: LIMIT_MS },
      (error, stdout, stderr) => done({ code: error ? error.code : 0, stdout, stderr }),
    );
    (child.stdin as any).end(input);
  });

const listening = (port = 0) =>
  new Promise<any>((done, fail) => {
    const server = createServer()
      .on('error', fail)
      .listen(port, '127.0.0.1', () => done(server));
  });

const freePort = async () => {
  const port = 20_000 + Math.floor(Math.random() * 10_000);
  const server = await listening(port).catch((cause) => {
    if (cause.code !== 'EADDRINUSE') throw cause;
  });
  if (!server) return freePort();
  server.close();
  await once(server, 'close');
  return port;
};

const stop = (child: any) => {
  if (child.exitCode !== null || child.signalCode !== null) return null;
  child.kill();
  return once(child, 'exit');
};

const serve = async (t: any, cwd: any, env: any = {}, { args = ['--config-stdin'], input = '{}', port }: any = {}) => {
  port ??= await freePort();
  const child = spawn(
    process.execPath,
    [...isolatedArgs, env?.BOARD_READ_FAILURE ? join(BIN, 'stdin-error.ts') : CLI, ...args],
    {
      cwd,
      env: { ...ENV, PORT: String(port), ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: LIMIT_MS,
    },
  );
  t.after(() => stop(child));
  const lines = await new Promise<any>((done, fail) => {
    let stdout = '';
    let stderr = '';
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
      if (/^agent-board: http:.*\n/m.test(stdout)) done(stdout.trimEnd().split('\n'));
    });
    child
      .on('error', fail)
      .on('close', (code) => fail(new Error(`the entry ended with exit ${code} and no URL line: ${stderr}`)));
    (child.stdin as any).end(input);
  });
  return { port, lines, ...http(port) };
};

const http = (port: any) => {
  const call = (method: any, path: any, value: any) =>
    new Promise<any>((done, fail) => {
      const headers =
        value === undefined ? {} : { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${port}` };
      request({ host: '127.0.0.1', port, method, path, headers }, (response) => {
        let text = '';
        response
          .setEncoding('utf8')
          .on('data', (chunk) => {
            text += chunk;
          })
          .on('end', () =>
            done({ status: response.statusCode, text, json: text.startsWith('{') ? JSON.parse(text) : null }),
          );
      })
        .on('error', fail)
        .end(value === undefined ? undefined : JSON.stringify(value));
    });
  return {
    get: (path: any) => call('GET', path, undefined),
    post: (path: any, value: any) => call('POST', path, value),
  };
};

const connect = (host: any, port: any) =>
  new Promise<any>((done) => {
    const socket = createConnection({ host, port });
    socket
      .once('error', (cause) => done((cause as NodeJS.ErrnoException).code))
      .once('connect', () => {
        socket.destroy();
        done('open');
      });
  });

test('the fixture repository: the start prints each command, the cards of the producer show, and Run types the run script with the number', async (t) => {
  const folder = await fixture(t);
  const log = join(dirname(folder), 'herdr.log');
  const board = await serve(
    t,
    folder,
    { HERDR_LOG: log, HERDR_WORKSPACE: basename(folder) },
    { input: JSON.stringify(FIXTURE_CONFIG) },
  );
  assert.deepEqual(board.lines, [
    `agent-board: repository ${folder}`,
    `agent-board: data    ${folder}/flow/producer.ts`,
    `agent-board: run     ${folder}/flow/run.ts {n}`,
    `agent-board: http://127.0.0.1:${board.port}`,
  ]);
  const { status, json } = await board.get('/api/board');
  assert.equal(status, 200);
  assert.deepEqual(
    cardsOf(json.columns, (card: any) => card.number),
    { needs: [394, 430], running: [], idle: [], done: [414] },
  );
  assert.equal(json.tracker, 'GitHub');
  assert.equal((await board.post('/api/run', { number: 430 })).status, 200);
  assert.equal((await board.post('/api/resume', { number: 430 })).status, 409);
  assert.deepEqual(
    (await readFile(log, 'utf8')).split('\n').filter((call) => call !== 'api snapshot'),
    [
      'workspace list',
      `tab create --workspace w1 --cwd ${folder} --label #430 plan --no-focus`,
      `pane run w1:p1 '${folder}/flow/run.ts' 430 && exit`,
      '',
    ],
  );
});

test('with an empty config, the start prints the repository and the URL, serves the page, and the board shows the sessions of the repository only', async (t) => {
  const folder = await repo(t);
  const board = await serve(t, folder, { HERDR_AGENT_CWD: folder });
  assert.deepEqual(board.lines, [`agent-board: repository ${folder}`, `agent-board: http://127.0.0.1:${board.port}`]);
  const page = await board.get('/');
  assert.deepEqual([page.status, page.text.includes('<title>Agent board</title>')], [200, true]);
  const { json } = await board.get('/api/board');
  assert.equal(json.source.isSet, false);
  assert.deepEqual(
    cardsOf(json.columns, (card: any) => [card.number, card.title, card.sessionId]),
    { needs: [], running: [[7, '#7', 's1']], idle: [], done: [] },
  );
});

test('the start prints each command of the config', async (t) => {
  const folder = await fixture(t);
  const board = await serve(
    t,
    folder,
    {},
    { input: JSON.stringify({ resume: ['flow/run.ts', '--resume', '{n}'], ...FIXTURE_CONFIG }) },
  );
  assert.deepEqual(board.lines, [
    `agent-board: repository ${folder}`,
    `agent-board: data    ${folder}/flow/producer.ts`,
    `agent-board: run     ${folder}/flow/run.ts {n}`,
    `agent-board: resume  ${folder}/flow/run.ts --resume {n}`,
    `agent-board: http://127.0.0.1:${board.port}`,
  ]);
  const { json } = await board.get('/api/board');
  assert.deepEqual([json.source.isSet, json.can], [true, { run: true, resume: true }]);
  assert.deepEqual(
    cardsOf(json.columns, (card: any) => card.number),
    { needs: [394, 430], running: [], idle: [], done: [414] },
  );
});

test('all config forms enforce the same checkout guards', async (t) => {
  const folder = await repo(t);
  const root = dirname(folder);
  const inner = await repo(t, 'inner');
  await git(root, 'init', '-q', '--bare', 'bare.git');
  await git(folder, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', inner, 'module');
  const worktree = await lane(folder);
  const linked = join(root, 'linked');
  await git(folder, 'worktree', 'add', '-q', linked);
  const cases: any[] = [
    [root, 'agent-board: the current folder is not in a git checkout'],
    [join(root, 'bare.git'), NOT_DOT_GIT],
    [join(folder, 'module'), NOT_DOT_GIT],
    [join(folder, '.git'), NOT_DOT_GIT],
    [worktree, `agent-board: start the board in the main checkout: ${folder}`],
    [linked, `agent-board: start the board in the main checkout: ${folder}`],
  ];
  for (const args of CONFIG_FORMS) {
    for (const [cwd, line] of cases) {
      assert.deepEqual(
        await cli(args, { cwd, env: { BOARD_READ_FAILURE: READ_FAILURE } }),
        refusal(line),
        [...args, cwd].join(' '),
      );
    }
  }

  await mkdir(join(folder, 'flow'));
  await copyFile(join(FIXTURES, 'contract-1.json'), join(folder, 'flow/contract-1.json'));
  await script(
    join(folder, 'flow/cwd.ts'),
    `const {appendFileSync,readFileSync}=await import('node:fs'); appendFileSync(process.env.PRODUCER_CWD,process.cwd()+'\\n'); process.stdout.write(readFileSync('flow/contract-1.json'));`,
  );
  const log = join(root, 'producer-cwd');
  const input = JSON.stringify({ data: ['flow/cwd.ts'] });
  const link = join(root, 'link');
  await symlink(folder, link);
  await mkdir(join(folder, 'sub'));
  for (const cwd of [folder, join(folder, 'sub'), link]) {
    const env = { PRODUCER_CWD: log, PWD: cwd };
    assert.deepEqual(await cli(['check', '--config-stdin'], { cwd, env, input }), OK);
    const board = await serve(t, cwd, env, { args: ['--config-stdin'], input });
    assert.equal(board.lines[0], `agent-board: repository ${folder}`);
    assert.equal((await board.get('/api/board')).status, 200);
  }
  assert.equal(await readFile(log, 'utf8'), `${folder}\n`.repeat(6));
});

test('a start in a subfolder of the main checkout, or through a symbolic link to it, prints the real path of the repository', async (t) => {
  const folder = await repo(t);
  const link = join(dirname(folder), 'link');
  await symlink(folder, link);
  await mkdir(join(folder, 'sub'));
  for (const [cwd, env] of [
    [join(folder, 'sub'), {}],
    [link, { PWD: link }],
  ] as const) {
    assert.equal((await serve(t, cwd, env)).lines[0], `agent-board: repository ${folder}`, cwd);
  }
});

test('a git and a herdr in a node_modules/.bin folder of the start folder do not run, with that folder first on PATH', async (t) => {
  const folder = await repo(t);
  const planted = join(folder, 'node_modules', '.bin');
  const marker = join(dirname(folder), 'planted');
  const log = join(dirname(folder), 'herdr.log');
  for (const name of ['git', 'herdr'])
    await script(
      join(planted, name),
      `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PLANTED,process.argv[1]+'\\n');`,
    );
  const env = { PATH: `${planted}:${ENV.PATH}`, PLANTED: marker, HERDR_LOG: log };
  const found = await exec(
    process.execPath,
    [...isolatedArgs, '-e', `console.log(Bun.which('git'));console.log(Bun.which('herdr'));`],
    { env: { ...ENV, ...env } },
  );
  assert.equal(found.stdout, `${planted}/git\n${planted}/herdr\n`);
  const board = await serve(t, folder, env);
  assert.equal((await board.get('/api/board')).status, 200);
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
  assert.equal(await readFile(log, 'utf8'), 'api snapshot\n');
});

test('issue data stdin stays independent', async (t) => {
  const cwd = await temp(t);
  const bad = JSON.parse(DOCUMENT);
  bad.tracker = 7;
  bad.issues[0].state = 'waiting';
  const check = (input: any) => cli(['check', '--stdin'], { cwd, input });
  assert.deepEqual(await check(DOCUMENT), OK);
  assert.deepEqual(await check(JSON.stringify(bad)), {
    code: 1,
    stdout: '',
    stderr:
      'tracker: is not a string with one character or more\nissues[0].state: "waiting" is not a state of contract 1\n',
  });
  assert.deepEqual(await check('{'), { code: 1, stdout: '', stderr: 'the data is not JSON\n' });
});

test('only the three public argument tuples are accepted', async (t) => {
  const cwd = await temp(t);
  const lists: any[] = [
    [],
    ['check'],
    ['nope'],
    ['check', 'nope'],
    ['check', '--stdin', 'more'],
    ['--stdin'],
    ['--unknown'],
    ['--config-stdin', 'check'],
    ['--stdin', 'check'],
    ['--config-stdin', '--stdin'],
    ['--stdin', '--config-stdin'],
    ['check', '--config-stdin', '--stdin'],
    ['check', '--stdin', '--config-stdin'],
    ['--config-stdin', '--config-stdin'],
    ['check', '--config-stdin', '--config-stdin'],
    ['check', '--stdin', '--stdin'],
    ['check', 'check'],
    ['--config-stdin', 'more'],
    ['check --stdin'],
  ];
  for (const args of lists)
    assert.deepEqual(await cli(args, { cwd, env: { BOARD_READ_FAILURE: READ_FAILURE } }), USAGE, args.join(' '));
  const child = spawn(process.execPath, [...isolatedArgs, CLI, 'check', '--stdin', '--config-stdin'], {
    cwd,
    env: { ...ENV, BOARD_READ_FAILURE: READ_FAILURE },
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: LIMIT_MS,
  });
  t.after(() => stop(child));
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.setEncoding('utf8').on('data', (chunk) => {
    stderr += chunk;
  });
  const [code] = await once(child, 'close');
  assert.deepEqual({ code, stdout, stderr }, USAGE);
});

for (const args of [['nope'], ...CONFIG_FORMS]) {
  test(`Bun below the floor stops before each other act: ${args.join(' ')}`, async (t) => {
    assert.deepEqual(
      await cli(args, { cwd: await temp(t), env: { BOARD_OLD_BUN: '1' } }),
      refusal('agent-board: Bun 1.4.2 or later is necessary'),
    );
  });
}

test('config stdin serves and checks', async (t) => {
  const folder = await fixture(t);
  const input = JSON.stringify(FIXTURE_CONFIG);
  assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, input }), OK);
  const board = await serve(t, folder, {}, { args: ['--config-stdin'], input });
  assert.deepEqual(board.lines, [
    `agent-board: repository ${folder}`,
    `agent-board: data    ${folder}/flow/producer.ts`,
    `agent-board: run     ${folder}/flow/run.ts {n}`,
    `agent-board: http://127.0.0.1:${board.port}`,
  ]);
  const { status, json } = await board.get('/api/board');
  assert.equal(status, 200);
  assert.deepEqual(
    cardsOf(json.columns, (card: any) => card.number),
    { needs: [394, 430], running: [], idle: [], done: [414] },
  );
});

test('config stdin waits for EOF and accepts chunks', async (t) => {
  for (const args of CONFIG_FORMS)
    await t.test(args.join(' '), async (t) => {
      const folder = await fixture(t);
      const marker = join(dirname(folder), 'producer-marker');
      await script(
        join(folder, 'flow/producer-é.ts'),
        `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PRODUCER_MARKER,'called');`,
        `process.stdout.write(await Bun.file('flow/contract-1.json').text());`,
      );
      const port = await freePort();
      const child = spawn(process.execPath, [...isolatedArgs, CLI, ...args], {
        cwd: folder,
        env: { ...ENV, PRODUCER_MARKER: marker },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: LIMIT_MS,
      });
      t.after(() => stop(child));
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.setEncoding('utf8').on('data', (chunk) => {
        stderr += chunk;
      });
      const ended = once(child, 'close');
      const bytes = Buffer.from(` \n${JSON.stringify({ data: ['flow/producer-é.ts'], port })}\t \n`);
      const split = bytes.indexOf(Buffer.from('é')) + 1;
      for (const chunk of [bytes.subarray(0, 3), bytes.subarray(3, split), bytes.subarray(split)]) {
        child.stdin.write(chunk);
        await delay(10);
      }
      const until = Date.now() + 200;
      do {
        assert.equal(stdout, '');
        assert.equal(stderr, '');
        assert.deepEqual([child.exitCode, child.signalCode], [null, null]);
        await assert.rejects(readFile(marker), { code: 'ENOENT' });
        assert.equal(await connect('127.0.0.1', port), 'ECONNREFUSED');
        await delay(20);
      } while (Date.now() < until);
      child.stdin.end();
      if (args[0] === 'check') {
        const [code] = await ended;
        assert.deepEqual({ code, stdout, stderr }, OK);
      } else {
        const until = Date.now() + LIMIT_MS;
        while (
          !stdout.includes(`agent-board: http://127.0.0.1:${port}\n`) &&
          child.exitCode === null &&
          Date.now() < until
        )
          await delay(10);
        assert.match(stdout, new RegExp(`agent-board: http://127\\.0\\.0\\.1:${port}\\n`));
        assert.equal(stderr, '');
        const { status, json } = await http(port).get('/api/board');
        assert.equal(status, 200);
        assert.deepEqual(
          cardsOf(json.columns, (card: any) => card.number),
          { needs: [394, 430], running: [], idle: [], done: [414] },
        );
      }
      assert.equal(await readFile(marker, 'utf8'), 'called');
    });
});

test('config stdin reports each bad input without starting work', async (t) => {
  const folder = await fixture(t);
  const marker = join(dirname(folder), 'producer-marker');
  await script(
    join(folder, 'flow/record.ts'),
    `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PRODUCER_MARKER,'called');`,
    `process.stdout.write(await Bun.file('flow/contract-1.json').text());`,
  );
  const port = await freePort();
  const inputs: any[] = [
    ...['', ' \t\n', '{', '{}{}', '{"data":}'].map((input) => [input, 'the input is not JSON']),
    ...['null', '[]', '"text"', 'true', 'false', '7'].map((input) => [input, 'the input is not a JSON object']),
    [JSON.stringify({ data: ['flow/record.ts'], extra: true }), '"extra" is not a key of the config'],
    ...[null, false, 1, 'flow/record.ts', [], [1]].map((data) => [
      JSON.stringify({ data }),
      '"data" is not a list of strings with one item or more',
    ]),
    [JSON.stringify({ data: ['flow/record.ts'], run: null }), '"run" is not a list of strings with one item or more'],
    [
      JSON.stringify({ data: ['flow/record.ts'], resume: 7 }),
      '"resume" is not a list of strings with one item or more',
    ],
    ...[null, '4403', 0, 65536, 4403.5].map((value) => [
      JSON.stringify({ data: ['flow/record.ts'], port: value }),
      '"port" is not an integer from 1024 to 65535',
    ]),
  ];
  for (const args of CONFIG_FORMS)
    for (const [input, message] of inputs) {
      const result = await cli(args, { cwd: folder, input, env: { PORT: String(port), PRODUCER_MARKER: marker } });
      assert.deepEqual(result, refusal(`agent-board: config stdin: ${message}`), `${args.join(' ')}: ${input}`);
      await assert.rejects(readFile(marker), { code: 'ENOENT' });
      assert.equal(await connect('127.0.0.1', port), 'ECONNREFUSED');
    }
});

test('config stdin catches read failures', async (t) => {
  const folder = await fixture(t);
  const marker = join(dirname(folder), 'producer-marker');
  await script(
    join(folder, 'flow/record.ts'),
    `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PRODUCER_MARKER,'called');`,
    `process.stdout.write(await Bun.file('flow/contract-1.json').text());`,
  );
  const port = await freePort();
  for (const args of CONFIG_FORMS) {
    const env = { PORT: String(port), PRODUCER_MARKER: marker, BOARD_READ_FAILURE: READ_FAILURE };
    assert.deepEqual(await cli(args, { cwd: folder, env }), refusal('agent-board: config stdin: stdin read failed'));
    await assert.rejects(readFile(marker), { code: 'ENOENT' });
    assert.equal(await connect('127.0.0.1', port), 'ECONNREFUSED');
  }
});

test('config stdin enforces executable security in the real CLI', async (t) => {
  const folder = await fixture(t);
  const marker = join(dirname(folder), 'producer-marker');
  const port = await freePort();
  const env = { PORT: String(port), PRODUCER_MARKER: marker };
  await script(
    join(folder, 'flow/record.ts'),
    `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PRODUCER_MARKER,'called');`,
    `process.stdout.write(await Bun.file('flow/contract-1.json').text());`,
  );
  await script(
    join(dirname(folder), 'sibling.ts'),
    `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PRODUCER_MARKER,'called');`,
  );
  await symlink(join(dirname(folder), 'sibling.ts'), join(folder, 'flow/external.ts'));
  await put(join(folder, 'flow/not-executable.ts'), 'process.exit(0);\n');
  await script(
    join(folder, '.claude/worktrees/lane/run.ts'),
    `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PRODUCER_MARKER,'called');`,
  );
  await symlink(join(folder, '.claude/worktrees/lane/run.ts'), join(folder, 'flow/lane.ts'));
  await script(
    join(folder, 'flow/control\nname.ts'),
    `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PRODUCER_MARKER,'called');`,
  );
  await symlink(join(folder, 'flow/control\nname.ts'), join(folder, 'flow/control.ts'));
  await symlink(join(folder, 'flow/producer.ts'), join(folder, 'flow/internal.ts'));
  const cases: any[] = [
    [['/bin/sh'], '"data": the first item is an absolute path'],
    [['flow/../flow/record.ts'], '"data": the first item has a ".." part'],
    [['flow'], '"data": flow is not a regular file'],
    [['flow/not-executable.ts'], '"data": flow/not-executable.ts is not executable'],
    [['flow/external.ts'], '"data": flow/external.ts resolves to a place outside the main checkout'],
    [['.claude/worktrees/lane/run.ts'], '"data": .claude/worktrees/lane/run.ts resolves into a lane worktree'],
    [['flow/lane.ts'], '"data": flow/lane.ts resolves into a lane worktree'],
    [['flow/record.ts', 'a\tb'], '"data": an item or a path has a control character'],
    [['flow/control.ts'], '"data": an item or a path has a control character'],
    [['flow/record.ts', '{agent}'], '"data": an item has "{" or "}"'],
  ];
  for (const args of CONFIG_FORMS)
    for (const [data, message] of cases) {
      assert.deepEqual(
        await cli(args, { cwd: folder, env, input: JSON.stringify({ data }) }),
        refusal(`agent-board: config stdin: ${message}`),
      );
      await assert.rejects(readFile(marker), { code: 'ENOENT' });
      assert.equal(await connect('127.0.0.1', port), 'ECONNREFUSED');
    }
  const input = JSON.stringify({ data: ['flow/internal.ts'] });
  assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, input }), OK);
  const board = await serve(t, folder, {}, { args: ['--config-stdin'], input });
  assert.equal(board.lines[1], `agent-board: data    ${folder}/flow/producer.ts`);
  assert.equal((await board.get('/api/board')).status, 200);
  assert.deepEqual(
    await cli(['check', '--config-stdin'], {
      cwd: folder,
      input: JSON.stringify({ resume: ['flow/run.ts', '{agent}', '{n}'] }),
    }),
    refusal('agent-board: config stdin: "resume": an item has "{" or "}" and is not {n}'),
  );
});

test('config stdin keeps port selection and listen errors', async (t) => {
  const folder = await repo(t);
  const reserved = await listening();
  t.after(() => reserved.close());
  const configPort = reserved.address().port;
  const port = await freePort();
  const input = JSON.stringify({ port: configPort });
  const board = await serve(t, folder, { PORT: String(port) }, { args: ['--config-stdin'], input, port });
  assert.equal(board.lines.at(-1), `agent-board: http://127.0.0.1:${port}`);
  assert.equal(await connect('127.0.0.1', port), 'open');
  await t.test(
    'loopback only',
    { skip: !OUTSIDE && 'this machine has no IPv4 address that is not a loopback address' },
    async () => {
      assert.equal(await connect(OUTSIDE, port), 'ECONNREFUSED');
    },
  );
  const inUse = (value: any) => refusal(`agent-board: cannot listen on 127.0.0.1:${value}: the port is in use`);
  for (const PORT of [undefined, 'not-a-number', '0']) {
    assert.deepEqual(await cli(['--config-stdin'], { cwd: folder, env: { PORT }, input }), inUse(configPort));
  }
  const configured = await freePort();
  assert.deepEqual(
    await cli(['--config-stdin'], {
      cwd: folder,
      env: { PORT: String(port) },
      input: JSON.stringify({ port: configured }),
    }),
    inUse(port),
  );
  const fromConfig = await serve(
    t,
    folder,
    { PORT: undefined },
    {
      args: ['--config-stdin'],
      input: JSON.stringify({ port: configured }),
      port: configured,
    },
  );
  assert.equal(fromConfig.lines.at(-1), `agent-board: http://127.0.0.1:${configured}`);
  const defaultPort = await listening(4403).catch((cause) => {
    if (cause.code !== 'EADDRINUSE') throw cause;
  });
  if (defaultPort) t.after(() => defaultPort.close());
  for (const PORT of [undefined, 'not-a-number', '0']) {
    assert.deepEqual(await cli(['--config-stdin'], { cwd: folder, env: { PORT }, input: '{}' }), inUse(4403));
  }
  const { code, stdout, stderr } = await cli(['--config-stdin'], { cwd: folder, env: { PORT: '99999' }, input: '{}' });
  assert.deepEqual([code, stdout], [1, '']);
  assert.match(stderr, /^agent-board: cannot listen on 127\.0\.0\.1:99999: [^\n]+\n$/);
});

test('config stdin preserves missing data and producer results', async (t) => {
  const folder = await fixture(t);
  const board = await serve(t, folder, {}, { args: ['--config-stdin'], input: '{}' });
  assert.deepEqual(board.lines, [`agent-board: repository ${folder}`, `agent-board: http://127.0.0.1:${board.port}`]);
  assert.equal((await board.get('/api/board')).json.source.isSet, false);
  assert.deepEqual(
    await cli(['check', '--config-stdin'], { cwd: folder, input: '{}' }),
    refusal('agent-board: the config has no "data"'),
  );
  await script(
    join(folder, 'flow/eval.ts'),
    `const mode=process.argv[2];
if(mode==='valid')process.stdout.write(await Bun.file('flow/contract-1.json').text());
else if(mode==='stderr'){console.error('boom\\nmore');console.log('out');process.exit(3);}
else if(mode==='stdout'){console.log('stop cannot read\\nmore');process.exit(1);}
else if(mode==='silent')process.exit(3);
else if(mode==='invalid-json')console.log('not-json');
else if(mode==='invalid-doc')process.stdout.write(await Bun.file('flow/invalid.json').text());
else process.exit(90);`,
  );
  const invalid = JSON.parse(DOCUMENT);
  invalid.tracker = 7;
  await put(join(folder, 'flow/invalid.json'), JSON.stringify(invalid));
  const cases: any[] = [
    ['valid', OK],
    ['stderr', refusal('agent-board: boom')],
    ['stdout', refusal('agent-board: stop cannot read')],
    ['silent', refusal('agent-board: the data command exited 3')],
    ['invalid-json', refusal('the data is not JSON')],
    ['invalid-doc', refusal('tracker: is not a string with one character or more')],
  ];
  for (const [command, expected] of cases) {
    const input = JSON.stringify({ data: ['flow/eval.ts', command] });
    assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, input }), expected, command);
  }
});

test('stdin config keeps startup safeguards and terminal actions', async (t) => {
  const config = {
    data: ['flow/producer.ts'],
    run: ['flow/run.ts', '--agent', '{agent}', '{n}', 'one word', 'a;b'],
    resume: ['flow/run.ts', '--resume', '{n}'],
  };
  const folder = await fixture(t, "it's a fixture");
  const document = JSON.parse(DOCUMENT);
  document.issues.push({
    number: 431,
    title: 'stopped step',
    type: 'feature',
    state: 'stuck',
    step: 'plan',
    updatedAt: '2026-10-11T18:00:00Z',
    act: 'resume the step',
  });
  document.agents.opencode = { available: true, cause: null };
  await put(join(folder, 'flow/contract-1.json'), JSON.stringify(document));
  const planted = join(folder, 'node_modules/.bin');
  const marker = join(dirname(folder), 'planted');
  for (const name of ['git', 'herdr'])
    await script(
      join(planted, name),
      `const {appendFileSync}=await import('node:fs');appendFileSync(process.env.PLANTED,process.argv[1]+'\\n');`,
    );
  const env = { PATH: `${planted}:${ENV.PATH}`, PLANTED: marker, HERDR_WORKSPACE: basename(folder) };
  assert.deepEqual(await cli(['check', '--config-stdin'], { cwd: folder, env, input: JSON.stringify(config) }), {
    code: 0,
    stdout: 'agent-board: contract 1, 4 issues, ok\n',
    stderr: '',
  });
  const log = join(dirname(folder), 'herdr.log');
  const board = await serve(t, folder, { ...env, HERDR_LOG: log }, { input: JSON.stringify(config) });
  const { json } = await board.get('/api/board');
  assert.deepEqual(json.can, { run: true, resume: true });
  assert.equal((await board.post('/api/run', { number: 430, agent: 'opencode' })).status, 200);
  assert.equal((await board.post('/api/resume', { number: 431 })).status, 200);
  const typed = (await readFile(log, 'utf8')).split('\n').filter((line) => line.startsWith('pane run '));
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
  const quoted = folder.replaceAll("'", "'\\''");
  assert.deepEqual(typed, [
    `pane run w1:p1 '${quoted}/flow/run.ts' '--agent' 'opencode' 430 'one word' 'a;b' && exit`,
    `pane run w1:p1 '${quoted}/flow/run.ts' '--resume' 431 && exit`,
  ]);
});

test('default changes leave producer configuration unchanged', async (t) => {
  const config = {
    data: ['flow/producer.ts'],
    run: ['flow/run.ts', '--agent', '{agent}', '{n}'],
    resume: ['flow/run.ts', '--resume', '{n}'],
  };
  const folder = await fixture(t);
  const document = JSON.parse(DOCUMENT);
  document.agents = { claude: { available: true, cause: null }, codex: { available: true, cause: null } };
  delete document.defaultAgent;
  document.issues.push(
    { ...document.issues[0], number: 431, state: 'stuck', act: 'Resume the step' },
    { ...document.issues[0], number: 432 },
  );
  await put(join(folder, 'flow/contract-1.json'), JSON.stringify(document));
  await put(join(folder, '.celetis.yaml'), 'agent: claude\n');
  await git(folder, 'add', '.celetis.yaml');
  await git(folder, 'commit', '-q', '-m', 'producer settings');
  await git(folder, 'config', 'celetis-flow.agent', 'claude');
  await git(folder, 'config', '--add', 'fixture.keep', 'one');
  await git(folder, 'config', '--add', 'fixture.keep', 'two');
  await script(
    join(folder, 'flow/producer.ts'),
    `import { readFile } from 'node:fs/promises'
async function main() {
  const document = JSON.parse(await readFile('flow/contract-1.json', 'utf8'))
  const yaml = await readFile('.celetis.yaml', 'utf8')
  if (yaml !== 'agent: claude\\n') throw new Error('unexpected producer configuration')
  document.defaultAgent = 'claude'
  console.log(JSON.stringify(document))
}
main()
`,
  );
  const snapshot = async () => ({
    yaml: await readFile(join(folder, '.celetis.yaml')),
    git: (await git(folder, 'config', '--local', '--null', '--list')).stdout,
    producer: JSON.parse((await exec(join(folder, 'flow/producer.ts'), [], { cwd: folder, env: ENV })).stdout),
  });
  const before = await snapshot();
  assert.equal(before.producer.defaultAgent, 'claude');
  const log = join(dirname(folder), 'herdr.log');
  const board = await serve(
    t,
    folder,
    { HERDR_LOG: log, HERDR_WORKSPACE: basename(folder) },
    { input: JSON.stringify(config) },
  );
  assert.equal((await board.get('/api/board')).json.defaultAgent, 'claude');
  const { status, json } = await board.post('/api/agent', { agent: 'codex' });
  assert.deepEqual(
    [status, json],
    [409, { error: 'The producer controls the default agent. Change it in the producer configuration.' }],
  );
  assert.deepEqual(await snapshot(), before);
  assert.equal((await board.post('/api/refresh', {})).status, 200);
  assert.equal((await board.get('/api/board')).json.defaultAgent, 'claude');
  assert.equal((await board.post('/api/run', { number: 430, agent: 'codex' })).status, 200);
  assert.equal((await board.post('/api/run', { number: 432 })).status, 200);
  assert.equal((await board.post('/api/resume', { number: 431 })).status, 200);
  assert.deepEqual(
    (await readFile(log, 'utf8')).split('\n').filter((line) => line.startsWith('pane run ')),
    [
      `pane run w1:p1 '${folder}/flow/run.ts' '--agent' 'codex' 430 && exit`,
      `pane run w1:p1 '${folder}/flow/run.ts' '--agent' 'claude' 432 && exit`,
      `pane run w1:p1 '${folder}/flow/run.ts' '--resume' 431 && exit`,
    ],
  );
  assert.deepEqual(await snapshot(), before);
  assert.equal((await board.get('/api/board')).json.defaultAgent, 'claude');
});
