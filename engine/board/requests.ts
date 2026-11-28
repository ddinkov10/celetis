import { z } from 'zod';
import { type AgentChoice, agentOrderList } from '../lib/config/core.ts';
import { coordinatorKeys } from '../lib/coordinator/types.ts';
import { textLimit } from '../lib/daemon/types.ts';
import { type Host, hostChoices, isHost } from '../lib/host/names.ts';
import { parseQueueAction } from '../lib/queue/queue.ts';
import type { QueueAction } from '../lib/queue/types.ts';
import { isCommit, orderVersion, uuid } from '../lib/state/fields.ts';
import { isSafeId, TerminalError } from '../lib/terminal/terminal.ts';
import { type IssueKey, isKey } from '../lib/tracker/key.ts';
import { isLevel, type Level, levels } from '../lib/workflow/effort.ts';

export const POSTS: ReadonlySet<string> = new Set([
  '/api/intake',
  '/api/assist',
  '/api/visual',
  '/api/run',
  '/api/resume',
  '/api/queue',
  '/api/shell',
  '/api/go',
  '/api/aside',
  '/api/stop',
  '/api/held/land',
  '/api/held/discard',
  '/api/hold',
  '/api/refresh',
  '/api/agent',
  '/api/update/check',
  '/api/update/start',
  '/api/update/restart',
  '/api/coordinator/open',
  '/api/coordinator/say',
  '/api/coordinator/key',
  '/api/coordinator/interrupt',
  '/api/coordinator/end',
]);
const notKey = 'the number of the issue is not an issue key';
const issueKey = z.custom<IssueKey>(isKey);
const host = z.custom<Host>(isHost);
const empty = z.strictObject({});
const numbered = z.strictObject({ number: issueKey });
const stop = z.strictObject({ number: issueKey, sessionId: z.custom<string>(isSafeId) });
const land = z.strictObject({ number: issueKey, head: z.custom<string>(isCommit), patch: z.custom<string>(isCommit) });
const say = z.strictObject({ text: z.string() });
const key = z.strictObject({ key: z.enum(coordinatorKeys) });
const updateStart = z.strictObject({ offerId: z.string().min(1) });
const queueOnly = z.strictObject({ action: z.unknown() });
const queueAdd = z.union([queueOnly, z.strictObject({ action: z.unknown(), agent: host })]);
const shell = z.object({ number: issueKey });
const retry = z.strictObject({ number: issueKey, waitId: z.string().regex(uuid) });
const run = z.strictObject({
  number: issueKey,
  agent: z.unknown().optional(),
  effort: z.custom<Level>(isLevel).optional(),
});
const agent = z.strictObject({ order: agentOrderList, expectedVersion: z.string().regex(orderVersion) });

type Of<P extends string, S extends z.ZodType> = { path: P } & z.output<S>;
export type BoardRequest =
  | {
      path:
        | '/api/intake'
        | '/api/refresh'
        | '/api/update/check'
        | '/api/update/restart'
        | '/api/coordinator/open'
        | '/api/coordinator/interrupt'
        | '/api/coordinator/end';
    }
  | Of<
      '/api/assist' | '/api/visual' | '/api/resume' | '/api/shell' | '/api/aside' | '/api/held/discard' | '/api/hold',
      typeof numbered
    >
  | Of<'/api/stop', typeof stop>
  | Of<'/api/held/land', typeof land>
  | Of<'/api/run', typeof retry>
  | ({ path: '/api/run'; agent?: Host } & Omit<z.output<typeof run>, 'agent'>)
  | { path: '/api/queue'; action: QueueAction; choice: AgentChoice }
  | { path: '/api/go'; sessionId: string }
  | Of<'/api/agent', typeof agent>
  | Of<'/api/update/start', typeof updateStart>
  | Of<'/api/coordinator/say', typeof say>
  | Of<'/api/coordinator/key', typeof key>;

export class Refusal extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly keepsLines = false,
  ) {
    super(message);
  }
}

export const refused = (cause: unknown): never => {
  throw cause instanceof TerminalError ? new Refusal(502, cause.message) : cause;
};
export const firstLine = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? '';
export const cleanCause = (cause: unknown) =>
  firstLine(String(cause ?? ''))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 200);
// The daemon bounds its line at textLimit, so this bound cuts no line that the daemon gives.
export const cleanLines = (cause: unknown) =>
  String(cause ?? '')
    .split('\n')
    .map((line) => line.replace(/[\u0000-\u001f\u007f]/g, '').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, textLimit);

// The first fault names the refusal line; a null field checks the key set.
type Faults = readonly (readonly [field: string | null, line: string])[];
const checked = <S extends z.ZodType>(schema: S, input: unknown, refusal: string | Faults): z.output<S> => {
  const found = schema.safeParse(input);
  if (found.success) return found.data;
  if (typeof refusal === 'string') throw new Refusal(400, refusal);
  const has = (field: string | null) =>
    found.error.issues.some(({ code, path: [name] }) => {
      if (code === 'unrecognized_keys') return field === null;
      if (name === undefined) return true;
      return field === null ? !Object.hasOwn(input as object, name) : name === field;
    });
  const [, line] = refusal.find(([field]) => has(field)) ?? (refusal.at(-1) as Faults[number]);
  throw new Refusal(400, line);
};

const agentOf = (number: IssueKey, choice: unknown) => {
  if (choice !== undefined && choice !== null && !isHost(choice))
    throw new Refusal(409, `#${number} has no agent "${String(choice)}"`);
  return isHost(choice) ? choice : undefined;
};

export const parseIssueQuery = (search: string): IssueKey => {
  const key = new URLSearchParams(search).get('key');
  if (!isKey(key)) throw new Refusal(400, 'the key is not an issue of this tracker');
  return key;
};

export const parseRequest = (path: string, body: unknown): BoardRequest => {
  if (
    (path.startsWith('/api/update/') ||
      path === '/api/assist' ||
      path === '/api/visual' ||
      path === '/api/intake' ||
      path === '/api/agent' ||
      path.startsWith('/api/coordinator/')) &&
    (body === null || typeof body !== 'object' || Array.isArray(body))
  )
    throw new Refusal(400, 'the body is not an object');
  const input = (body ?? {}) as Record<string, unknown>;
  if (path === '/api/intake') {
    checked(empty, input, 'intake takes an empty object');
    return { path };
  }
  if (path === '/api/assist' || path === '/api/visual') {
    const only =
      path === '/api/assist' ? 'assistance takes only the issue number' : 'making a visual takes only the issue number';
    const { number } = checked(numbered, input, [
      [null, only],
      ['number', notKey],
    ]);
    return { path, number };
  }
  if (path === '/api/aside' || path === '/api/held/discard' || path === '/api/hold') {
    const only = {
      '/api/aside': 'Set aside takes only the issue number',
      '/api/held/discard': 'Discard takes only the issue number',
      '/api/hold': 'Hold landing takes only the issue number',
    }[path];
    const { number } = checked(numbered, input, [
      [null, only],
      ['number', notKey],
    ]);
    return { path, number };
  }
  if (path === '/api/stop') {
    const { number, sessionId } = checked(stop, input, [
      [null, 'Stop takes only the issue number and a session ID'],
      ['number', notKey],
      ['sessionId', 'the session ID is not a terminal ID'],
    ]);
    return { path, number, sessionId };
  }
  if (path === '/api/held/land') {
    const { number, head, patch } = checked(land, input, [
      [null, 'Land takes only the issue number, the head, and the patch'],
      ['number', notKey],
      ['head', 'the head and the patch are not 40 lowercase hex digits'],
      ['patch', 'the head and the patch are not 40 lowercase hex digits'],
    ]);
    return { path, number, head, patch };
  }
  if (path === '/api/coordinator/open' || path === '/api/coordinator/interrupt' || path === '/api/coordinator/end') {
    checked(empty, input, 'this act of the coordinator takes an empty object');
    return { path };
  }
  if (path === '/api/coordinator/say') {
    const { text } = checked(say, input, 'a message to the coordinator takes only one text string');
    return { path, text };
  }
  if (path === '/api/coordinator/key') {
    const { key: pressed } = checked(
      key,
      input,
      `a key of the coordinator is only one of ${coordinatorKeys.join(', ')}`,
    );
    return { path, key: pressed };
  }
  if (path === '/api/update/check') {
    checked(empty, input, 'the update check takes an empty object');
    return { path };
  }
  if (path === '/api/update/start') {
    const { offerId } = checked(updateStart, input, 'the update start takes one offerId string');
    return { path, offerId };
  }
  if (path === '/api/update/restart') {
    checked(empty, input, 'the restart takes an empty object');
    return { path };
  }
  if (path === '/api/queue') {
    let action: QueueAction;
    try {
      action = parseQueueAction(input.action);
    } catch {
      throw new Refusal(400, 'queue: invalid action');
    }
    const fields = checked(
      action.kind === 'add' ? queueAdd : queueOnly,
      input,
      'queue: invalid request fields or host',
    );
    return {
      path,
      action,
      choice: 'agent' in fields ? { kind: 'explicit', host: fields.agent } : { kind: 'default' },
    };
  }
  if (path === '/api/resume' || path === '/api/shell') {
    const { number } = checked(shell, input, notKey);
    return { path, number };
  }
  if (path === '/api/run') {
    if (Object.hasOwn(input, 'waitId')) {
      const { number, waitId } = checked(retry, input, [
        ['number', notKey],
        [null, 'a quota Retry takes only the issue number and its wait ID'],
        ['waitId', 'a quota Retry takes only the issue number and its wait ID'],
      ]);
      return { path, number, waitId };
    }
    const { number, agent, effort } = checked(run, input, [
      ['number', notKey],
      [null, 'Run takes only the issue number, an agent, and an effort'],
      ['effort', `the effort is not one of ${levels.join(', ')}`],
    ]);
    return { path, number, agent: agentOf(number, agent), effort };
  }
  if (path === '/api/go') return { path, sessionId: String(input.sessionId) };
  if (path === '/api/agent') {
    const { order, expectedVersion } = checked(
      agent,
      input,
      `the order takes exactly a nonempty, unique list of ${hostChoices} and expectedVersion`,
    );
    return { path, order, expectedVersion };
  }
  if (path === '/api/refresh') return { path };
  throw new Refusal(404, 'no such path');
};
