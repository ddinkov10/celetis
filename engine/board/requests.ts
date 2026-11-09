import { isLevel, levels } from '../lib/effort.ts';
import { isHost, isIssueField, orderVersion, uuid } from '../lib/fields.ts';
import { parseQueueAction } from '../lib/queue.ts';
import type { QueueAction } from '../lib/queue-types.ts';
import { TerminalError } from '../lib/terminal.ts';
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
  '/api/refresh',
  '/api/agent',
  '/api/update/check',
  '/api/update/start',
  '/api/update/restart',
]);
const fieldsOf = (value: Record<string, unknown>) => Object.keys(value).sort().join(',');

export class Refusal extends Error {
  constructor(
    readonly status: number,
    message: string,
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

const agentOf = (number: number, choice: unknown) => {
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
      path === '/api/agent') &&
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
    if (!isIssueField(number)) throw new Refusal(400, 'the number of the issue is not digits');
    if (path === '/api/run' && Object.hasOwn(input, 'waitId')) {
      if (fieldsOf(input) !== 'number,waitId' || typeof input.waitId !== 'string' || !uuid.test(input.waitId))
        throw new Refusal(400, 'a quota Retry takes only the issue number and its wait ID');
      return { path, number: Number(number), waitId: input.waitId };
    }
    if (path === '/api/run') {
      const { effort } = input;
      if (Object.keys(input).some((key) => !['number', 'agent', 'effort'].includes(key)))
        throw new Refusal(400, 'Run takes only the issue number, an agent, and an effort');
      if (effort !== undefined && !isLevel(effort))
        throw new Refusal(400, `the effort is not one of ${levels.join(', ')}`);
      return { path, number: Number(number), agent: agentOf(Number(number), input.agent), effort };
    }
    return { path, number: Number(number) };
  }
  if (path === '/api/go') return { path, sessionId: String(input.sessionId) };
  if (path === '/api/agent') {
    const { order, expectedVersion } = input;
    if (
      fieldsOf(input) !== 'expectedVersion,order' ||
      !Array.isArray(order) ||
      order.length === 0 ||
      order.length > 2 ||
      !order.every(isHost) ||
      new Set(order).size !== order.length ||
      typeof expectedVersion !== 'string' ||
      !orderVersion.test(expectedVersion)
    )
      throw new Refusal(400, 'the order takes exactly a nonempty, unique list of claude or codex and expectedVersion');
    return { path, order, expectedVersion };
  }
  if (path === '/api/refresh') return { path };
  throw new Refusal(404, 'no such path');
};
