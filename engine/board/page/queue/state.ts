import { useSyncExternalStore } from 'react';
import type { QueueAction, QueueRecord, QueueView } from '../../../lib/queue/types.ts';
import type { IssueKey } from '../../../lib/tracker/key.ts';
import type { Board, Card } from '../../types.ts';
import { knownAgent } from '../../view.ts';
import { shellStore } from '../store.ts';
import { announce, toast } from '../ui.ts';

export type QueueState = Readonly<{
  board: Board | null;
  submitted: QueueView | null;
  agent: string;
  isBusy: boolean;
  isUncertain: boolean;
  state: 'empty' | 'starting' | 'running' | 'me-gate' | 'error';
  isAuthoritative: boolean;
  chosen: string | null;
  available: (Card & { number: IssueKey })[];
}>;

const recordedHost = (record: QueueRecord | null | undefined) =>
  record?.choice?.kind === 'explicit' ? record.choice.host : null;
const chosenHost = (record: QueueRecord | null | undefined) => (record?.choice ? recordedHost(record) : agent || null);

let board: Board | null = null;
let submitted: QueueView | null = null;
let agent = '';
let busy = false;
let uncertain = false;
const retired = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: QueueState = {
  board,
  submitted,
  agent,
  isBusy: busy,
  isUncertain: uncertain,
  state: 'empty',
  isAuthoritative: false,
  chosen: null,
  available: [],
};
const cards = () => Object.values(board?.columns ?? {}).flat();
const available = () =>
  cards().flatMap(({ number, ...card }) =>
    number !== null && !card.sessionId && card.run && card.step ? [{ ...card, number }] : [],
  );
const find = (number: IssueKey) => cards().find((card) => card.number === number);
const expected = () => ({
  id: submitted?.record?.id ?? null,
  revision: submitted?.record?.revision ?? 0,
  current: submitted?.record?.numbers[0] ?? null,
});
const authoritative = () => Boolean(submitted && !uncertain && !board?.source.error);

function accept(view: QueueView): void {
  const old = submitted?.record;
  const next = view.record;
  if (next && (retired.has(next.id) || (old?.id === next.id && next.revision < old.revision))) return;
  if (!next && old) {
    submitted = {
      ...(submitted as QueueView),
      error: view.error ?? 'The queue record is unavailable. Refresh before acting.',
      actions: { add: false, edit: false, continue: false, retry: false },
    };
    return;
  }
  if (old && next && old.id !== next.id) retired.add(old.id);
  submitted = view;
}
const request = async (action: QueueAction) => {
  if (busy || !authoritative()) return;
  busy = true;
  announce('Saving the queue');
  emit();
  try {
    const response = await fetch('/api/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action,
        ...(action.kind === 'add' && chosenHost(submitted?.record) ? { agent: chosenHost(submitted?.record) } : {}),
      }),
      signal: AbortSignal.timeout(150_000),
    });
    if (!response.ok) throw new Error(((await response.json()) as { error: string }).error);
    accept((await response.json()) as QueueView);
    announce(action.kind === 'add' ? `#${action.number} is saved in the queue` : 'The queue is saved');
  } catch (error) {
    uncertain = true;
    toast('Queue action needs a refresh', {
      detail: error instanceof Error ? error.message : String(error),
      isError: true,
    });
    try {
      const response = await fetch('/api/queue', { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error('Queue state is unavailable');
      const view = (await response.json()) as QueueView;
      accept(view);
      uncertain = !view.actions.add && !view.actions.edit && !view.actions.continue && !view.actions.retry;
    } catch {
      uncertain = true;
    }
    announce('Check the saved queue before another attempt');
  } finally {
    busy = false;
    emit();
  }
};
const stateOf = () => {
  const record = submitted?.record;
  if (!record?.numbers.length) return 'empty';
  if (record.state === 'me-gate') return 'me-gate';
  if (record.state === 'error' || (submitted?.error && !submitted.owner)) return 'error';
  const observed = cards().some(
    (card) =>
      card.number === record.numbers[0] &&
      card.sessionId &&
      card.step === record.current?.step &&
      card.state !== null &&
      card.state !== 'starts',
  );
  return record.state === 'running' && observed ? 'running' : 'starting';
};
const hostAvailable = (host: string | null) => {
  const next = host ?? (board?.next?.kind === 'start' ? board.next.host : null);
  return next === null || (!!board && knownAgent(board.registry, next) && board.agents?.[next]?.available === true);
};

function emit(): void {
  if (!board) return;
  shellStore.setInputs({ queueCount: submitted?.record?.numbers.length ?? 0 });
  snapshot = {
    board,
    submitted,
    agent,
    isBusy: busy,
    isUncertain: uncertain,
    state: stateOf(),
    isAuthoritative: authoritative(),
    chosen: chosenHost(submitted?.record),
    available: available(),
  };
  for (const listener of listeners) listener();
}

function update(next: Board): void {
  board = next;
  const before = submitted?.record?.numbers.length;
  if (board.queue) {
    accept(board.queue);
    if (!board.source.error && Object.values(board.queue.actions).some(Boolean)) uncertain = false;
  }
  emit();
  if (before !== undefined && submitted?.record && before > submitted.record.numbers.length)
    announce(`${submitted.record.numbers.length} issues remain in the queue`);
}

export const queueStore = {
  get: (): QueueState => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  update,
  act: request,
  expected,
  setAgent: (value: string) => {
    agent = value;
    emit();
  },
  hostAvailable,
  find,
  refresh: (): Promise<void> => shellStore.handlers().readAgain(),
};

export const useQueue = <T>(select: (state: QueueState) => T): T =>
  useSyncExternalStore(queueStore.subscribe, () => select(snapshot));
