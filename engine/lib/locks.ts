import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HostError } from './host.ts';
import { childEnv, run } from './process.ts';
import { processRunsScript, processStart, processState } from './process-identity.ts';

export interface LockOwner {
  take(name: string): Promise<string | null>;
  registerSession(pid: number | undefined): Promise<void>;
  release(name: string): Promise<void>;
  releaseAll(): Promise<void>;
}

function die(message: string): never {
  throw new HostError(`celetis-flow: ${message}`);
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

const ref = (name: string) => `refs/celetis-flow/locks/${name}`;
const recordPath = (common: string) => join(common, 'celetis-flow', 'no-progress');
const git = (main: string, args: string[], input?: string) => run('git', args, { cwd: main, env: childEnv(), input });
const refValue = async (main: string, name: string) =>
  (await git(main, ['rev-parse', '--verify', ref(name)])).stdout.trimEnd();

async function holderFrom(main: string, owner: string): Promise<string> {
  const data = parsed((await git(main, ['cat-file', 'blob', owner])).stdout);
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
    if (kind === 'runner' && !(await processRunsScript(pid, 'celetis-flow.ts'))) continue;
    if ((await processState(pid, row.start)) === 'gone') continue;
    return String(pid);
  }
  return '';
}

export async function lockHolder(main: string, name: string): Promise<string> {
  const old = await refValue(main, name);
  return old ? holderFrom(main, old) : '';
}

export async function isRecorded(common: string, n: string, line: string): Promise<boolean> {
  return (await readFile(recordPath(common), 'utf8').catch(() => '')).split('\n').includes(`${n}\t${line}`);
}

export async function addRecord(common: string, n: string, line: string): Promise<void> {
  if (!(await isRecorded(common, n, line))) await writeFile(recordPath(common), `${n}\t${line}\n`, { flag: 'a' });
}

export function createLockOwner(main: string): LockOwner {
  let owner = '';
  let session: { pid: number; start: string } | null = null;
  const held = new Set<string>();
  const blob = async (value: unknown) => {
    const r = await git(main, ['hash-object', '-w', '--stdin'], `${JSON.stringify(value)}\n`);
    if (r.code !== 0) die('cannot write the lock owner');
    return r.stdout.trimEnd();
  };
  const release = async (name: string) => {
    const sessionGone = session === null || (await processState(session.pid, session.start)) === 'gone';
    if (owner && sessionGone) await git(main, ['update-ref', '--no-deref', '-d', ref(name), owner]);
    held.delete(name);
  };
  return {
    async take(name) {
      if (!owner) {
        const start = await processStart(process.pid);
        if (!start) die('cannot read process identity; allow process access and start the runner again');
        owner = await blob({ runner: { pid: process.pid, start }, session: null });
      }
      for (;;) {
        const old = await refValue(main, name);
        const holder = old ? await holderFrom(main, old) : '';
        if (holder) return holder;
        const r = await git(main, ['update-ref', '--no-deref', ref(name), owner, old]);
        if (r.code === 0) {
          held.add(name);
          return null;
        }
        if ((await refValue(main, name)) === old)
          die(`cannot take the ${name} lock; check Git access and start the runner again`);
      }
    },
    async registerSession(pid) {
      if (!pid) die('cannot read session process identity; start the runner again');
      const start = await processStart(pid);
      if (!start) die('cannot read session process identity; start the runner again');
      const current = parsed((await git(main, ['cat-file', 'blob', owner])).stdout);
      const next = await blob({ ...(current as Record<string, unknown>), session: { pid, start } });
      const input = [...held].map((name) => `update ${ref(name)} ${next} ${owner}\n`).join('');
      const r = await git(main, ['update-ref', '--no-deref', '--stdin'], input);
      if (r.code !== 0) die('cannot register the session in its locks; start the runner again');
      owner = next;
      session = { pid, start };
    },
    release,
    async releaseAll() {
      for (const name of [...held]) await release(name);
    },
  };
}
