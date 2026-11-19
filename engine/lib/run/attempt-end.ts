import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { hostAdapter } from '../host/hosts.ts';
import type { UsageAttempt } from '../host/usage.ts';
import {
  commandNames,
  controllingTerminal,
  descendantsOf,
  type ProcessRow,
  processesWithEnvironment,
  processState,
  processTable,
  terminateChild,
} from '../process/identity.ts';
import { bunArgs, childEnv } from '../process/process.ts';
import { type Job, openJob, sessionJobName } from '../process/windows.ts';
import { startFiles } from '../state/state.ts';
import { exitGraceMs, requestExit } from '../terminal/terminal.ts';

export type OwnedSession = Readonly<{
  pid: number;
  start: string;
  terminal: string;
  shell: number | null;
  tty: string | null;
  folder: string | null;
}>;

export type Member = Readonly<{ pid: number; start: string; name: string | null; kind: 'signal' | 'count' }>;
export type Members = ReadonlyMap<string, Member>;
export type Signalled = Readonly<{ pid: number; name: string | null; signal: 'SIGTERM' | 'SIGKILL' | 'job' }>;
export type AttemptEnd =
  | Readonly<{ kind: 'quiescent'; signalled: readonly Signalled[] }>
  | Readonly<{ kind: 'unverified'; reason: string; running: readonly number[]; signalled: readonly Signalled[] }>;
export type StopEvidence = Readonly<{ members: Members | null; job: Job | null; closedAt: number }>;

const stageMs = 5_000;
const readLimitMs = 20_000;

const attemptMarker = (attemptId: string) => `CELETIS_ATTEMPT=${attemptId}`;
const unverified = (
  reason: string,
  running: readonly number[] = [],
  signalled: readonly Signalled[] = [],
): AttemptEnd => ({
  kind: 'unverified',
  reason,
  running,
  signalled,
});
const quiescent = (signalled: readonly Signalled[] = []): AttemptEnd => ({ kind: 'quiescent', signalled });

type Read = Readonly<{
  rows: readonly ProcessRow[];
  marked: NonNullable<Awaited<ReturnType<typeof processesWithEnvironment>>>;
}>;
type Scope = Readonly<{
  barrier: Readonly<{ pid: number; start: string }>;
  shell: number;
  tty: string;
  tree: boolean;
  terminal: Member['kind'];
  control: number | null;
}>;

async function readAttempt(attemptId: string): Promise<Read | null> {
  const [rows, marked] = await Promise.all([processTable(), processesWithEnvironment(attemptMarker(attemptId))]);
  return rows && marked && { rows, marked };
}

async function addMembers(members: Map<string, Member>, { rows, marked }: Read, scope: Scope): Promise<void> {
  const barrier = rows.some((row) => row.pid === scope.barrier.pid && row.start === scope.barrier.start);
  const below = new Set(barrier ? descendantsOf(rows, scope.barrier.pid).map((row) => row.pid) : []);
  const shell = new Set([scope.shell, ...descendantsOf(rows, scope.shell).map((row) => row.pid)]);
  const found: Omit<Member, 'name'>[] = [];
  for (const row of rows) {
    if (
      row.pid === 1 ||
      row.pid === process.pid ||
      row.pid === scope.control ||
      (row.pid === scope.barrier.pid && row.start === scope.barrier.start) ||
      (shell.has(row.pid) && !below.has(row.pid))
    )
      continue;
    // macOS ps hides the environment of platform binaries such as /bin/sh, so the terminal also identifies writers.
    const terminal = row.tty === scope.tty ? scope.terminal : null;
    const kind =
      (scope.tree && below.has(row.pid)) || marked.proven.has(row.pid) || terminal === 'signal'
        ? 'signal'
        : marked.unsure.has(row.pid) || terminal === 'count'
          ? 'count'
          : null;
    const known = members.get(`${row.pid} ${row.start}`);
    if (kind && (!known || (known.kind === 'count' && kind === 'signal')))
      found.push({ pid: row.pid, start: row.start, kind });
  }
  const names = await commandNames(
    found.flatMap((each) => (members.has(`${each.pid} ${each.start}`) ? [] : [each.pid])),
  );
  for (const each of found) {
    const key = `${each.pid} ${each.start}`;
    members.set(key, { ...each, name: members.get(key)?.name ?? names.get(each.pid) ?? null });
  }
}

export async function recordMembers(attemptId: string, owned: OwnedSession): Promise<Members | null> {
  if (owned.shell === null || owned.tty === null) return null;
  const read = await readAttempt(attemptId);
  if (!read?.rows.some((row) => row.pid === owned.pid && row.start === owned.start)) return null;
  const members = new Map<string, Member>();
  const scope: Scope = {
    barrier: owned,
    shell: owned.shell,
    tty: owned.tty,
    tree: true,
    terminal: 'signal',
    control: null,
  };
  await addMembers(members, read, scope);
  return members;
}

function stages(members: Members) {
  const signalled: Signalled[] = [];
  const sent = { SIGTERM: new Set<string>(), SIGKILL: new Set<string>() };
  const gone = new Set<string>();
  const step = async (escalation: number): Promise<Readonly<{ running: number[]; over: boolean }>> => {
    const now = performance.now();
    const over = now >= escalation + 2 * stageMs;
    const stage = over || now < escalation ? null : now < escalation + stageMs ? 'SIGTERM' : 'SIGKILL';
    const running: number[] = [];
    for (const [key, member] of members) {
      if (gone.has(key)) continue;
      const state = await processState(member.pid, member.start);
      if (state === 'gone') {
        gone.add(key);
        continue;
      }
      running.push(member.pid);
      if (stage === null || member.kind !== 'signal' || state !== 'runs' || sent[stage].has(key)) continue;
      sent[stage].add(key);
      try {
        process.kill(member.pid, stage);
        signalled.push({ pid: member.pid, name: member.name, signal: stage });
      } catch {}
    }
    return { running, over };
  };
  return { signalled, step };
}

async function endedAttempt(
  attempt: UsageAttempt,
  owned: OwnedSession,
  shell: number,
  tty: string,
  begun: number,
  stop: StopEvidence | null,
): Promise<AttemptEnd> {
  const readUntil = begun + readLimitMs;
  // A proof that starts late still gives each stage its full time.
  const escalation = Math.max((stop?.closedAt ?? begun) + stageMs, begun);
  const members = new Map(stop?.members ?? []);
  const { signalled, step } = stages(members);
  const marker = randomUUID();
  const life = Math.ceil(Math.max(readUntil, escalation + 2 * stageMs) - performance.now()) + 5000;
  // ps shows no environment that it cannot read, so a control child must prove that the marker read sees one.
  const control = spawn(process.execPath, bunArgs('-e', [`setTimeout(() => {}, ${life})`]), {
    env: { ...childEnv(), CELETIS_ATTEMPT: marker },
    stdio: 'ignore',
  });
  let ended = false;
  control.on('error', () => {
    ended = true;
  });
  control.on('exit', () => {
    ended = true;
  });
  const spawned = performance.now();
  // After the tab close, the recorded terminal name can belong to a new tab.
  const scope: Scope = { barrier: owned, shell, tty, tree: false, terminal: 'count', control: control.pid ?? null };
  let shown = false;
  let barrierGone = stop === null;
  try {
    for (;;) {
      const [rows, marked, controls] = await Promise.all([
        processTable(),
        processesWithEnvironment(attemptMarker(attempt.id)),
        processesWithEnvironment(attemptMarker(marker)),
      ]);
      const seen = control.pid !== undefined && controls?.proven.has(control.pid) === true;
      if (!shown && rows && marked && controls && !seen) {
        if (ended) return unverified('the control process ended before the process table showed it');
        if (performance.now() - spawned >= 1000)
          return unverified('the process table shows no environment of a control process');
      }
      const read = rows && marked && seen ? { rows, marked } : null;
      if (read) {
        shown = true;
        await addMembers(members, read, scope);
      } else if (performance.now() >= readUntil)
        return unverified('the process table could not be read', [], signalled);
      if (shown) {
        if (!barrierGone) barrierGone = (await processState(owned.pid, owned.start)) === 'gone';
        const { running, over } = await step(escalation);
        const all = barrierGone ? running : [owned.pid, ...running];
        if (read && all.length === 0) return quiescent(signalled);
        if (over && all.length > 0)
          return unverified('processes of the attempt still run after SIGKILL', all, signalled);
      }
      await Bun.sleep(250);
    }
  } finally {
    control.kill('SIGKILL');
  }
}

async function endedJob(
  attempt: UsageAttempt,
  owned: OwnedSession,
  stop: StopEvidence | null,
  open: (name: string) => Job | null,
): Promise<AttemptEnd> {
  const job = stop?.job ?? open(sessionJobName(attempt.id, ''));
  if (!job) {
    const folder = owned.folder;
    const empty =
      folder !== null &&
      (await processState(owned.pid, owned.start)) === 'gone' &&
      (await stat(startFiles(folder).jobEmpty).catch(() => null))?.isFile();
    return empty ? quiescent() : unverified('the job of the attempt could not be opened');
  }
  const signalled: Signalled[] = [];
  const unread = () => unverified('the job of the attempt could not be read', [], signalled);
  try {
    const live = stop !== null || (await processState(owned.pid, owned.start)) === 'runs';
    const others = async (): Promise<number[] | null> => {
      const members = job.members();
      if (!members) return null;
      // A member with the PID of an ended starter is another process.
      const starter = members.includes(owned.pid) && (await processState(owned.pid, owned.start)) === 'runs';
      return members.filter((pid) => !(starter && pid === owned.pid));
    };
    const first = await others();
    if (!first) return unread();
    if (first.length === 0) return quiescent();
    const requested = performance.now();
    if (stop === null && !(await requestExit(owned.terminal, attempt.host)))
      return unverified('the exit request failed');
    const deadline = performance.now() + readLimitMs;
    let politeAt = stop?.closedAt ?? requested + exitGraceMs;
    let hostEnded = false;
    let endedAt: number | null = null;
    for (;;) {
      if (stop === null && endedAt === null) {
        const barrier = await processState(owned.pid, owned.start);
        if (barrier === 'gone') politeAt = Math.min(politeAt, performance.now());
        if (barrier === 'runs' && !hostEnded && performance.now() - requested >= exitGraceMs) {
          hostEnded = true;
          await terminateChild(owned);
        }
      }
      const running = await others();
      if (!running) return unread();
      if (running.length === 0) return quiescent(signalled);
      if (!live) {
        if (performance.now() >= deadline) return unverified('processes of the attempt still run', running);
      } else if (endedAt === null && performance.now() >= politeAt + stageMs) {
        // A failed read of the barrier keeps it alive, so only a definite end lets the job end it too.
        const barrierGone = (await processState(owned.pid, owned.start)) === 'gone';
        const ended = barrierGone ? (job.terminate() ? running : []) : job.terminateOthers(owned.pid);
        endedAt = performance.now();
        for (const pid of ended) signalled.push({ pid, name: null, signal: 'job' });
      } else if (endedAt !== null && performance.now() >= endedAt + stageMs)
        return unverified('processes of the attempt still run after the job ended them', running, signalled);
      await Bun.sleep(250);
    }
  } finally {
    job.close();
  }
}

export async function endOwnedAttempt(
  attempt: UsageAttempt,
  owned: OwnedSession,
  stop: StopEvidence | null = null,
  open: (name: string) => Job | null = openJob,
): Promise<AttemptEnd> {
  const begun = performance.now();
  if (!hostAdapter(attempt.host).terminatesAfterGrace)
    return unverified(`no proved termination path for ${attempt.host} on ${process.platform}`);
  if (process.platform === 'win32') return endedJob(attempt, owned, stop, open);
  const readUntil = begun + readLimitMs;
  const recorded = owned.shell !== null && owned.tty !== null;
  let rows = await processTable();
  while (!rows && recorded && performance.now() < readUntil) {
    await Bun.sleep(250);
    rows = await processTable();
  }
  if (!rows && recorded) return unverified('the process table could not be read');
  const first = rows?.find((row) => row.pid === owned.pid && row.start === owned.start);
  if (rows && (!first || stop !== null) && owned.shell !== null && owned.tty !== null)
    return endedAttempt(attempt, owned, owned.shell, owned.tty, begun, stop);
  if (!first) return unverified('the session process could not be read');
  if (!controllingTerminal(first.tty)) return unverified('the session has no controlling terminal');
  const members = new Map<string, Member>();
  const scope: Scope = {
    barrier: owned,
    shell: first.ppid,
    tty: first.tty,
    tree: true,
    terminal: 'signal',
    control: null,
  };
  const collect = async () => {
    const read = await readAttempt(attempt.id);
    if (read) await addMembers(members, read, scope);
    return read?.marked ?? null;
  };
  const marked = await collect();
  if (marked === null) return unverified('the process table could not be read');
  if ([...marked.proven, ...marked.unsure].every((pid) => pid === owned.pid))
    return unverified('no process carries the attempt marker');
  const { signalled, step } = stages(members);
  const requested = performance.now();
  if (!(await requestExit(owned.terminal, attempt.host))) return unverified('the exit request failed');
  let hostSignalled = false;
  let barrierEndAt = Number.POSITIVE_INFINITY;
  for (;;) {
    const barrier = await processState(owned.pid, owned.start);
    if (barrier === 'runs' && !hostSignalled && performance.now() - requested >= exitGraceMs) {
      hostSignalled = true;
      await terminateChild(owned);
    }
    if (barrier === 'gone') barrierEndAt = Math.min(barrierEndAt, performance.now());
    if ((await collect()) === null) return unverified('the process table could not be read', [], signalled);
    const { running, over } = await step(Math.min(barrierEndAt, requested + exitGraceMs) + stageMs);
    if (barrier === 'gone' && running.length === 0) return quiescent(signalled);
    if (over)
      return unverified(
        'processes of the attempt still run after SIGKILL',
        barrier === 'gone' ? running : [owned.pid, ...running],
        signalled,
      );
    await Bun.sleep(250);
  }
}
