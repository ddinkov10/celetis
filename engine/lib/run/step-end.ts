import { open, readFile, rm } from 'node:fs/promises';
import type { Host } from '../config/core.ts';
import { isHost } from '../host/names.ts';
import { commonDir } from '../process/git.ts';
import { daemonScript, processRunsScript, processState } from '../process/identity.ts';
import type { Next } from '../resolver/lines.ts';
import { isSessionId } from '../state/fields.ts';
import { checkFolder, ensureFolder, repositoryLayout, writeAtomic } from '../state/state.ts';
import { isSafeId } from '../terminal/terminal.ts';
import { type IssueKey, isKey } from '../tracker/key.ts';

export type StepEndState = 'checking' | 'waiting' | 'exiting';
export type TurnKey = { terminalId: string; sessionId: string; sequence: number };
export type StepEndRecord = {
  daemon: { pid: number; start: string };
  terminal: string;
  host: Host;
  state: StepEndState;
  turn: TurnKey | null;
};

export function verdictOf(first: Next, changed: boolean): StepEndState {
  if (changed) return 'exiting';
  return first.kind === 'observed' && first.reason === 'landing' ? 'checking' : 'waiting';
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string) => Object.keys(value).sort().join(',') === names;
const valid = (value: unknown): value is StepEndRecord => {
  if (!object(value)) return false;
  const { daemon, turn } = value;
  return (
    keys(value, 'daemon,host,state,terminal,turn') &&
    object(daemon) &&
    keys(daemon, 'pid,start') &&
    Number.isSafeInteger(daemon.pid) &&
    Number(daemon.pid) > 0 &&
    typeof daemon.start === 'string' &&
    daemon.start.length > 0 &&
    isSafeId(value.terminal) &&
    isHost(value.host) &&
    (value.state === 'checking' || value.state === 'waiting' || value.state === 'exiting') &&
    ((turn === null && value.state === 'checking') ||
      (object(turn) &&
        keys(turn, 'sequence,sessionId,terminalId') &&
        typeof turn.terminalId === 'string' &&
        turn.terminalId.length > 0 &&
        isSessionId(value.host, turn.sessionId) &&
        Number.isSafeInteger(turn.sequence) &&
        Number(turn.sequence) >= 0))
  );
};

async function layoutOf(main: string, issue: IssueKey) {
  if (!isKey(issue)) throw new Error('step-end: invalid issue number');
  return repositoryLayout(await commonDir(main));
}

export async function writeStepEnd(main: string, issue: IssueKey, record: StepEndRecord): Promise<void> {
  if (!valid(record)) throw new Error('step-end: invalid record');
  const layout = await layoutOf(main, issue);
  ensureFolder(layout.root);
  ensureFolder(layout.stepEnds);
  await writeAtomic(layout.stepEnd(issue), `${JSON.stringify(record)}\n`);
}

export async function readStepEnd(main: string, issue: IssueKey): Promise<StepEndRecord | null> {
  try {
    const layout = await layoutOf(main, issue);
    checkFolder(layout.root);
    checkFolder(layout.stepEnds);
    const source = await readFile(layout.stepEnd(issue), 'utf8');
    let record: unknown;
    try {
      record = JSON.parse(source);
    } catch {
      return null;
    }
    if (!valid(record)) return null;
    const { pid, start } = record.daemon;
    if (!(await processRunsScript(pid, daemonScript)) || (await processState(pid, start)) !== 'runs') return null;
    return record;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      console.error(
        `step-end: #${issue}: ${String((error as Error).message)
          .split('\n')[0]
          ?.slice(0, 200)}`,
      );
    return null;
  }
}

export async function removeStepEnd(main: string, issue: IssueKey): Promise<void> {
  const file = (await layoutOf(main, issue)).stepEnd(issue);
  try {
    await rm(file, { force: true });
  } catch {
    const handle = await open(file, 'r+');
    try {
      await handle.truncate(0);
    } finally {
      await handle.close();
    }
  }
}
