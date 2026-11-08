import { exitCodeOf, exits } from './contract.ts';
import { HostError } from './errors.ts';
import { codexHome } from './homes.ts';
import { bunArgs, childEnv, run, updateDescriptor } from './process.ts';

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
  const blocked = 6;
  class HostError extends Error {
    constructor(
      message: string,
      readonly code: number,
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
    throw new HostError('celetis: cannot open Codex app-server streams', blocked);
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
      timer = setTimeout(
        () => reject(new HostError(`celetis: Codex ${operation} timed out after 10 seconds`, blocked)),
        10_000,
      );
    });
    try {
      while (Date.now() < deadline) {
        const next = await Promise.race([iterator.next(), timeout, interrupted]);
        if (next.done) throw new HostError(`celetis: Codex app-server closed its output during ${operation}`, blocked);
        let value: unknown;
        try {
          value = JSON.parse(next.value);
        } catch {
          throw new HostError('celetis: invalid Codex app-server response', blocked);
        }
        if (!object(value)) throw new HostError('celetis: invalid Codex app-server response', blocked);
        if (Object.hasOwn(value, 'id')) {
          if (value.id !== id) continue;
          if (value.error != null) {
            const message = object(value.error) ? (value.error.message ?? 'unknown error') : 'unknown error';
            throw new HostError(`celetis: Codex ${operation} failed: ${message}`, blocked);
          }
          if (!object(value.result)) throw new HostError('celetis: invalid Codex app-server response', blocked);
          return value;
        }
        if (typeof value.method !== 'string')
          throw new HostError('celetis: invalid Codex app-server response', blocked);
      }
      throw new HostError(`celetis: Codex ${operation} timed out after 10 seconds`, blocked);
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
      error instanceof HostError ? error.code : blocked,
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
  if (!Bun.which('codex', { PATH: env.PATH })) throw new HostError('celetis: codex is not on PATH', exits.prerequisite);
  try {
    if (execute === run) return await nativeCodexRequest(cwd, method, params, inheritedFd, env);
    const program = `try{const [cwd,method,params,fd]=JSON.parse(process.argv[1]);console.log(JSON.stringify(await (${nativeCodexRequest.toString()})(cwd,method,params,fd??undefined,process.env)));}catch(error){console.error(error.message);process.exitCode=typeof error.code==='number'?error.code:1;}`;
    const helperFd = inheritedFd === undefined ? undefined : 3;
    const result = await execute(
      process.execPath,
      bunArgs('--eval', [program, JSON.stringify([cwd, method, params, helperFd])]),
      { cwd, env, inheritedFd },
    );
    if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
    const value: unknown = JSON.parse(result.stdout);
    if (!object(value)) throw new HostError('celetis: invalid Codex app-server response', exits.blocked);
    return value;
  } catch (error) {
    throw new HostError(
      error instanceof Error ? error.message : String(error),
      (object(error) ? exitCodeOf(error.code) : null) ?? exits.internal,
    );
  }
}
