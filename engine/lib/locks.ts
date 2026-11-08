import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type ExitCode, exits } from './contract.ts';
import { HostError } from './host.ts';
import { childEnv, run } from './process.ts';
import { daemonScript, type ProcessState, processScript, processStart, processState } from './process-identity.ts';
import { stateFolder } from './state-folder.ts';

export type Identity = Readonly<{ pid: number; start: string }>;
export type LockClaim =
  | Readonly<{ kind: 'taken' }>
  | Readonly<{ kind: 'held'; holder: string }>
  | Readonly<{ kind: 'unknown' }>;
type OwnerRecord = Readonly<{ daemon: Identity | null; session: Identity | null }>;

export interface LockOwner {
  owns(name: string): boolean;
  take(name: string): Promise<string | null>;
  adopt(name: string, session: Identity | null): Promise<LockClaim>;
  registerSession(pid: number | undefined): Promise<void>;
  release(name: string, handOff?: boolean): Promise<string | null>;
  releaseAll(handOff?: boolean): Promise<void>;
}

function die(message: string, code: ExitCode = exits.blocked): never {
  throw new HostError(`daemon: ${message}`, code);
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

const ref = (name: string) => `refs/celetis/locks/${name}`;
const recordPath = async (common: string) => join(await stateFolder(common), 'no-progress');
const git = (main: string, args: string[], input?: string) => run('git', args, { cwd: main, env: childEnv(), input });
const refValue = async (main: string, name: string) =>
  (await git(main, ['rev-parse', '--verify', ref(name)])).stdout.trimEnd();

function identity(row: unknown): Identity | null {
  return object(row) && Number.isInteger(row.pid) && Number(row.pid) > 0 && typeof row.start === 'string' && row.start
    ? { pid: Number(row.pid), start: row.start }
    : null;
}

async function ownerRecord(main: string, owner: string): Promise<OwnerRecord | null> {
  const data = parsed((await git(main, ['cat-file', 'blob', owner])).stdout);
  return object(data) ? { daemon: identity(data.daemon), session: identity(data.session) } : null;
}

async function daemonState(daemon: Identity): Promise<ProcessState> {
  const state = await processState(daemon.pid, daemon.start);
  if (state === 'gone') return 'gone';
  const script = await processScript(daemon.pid, daemonScript);
  return script === 'runs' ? state : script;
}

const same = (a: Identity | null, b: Identity | null) => !!a && !!b && a.pid === b.pid && a.start === b.start;

async function holderFrom(main: string, owner: string): Promise<string> {
  const record = await ownerRecord(main, owner);
  const { daemon, session } = record ?? { daemon: null, session: null };
  if (daemon && (await daemonState(daemon)) !== 'gone') return String(daemon.pid);
  if (session && (await processState(session.pid, session.start)) !== 'gone') return String(session.pid);
  return '';
}

export async function lockHolder(main: string, name: string): Promise<string> {
  const old = await refValue(main, name);
  return old ? holderFrom(main, old) : '';
}

export async function isRecorded(common: string, n: string, line: string): Promise<boolean> {
  const path = await recordPath(common);
  return (await readFile(path, 'utf8').catch(() => '')).split('\n').includes(`${n}\t${line}`);
}

export async function addRecord(common: string, n: string, line: string): Promise<void> {
  if (!(await isRecorded(common, n, line))) await writeFile(await recordPath(common), `${n}\t${line}\n`, { flag: 'a' });
}

export function createLockOwner(main: string, ownStart?: string): LockOwner {
  let owner = '';
  let session: Identity | null = null;
  const held = new Set<string>();
  const blob = async (value: unknown) => {
    const r = await git(main, ['hash-object', '-w', '--stdin'], `${JSON.stringify(value)}\n`);
    if (r.code !== 0) die('cannot write the lock owner');
    return r.stdout.trimEnd();
  };
  const queueAfterIssue = (name: string) => {
    if (name === 'queue' && [...held].some((lock) => lock.startsWith('issue-')))
      die('cannot take queue ownership after an issue lock; release the issue lock first', exits.internal);
  };
  const begin = async () => {
    if (owner) return;
    const start = ownStart ?? (await processStart(process.pid));
    if (!start) die('cannot read process identity; allow process access and start the run again');
    owner = await blob({ daemon: { pid: process.pid, start }, session: null });
  };
  const withSession = async (next: Identity) => {
    const current = parsed((await git(main, ['cat-file', 'blob', owner])).stdout);
    return blob({ ...(current as Record<string, unknown>), session: next });
  };
  const moved = (next: string) => [...held].map((name) => `update ${ref(name)} ${next} ${owner}\n`).join('');
  const release = async (name: string, handOff = false): Promise<string | null> => {
    if (!held.has(name)) return null;
    const sessionGone = session === null || (await processState(session.pid, session.start)) === 'gone';
    const result =
      owner && sessionGone
        ? await git(main, ['update-ref', '--no-deref', '-d', ref(name), owner])
        : owner && handOff
          ? await git(main, ['update-ref', '--no-deref', ref(name), await blob({ daemon: null, session }), owner])
          : null;
    if (result && result.code !== 0) return result.stderr.trimEnd();
    held.delete(name);
    return null;
  };
  return {
    owns: (name) => held.has(name),
    async take(name) {
      queueAfterIssue(name);
      await begin();
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
          die(`cannot take the ${name} lock; check Git access and start the run again`);
      }
    },
    async adopt(name, claimed) {
      queueAfterIssue(name);
      await begin();
      for (;;) {
        const old = await refValue(main, name);
        if (old === owner && held.has(name)) return { kind: 'taken' };
        const record = old ? await ownerRecord(main, old) : null;
        const { daemon, session: recorded } = record ?? { daemon: null, session: null };
        let next = owner;
        if (daemon) {
          const state = await daemonState(daemon);
          if (state === 'runs') return { kind: 'held', holder: String(daemon.pid) };
          if (state === 'unknown') return { kind: 'unknown' };
        }
        if (recorded) {
          const state = await processState(recorded.pid, recorded.start);
          if (state === 'unknown') return { kind: 'unknown' };
          if (state === 'runs') {
            if (!same(recorded, claimed) || (session && !same(session, recorded)))
              return { kind: 'held', holder: String(recorded.pid) };
            if (!session) next = await withSession(recorded);
          }
        }
        const r =
          next === owner
            ? await git(main, ['update-ref', '--no-deref', ref(name), owner, old])
            : await git(
                main,
                ['update-ref', '--no-deref', '--stdin'],
                `update ${ref(name)} ${next} ${old}\n${moved(next)}`,
              );
        if (r.code === 0) {
          if (next !== owner) {
            owner = next;
            session = recorded;
          }
          held.add(name);
          return { kind: 'taken' };
        }
        if ((await refValue(main, name)) === old)
          die(`cannot take the ${name} lock; check Git access and start the run again`);
      }
    },
    async registerSession(pid) {
      if (!pid) die('cannot read session process identity; start the run again');
      const start = await processStart(pid);
      if (!start) die('cannot read session process identity; start the run again');
      const next = await withSession({ pid, start });
      const r = await git(main, ['update-ref', '--no-deref', '--stdin'], moved(next));
      if (r.code !== 0) die('cannot register the session in its locks; start the run again');
      owner = next;
      session = { pid, start };
    },
    release,
    async releaseAll(handOff = false) {
      for (const name of [...held]) await release(name, handOff);
    },
  };
}
