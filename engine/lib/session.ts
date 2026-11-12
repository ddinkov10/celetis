import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config, Host } from './config-core.ts';
import { exits, stepHeader } from './contract.ts';
import { isLevel, type Level, type StartPair } from './effort.ts';
import { HostError } from './errors.ts';
import { recordEvent } from './events.ts';
import { isSessionId } from './fields.ts';
import { commonDir } from './git.ts';
import { isHost } from './host-names.ts';
import type { Claim } from './host-types.ts';
import { hostAdapter } from './hosts.ts';
import type { LockOwner } from './locks.ts';
import { ensureFolder, repositoryLayout, writeAtomic } from './state.ts';
import { commitMigration, type LocalRecord, readLocalRecord } from './state-migration.ts';
import { requestStatePreparation } from './state-preparation.ts';
import { readScreen } from './terminal.ts';
import { type Step, steps } from './workflow.ts';

export interface SessionRecord {
  schema: 2;
  host: Host;
  issue: number;
  step: Step;
  checkout: string;
  session_id: string | null;
  effort: Level | null;
}
export type SavedSession = SessionRecord & { session_id: string };
type StepFacts = {
  issue: number;
  step: Step;
  host: Host;
  main: string;
  pluginRoot: string;
  landing: Config['landing'];
  recovery?: boolean;
};
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sessionFields(value: Record<string, unknown>, main: string, issue: number): boolean {
  return (
    value.issue === issue &&
    value.checkout === main &&
    isHost(value.host) &&
    typeof value.step === 'string' &&
    steps.includes(value.step as Step) &&
    (value.session_id === null || isSessionId(value.host, value.session_id))
  );
}

export function validateSession(value: unknown, main: string, issue: number, file: string): SessionRecord {
  if (
    !object(value) ||
    Object.keys(value).sort().join(',') !== 'checkout,effort,host,issue,schema,session_id,step' ||
    value.schema !== 2 ||
    !sessionFields(value, main, issue) ||
    !(isHost(value.host) && (hostAdapter(value.host).appliesEffort ? isLevel(value.effort) : value.effort === null))
  ) {
    throw new HostError(
      `session: ${file}: invalid schema-2 fields; preserve the record and repair its data`,
      exits.usage,
    );
  }
  return value as unknown as SessionRecord;
}

export function serializeSession(record: SessionRecord): string {
  return JSON.stringify(Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b))));
}

function historical(source: LocalRecord, main: string, issue: number): SessionRecord {
  const value = source.value;
  if (
    !object(value) ||
    value.schema !== 1 ||
    Object.keys(value).sort().join(',') !== 'checkout,host,issue,schema,session_id,step' ||
    !sessionFields(value, main, issue)
  )
    throw new HostError(
      `session: ${source.path}: schema 1 to 2: invalid historical fields; preserve and repair the record`,
      exits.usage,
    );
  return validateSession({ ...value, schema: 2, effort: 'high' }, main, issue, source.path);
}

const oldSchema = (source: LocalRecord) => object(source.value) && source.value.schema === 1;
async function snapshot(common: string, issue: number): Promise<LocalRecord | null> {
  const layout = repositoryLayout(common);
  const file = layout.session(issue);
  try {
    return await readLocalRecord(file, [common, layout.root.path, layout.sessions.path], 'shared');
  } catch (error) {
    throw new HostError(
      `session: ${file}: target schema 2: cannot read record: ${error instanceof Error ? error.message : String(error)}`,
      exits.blocked,
    );
  }
}
function currentRecord(source: LocalRecord, main: string, issue: number): SessionRecord {
  if (!object(source.value) || source.value.schema !== 2)
    throw new HostError(
      `session: ${source.path}: unsupported schema ${object(source.value) ? String(source.value.schema) : 'unknown'}; expected schema 2`,
      exits.usage,
    );
  return validateSession(source.value, main, issue, source.path);
}
function missing(issue: number): HostError {
  return new HostError(
    `celetis: #${issue} has no current session record; start a new step with celetis --agent <host> run ${issue}`,
    exits.prerequisite,
  );
}

export async function prepareSession(main: string, issue: number, common: string, owner: LockOwner): Promise<void> {
  const source = await snapshot(common, issue);
  if (!source) return;
  if (!oldSchema(source)) {
    currentRecord(source, main, issue);
    return;
  }
  historical(source, main, issue);
  const context = `session: ${source.path}: schema 1 to 2`;
  const name = `issue-${issue}`;
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
    await commitMigration(locked, 1, `${serializeSession(target)}\n`);
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
  issue: number,
  common?: string,
  owner?: LockOwner,
): Promise<SessionRecord> {
  common ??= await commonDir(main);
  const source = await snapshot(common, issue);
  if (!source) throw missing(issue);
  if (!oldSchema(source)) return currentRecord(source, main, issue);
  historical(source, main, issue);
  try {
    if (owner?.owns(`issue-${issue}`)) await prepareSession(main, issue, common, owner);
    else await requestStatePreparation(main, { kind: 'session', issue });
  } catch (error) {
    const context = `session: ${source.path}: schema 1 to 2`;
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
  issue: number,
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
  issue: number,
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
