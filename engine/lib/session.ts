import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Config, Host } from './config-core.ts';
import { clampEffort, isLevel, type Level } from './effort.ts';
import { codexRequest, commonDir, HostError } from './host.ts';
import { run } from './process.ts';
import { command, invocation, type Step, steps } from './workflow.ts';

export interface SessionRecord {
  schema: 2;
  host: Host;
  issue: number;
  step: Step;
  checkout: string;
  session_id: string | null;
  effort: Level;
}
export type SavedSession = SessionRecord & { session_id: string };
const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const modelsUnreadable = 'celetis-flow: cannot read the Codex models; start the runner again';
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateSession(value: unknown, main: string, issue: number, file: string): SessionRecord {
  if (
    !object(value) ||
    Object.keys(value).sort().join(',') !== 'checkout,effort,host,issue,schema,session_id,step' ||
    value.schema !== 2 ||
    value.issue !== issue ||
    value.checkout !== main ||
    (value.host !== 'claude' && value.host !== 'codex') ||
    typeof value.step !== 'string' ||
    !steps.includes(value.step as Step) ||
    !(value.session_id === null || (typeof value.session_id === 'string' && uuid.test(value.session_id))) ||
    !isLevel(value.effort)
  ) {
    throw new HostError(
      `celetis: invalid or obsolete session record ${file}; remove it and start a new step with celetis --agent <host> celetis-flow ${issue}`,
    );
  }
  return value as unknown as SessionRecord;
}

export function serializeSession(record: SessionRecord): string {
  return JSON.stringify(Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b))));
}

export async function readSession(main: string, issue: number, common?: string): Promise<SessionRecord> {
  const file = join(common ?? (await commonDir(main)), 'celetis-flow/sessions', `${issue}.json`);
  let source: string;
  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    throw new HostError(
      `celetis: #${issue} has no current session record; start a new step with celetis --agent <host> celetis-flow ${issue}`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {}
  return validateSession(value, main, issue, file);
}

export function manualRecovery(host: Host): string {
  return host === 'claude' ? 'claude --resume' : 'codex resume --no-daemon';
}

export async function selectSavedSession(
  main: string,
  issue: number,
  explicit?: string,
  common?: string,
): Promise<SavedSession> {
  const record = await readSession(main, issue, common);
  if (explicit !== undefined && explicit !== record.host)
    throw new HostError(
      `celetis: #${issue} recorded host is ${record.host}; resume without --agent or use --agent ${record.host}`,
    );
  const { session_id } = record;
  if (session_id === null)
    throw new HostError(
      `celetis: #${issue} has no saved turn with a verified herdr identity; exact runner resume requires herdr identity. From the main checkout, run ${manualRecovery(record.host)} and select the saved session, or start a new step if none exists.`,
    );
  return { ...record, session_id };
}

export function resumeArguments(record: SavedSession): string[] {
  return record.host === 'claude'
    ? ['--resume', record.session_id, '--effort', record.effort]
    : ['resume', '--no-daemon', '-c', `model_reasoning_effort=${JSON.stringify(record.effort)}`, record.session_id];
}

export function sessionEnv(host: Host, source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (host === 'codex') return { ...source };
  const windows = process.platform === 'win32';
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => (windows ? key.toUpperCase() : key) !== 'CLAUDE_CODE_EFFORT_LEVEL'),
  );
}

export async function writeSession(main: string, record: SessionRecord): Promise<void> {
  const dir = join(await commonDir(main), 'celetis-flow/sessions');
  const file = join(dir, `${record.issue}.json`);
  validateSession(record, main, record.issue, file);
  await mkdir(dir, { recursive: true });
  const temp = join(dir, `.${record.issue}.${randomUUID()}`);
  try {
    await writeFile(temp, `${serializeSession(record)}\n`, { mode: 0o600, flag: 'wx' });
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function verifySavedSession(record: SessionRecord, startedAt: number): Promise<boolean> {
  if (!record.session_id || !uuid.test(record.session_id)) return false;
  if (record.host === 'claude') {
    const projects = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects');
    for (const name of await readdir(projects).catch(() => [])) {
      const source = await readFile(join(projects, name, `${record.session_id}.jsonl`), 'utf8').catch(() => null);
      if (source === null) continue;
      for (const line of source.split('\n').filter(Boolean)) {
        let row: unknown;
        try {
          row = JSON.parse(line);
        } catch {
          break;
        }
        if (
          object(row) &&
          row.sessionId === record.session_id &&
          row.type === 'user' &&
          row.cwd === record.checkout &&
          typeof row.timestamp === 'string' &&
          /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(row.timestamp) &&
          Date.parse(row.timestamp) / 1000 >= startedAt
        )
          return true;
      }
    }
    return false;
  }
  try {
    const reply = await codexRequest(record.checkout, 'thread/read', {
      threadId: record.session_id,
      includeTurns: false,
    });
    const thread = object(reply) && object(reply.result) ? reply.result.thread : null;
    if (
      !object(thread) ||
      thread.id !== record.session_id ||
      thread.cwd !== record.checkout ||
      thread.ephemeral !== false ||
      typeof thread.createdAt !== 'number' ||
      thread.createdAt < startedAt
    )
      return false;
    const turns = await codexRequest(record.checkout, 'thread/turns/list', {
      threadId: record.session_id,
      limit: 1,
      itemsView: 'notLoaded',
    });
    const data = object(turns) && object(turns.result) ? turns.result.data : null;
    return (
      Array.isArray(data) &&
      data.length === 1 &&
      object(data[0]) &&
      typeof data[0].id === 'string' &&
      data[0].id.length > 0
    );
  } catch {
    return false;
  }
}

function agentOf(reply: unknown): Record<string, unknown> | null {
  return object(reply) && object(reply.result) && object(reply.result.agent) ? reply.result.agent : null;
}

export async function observeSession(
  record: SessionRecord,
  reply: unknown,
  priorId: string,
  startedAt: number,
): Promise<0 | 1 | 2> {
  const agent = agentOf(reply);
  if (
    !agent ||
    (agent.agent !== 'claude' && agent.agent !== 'codex') ||
    typeof agent.agent_status !== 'string' ||
    !['idle', 'working', 'blocked', 'done', 'unknown'].includes(agent.agent_status)
  )
    return 2;
  const identity = agent.agent_session;
  if (identity == null) return 1;
  if (agent.agent !== record.host && (!priorId || !object(identity) || identity.value !== priorId)) return 2;
  if (
    !object(identity) ||
    identity.agent !== agent.agent ||
    identity.kind !== 'id' ||
    typeof identity.value !== 'string' ||
    !uuid.test(identity.value)
  )
    return 2;
  if (identity.value === priorId) return 1;
  const next = { ...record, session_id: identity.value };
  if (!(await verifySavedSession(next, startedAt))) return 1;
  try {
    await writeSession(record.checkout, next);
  } catch {
    return 2;
  }
  return 0;
}

export function sessionIdle(reply: unknown, host: Host, id: string): boolean {
  const agent = agentOf(reply);
  return (
    !!agent &&
    agent.agent === host &&
    ['idle', 'done'].includes(String(agent.agent_status)) &&
    object(agent.agent_session) &&
    agent.agent_session.agent === host &&
    agent.agent_session.kind === 'id' &&
    agent.agent_session.value === id
  );
}

export function reportedSessionId(reply: unknown): string {
  const identity = agentOf(reply)?.agent_session;
  return object(identity) && typeof identity.value === 'string' ? identity.value : '';
}

export function stepHeader(facts: {
  issue: number;
  step: Step;
  host: Host;
  main: string;
  pluginRoot: string;
  landing: Config['landing'];
}): string {
  return [
    'Celetis step session',
    '- step session: yes',
    `- issue: #${facts.issue}`,
    `- step: ${facts.step}`,
    `- host: ${facts.host}`,
    `- main checkout: ${facts.main}`,
    `- plugin root: ${facts.pluginRoot}`,
    `- landing: ${facts.landing}`,
  ].join('\n');
}

export function selectCodexEffort(
  config: Record<string, unknown>,
  models: readonly unknown[],
  chosen: Level,
): { model: string; applied: Level } {
  const configured = config.model;
  if (!(configured == null || typeof configured === 'string')) throw new HostError(modelsUnreadable);
  const entry = models
    .filter(object)
    .find((each) => (configured == null ? each.isDefault === true : each.model === configured));
  if (!entry)
    throw new HostError(
      configured == null
        ? modelsUnreadable
        : `celetis-flow: the Codex model ${configured} is not in model/list; set model in the Codex config to a listed model, then start the runner again`,
    );
  const { model, supportedReasoningEfforts: options } = entry;
  if (typeof model !== 'string' || !Array.isArray(options)) throw new HostError(modelsUnreadable);
  const applied = clampEffort(
    chosen,
    options
      .map((option) => (object(option) ? option.reasoningEffort : null))
      .filter((each) => typeof each === 'string'),
  );
  if (!applied)
    throw new HostError(
      `celetis-flow: the Codex model ${model} supports no effort level of Celetis; set model in the Codex config to another model, then start the runner again`,
    );
  return { model, applied };
}

async function codexModels(cwd: string): Promise<unknown[]> {
  const models: unknown[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const reply = await codexRequest(cwd, 'model/list', { cursor, includeHidden: true });
    const page = object(reply) && object(reply.result) ? reply.result : null;
    const next = page?.nextCursor ?? null;
    if (!page || !Array.isArray(page.data) || !(next === null || (typeof next === 'string' && !seen.has(next))))
      throw new HostError(modelsUnreadable);
    models.push(...page.data);
    cursor = next;
    if (next !== null) seen.add(next);
  } while (cursor !== null);
  return models;
}

export async function hostArguments(
  host: Host,
  issue: number,
  step: Step,
  root: string,
  cwd: string,
  facts: { pluginRoot: string; landing: Config['landing'] },
  effort: Level,
): Promise<{ args: string[]; applied: Level; model: string | null }> {
  const stepText = async () =>
    `${stepHeader({ issue, step, host, main: cwd, ...facts })}\n\n${await readFile(join(root, 'step-prompt.md'), 'utf8')}`;
  if (host === 'claude')
    return {
      args: [
        '--permission-mode',
        'auto',
        '--effort',
        effort,
        '-n',
        `#${issue} ${step}`,
        ...(step === 'specify' ? [] : ['--append-system-prompt', await stepText()]),
        invocation(step, issue),
      ],
      applied: effort,
      model: null,
    };
  const args = ['--no-daemon'];
  const reply = await codexRequest(cwd, 'config/read', { cwd, includeLayers: false });
  const config = object(reply) && object(reply.result) && object(reply.result.config) ? reply.result.config : null;
  if (step !== 'specify') {
    const existing = config?.developer_instructions ?? '';
    if (config === null || typeof existing !== 'string')
      throw new HostError('celetis-flow: cannot read the step instructions; start the runner again');
    const text = await stepText();
    args.push('-c', `developer_instructions=${JSON.stringify(existing ? `${existing}\n\n${text}` : text)}`);
  }
  if (config === null) throw new HostError(modelsUnreadable);
  const { model, applied } = selectCodexEffort(config, await codexModels(cwd), effort);
  args.push(
    '-c',
    `model_reasoning_effort=${JSON.stringify(applied)}`,
    `Use the celetis:${command(step)} skill for #${issue}. Complete its Celetis entry before any response, including commentary.`,
  );
  return { args, applied, model };
}

export function startLine(
  prompt: string,
  chosen: Level,
  source: 'decided' | 'default' | 'override',
  applied: Level,
  model: string | null,
): string {
  const line = `start: ${prompt} at ${chosen} (${source})`;
  return applied === chosen ? line : `${line}; codex applies ${applied} for ${model}`;
}

export async function startupError(issue: number, host: Host, detail: string): Promise<void> {
  console.error(
    `celetis-flow: #${issue} ${host} startup: ${detail}. Check the version, trust, and sign-in prompts in this pane. Complete the required action, then start the step again. Manual recovery: ${manualRecovery(host)} from the main checkout.`,
  );
  const result = await run('herdr', [
    'pane',
    'read',
    process.env.HERDR_PANE_ID ?? '',
    '--source',
    'recent-unwrapped',
    '--lines',
    '40',
  ]);
  process.stderr.write(result.stdout);
}
