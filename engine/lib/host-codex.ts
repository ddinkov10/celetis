import { codexRequest } from './codex-app-server.ts';
import { exits } from './contract.ts';
import { clampEffort, type Level } from './effort.ts';
import { HostError } from './errors.ts';
import { uuid } from './fields.ts';
import { codexHome } from './homes.ts';
import type { Claim, HostAdapter } from './host-types.ts';
import { codexSessionPin } from './plugin-metadata.ts';
import { readCodexUsage } from './usage-codex.ts';
import { command, type Step } from './workflow.ts';

const modelsUnreadable = 'daemon: cannot read the Codex models; start the run again';
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function codexPrompt(step: Step, issue: number): string {
  return `Use the celetis:${command(step)} skill for #${issue}. Complete its Celetis entry before any response, including commentary.`;
}

async function codexClaim(checkout: string, prompt: string, startedAt: number): Promise<Claim> {
  let reply: unknown;
  try {
    reply = await codexRequest(checkout, 'thread/list', { cwd: checkout, limit: 20, modelProviders: [] });
  } catch {
    return { kind: 'none' };
  }
  const threads = object(reply) && object(reply.result) ? reply.result.data : null;
  if (!Array.isArray(threads)) return { kind: 'none' };
  const ids = threads.flatMap((thread) =>
    object(thread) &&
    typeof thread.id === 'string' &&
    uuid.test(thread.id) &&
    thread.cwd === checkout &&
    typeof thread.createdAt === 'number' &&
    thread.createdAt >= startedAt &&
    thread.preview === prompt
      ? [thread.id]
      : [],
  );
  const [id] = ids;
  if (id === undefined) return { kind: 'none' };
  return ids.length === 1 ? { kind: 'one', id } : { kind: 'many' };
}

function selectCodexEffort(
  config: Record<string, unknown>,
  models: readonly unknown[],
  chosen: Level,
): { model: string; applied: Level } {
  const configured = config.model;
  if (!(configured == null || typeof configured === 'string')) throw new HostError(modelsUnreadable, exits.blocked);
  const entry = models
    .filter(object)
    .find((each) => (configured == null ? each.isDefault === true : each.model === configured));
  if (!entry)
    throw configured == null
      ? new HostError(modelsUnreadable, exits.blocked)
      : new HostError(
          `daemon: the Codex model ${configured} is not in model/list; set model in the Codex config to a listed model, then start the run again`,
          exits.prerequisite,
        );
  const { model, supportedReasoningEfforts: options } = entry;
  if (typeof model !== 'string' || !Array.isArray(options)) throw new HostError(modelsUnreadable, exits.blocked);
  const applied = clampEffort(
    chosen,
    options
      .map((option) => (object(option) ? option.reasoningEffort : null))
      .filter((each) => typeof each === 'string'),
  );
  if (!applied)
    throw new HostError(
      `daemon: the Codex model ${model} supports no effort level of Celetis; set model in the Codex config to another model, then start the run again`,
      exits.prerequisite,
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
      throw new HostError(modelsUnreadable, exits.blocked);
    models.push(...page.data);
    cursor = next;
    if (next !== null) seen.add(next);
  } while (cursor !== null);
  return models;
}

export const codex: HostAdapter = {
  app: 'codex',
  exitKeys: (terminal) => ['keys', terminal, 'ctrl+c', 'ctrl+c'],
  checkHome: async () => {
    await codexHome();
  },
  homeEnv: async () => ({ CODEX_HOME: await codexHome() }),
  stepEnv: (source) => source,
  pin: codexSessionPin,
  stepPrompt: codexPrompt,
  stepArguments: async ({ issue, step, cwd, effort, stepText }) => {
    const args = ['--no-daemon'];
    const reply = await codexRequest(cwd, 'config/read', { cwd, includeLayers: false });
    const config = object(reply) && object(reply.result) && object(reply.result.config) ? reply.result.config : null;
    if (step !== 'specify') {
      const existing = config?.developer_instructions ?? '';
      if (config === null || typeof existing !== 'string')
        throw new HostError('daemon: cannot read the step instructions; start the run again', exits.blocked);
      const text = await stepText();
      args.push('-c', `developer_instructions=${JSON.stringify(existing ? `${existing}\n\n${text}` : text)}`);
    }
    if (config === null) throw new HostError(modelsUnreadable, exits.blocked);
    const { model, applied } = selectCodexEffort(config, await codexModels(cwd), effort);
    args.push('-c', `model_reasoning_effort=${JSON.stringify(applied)}`, codexPrompt(step, issue));
    return { args, applied, model };
  },
  resumeArguments: (session) => [
    'resume',
    '--no-daemon',
    '-c',
    `model_reasoning_effort=${JSON.stringify(session.effort)}`,
    session.session_id,
  ],
  interactiveArguments: (_title, prompt, attempt) => ['--no-daemon', `${prompt}\nLauncher attempt: ${attempt}.`],
  startId: () => null,
  claim: (checkout, prompt, _announced, startedAt) => codexClaim(checkout, prompt, startedAt),
  verifySession: async (checkout, sessionId, startedAt) => {
    if (!sessionId || !uuid.test(sessionId)) return false;
    try {
      const reply = await codexRequest(checkout, 'thread/read', {
        threadId: sessionId,
        includeTurns: false,
      });
      const thread = object(reply) && object(reply.result) ? reply.result.thread : null;
      if (
        !object(thread) ||
        thread.id !== sessionId ||
        thread.cwd !== checkout ||
        thread.ephemeral !== false ||
        typeof thread.createdAt !== 'number' ||
        thread.createdAt < startedAt
      )
        return false;
      const turns = await codexRequest(checkout, 'thread/turns/list', {
        threadId: sessionId,
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
  },
  recovery: 'codex resume --no-daemon',
  prepareUsage: async () => [],
  readUsage: (attempt) => readCodexUsage(attempt),
  sessionVariable: 'CODEX_SESSION_ID',
  terminatesAfterGrace: false,
};
