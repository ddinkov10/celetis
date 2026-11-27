import { open, readFile, rm } from 'node:fs/promises';
import { z } from 'zod';
import type { Host } from '../config/core.ts';
import { isHost } from '../host/names.ts';
import { commonDir } from '../process/git.ts';
import { daemonScript, processRunsScript, processState } from '../process/identity.ts';
import type { Next } from '../resolver/lines.ts';
import { isSessionId } from '../state/fields.ts';
import { code, filled, identity } from '../state/schemas.ts';
import { checkFolder, ensureFolder, repositoryLayout, writeAtomic } from '../state/state.ts';
import { isSafeId } from '../terminal/terminal.ts';
import { type IssueKey, isKey } from '../tracker/key.ts';

const turnKey = z.strictObject({ terminalId: filled, sessionId: z.string(), sequence: code });
const stepEndRecord = z
  .strictObject({
    daemon: identity,
    terminal: z.custom<string>(isSafeId),
    host: z.custom<Host>(isHost),
    state: z.enum(['checking', 'waiting', 'exiting']),
    turn: turnKey.nullable(),
  })
  .refine(({ host, state, turn }) => (turn === null ? state === 'checking' : isSessionId(host, turn.sessionId)));

export type StepEndState = z.output<typeof stepEndRecord>['state'];
export type TurnKey = z.output<typeof turnKey>;
export type StepEndRecord = z.output<typeof stepEndRecord>;

export function verdictOf(first: Next, changed: boolean): StepEndState {
  if (changed) return 'exiting';
  return first.kind === 'observed' && first.reason === 'landing' ? 'checking' : 'waiting';
}

const valid = (value: unknown): value is StepEndRecord => stepEndRecord.safeParse(value).success;

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
