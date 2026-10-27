import { realpath } from 'node:fs/promises';
import { bunFloor, type Host } from './config.ts';
import { claudeInstallation, codexHome, codexPlugin } from './plugin-metadata.ts';
import { bunArgs, childEnv, run, updateDescriptor } from './process.ts';

export type { Host } from './config.ts';

export const updateHint = 'celetis: when a skill or a document gave this command, run celetis update';

export class HostError extends Error {
  constructor(
    message: string,
    readonly code = 1,
  ) {
    super(message);
  }
}

export class NotInstalled extends HostError {}

export async function commonDir(cwd: string): Promise<string> {
  const result = await run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd });
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
  return result.stdout.replace(/\n$/, '');
}

export async function mainCheckout(cwd: string): Promise<string> {
  const gitPath = async (args: string[], at = cwd) => {
    const result = await run('git', ['rev-parse', ...args], { cwd: at });
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
    return realpath(result.stdout.replace(/\n$/, ''));
  };
  const active = await gitPath(['--show-toplevel']);
  const common = await realpath(await commonDir(cwd));
  if ((await gitPath(['--absolute-git-dir'])) === common) return active;
  const listed = await run('git', ['worktree', 'list', '--porcelain', '-z'], { cwd });
  if (listed.code !== 0) throw new HostError(listed.stderr.trimEnd(), listed.code);
  const first = listed.stdout.split('\0\0')[0]?.split('\0') ?? [];
  const candidate = first[0]?.startsWith('worktree ') ? first[0].slice(9) : '';
  const message = `celetis: cannot identify the main checkout from Git metadata: ${common}`;
  if (!candidate || first.includes('bare')) throw new HostError(message, 2);
  try {
    const main = await gitPath(['--show-toplevel'], candidate);
    if ((await gitPath(['--absolute-git-dir'], main)) === common) return main;
  } catch (error) {
    throw new HostError(`${message}\n${error instanceof Error ? error.message : String(error)}`, 2);
  }
  throw new HostError(message, 2);
}

export function requireBun(): void {
  if (Bun.semver.order(Bun.version, bunFloor) < 0) {
    throw new HostError(`celetis: need Bun >=${bunFloor} on PATH, found ${Bun.version}`, 2);
  }
}

export function selectHost(
  explicit: string | undefined,
  environment: string | undefined,
  hint: Host | undefined,
): Host {
  const host = explicit ?? environment ?? hint ?? 'claude';
  if (host !== 'claude' && host !== 'codex')
    throw new HostError(`celetis: invalid agent ${host}; use claude or codex`, 2);
  return host;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function nativeCodexRequest(
  cwd: string,
  method: string,
  params: unknown,
  inheritedFd: number | undefined,
  env: NodeJS.ProcessEnv,
): Promise<unknown> {
  const { spawn } = await import('node:child_process');
  const { fstatSync } = await import('node:fs');
  const { constants } = await import('node:os');
  const { createInterface } = await import('node:readline');
  class HostError extends Error {
    constructor(
      message: string,
      readonly code = 1,
    ) {
      super(message);
    }
  }
  const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  if (inheritedFd === undefined) {
    const candidate = Number(process.env.CELETIS_UPDATE_FD);
    if (Number.isInteger(candidate) && candidate >= 3) {
      try {
        if (fstatSync(candidate).isFile()) inheritedFd = candidate;
      } catch {}
    }
  }
  const args = method === 'skills/list' ? ['app-server', '--stdio'] : ['--disable', 'plugins', 'app-server', '--stdio'];
  const child = spawn('codex', args, {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe', ...(inheritedFd === undefined ? [] : [inheritedFd])],
  });
  if (!child.stdin || !child.stdout || !child.stderr)
    throw new HostError('celetis: cannot open Codex app-server streams');
  const input = child.stdin;
  const output = child.stdout;
  const errors = child.stderr;
  const exited = new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.once('error', () => resolve());
  });
  const handlers = new Map<NodeJS.Signals, () => void>();
  let interruption: HostError | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const) {
      const handler = () => {
        interruption ??= new HostError('', 128 + constants.signals[signal]);
        reject(interruption);
      };
      handlers.set(signal, handler);
      process.on(signal, handler);
    }
  });
  let failure: Error | undefined;
  child.on('error', (error) => {
    failure = error;
  });
  let stderr = '';
  errors.setEncoding('utf8');
  errors.on('data', (data: string) => {
    stderr += data;
  });
  input.on('error', () => {});
  const lines = createInterface({ input: output, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  async function reply(id: number, operation: string): Promise<Record<string, unknown>> {
    const deadline = Date.now() + 10_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new HostError(`celetis: Codex ${operation} timed out after 10 seconds`)), 10_000);
    });
    try {
      while (Date.now() < deadline) {
        const next = await Promise.race([iterator.next(), timeout, interrupted]);
        if (next.done) throw new HostError(`celetis: Codex app-server closed its output during ${operation}`);
        let value: unknown;
        try {
          value = JSON.parse(next.value);
        } catch {
          throw new HostError('celetis: invalid Codex app-server response');
        }
        if (!object(value)) throw new HostError('celetis: invalid Codex app-server response');
        if (Object.hasOwn(value, 'id')) {
          if (value.id !== id) continue;
          if (value.error != null) {
            const message = object(value.error) ? (value.error.message ?? 'unknown error') : 'unknown error';
            throw new HostError(`celetis: Codex ${operation} failed: ${message}`);
          }
          if (!object(value.result)) throw new HostError('celetis: invalid Codex app-server response');
          return value;
        }
        if (typeof value.method !== 'string') throw new HostError('celetis: invalid Codex app-server response');
      }
      throw new HostError(`celetis: Codex ${operation} timed out after 10 seconds`);
    } finally {
      clearTimeout(timer);
    }
  }
  const send = (value: unknown) => input.write(`${JSON.stringify(value)}\n`);
  let error: unknown;
  let result: unknown;
  try {
    send({
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: 'celetis', version: '0.0.0' }, capabilities: { experimentalApi: true } },
    });
    await reply(1, 'initialize');
    send({ method: 'initialized' });
    send({ id: 2, method, params });
    result = await reply(2, method);
  } catch (caught) {
    error = caught;
  } finally {
    lines.close();
    input.destroy();
    child.kill('SIGTERM');
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      exited,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 500);
      }),
    ]);
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
    output.destroy();
    errors.destroy();
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
  if (interruption) error = interruption;
  if (error || failure) {
    const detail = error instanceof Error ? error.message : (failure?.message ?? String(error));
    throw new HostError(
      [detail, stderr.trimEnd()].filter(Boolean).join('\n'),
      error instanceof HostError ? error.code : 1,
    );
  }
  return result;
}

export async function codexRequest(
  cwd: string,
  method: string,
  params: unknown,
  nativeHome?: string,
  execute: typeof run = run,
): Promise<unknown> {
  const inheritedFd = updateDescriptor();
  const env = childEnv({ ...process.env, CODEX_HOME: await codexHome(nativeHome) });
  if (!Bun.which('codex', { PATH: env.PATH })) throw new HostError('celetis: codex is not on PATH');
  try {
    if (execute === run) return await nativeCodexRequest(cwd, method, params, inheritedFd, env);
    const program = `try{const [cwd,method,params,fd]=JSON.parse(process.argv[1]);console.log(JSON.stringify(await (${nativeCodexRequest.toString()})(cwd,method,params,fd??undefined,process.env)));}catch(error){console.error(error.message);process.exitCode=typeof error.code==='number'?error.code:1;}`;
    const helperFd = inheritedFd === undefined ? undefined : 3;
    const result = await execute(
      process.execPath,
      bunArgs('--eval', [program, JSON.stringify([cwd, method, params, helperFd])]),
      { cwd, env, inheritedFd },
    );
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
    const value: unknown = JSON.parse(result.stdout);
    if (!object(value)) throw new HostError('celetis: invalid Codex app-server response');
    return value;
  } catch (error) {
    throw new HostError(
      error instanceof Error ? error.message : String(error),
      object(error) && typeof error.code === 'number' ? error.code : 1,
    );
  }
}

export async function installedRoot(host: Host, cwd: string, execute: typeof run = run): Promise<string> {
  if (host === 'claude') {
    const missing =
      'celetis: no enabled Celetis installation; run: claude plugin marketplace add ddinkov10/celetis && claude plugin install celetis@celetis';
    if (!Bun.which('claude', { PATH: childEnv().PATH })) throw new HostError(missing);
    const result = await execute('claude', ['plugin', 'list', '--json'], { cwd });
    if (result.code !== 0) {
      throw new HostError(
        [
          result.stderr.trimEnd(),
          `celetis: claude plugin list --json failed (exit ${result.code})`,
          result.stdout.trimEnd(),
        ]
          .filter(Boolean)
          .join('\n'),
        result.code,
      );
    }
    let records: unknown;
    try {
      records = JSON.parse(result.stdout);
    } catch {}
    if (!Array.isArray(records)) throw new HostError(`celetis: invalid plugin list JSON\n${result.stdout.trimEnd()}`);
    return (await claudeInstallation(records, cwd)).root;
  }
  return (await codexPlugin(cwd, execute)).root;
}
