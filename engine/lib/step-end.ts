import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Host } from './config-core.ts';
import { commonDir } from './host.ts';
import type { Next } from './lines.ts';
import { processRuns, processRunsScript, processStart } from './process-identity.ts';
import { isSafeId } from './terminal.ts';

export type StepEndState = 'checking' | 'waiting' | 'exiting';
export type TurnKey = { terminalId: string; sessionId: string; sequence: number };
export type StepEndRecord = {
  runner: { pid: number; start: string };
  terminal: string;
  host: Host;
  state: StepEndState;
  turn: TurnKey | null;
};

export function verdictOf(first: Next, changed: boolean): StepEndState {
  if (changed) return 'exiting';
  return first.kind === 'observed' && first.reason === 'landing' ? 'checking' : 'waiting';
}

const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, names: string) => Object.keys(value).sort().join(',') === names;
const valid = (value: unknown): value is StepEndRecord => {
  if (!object(value)) return false;
  const { runner, turn } = value;
  return (
    keys(value, 'host,runner,state,terminal,turn') &&
    object(runner) &&
    keys(runner, 'pid,start') &&
    Number.isSafeInteger(runner.pid) &&
    Number(runner.pid) > 0 &&
    typeof runner.start === 'string' &&
    runner.start.length > 0 &&
    isSafeId(value.terminal) &&
    (value.host === 'claude' || value.host === 'codex') &&
    (value.state === 'checking' || value.state === 'waiting' || value.state === 'exiting') &&
    ((turn === null && value.state === 'checking') ||
      (object(turn) &&
        keys(turn, 'sequence,sessionId,terminalId') &&
        typeof turn.terminalId === 'string' &&
        turn.terminalId.length > 0 &&
        typeof turn.sessionId === 'string' &&
        uuid.test(turn.sessionId) &&
        Number.isSafeInteger(turn.sequence) &&
        Number(turn.sequence) >= 0))
  );
};

async function pathOf(main: string, issue: number): Promise<string> {
  if (!Number.isSafeInteger(issue) || issue <= 0) throw new Error('step-end: invalid issue number');
  return join(await commonDir(main), 'celetis-flow/step-end', `${issue}.json`);
}

export async function writeStepEnd(main: string, issue: number, record: StepEndRecord): Promise<void> {
  if (!valid(record)) throw new Error('step-end: invalid record');
  const file = await pathOf(main, issue);
  const dir = join(file, '..');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = join(dir, `.${issue}.${randomUUID()}`);
  try {
    await writeFile(temp, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'wx' });
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function readStepEnd(main: string, issue: number): Promise<StepEndRecord | null> {
  try {
    const source = await readFile(await pathOf(main, issue), 'utf8');
    let record: unknown;
    try {
      record = JSON.parse(source);
    } catch {
      return null;
    }
    if (!valid(record)) return null;
    const { pid, start } = record.runner;
    if (
      !(await processRunsScript(pid, 'celetis-flow.ts')) ||
      !(await processRuns(pid)) ||
      (await processStart(pid)) !== start
    )
      return null;
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

export async function removeStepEnd(main: string, issue: number): Promise<void> {
  const file = await pathOf(main, issue);
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
