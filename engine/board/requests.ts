import { coordinatorKeys } from '../lib/coordinator/types.ts';
import { textLimit } from '../lib/daemon/types.ts';
import { hostChoices, isHost } from '../lib/host/names.ts';
import { parseQueueAction } from '../lib/queue/queue.ts';
import type { QueueAction } from '../lib/queue/types.ts';
import { isCommit, orderVersion, uuid } from '../lib/state/fields.ts';
import { isSafeId, TerminalError } from '../lib/terminal/terminal.ts';
import { type IssueKey, isKey } from '../lib/tracker/key.ts';
import { isLevel, levels } from '../lib/workflow/effort.ts';
import type { BoardRequest } from './types.ts';

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
const fieldsOf = (value: Record<string, unknown>) => Object.keys(value).sort().join(',');

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

const agentOf = (number: IssueKey, choice: unknown) => {
  if (choice !== undefined && choice !== null && !isHost(choice))
    throw new Refusal(409, `#${number} has no agent "${String(choice)}"`);
  return isHost(choice) ? choice : undefined;
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
    if (Object.keys(input).length) throw new Refusal(400, 'intake takes an empty object');
    return { path };
  }
  if (path === '/api/assist' && (Object.keys(input).length !== 1 || !Object.hasOwn(input, 'number')))
    throw new Refusal(400, 'assistance takes only the issue number');
  if (path === '/api/visual' && (Object.keys(input).length !== 1 || !Object.hasOwn(input, 'number')))
    throw new Refusal(400, 'making a visual takes only the issue number');
  if (path === '/api/aside' || path === '/api/stop') {
    const stops = path === '/api/stop';
    const { number } = input;
    if (fieldsOf(input) !== (stops ? 'number,sessionId' : 'number'))
      throw new Refusal(
        400,
        stops ? 'Stop takes only the issue number and a session ID' : 'Set aside takes only the issue number',
      );
    if (!isKey(number)) throw new Refusal(400, notKey);
    if (!stops) return { path, number };
    if (!isSafeId(input.sessionId)) throw new Refusal(400, 'the session ID is not a terminal ID');
    return { path, number, sessionId: input.sessionId };
  }
  if (path === '/api/held/land') {
    const { number, head, patch } = input;
    if (fieldsOf(input) !== 'head,number,patch')
      throw new Refusal(400, 'Land takes only the issue number, the head, and the patch');
    if (!isKey(number)) throw new Refusal(400, notKey);
    if (!isCommit(head) || !isCommit(patch))
      throw new Refusal(400, 'the head and the patch are not 40 lowercase hex digits');
    return { path, number, head, patch };
  }
  if (path === '/api/held/discard' || path === '/api/hold') {
    const { number } = input;
    if (fieldsOf(input) !== 'number')
      throw new Refusal(
        400,
        path === '/api/hold' ? 'Hold landing takes only the issue number' : 'Discard takes only the issue number',
      );
    if (!isKey(number)) throw new Refusal(400, notKey);
    return { path, number };
  }
  if (path === '/api/coordinator/open' || path === '/api/coordinator/interrupt' || path === '/api/coordinator/end') {
    if (Object.keys(input).length) throw new Refusal(400, 'this act of the coordinator takes an empty object');
    return { path };
  }
  if (path === '/api/coordinator/say') {
    if (fieldsOf(input) !== 'text' || typeof input.text !== 'string')
      throw new Refusal(400, 'a message to the coordinator takes only one text string');
    return { path, text: input.text };
  }
  if (path === '/api/coordinator/key') {
    const key = coordinatorKeys.find((each) => each === input.key);
    if (fieldsOf(input) !== 'key' || key === undefined)
      throw new Refusal(400, `a key of the coordinator is only one of ${coordinatorKeys.join(', ')}`);
    return { path, key };
  }
  if (path === '/api/update/check') {
    if (Object.keys(input).length) throw new Refusal(400, 'the update check takes an empty object');
    return { path };
  }
  if (path === '/api/update/start') {
    if (Object.keys(input).length !== 1 || typeof input.offerId !== 'string' || !input.offerId)
      throw new Refusal(400, 'the update start takes one offerId string');
    return { path, offerId: input.offerId };
  }
  if (path === '/api/update/restart') {
    if (Object.keys(input).length) throw new Refusal(400, 'the restart takes an empty object');
    return { path };
  }
  if (path === '/api/queue') {
    let action: QueueAction;
    try {
      action = parseQueueAction(input.action);
    } catch {
      throw new Refusal(400, 'queue: invalid action');
    }
    const fields = fieldsOf(input);
    if (
      Array.isArray(input) ||
      !(fields === 'action' || (action.kind === 'add' && fields === 'action,agent' && isHost(input.agent)))
    )
      throw new Refusal(400, 'queue: invalid request fields or host');
    return {
      path,
      action,
      choice: isHost(input.agent) ? { kind: 'explicit', host: input.agent } : { kind: 'default' },
    };
  }
  if (
    path === '/api/assist' ||
    path === '/api/visual' ||
    path === '/api/run' ||
    path === '/api/resume' ||
    path === '/api/shell'
  ) {
    const { number } = input;
    if (!isKey(number)) throw new Refusal(400, notKey);
    if (path === '/api/run' && Object.hasOwn(input, 'waitId')) {
      if (fieldsOf(input) !== 'number,waitId' || typeof input.waitId !== 'string' || !uuid.test(input.waitId))
        throw new Refusal(400, 'a quota Retry takes only the issue number and its wait ID');
      return { path, number, waitId: input.waitId };
    }
    if (path === '/api/run') {
      const { effort } = input;
      if (Object.keys(input).some((key) => !['number', 'agent', 'effort'].includes(key)))
        throw new Refusal(400, 'Run takes only the issue number, an agent, and an effort');
      if (effort !== undefined && !isLevel(effort))
        throw new Refusal(400, `the effort is not one of ${levels.join(', ')}`);
      return { path, number, agent: agentOf(number, input.agent), effort };
    }
    return { path, number };
  }
  if (path === '/api/go') return { path, sessionId: String(input.sessionId) };
  if (path === '/api/agent') {
    const { order, expectedVersion } = input;
    if (
      fieldsOf(input) !== 'expectedVersion,order' ||
      !Array.isArray(order) ||
      order.length === 0 ||
      !order.every(isHost) ||
      new Set(order).size !== order.length ||
      typeof expectedVersion !== 'string' ||
      !orderVersion.test(expectedVersion)
    )
      throw new Refusal(400, `the order takes exactly a nonempty, unique list of ${hostChoices} and expectedVersion`);
    return { path, order, expectedVersion };
  }
  if (path === '/api/refresh') return { path };
  throw new Refusal(404, 'no such path');
};
