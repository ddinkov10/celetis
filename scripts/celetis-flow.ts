import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, join } from 'node:path';
import type { Config } from './lib/config.ts';
import type { Host } from './lib/host.ts';
import type { SessionRecord, Step } from './lib/session.ts';
import type { ConsumerLock } from './lib/update-lock.ts';

const usage =
  'usage: scripts/celetis celetis-flow [<issue number>...] | --board | --resume <issue number>, e.g. scripts/celetis celetis-flow 373 374; with no number, the automatic runner';
const removed = 'the plugin version of this runner was removed after an update; start the runner again';
const here = import.meta.dir;
const required = [
  'next-step.ts',
  'celetis',
  'launcher.ts',
  'lib/config.ts',
  'lib/host.ts',
  'lib/plugin-metadata.ts',
  'lib/plugin-policy.ts',
  'lib/update-lock.ts',
  'lib/session.ts',
  'lib/process.ts',
  'lib/vendor/yaml.mjs',
];
const flow = {
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
};
async function gone(files = required) {
  for (const file of files) if (!(await stat(join(here, file)).catch(() => null))?.isFile()) return true;
  return false;
}
function stepOf(line: string): Step {
  const step = line.replace(/^run \/celetis:/, '').split(' ')[0];
  return (step === 'feature' ? 'specify' : step) as Step;
}
function parsed(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function main(argv: string[]): Promise<number> {
  let consumer: ConsumerLock | undefined;
  let mode: 'numbers' | 'auto' | 'board' | 'resume' = 'numbers';
  let numbers: string[] = [];
  if (argv.length === 1 && argv[0] === '--board') mode = 'board';
  else if (argv.length === 2 && argv[0] === '--resume') {
    mode = 'resume';
    numbers = [(argv[1] ?? '').replace(/^#/, '')];
  } else {
    numbers = argv.map((arg) => arg.replace(/^#/, ''));
    if (!numbers.length) mode = 'auto';
  }
  if (
    numbers.some((n) => !/^[1-9][0-9]*$/.test(n)) ||
    ((argv[0] === '--board' || argv[0] === '--resume') && mode === 'numbers')
  ) {
    console.error(usage);
    return 2;
  }
  if (
    await gone([
      'lib/config.ts',
      'lib/host.ts',
      'lib/plugin-metadata.ts',
      'lib/plugin-policy.ts',
      'lib/update-lock.ts',
      'lib/process.ts',
      'lib/session.ts',
      'lib/vendor/yaml.mjs',
    ])
  ) {
    if (mode === 'numbers') {
      for (const n of numbers) console.log(`celetis-flow: #${n}: ${removed}`);
      return 0;
    }
    if (mode === 'resume') console.error(`celetis-flow: ${removed}`);
    else console.log(mode === 'board' ? `stop ${removed}` : `celetis-flow: stop ${removed}`);
    return 1;
  }
  const { ConfigError, readConfig } = await import('./lib/config.ts');
  const { HostError, commonDir, mainCheckout, requireBun, selectHost } = await import('./lib/host.ts');
  const { bunArgs, childEnv, run } = await import('./lib/process.ts');
  const {
    hostArguments,
    manualRecovery,
    observeSession,
    readSession,
    reportedSessionId,
    selectSavedSession,
    serializeSession,
    sessionIdle,
    startupError,
    writeSession,
  } = await import('./lib/session.ts');
  const root = dirname(here);
  let common = '',
    main = '',
    state = '',
    recordPath = '';
  let config: Config;
  let host: Host = 'claude';
  let managed = false;
  let pane = '';
  let savedId = '';
  let said = '';
  let holder = '';
  let lockOwner = '';
  const held = new Set<string>();
  let session: ChildProcess | undefined;
  let signalStatus = 0;
  let watcher: AbortController | undefined;
  let watchDir = '';
  const handlers = new Map<NodeJS.Signals, () => void>();
  const die = (message: string): never => {
    throw new HostError(`celetis-flow: ${message}`);
  };
  const say = (message: string) => {
    if (mode === 'auto' && message === said) return;
    said = message;
    console.log(`celetis-flow: ${message}`);
  };
  const load = () => {
    try {
      return readConfig(main);
    } catch (error) {
      if (error instanceof ConfigError)
        throw new HostError(`celetis: ${main}/.celetis.yaml: ${error.field}: ${error.message}`, 2);
      throw error;
    }
  };
  const git = async (args: string[], input?: string) => run('git', args, { cwd: main, env: childEnv(), input });
  const ref = (name: string) => `refs/celetis-flow/locks/${name}`;
  const refValue = async (name: string) => (await git(['rev-parse', '--verify', ref(name)])).stdout.trimEnd();
  const processField = async (pid: number, field: string) => {
    const r = await run('ps', ['-p', String(pid), '-o', field], { env: childEnv({ ...process.env, LC_ALL: 'C' }) });
    return r.code === 0 ? r.stdout.trimEnd() : '';
  };
  const identity = async (pid: number) => processField(pid, 'lstart=');
  const holderFrom = async (owner: string) => {
    const data = parsed((await git(['cat-file', 'blob', owner])).stdout);
    if (!object(data)) return '';
    for (const kind of ['runner', 'session']) {
      const row = data[kind];
      if (
        !object(row) ||
        !Number.isInteger(row.pid) ||
        Number(row.pid) <= 0 ||
        typeof row.start !== 'string' ||
        !row.start
      )
        continue;
      const pid = Number(row.pid);
      if (kind === 'runner' && !(await processField(pid, 'command=')).includes('celetis-flow.ts')) continue;
      const status = await processField(pid, 'stat=');
      if (!status || /[ZX]/.test(status)) continue;
      if ((await identity(pid)) !== row.start) continue;
      return String(pid);
    }
    return '';
  };
  const holderOf = async (name: string) => {
    const old = await refValue(name);
    return old ? holderFrom(old) : '';
  };
  const blob = async (value: unknown) => {
    const r = await git(['hash-object', '-w', '--stdin'], `${JSON.stringify(value)}\n`);
    if (r.code !== 0) die('cannot write the lock owner');
    return r.stdout.trimEnd();
  };
  const take = async (name: string) => {
    if (!lockOwner) {
      const start = await identity(process.pid);
      if (!start) die('cannot read process identity; allow process access and start the runner again');
      lockOwner = await blob({ runner: { pid: process.pid, start }, session: null });
    }
    for (;;) {
      const old = await refValue(name);
      holder = old ? await holderFrom(old) : '';
      if (holder) return false;
      const r = await git(['update-ref', '--no-deref', ref(name), lockOwner, old]);
      if (r.code === 0) {
        held.add(name);
        return true;
      }
      if ((await refValue(name)) === old)
        die(`cannot take the ${name} lock; check Git access and start the runner again`);
    }
  };
  const release = async (name: string) => {
    if (lockOwner) await git(['update-ref', '--no-deref', '-d', ref(name), lockOwner]);
    held.delete(name);
  };
  const registerSession = async () => {
    const pid = session?.pid;
    if (!pid) throw new HostError('celetis-flow: cannot read session process identity; start the runner again');
    const start = await identity(pid);
    if (!start) die('cannot read session process identity; start the runner again');
    const current = parsed((await git(['cat-file', 'blob', lockOwner])).stdout);
    const owner = await blob({ ...(current as Record<string, unknown>), session: { pid, start } });
    const input = [...held].map((name) => `update ${ref(name)} ${owner} ${lockOwner}\n`).join('');
    const r = await git(['update-ref', '--no-deref', '--stdin'], input);
    if (r.code !== 0) die('cannot register the session in its locks; start the runner again');
    lockOwner = owner;
  };
  const recorded = async (n: string, line: string) =>
    (await readFile(recordPath, 'utf8').catch(() => '')).split('\n').includes(`${n}\t${line}`);
  const resolve = async (args: string[], abort?: AbortSignal) => {
    if (abort?.aborted) return { code: 1, stdout: '', stderr: '' };
    const r = await run(process.execPath, bunArgs(join(here, 'next-step.ts'), args), {
      cwd: main,
      env: childEnv(),
      signal: abort,
    });
    process.stderr.write(r.stderr);
    return r;
  };
  const herdr = async (args: string[], abort?: AbortSignal) =>
    run('herdr', args, { cwd: main, env: childEnv(), signal: abort });
  const idle = async (id: string, abort: AbortSignal) =>
    sessionIdle(parsed((await herdr(['agent', 'get', pane], abort)).stdout), host, id);
  const endWhenDone = async (
    n: string,
    line: string,
    record: SessionRecord,
    prior: string,
    startedAt: number,
    abort: AbortSignal,
  ) => {
    const deadline = performance.now() + 60_000;
    let saved = false;
    while (!abort.aborted) {
      const reply = await herdr(['agent', 'get', pane], abort);
      if (reply.code === 0) {
        const result = await observeSession(record, parsed(reply.stdout), prior, startedAt);
        if (result === 0) {
          saved = true;
          break;
        }
        if (result === 2) {
          await writeFile(join(watchDir, 'error'), '');
          await startupError(Number(n), host, 'herdr returned an invalid identity');
          return;
        }
      }
      if (performance.now() >= deadline) {
        await writeFile(join(watchDir, 'error'), '');
        await startupError(Number(n), host, 'no saved turn with a verified identity after 60 seconds');
        return;
      }
      await Bun.sleep(1000);
    }
    if (!saved || abort.aborted) return;
    const id = (await readSession(main, Number(n))).session_id ?? '';
    while (
      !abort.aborted &&
      (await herdr(['agent', 'wait', pane, '--until', 'idle', '--until', 'done'], abort)).code === 0
    ) {
      if (await gone()) {
        say(`#${n}: ${removed}`);
        return;
      }
      if (await idle(id, abort)) {
        const first = await resolve([n], abort);
        const next = first.code === 0 ? first.stdout.trimEnd() : line;
        if (next !== line && (next.startsWith('run ') || next.startsWith(`stop #${n} `))) {
          const second = await resolve([n], abort);
          if (second.code === 0 && second.stdout.trimEnd() === next && (await idle(id, abort))) {
            if ((await herdr(['agent', 'prompt', pane, '/exit'], abort)).code !== 0 && !abort.aborted)
              console.error(
                `celetis-flow: #${n} cannot submit /exit; the session stays open. Exit it in this pane when ready.`,
              );
            return;
          }
        }
      }
      await herdr(['agent', 'wait', pane, '--until', 'working', '--until', 'blocked', '--timeout', '5000'], abort);
      if (!abort.aborted) await Bun.sleep(1000);
    }
  };
  const startSession = async (args: string[]) => {
    if (host === 'codex')
      args = [...(await (await import('./lib/plugin-metadata.ts')).codexSessionPin(root, main)), ...args];
    watchDir = await mkdtemp(join(state, 'start.'));
    session = spawn(
      process.execPath,
      bunArgs(import.meta.path, ['--session-start', watchDir, String(process.pid), host, ...args]),
      {
        cwd: main,
        env: childEnv({ ...process.env, CELETIS_CONSUMER_FD: '3' }),
        stdio: ['inherit', 'inherit', 'inherit', consumer?.fd ?? 'ignore'],
      },
    );
    const ended = new Promise<number>((done) => {
      session?.once('error', (error) => {
        console.error(error.message);
        done(1);
      });
      session?.once('exit', (code, signal) => done(code ?? (signal ? 128 + constants.signals[signal] : 1)));
    });
    await registerSession();
    if (signalStatus) {
      session.kill('SIGTERM');
      await ended;
      session = undefined;
      throw new HostError('', signalStatus);
    }
    return { ended };
  };
  const runIssue = async (n: string, first: 'any' | 'gated') => {
    if (!(await take(`issue-${n}`))) {
      say(`another celetis-flow.ts or its session (PID ${holder}) works on #${n}`);
      return false;
    }
    let started = false,
      last = '',
      exitCode = 0;
    try {
      for (;;) {
        if (signalStatus) throw new HostError('', signalStatus);
        if (await gone()) {
          say(`#${n}: ${removed}`);
          break;
        }
        config = load();
        await (await import('./lib/plugin-policy.ts')).requireUpdatePolicy(host, main);
        const line = (await resolve([n])).stdout.trimEnd();
        if (!line.startsWith('run ')) {
          say(line || `#${n}: next-step.ts printed no line`);
          break;
        }
        const prompt = line.slice(4);
        if (line === last) {
          if (exitCode !== 0)
            die(
              `${host} session exited with status ${exitCode} before issue progress; check startup output, then run ${manualRecovery(host)} from the main checkout or start the step again`,
            );
          say(`no progress: ${prompt}`);
          if (!(await recorded(n, line))) await writeFile(recordPath, `${n}\t${line}\n`, { flag: 'a' });
          break;
        }
        const step = stepOf(line);
        if (first !== 'any' && (config.gates?.[step] ?? 'me') !== 'auto') {
          say(`the gate of ${step} is me: scripts/celetis celetis-flow ${n} starts ${prompt}`);
          break;
        }
        first = 'gated';
        say(`start: ${prompt}`);
        started = true;
        if ((await gone()) || !(await stat(join(root, 'step-prompt.md')).catch(() => null))?.isFile()) {
          say(`#${n}: ${removed}`);
          break;
        }
        const args = await hostArguments(host, Number(n), step, prompt, root, main);
        const record: SessionRecord = { schema: 1, host, issue: Number(n), step, checkout: main, session_id: null };
        await writeSession(main, record);
        const { ended } = await startSession(args);
        let watching: Promise<void> | undefined;
        if (managed) {
          if (process.env.HERDR_TAB_ID) await herdr(['tab', 'rename', process.env.HERDR_TAB_ID, `#${n} ${step}`]);
          const prior = reportedSessionId(parsed((await herdr(['agent', 'get', pane])).stdout));
          const startedAt = Math.floor(Date.now() / 1000);
          watcher = new AbortController();
          watching = endWhenDone(n, line, record, prior, startedAt, watcher.signal);
        }
        await writeFile(join(watchDir, 'go'), '');
        exitCode = await ended;
        session = undefined;
        watcher?.abort();
        await watching;
        watcher = undefined;
        if (managed && (await readSession(main, Number(n))).session_id === null) {
          if (!(await stat(join(watchDir, 'error')).catch(() => null)))
            await startupError(Number(n), host, 'the session ended before a saved turn had a verified identity');
          throw new HostError('', 1);
        }
        await rm(watchDir, { recursive: true, force: true });
        watchDir = '';
        if (signalStatus) throw new HostError('', signalStatus);
        last = line;
      }
      return started;
    } finally {
      await release(`issue-${n}`);
    }
  };
  try {
    requireBun();
    common = await commonDir(process.cwd());
    main = await mainCheckout(process.cwd());
    state = join(common, 'celetis-flow');
    recordPath = join(state, 'no-progress');
    let saved: SessionRecord | undefined;
    if (mode === 'resume') {
      saved = await selectSavedSession(main, Number(numbers[0]));
      if (
        process.env.CELETIS_RESUME_RECORD !== undefined &&
        process.env.CELETIS_RESUME_RECORD !== serializeSession(saved)
      )
        die('the session record changed during package discovery; run the resume command again');
      delete process.env.CELETIS_RESUME_RECORD;
      host = saved.host;
      savedId = saved.session_id ?? '';
    } else host = selectHost(undefined, process.env, main);
    if (host === 'codex') process.env.CODEX_HOME = await (await import('./lib/plugin-metadata.ts')).codexHome();
    config = load();
    consumer = await (await import('./lib/update-lock.ts')).ConsumerLock.acquire(host);
    await (await import('./lib/plugin-policy.ts')).requireUpdatePolicy(host, main);
    process.env.CELETIS_AGENT = host;
    process.chdir(main);
    if (!Bun.which(host, { PATH: childEnv().PATH })) throw new HostError(`celetis: ${host} is not on PATH`);
    if (mode !== 'resume') {
      if (!Bun.which('gh', { PATH: childEnv().PATH })) die('gh is not on PATH');
      if (process.env.HERDR_ENV === '1') {
        pane = process.env.HERDR_PANE_ID ?? '';
        if (!/^w[A-Za-z0-9]+:p[A-Za-z0-9]+$/.test(pane))
          die('HERDR_ENV=1 needs a valid HERDR_PANE_ID; start from a herdr pane');
        if (!Bun.which('herdr', { PATH: childEnv().PATH })) die('herdr is not on PATH');
        managed = true;
      }
    }
    await mkdir(state, { recursive: true });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      const handler = () => {
        signalStatus = 128 + constants.signals[signal];
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
    if (mode === 'resume') {
      if (!(await take(`issue-${numbers[0]}`)))
        die(`another celetis-flow.ts or its session (PID ${holder}) works on #${numbers[0]}`);
      const { ended } = await startSession(
        host === 'claude' ? ['--resume', savedId] : ['resume', '--no-daemon', savedId],
      );
      await writeFile(join(watchDir, 'go'), '');
      const code = await ended;
      session = undefined;
      return signalStatus || code;
    }
    if (mode === 'board') {
      if (await gone()) {
        console.log(`stop ${removed}`);
        return 1;
      }
      const result = await resolve(['--json']);
      if (result.code !== 0) {
        console.log(result.stdout.trimEnd() || 'stop cannot read the issues from GitHub');
        return 1;
      }
      const doc = JSON.parse(result.stdout) as {
        noRun: string | null;
        issues: (Record<string, unknown> & { number: number; line: string; state: string; type: string })[];
      };
      const steps = Object.fromEntries(
        [...new Set(Object.values(flow.lanes).flat())].sort().map((step) => [
          step,
          {
            gate: config.gates?.[step as Step] ?? 'me',
            ...(['implement', 'chore', 'hotfix'].includes(step)
              ? { hint: 'It lands the change when the build is done.' }
              : {}),
          },
        ]),
      );
      const issues = [];
      for (const issue of doc.issues) {
        const step = issue.line.startsWith('run /') ? stepOf(issue.line) : null;
        const locked = !!(await holderOf(`issue-${issue.number}`));
        const stuck = await recorded(String(issue.number), issue.line);
        const { line: _line, ...row } = issue;
        issues.push({
          ...row,
          step,
          started: step === 'plan' || step === 'implement',
          urgent: issue.type === 'hotfix',
          ...(issue.state === 'done'
            ? {}
            : locked
              ? { state: 'starting' }
              : issue.state === 'dirty'
                ? {}
                : stuck
                  ? { state: 'stuck', act: `scripts/celetis celetis-flow --resume ${issue.number}` }
                  : {}),
        });
      }
      const agents = Object.fromEntries(
        ['claude', 'codex'].map((agent) => {
          const available = !!Bun.which(agent, { PATH: childEnv().PATH });
          return [agent, { available, cause: available ? null : `celetis: ${agent} is not on PATH` }];
        }),
      );
      console.log(
        JSON.stringify(
          {
            contract: 1,
            tracker: 'GitHub',
            agents,
            defaultAgent: host,
            flow: { ...flow, steps },
            noRun: doc.noRun,
            runner: !!(await holderOf('runner')),
            issues,
          },
          null,
          2,
        ),
      );
      return 0;
    }
    if (mode === 'numbers') {
      for (const n of numbers) await runIssue(n, 'any');
      return 0;
    }
    if (!(await take('runner'))) die(`another automatic runner or its session has PID ${holder}`);
    while (!signalStatus) {
      if (await gone()) {
        say(`stop ${removed}`);
        return 1;
      }
      config = load();
      await (await import('./lib/plugin-policy.ts')).requireUpdatePolicy(host, main);
      const result = await resolve(['--open']);
      let started = false;
      if (result.code === 0) {
        let pick = '';
        for (const row of result.stdout.trimEnd().split('\n')) {
          const [n, line] = row.split('\t');
          if (!n || !line?.startsWith('run ') || (config.gates?.[stepOf(line)] ?? 'me') !== 'auto') continue;
          if ((await holderOf(`issue-${n}`)) || (await recorded(n, line))) continue;
          pick = n;
          break;
        }
        if (pick) started = await runIssue(pick, 'gated');
        else say('no auto step can start; the runner asks again each 60 seconds');
      } else say(result.stdout.trimEnd() || 'stop cannot read the open issues from GitHub');
      if (!started) {
        const until = performance.now() + 60_000;
        while (!signalStatus && performance.now() < until) await Bun.sleep(50);
      }
    }
    return signalStatus;
  } catch (error) {
    if (error instanceof HostError) {
      if (error.message) console.error(error.message);
      return error.code;
    }
    throw error;
  } finally {
    watcher?.abort();
    if (session?.pid && session.exitCode === null && session.signalCode === null) {
      session.kill('SIGTERM');
      await new Promise<void>((done) => session?.once('exit', () => done()));
    }
    if (watchDir) await rm(watchDir, { recursive: true, force: true });
    consumer?.close();
    for (const name of [...held]) await release(name);
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
}

async function waitingSession(args: string[]): Promise<number> {
  const [dir, runner, host, ...hostArgs] = args;
  if (!dir || !runner || (host !== 'claude' && host !== 'codex')) return 2;
  const { childEnv, run } = await import('./lib/process.ts');
  while (!(await stat(join(dir, 'go')).catch(() => null))?.isFile()) {
    const status = await run('ps', ['-p', runner, '-o', 'stat=']);
    if (status.code !== 0 || !status.stdout.trim() || /[ZX]/.test(status.stdout)) return 1;
    await Bun.sleep(50);
  }
  const executable = Bun.which(host, { PATH: childEnv().PATH });
  if (!executable || !process.execve) return 1;
  (await import('./lib/update-lock.ts')).ConsumerLock.retainInherited();
  return (await import('./lib/update-lock.ts')).execConsumer(executable, [executable, ...hostArgs], childEnv());
}

if (import.meta.main)
  process.exitCode =
    process.argv[2] === '--session-start'
      ? await waitingSession(process.argv.slice(3))
      : await main(process.argv.slice(2));
