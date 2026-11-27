import { constants } from 'node:fs';
import { open, readdir } from 'node:fs/promises';
import { z } from 'zod';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import { type Host, hosts } from '../host/names.ts';
import { recordEvent } from '../state/events.ts';
import { issueKey, lowerUuid } from '../state/schemas.ts';
import { checkFolder, ensureFolder, repositoryLayout, writeAtomic } from '../state/state.ts';
import type { IssueKey } from '../tracker/key.ts';
import { type Level, levels } from '../workflow/effort.ts';
import { type SessionWork, sessionWorks } from '../workflow/workflow.ts';

const outcomes = ['exited', 'no-saved-turn', 'usage-limit', 'stopped', 'unverified', 'not-started'] as const;
export type AttemptOutcome = (typeof outcomes)[number];
export type AttemptFinish = Readonly<{ outcome: AttemptOutcome; code: number | null; reason: string | null }>;
export type AttemptOpen = Readonly<{
  id: string;
  issue: IssueKey;
  work: SessionWork;
  start: 'new' | 'resume';
  host: Host;
  model: string | null;
  effort: Level | null;
  startedAt: number;
}>;

const forbidden = /[\p{Cc}\p{Bidi_C}\u{2028}\u{2029}]+/gu;
const entryName = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/;
const textLimit = 512;

function clean(value: string | null): string | null {
  if (value === null) return null;
  const text = [...value.replace(forbidden, ' ').trim()].slice(0, textLimit).join('').trimEnd();
  return text === '' ? null : text;
}

const time = z.string().refine((value) => {
  const at = new Date(value);
  return !Number.isNaN(at.getTime()) && at.toISOString() === value;
});
const text = z.string().refine((value) => clean(value) === value);
const attemptEntry = z.strictObject({
  schema: z.literal(1),
  id: lowerUuid,
  issue: issueKey,
  work: z.enum(sessionWorks),
  start: z.enum(['new', 'resume']),
  host: z.enum(hosts),
  model: text.nullable(),
  effort: z.enum(levels).nullable(),
  startedAt: time,
  end: z
    .strictObject({
      at: time,
      outcome: z.enum(outcomes),
      code: z.int().nullable(),
      reason: text.nullable(),
    })
    .nullable(),
});
const isAttempt = (value: unknown): value is z.output<typeof attemptEntry> => attemptEntry.safeParse(value).success;
export type AttemptEntry = Readonly<z.output<typeof attemptEntry>>;

export function attemptModel(host: Host, chosen: string, kept: string | null): string | null {
  return host === 'claude' ? chosen : kept;
}

const unreadable = (path: string, reason: string) => new HostError(`attempts: ${path}: ${reason}`, exits.blocked);

async function readEntry(path: string): Promise<AttemptEntry> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    if (!(await handle.stat()).isFile()) throw unreadable(path, 'need a regular file');
    const value: unknown = JSON.parse(await handle.readFile('utf8'));
    if (!isAttempt(value)) throw unreadable(path, 'not a valid attempt record');
    return value;
  } finally {
    await handle.close();
  }
}

function report(issue: IssueKey, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  recordEvent({ name: 'attempt-record', message: `attempt-record: ${reason}`, issue });
}

export async function recordAttemptStart(common: string, open: AttemptOpen): Promise<void> {
  try {
    const layout = repositoryLayout(common);
    ensureFolder(layout.root);
    ensureFolder(layout.attempts);
    ensureFolder(layout.attemptFolder(open.issue));
    const entry: AttemptEntry = {
      schema: 1,
      id: open.id,
      issue: open.issue,
      work: open.work,
      start: open.start,
      host: open.host,
      model: clean(open.model),
      effort: open.effort,
      startedAt: new Date(open.startedAt).toISOString(),
      end: null,
    };
    await writeAtomic(layout.attemptEntry(open.issue, open.id), `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  } catch (error) {
    report(open.issue, error);
  }
}

export async function recordAttemptEnd(
  common: string,
  issue: IssueKey,
  id: string,
  finish: AttemptFinish,
): Promise<void> {
  try {
    const layout = repositoryLayout(common);
    const path = layout.attemptEntry(issue, id);
    checkFolder(layout.root);
    checkFolder(layout.attempts);
    checkFolder(layout.attemptFolder(issue));
    let entry: AttemptEntry;
    try {
      entry = await readEntry(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && finish.outcome === 'not-started') return;
      throw error;
    }
    if (entry.end !== null) return;
    const end = { at: new Date().toISOString(), ...finish, reason: clean(finish.reason) };
    await writeAtomic(path, `${JSON.stringify({ ...entry, end })}\n`, { mode: 0o600 });
  } catch (error) {
    report(issue, error);
  }
}

export async function readAttempts(
  common: string,
  issue: IssueKey,
): Promise<Readonly<{ entries: readonly AttemptEntry[]; invalid: readonly string[] }>> {
  const layout = repositoryLayout(common);
  const folder = layout.attemptFolder(issue);
  if (checkFolder(layout.root) === null || checkFolder(layout.attempts) === null || checkFolder(folder) === null)
    return { entries: [], invalid: [] };
  let names: string[];
  try {
    names = await readdir(folder.path);
  } catch (error) {
    throw unreadable(folder.path, `cannot read the folder: ${error instanceof Error ? error.message : error}`);
  }
  const entries: AttemptEntry[] = [];
  const invalid: string[] = [];
  for (const name of names.sort()) {
    const id = entryName.exec(name)?.[1];
    if (id === undefined) continue;
    try {
      const entry = await readEntry(layout.attemptEntry(issue, id));
      if (entry.id === id && entry.issue === issue) entries.push(entry);
      else invalid.push(name);
    } catch {
      invalid.push(name);
    }
  }
  entries.sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
  return { entries, invalid };
}
