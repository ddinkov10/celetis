import { z } from 'zod';
import { HostError } from '../../command/errors.ts';
import { exits } from '../../contract/contract.ts';
import { codexSessionPin } from '../../plugin/metadata.ts';
import { isSessionId } from '../../state/fields.ts';
import { anyNumber } from '../../state/schemas.ts';
import type { IssueKey } from '../../tracker/key.ts';
import { clampEffort, type Level, levels, type Model } from '../../workflow/effort.ts';
import { command, type Step } from '../../workflow/workflow.ts';
import { codexHome } from '../homes.ts';
import type { Claim, HostAdapter } from '../types.ts';
import { codexRequest } from './app-server.ts';
import { readCodexUsage } from './usage.ts';

const modelsUnreadable = 'daemon: cannot read the Codex models; start the run again';
const codexSessionId = z.string().refine((id) => isSessionId('codex', id));
const claimThreads = z.looseObject({ result: z.looseObject({ data: z.array(z.unknown()) }) });
const claimThread = z.looseObject({ id: codexSessionId, cwd: z.string(), createdAt: anyNumber, preview: z.string() });
const configReply = z.looseObject({
  result: z.looseObject({
    config: z.looseObject({ developer_instructions: z.unknown().optional(), model: z.unknown().optional() }),
  }),
});
type CodexConfig = z.infer<typeof configReply>['result']['config'];
const modelPage = z.looseObject({
  result: z.looseObject({ data: z.array(z.unknown()), nextCursor: z.string().nullish() }),
});
const modelHead = z.looseObject({ isDefault: z.unknown().optional(), model: z.unknown().optional() });
const modelEntry = z.looseObject({ model: z.string(), supportedReasoningEfforts: z.array(z.unknown()) });
const effortOption = z.looseObject({ reasoningEffort: z.unknown().optional() });
const threadRead = z.looseObject({
  result: z.looseObject({
    thread: z.looseObject({ id: z.string(), cwd: z.string(), ephemeral: z.literal(false), createdAt: anyNumber }),
  }),
});
const turnList = z.looseObject({
  result: z.looseObject({ data: z.tuple([z.looseObject({ id: z.string().min(1) })]) }),
});

function codexPrompt(step: Step, issue: IssueKey): string {
  return `Use the celetis:${command(step)} skill for #${issue}. Complete its Celetis entry before any response, including commentary.`;
}

async function codexClaim(checkout: string, prompt: string, startedAt: number): Promise<Claim> {
  let reply: Record<string, unknown>;
  try {
    reply = await codexRequest(checkout, 'thread/list', { cwd: checkout, limit: 20, modelProviders: [] });
  } catch {
    return { kind: 'none' };
  }
  const list = claimThreads.safeParse(reply);
  if (!list.success) return { kind: 'none' };
  const ids = list.data.result.data.flatMap((value) => {
    const thread = claimThread.safeParse(value);
    return thread.success &&
      thread.data.cwd === checkout &&
      thread.data.createdAt >= startedAt &&
      thread.data.preview === prompt
      ? [thread.data.id]
      : [];
  });
  const [id] = ids;
  if (id === undefined) return { kind: 'none' };
  return ids.length === 1 ? { kind: 'one', id } : { kind: 'many' };
}

const tiers: Readonly<Record<Model, number>> = { haiku: 0, sonnet: 0, opus: 1, fable: 2 };

export function tierRaise(level: Level, model: Model): Level {
  return levels[Math.min(levels.indexOf(level) + tiers[model], levels.length - 1)] ?? level;
}

function selectCodexEffort(
  config: CodexConfig,
  models: readonly unknown[],
  chosen: Level,
): { model: string; applied: Level } {
  const configured = config.model;
  if (!(configured == null || typeof configured === 'string')) throw new HostError(modelsUnreadable, exits.blocked);
  const entry = models
    .flatMap((value) => {
      const head = modelHead.safeParse(value);
      return head.success ? [head.data] : [];
    })
    .find((each) => (configured == null ? each.isDefault === true : each.model === configured));
  if (!entry)
    throw configured == null
      ? new HostError(modelsUnreadable, exits.blocked)
      : new HostError(
          `daemon: the Codex model ${configured} is not in model/list; set model in the Codex config to a listed model, then start the run again`,
          exits.prerequisite,
        );
  const selected = modelEntry.safeParse(entry);
  if (!selected.success) throw new HostError(modelsUnreadable, exits.blocked);
  const { model, supportedReasoningEfforts: options } = selected.data;
  const applied = clampEffort(
    chosen,
    options.flatMap((option) => {
      const parsed = effortOption.safeParse(option);
      return parsed.success && typeof parsed.data.reasoningEffort === 'string' ? [parsed.data.reasoningEffort] : [];
    }),
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
    const page = modelPage.safeParse(reply);
    const next = page.data?.result.nextCursor ?? null;
    if (!page.success || (next !== null && seen.has(next))) throw new HostError(modelsUnreadable, exits.blocked);
    models.push(...page.data.result.data);
    cursor = next;
    if (next !== null) seen.add(next);
  } while (cursor !== null);
  return models;
}

export const codex: HostAdapter = {
  app: 'codex',
  capability: { steps: 'all', interactive: true, dispatch: true, landing: true, setup: true },
  appliesEffort: true,
  exitKeys: (terminal) => ['keys', terminal, 'ctrl+c', 'ctrl+c'],
  checkHome: async () => {
    await codexHome();
  },
  homeEnv: async () => ({ CODEX_HOME: await codexHome() }),
  stepEnv: (source) => source,
  pin: codexSessionPin,
  sessionEnv: async () => ({}),
  stepPrompt: codexPrompt,
  stepArguments: async ({ issue, step, cwd, start, stepText }) => {
    const args = ['--no-daemon'];
    const reply = await codexRequest(cwd, 'config/read', { cwd, includeLayers: false });
    const config = configReply.safeParse(reply).data?.result.config ?? null;
    if (step !== 'specify') {
      const existing = config?.developer_instructions ?? '';
      if (config === null || typeof existing !== 'string')
        throw new HostError('daemon: cannot read the step instructions; start the run again', exits.blocked);
      const text = await stepText();
      args.push('-c', `developer_instructions=${JSON.stringify(existing ? `${existing}\n\n${text}` : text)}`);
    }
    if (config === null) throw new HostError(modelsUnreadable, exits.blocked);
    const chosen =
      start.source.level === 'pinned' || start.source.level === 'override'
        ? start.level
        : tierRaise(start.level, start.model);
    const { model, applied } = selectCodexEffort(config, await codexModels(cwd), chosen);
    args.push('-c', `model_reasoning_effort=${JSON.stringify(applied)}`, codexPrompt(step, issue));
    return { args, applied, model };
  },
  resumeArguments: (session) => {
    if (session.effort === null) throw new HostError('daemon: a codex session record has no effort', exits.internal);
    return [
      'resume',
      '--no-daemon',
      '-c',
      `model_reasoning_effort=${JSON.stringify(session.effort)}`,
      session.session_id,
    ];
  },
  sessionArguments: () => [],
  interactiveArguments: (_title, prompt, attempt) => ['--no-daemon', `${prompt}\nLauncher attempt: ${attempt}.`],
  startId: () => null,
  claim: (checkout, prompt, _announced, startedAt) => codexClaim(checkout, prompt, startedAt),
  verifySession: async (checkout, sessionId, startedAt) => {
    if (!isSessionId('codex', sessionId)) return false;
    try {
      const reply = await codexRequest(checkout, 'thread/read', {
        threadId: sessionId,
        includeTurns: false,
      });
      const read = threadRead.safeParse(reply);
      if (!read.success) return false;
      const { thread } = read.data.result;
      if (thread.id !== sessionId || thread.cwd !== checkout || thread.createdAt < startedAt) return false;
      const turns = await codexRequest(checkout, 'thread/turns/list', {
        threadId: sessionId,
        limit: 1,
        itemsView: 'notLoaded',
      });
      return turnList.safeParse(turns).success;
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
