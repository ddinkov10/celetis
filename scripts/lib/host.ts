import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, join, win32 } from 'node:path';
import { createInterface } from 'node:readline';
import { bunFloor, ConfigError, readSnapshot } from './config.ts';
import { childEnv, run } from './process.ts';

export type Host = 'claude' | 'codex';

export class HostError extends Error {
  constructor(
    message: string,
    readonly code = 1,
  ) {
    super(message);
  }
}

export async function commonDir(cwd: string): Promise<string> {
  const result = await run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd });
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
  return result.stdout.trimEnd();
}

export async function mainCheckout(cwd: string): Promise<string> {
  const common = await commonDir(cwd);
  return /^[A-Za-z]:\\/.test(common) ? win32.dirname(common) : dirname(common);
}

export function requireBun(): void {
  if (Bun.semver.order(Bun.version, bunFloor) < 0) {
    throw new HostError(`celetis: need Bun >=${bunFloor} on PATH, found ${Bun.version}`, 2);
  }
}

export function selectHost(explicit: string | undefined, env: NodeJS.ProcessEnv, main: string | null): Host {
  let host: unknown = explicit ?? env.CELETIS_AGENT;
  if (host === undefined) {
    host = 'claude';
    if (main !== null) {
      const file = `${main}/.celetis.yaml`;
      let config: unknown;
      try {
        const source = new TextDecoder().decode(readSnapshot(file));
        try {
          config = Bun.YAML.parse(source);
        } catch (error) {
          throw new ConfigError([], `invalid YAML: ${(error as Error).message.split('\n')[0]}`);
        }
      } catch (error) {
        if (!(error instanceof ConfigError)) throw error;
        throw new HostError(`celetis: ${file}: ${error.field}: ${error.message}`, 2);
      }
      if (config !== null && typeof config === 'object' && !Array.isArray(config) && Object.hasOwn(config, 'host')) {
        host = (config as Record<string, unknown>).host;
      }
    }
  }
  if (host !== 'claude' && host !== 'codex') {
    const value = Array.isArray(host)
      ? 'a sequence'
      : host !== null && typeof host === 'object'
        ? 'a mapping'
        : String(host);
    throw new HostError(`celetis: invalid agent ${value}; use claude or codex`, 2);
  }
  return host;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function codexRequest(
  cwd: string,
  method: string,
  params: unknown,
  inheritedFd?: number,
): Promise<unknown> {
  const env = childEnv();
  if (!Bun.which('codex', { PATH: env.PATH })) throw new HostError('celetis: codex is not on PATH');
  const child = spawn('codex', ['app-server', '--stdio'], {
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

export async function installedRoot(host: Host, cwd: string, inheritedFd?: number): Promise<string> {
  if (host === 'claude') {
    const missing =
      'celetis: the plugin is not installed; run: claude plugin marketplace add ddinkov10/celetis && claude plugin install celetis@celetis';
    if (!Bun.which('claude', { PATH: childEnv().PATH })) throw new HostError(missing);
    const result = await run('claude', ['plugin', 'list', '--json'], {
      cwd,
      inheritedFd,
      stderr: inheritedFd === undefined ? undefined : 'inherit',
    });
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
    const matches = records.filter((item) => object(item) && item.id === 'celetis@celetis');
    const record = matches.find((item) => item.scope === 'user') ?? matches[0];
    if (record?.enabled !== true || typeof record.installPath !== 'string' || !record.installPath)
      throw new HostError(missing);
    return record.installPath.replaceAll('\r', '');
  }
  const reply = await codexRequest(cwd, 'skills/list', { cwds: [cwd], forceReload: true }, inheritedFd);
  const invalid = () => new HostError('celetis: invalid Codex skills/list response');
  if (!object(reply) || !object(reply.result) || !Array.isArray(reply.result.data)) throw invalid();
  const records = reply.result.data.filter((item) => object(item) && item.cwd === cwd);
  if (records.length !== 1 || !Array.isArray(records[0].skills)) throw invalid();
  const paths: { root: string; path: string }[] = [];
  for (const skill of records[0].skills) {
    if (
      !object(skill) ||
      skill.pluginId !== 'celetis@celetis' ||
      skill.enabled !== true ||
      typeof skill.name !== 'string' ||
      !/^celetis:[a-z][a-z-]*$/.test(skill.name)
    )
      continue;
    if (typeof skill.path !== 'string' || [...skill.path].some((character) => character.charCodeAt(0) < 32))
      throw invalid();
    const path = /^[A-Za-z]:\\/.test(skill.path) ? skill.path.replaceAll('\\', '/') : skill.path;
    const parsed = /^(.*)\/skills\/([a-z][a-z-]*)\/SKILL\.md$/.exec(path);
    if (
      !parsed?.[1] ||
      !/^(?:\/|[A-Za-z]:\/).+/.test(path) ||
      /\/(?:\.{0,2})\//.test(path) ||
      `celetis:${parsed[2]}` !== skill.name
    )
      throw invalid();
    paths.push({ root: parsed[1], path });
  }
  const roots = [...new Set(paths.map((item) => item.root))];
  const selected = roots[0];
  if (!selected)
    throw new HostError(
      'celetis: Codex has no enabled celetis@celetis installation; install and enable the plugin in Codex',
    );
  if (roots.length > 1)
    throw new HostError('celetis: Codex reports multiple celetis package roots; fix the enabled installation');
  const root = selected;
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8'));
  } catch {}
  if (
    !(await stat(join(root, 'scripts')).catch(() => null))?.isDirectory() ||
    !object(manifest) ||
    manifest.name !== 'celetis'
  )
    throw new HostError('celetis: Codex reports an invalid celetis package; reinstall the plugin');
  for (const item of paths) {
    if (!(await stat(item.path).catch(() => null))?.isFile())
      throw new HostError('celetis: Codex reports a missing installed skill; reinstall the plugin');
  }
  return root;
}
