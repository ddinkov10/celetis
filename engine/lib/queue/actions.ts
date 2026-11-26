import { randomUUID } from 'node:crypto';
import { HostError } from '../command/errors.ts';
import type { Operation } from '../command/operation.ts';
import type { Config } from '../config/core.ts';
import { type ExitCode, exits } from '../contract/contract.ts';
import { hostAvailability } from '../host/host.ts';
import type { Next } from '../resolver/lines.ts';
import { lineOf } from '../resolver/lines.ts';
import { nextIssue } from '../resolver/resolver.ts';
import { services } from '../services/services.ts';
import { issueLock, lockHolder } from '../state/locks.ts';
import type { IssueKey } from '../tracker/key.ts';
import {
  explicitHost,
  parseQueueAction,
  queueOwner,
  queueView,
  readQueue,
  readQueueView,
  requireQueueChoice,
  updateQueue,
} from './queue.ts';
import type { QueueAction, QueueExpected, QueueReceipt, QueueRecord, QueueView, QueueWake } from './types.ts';

function refuse(message: string, code: ExitCode = exits.prerequisite): never {
  throw new HostError(message, code);
}
const terminal = (next: Next | null) =>
  next?.kind === 'stop' && (next.reason === 'finished' || next.reason === 'wontfix');
const expectedOf = (record: QueueRecord | null): QueueExpected => ({
  id: record?.id ?? null,
  revision: record?.revision ?? 0,
  current: record?.numbers[0] ?? null,
});
const match = (record: QueueRecord | null, expected: QueueExpected) => {
  const actual = expectedOf(record);
  if (actual.id !== expected.id || actual.revision !== expected.revision || actual.current !== expected.current)
    refuse('queue: the ID, revision, or current issue changed; refresh the queue');
};
const checkoutOf = (operation: Operation) => {
  const { main, common } = operation.checkout;
  if (main === null || common === null) refuse('queue: need a Git checkout', exits.usage);
  return { main, common };
};
export const emptyQueue = (record?: QueueRecord | null): QueueRecord => ({
  schema: 4,
  id: record?.id ?? randomUUID(),
  revision: record?.revision ?? 1,
  choice: null,
  activeHost: null,
  numbers: [],
  state: 'empty',
  waitId: null,
  current: null,
  last: null,
  reason: null,
  act: null,
  launch: null,
});
const wakeOf = (record: QueueRecord): QueueWake => {
  if (!record.launch || !record.choice) throw new Error('queue: no pending launch');
  return { id: record.id, token: record.launch.token, choice: record.choice };
};

export async function admitQueue(operation: Operation, input: QueueAction): Promise<QueueReceipt> {
  const action = parseQueueAction(input);
  const { main, common } = checkoutOf(operation);
  const snapshot = await readQueue(main, common);
  match(snapshot, action.expected);
  const choice = snapshot?.choice ?? operation.choice;
  requireQueueChoice(choice, operation.choice);
  const pinned = explicitHost(choice);
  const number = action.kind === 'add' ? action.number : snapshot?.numbers[0];
  if (!number) refuse('queue: that action is not available; refresh the queue');
  const { next, stderr } = await nextIssue(number, operation);
  if (action.kind === 'add' || action.kind === 'continue' || action.kind === 'retry') {
    if (
      action.kind === 'retry' && action.step === null
        ? !terminal(next)
        : next.kind !== 'run' || next.step !== action.step
    )
      refuse(
        `queue: the displayed decision changed: ${lineOf(number, next)}${next.kind === 'observed' && next.reason === 'unreadable' ? `\n${stderr}`.trimEnd() : ''}`,
      );
    if (next.kind === 'run' && pinned && !hostAvailability(pinned).available) refuse(`queue: ${pinned} is not on PATH`);
  }
  const currentNext =
    snapshot?.numbers[0] && snapshot.numbers[0] !== number
      ? (await nextIssue(snapshot.numbers[0], operation)).next
      : next;
  let wake = false;
  let owner: string | null = null;
  const record = await updateQueue(
    main,
    async (current) => {
      match(current, action.expected);
      owner = await queueOwner(main, current);
      if (action.kind === 'add') {
        if (!queueView(current, owner, currentNext).actions.add)
          refuse('queue: cannot read the current issue; refresh before acting', exits.blocked);
        if (current?.numbers.includes(action.number)) refuse('queue: that issue is already queued');
        if (await lockHolder(main, issueLock(action.number))) refuse('queue: that issue already has a live owner');
        if (current?.numbers.length) return { ...current, numbers: [...current.numbers, action.number] };
        if (owner) refuse('queue: a previous run still owns the queue');
        wake = true;
        return {
          ...emptyQueue(current),
          choice,
          numbers: [action.number],
          state: 'starting',
          current: next?.kind === 'run' ? next : null,
          launch: { token: randomUUID(), authorization: { number: action.number, step: action.step, retry: false } },
        };
      }
      if (!current?.numbers.length) refuse('queue: the queue is empty');
      if (action.kind === 'move' || action.kind === 'remove') {
        if (!queueView(current, owner, currentNext).actions.edit)
          refuse('queue: cannot read the current issue; refresh before acting', exits.blocked);
        const index = current.numbers.indexOf(action.number);
        if (index < 1) refuse('queue: only waiting issues can be edited');
        const numbers = [...current.numbers];
        if (action.kind === 'remove') numbers.splice(index, 1);
        else {
          const target = index + (action.direction === 'up' ? -1 : 1);
          if (target < 1 || target >= numbers.length) refuse('queue: that move is not available');
          [numbers[index], numbers[target]] = [numbers[target] as IssueKey, action.number];
        }
        return { ...current, numbers };
      }
      const view = queueView(current, owner, next);
      if (!view.actions[action.kind]) refuse('queue: that action is not available; refresh the queue');
      wake = true;
      return {
        ...current,
        state: 'starting',
        activeHost: null,
        waitId: null,
        reason: null,
        act: null,
        launch: {
          token: randomUUID(),
          authorization: { number: current.numbers[0] as IssueKey, step: action.step, retry: action.kind === 'retry' },
        },
      };
    },
    common,
  );
  return { view: queueView(record, owner, currentNext), wake: wake ? wakeOf(record) : null };
}

export async function reconcileQueue(operation: Operation, signal?: AbortSignal): Promise<QueueReceipt> {
  const { main, common } = checkoutOf(operation);
  let snapshot: QueueRecord | null;
  try {
    snapshot = await readQueue(main, common);
  } catch {
    return { view: await readQueueView(operation, signal), wake: null };
  }
  if (!snapshot?.numbers.length) return { view: await readQueueView(operation, signal), wake: null };
  const observations = new Map<IssueKey, Next>();
  for (const number of snapshot.numbers) {
    signal?.throwIfAborted();
    observations.set(number, (await nextIssue(number, operation, signal)).next);
  }
  let wake: QueueWake | null = null;
  let owner: string | null = null;
  let fresh = false;
  const record = await updateQueue(
    main,
    async (current) => {
      signal?.throwIfAborted();
      if (!current) refuse('queue: the record disappeared during reconciliation');
      if (current.id !== snapshot.id || current.revision !== snapshot.revision) return current;
      fresh = true;
      owner = await queueOwner(main, current);
      const numbers: IssueKey[] = [];
      for (const number of current.numbers) {
        const observed = observations.get(number) ?? null;
        const held = (number === current.numbers[0] && owner) || (await lockHolder(main, issueLock(number)));
        if (!terminal(observed) || held) numbers.push(number);
      }
      if (numbers.length === current.numbers.length) return current;
      if (!numbers.length) return emptyQueue(current);
      if (numbers[0] === current.numbers[0]) return { ...current, numbers };
      const next: QueueRecord = {
        ...current,
        numbers,
        state: 'starting',
        activeHost: null,
        waitId: null,
        current: null,
        last: null,
        reason: null,
        act: null,
        launch: { token: randomUUID(), authorization: null },
      };
      wake = wakeOf(next);
      return next;
    },
    common,
  );
  if (!fresh) return { view: await readQueueView(operation, signal), wake: null };
  const unreadable = record.numbers.find((number) => {
    const next = observations.get(number);
    return next?.kind === 'observed' && next.reason === 'unreadable';
  });
  const view = queueView(
    record,
    owner,
    observations.get(record.numbers[0] as IssueKey) ?? null,
    unreadable
      ? `queue: cannot read #${unreadable} from ${services(operation.mainConfig as Config, main).tracker.name}; the issue remains queued`
      : null,
  );
  if (unreadable) view.actions = { add: false, edit: false, continue: false, retry: false };
  return { view, wake };
}

export async function failQueueLaunch(
  operation: Operation,
  id: string,
  token: string,
  reason: string,
): Promise<QueueView> {
  const { main, common } = checkoutOf(operation);
  await updateQueue(
    main,
    async (current) => {
      if (!current) refuse('queue: the pending record disappeared');
      if (current.id !== id || current.launch?.token !== token || (await queueOwner(main, current))) return current;
      return {
        ...current,
        state: 'error',
        activeHost: null,
        waitId: null,
        launch: null,
        reason,
        act: 'Fix the launch failure, then use Try again.',
      };
    },
    common,
  );
  return readQueueView(operation);
}
