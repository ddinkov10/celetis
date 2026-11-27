import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { HostError } from '../command/errors.ts';
import type { Config, Host } from '../config/core.ts';
import { exits, stepHeader } from '../contract/contract.ts';
import { hostAdapter } from '../host/hosts.ts';
import { hosts } from '../host/names.ts';
import type { Claim } from '../host/types.ts';
import { commonDir } from '../process/git.ts';
import { recordEvent } from '../state/events.ts';
import { isSessionId } from '../state/fields.ts';
import { issueLock, type LockOwner } from '../state/locks.ts';
import { commitMigration, type LocalRecord, readLocalRecord } from '../state/migration.ts';
import { requestStatePreparation } from '../state/preparation.ts';
import { issueKey } from '../state/schemas.ts';
import { ensureFolder, repositoryLayout, writeAtomic } from '../state/state.ts';
import { readScreen } from '../terminal/terminal.ts';
import type { IssueKey } from '../tracker/key.ts';
import { type Level, levels, type StartPair } from '../workflow/effort.ts';
import { type Step, steps } from '../workflow/workflow.ts';

const sessionFields = {
  host: z.enum(hosts),
  step: z.enum(steps),
  checkout: z.string(),
  session_id: z.string().nullable(),
};
const effort = z.enum(levels).nullable();
const savedId = (record: { host: Host; session_id: string | null }) =>
  record.session_id === null || isSessionId(record.host, record.session_id);

export const sessionRecord = z
  .strictObject({ schema: z.literal(3), issue: issueKey, ...sessionFields, effort })
  .refine(savedId);
const sessionRecord1 = z.strictObject({ schema: z.literal(1), issue: z.int(), ...sessionFields }).refine(savedId);
export const sessionRecord2 = z
  .strictObject({ schema: z.literal(2), issue: z.int(), ...sessionFields, effort })
  .refine(savedId);
const versioned = z.looseObject({ schema: z.unknown().optional() });
const versionOf = (value: unknown) => {
  const parsed = versioned.safeParse(value);
  return parsed.success ? { schema: parsed.data.schema } : null;
};

export type SessionRecord = z.output<typeof sessionRecord>;
export type SavedSession = SessionRecord & { session_id: string };
type StepFacts = {
  issue: IssueKey;
  step: Step;
  host: Host;
  main: string;
  pluginRoot: string;
  landing: Config['landing'];
  recovery?: boolean;
};
const holds =
  <T extends z.ZodType>(schema: T) =>
  (value: unknown): value is z.output<T> =>
    schema.safeParse(value).success;
const isCurrent = holds(sessionRecord);
const isSession1 = holds(sessionRecord1);
const isSession2 = holds(sessionRecord2);

const effortHolds = (record: { host: Host; effort: Level | null }) =>
  hostAdapter(record.host).appliesEffort ? record.effort !== null : record.effort === null;

export const matchesSession = (record: SessionRecord, main: string, issue: IssueKey) =>
  record.issue === issue && record.checkout === main && effortHolds(record);

export function validateSession(value: unknown, main: string, issue: IssueKey, file: string): SessionRecord {
  if (!isCurrent(value) || !matchesSession(value, main, issue)) {
    throw new HostError(
      `session: ${file}: invalid schema-3 fields; preserve the record and repair its data`,
      exits.usage,
    );
  }
  return value;
}

export function convertSession(value: unknown, main: string, issue: IssueKey, file: string): SessionRecord {
  const version = versionOf(value)?.schema;
  const invalid = (schema: string) =>
    new HostError(
      `session: ${file}: schema ${schema} to 3: invalid historical fields; preserve and repair the record`,
      exits.usage,
    );
  if (version !== 1 && version !== 2) throw invalid('unknown');
  const old = version === 1 ? (isSession1(value) ? value : null) : isSession2(value) ? value : null;
  if (old === null || String(old.issue) !== issue || old.checkout !== main || ('effort' in old && !effortHolds(old)))
    throw invalid(String(version));
  return validateSession(
    { ...old, schema: 3, issue, effort: 'effort' in old ? old.effort : 'high' },
    main,
    issue,
    file,
  );
}

export function serializeSession(record: SessionRecord): string {
  return JSON.stringify(Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b))));
}

const historical = (source: LocalRecord, main: string, issue: IssueKey) =>
  convertSession(source.value, main, issue, source.path);
const schemaOf = (source: LocalRecord) => {
  const version = versionOf(source.value);
  return version ? String(version.schema) : 'unknown';
};
const oldSchema = (source: LocalRecord) => {
  const schema = versionOf(source.value)?.schema;
  return schema === 1 || schema === 2;
};
async function snapshot(common: string, issue: IssueKey): Promise<LocalRecord | null> {
  const layout = repositoryLayout(common);
  const file = layout.session(issue);
  try {
    return await readLocalRecord(file, [common, layout.root.path, layout.sessions.path], 'shared');
  } catch (error) {
    throw new HostError(
      `session: ${file}: target schema 3: cannot read record: ${error instanceof Error ? error.message : String(error)}`,
      exits.blocked,
    );
  }
}
function currentRecord(source: LocalRecord, main: string, issue: IssueKey): SessionRecord {
  if (versionOf(source.value)?.schema !== 3)
    throw new HostError(
      `session: ${source.path}: unsupported schema ${schemaOf(source)}; expected schema 3`,
      exits.usage,
    );
  return validateSession(source.value, main, issue, source.path);
}
function missing(issue: IssueKey): HostError {
  return new HostError(
    `celetis: #${issue} has no current session record; start a new step with celetis --agent <host> run ${issue}`,
    exits.prerequisite,
  );
}

export async function prepareSession(main: string, issue: IssueKey, common: string, owner: LockOwner): Promise<void> {
  const source = await snapshot(common, issue);
  if (!source) return;
  if (!oldSchema(source)) {
    currentRecord(source, main, issue);
    return;
  }
  historical(source, main, issue);
  const context = `session: ${source.path}: schema ${schemaOf(source)} to 3`;
  const name = issueLock(issue);
  let acquired = false;
  try {
    if (!owner.owns(name)) {
      const holder = await owner.take(name);
      if (holder !== null)
        throw new HostError(
          `${context}: busy ${name} ownership (PID ${holder}); retry after the owner exits`,
          exits.prerequisite,
        );
      acquired = true;
    }
    const locked = await snapshot(common, issue);
    if (!locked) throw new HostError(`${context}: source disappeared during preparation`, exits.prerequisite);
    if (!oldSchema(locked)) {
      currentRecord(locked, main, issue);
      return;
    }
    const target = historical(locked, main, issue);
    await commitMigration(
      locked,
      Number((locked.value as Record<string, unknown>).schema),
      `${serializeSession(target)}\n`,
    );
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    if (cause.startsWith(context)) throw error;
    throw new HostError(`${context}: ${cause}`, error instanceof HostError ? error.code : exits.internal);
  } finally {
    if (acquired) await owner.release(name);
  }
}

export async function readSession(
  main: string,
  issue: IssueKey,
  common?: string,
  owner?: LockOwner,
): Promise<SessionRecord> {
  common ??= await commonDir(main);
  const source = await snapshot(common, issue);
  if (!source) throw missing(issue);
  if (!oldSchema(source)) return currentRecord(source, main, issue);
  historical(source, main, issue);
  try {
    if (owner?.owns(issueLock(issue))) await prepareSession(main, issue, common, owner);
    else await requestStatePreparation(main, { kind: 'session', issue });
  } catch (error) {
    const context = `session: ${source.path}: schema ${schemaOf(source)} to 3`;
    const cause = error instanceof Error ? error.message : String(error);
    if (cause.startsWith(context)) throw error;
    throw new HostError(`${context}: ${cause}`, error instanceof HostError ? error.code : exits.internal);
  }
  const prepared = await snapshot(common, issue);
  if (!prepared) throw missing(issue);
  return currentRecord(prepared, main, issue);
}

export async function selectSavedSession(
  main: string,
  issue: IssueKey,
  explicit?: string,
  common?: string,
  owner?: LockOwner,
): Promise<SavedSession> {
  const record = await readSession(main, issue, common, owner);
  if (explicit !== undefined && explicit !== record.host)
    throw new HostError(
      `celetis: #${issue} recorded host is ${record.host}; resume without --agent or use --agent ${record.host}`,
      exits.usage,
    );
  const { session_id } = record;
  if (session_id === null)
    throw new HostError(
      `celetis: #${issue} has no saved turn with a verified session identity; exact run resume requires that identity. From the main checkout, run ${hostAdapter(record.host).recovery} and select the saved session, or start a new step if none exists.`,
      exits.prerequisite,
    );
  return { ...record, session_id };
}

export async function writeSession(main: string, record: SessionRecord, owner?: LockOwner): Promise<void> {
  const common = await commonDir(main);
  const layout = repositoryLayout(common);
  const file = layout.session(record.issue);
  validateSession(record, main, record.issue, file);
  if (await snapshot(common, record.issue)) await readSession(main, record.issue, common, owner);
  ensureFolder(layout.root);
  ensureFolder(layout.sessions);
  await writeAtomic(file, `${serializeSession(record)}\n`);
}

export async function observeSession(
  record: SessionRecord,
  claim: Claim,
  startedAt: number,
  owner?: LockOwner,
): Promise<0 | 1 | 2> {
  if (claim.kind === 'none') return 1;
  if (claim.kind === 'many') return 2;
  const next = { ...record, session_id: claim.id };
  if (!(await hostAdapter(record.host).verifySession(record.checkout, claim.id, startedAt))) return 1;
  try {
    await writeSession(record.checkout, next, owner);
  } catch {
    return 2;
  }
  return 0;
}

export async function stepText(facts: StepFacts): Promise<string> {
  const file = join(facts.pluginRoot, 'step-prompt.md');
  const text = await readFile(file, 'utf8').catch((error) => {
    throw new HostError(
      `daemon: cannot read the step text ${file}; repair the ${facts.host} plugin installation`,
      exits.prerequisite,
      { cause: error },
    );
  });
  return `${stepHeader(facts)}\n\n${text}`;
}

export function startLine(prompt: string, start: StartPair, applied: Level | null, kept: string | null): string {
  const line = `start: ${prompt} on ${start.model} (${start.source.model}) at ${start.level} (${start.source.level})`;
  if (applied === null) return `${line}; opencode keeps the model and the variant of its configuration`;
  return kept === null ? line : `${line}; codex keeps its configured model ${kept} and applies ${applied}`;
}

export async function startupError(
  issue: IssueKey,
  host: Host,
  detail: string,
  terminal: string,
  tab: string,
): Promise<void> {
  const line = `daemon: #${issue} ${host} startup: ${detail}. Check the version, trust, and sign-in prompts in the tab ${tab}. Complete the required action, then start the step again. Manual recovery: ${hostAdapter(host).recovery} from the main checkout.`;
  console.error(line);
  recordEvent({ name: 'startup-error', message: line, issue });
  const screen = await readScreen(terminal, 40);
  if (screen) process.stderr.write(`${screen.trimEnd().split('\n').slice(-40).join('\n')}\n`);
}
