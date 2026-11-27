import type { QueueView } from '../lib/queue/types.ts';
import { grammar } from '../lib/tracker/grammar.ts';
import { compareKeys, type IssueKey } from '../lib/tracker/key.ts';
import { firstLine } from './requests.ts';
import type { Document } from './types.ts';

const STALE_MS = 60_000;
const BACKGROUND_MS = 300_000;

export type Reads = {
  readonly document: Document | null;
  readonly readAt: string | null;
  readonly fullError: string | null;
  readonly checkedFrom: number;
  readonly pending: Promise<void> | null;
  readError(): string | null;
  revisions(): ReadonlyMap<IssueKey, string>;
  refresh(): Promise<void>;
  target(keys: Iterable<IssueKey>): void;
  setQueue(view: QueueView): void;
  beforeBoard(isLocal: boolean, isDue: (checkedFrom: number) => boolean): Promise<void>;
  start(): void;
  stop(): void;
};

export const createReads = ({
  read,
  readTargets,
  hints,
  revisions,
  now,
}: {
  read: (signal: AbortSignal) => Promise<Document>;
  readTargets: (keys: readonly IssueKey[], previous: Document, signal: AbortSignal) => Promise<Document>;
  hints: () => Promise<ReadonlyMap<string, IssueKey> | null>;
  revisions: (signal: AbortSignal) => Promise<ReadonlyMap<IssueKey, string>>;
  now: () => number;
}): Reads => {
  let board: Document | null = null;
  let readAt: string | null = null;
  let fullError: string | null = null;
  let targetError: string | null = null;
  const readError = () => targetError ?? fullError;
  let askedAt = -Infinity;
  let checkedFrom = -Infinity;
  let pending: Promise<void> | null = null;
  const targets = new Set<IssueKey>();
  let fullRequest: { promise: Promise<void>; done: () => void } | null = null;
  let fullQueued = false;
  let ready = false;
  let stopped = false;
  let activeRead: AbortController | null = null;
  let nextCheck: ReturnType<typeof setTimeout> | undefined;
  let nextHint: ReturnType<typeof setTimeout> | undefined;
  let seenHints = new Set<string>();
  let polled: ReadonlyMap<IssueKey, string> | null = null;
  let pollFailing = false;

  const readData = async (full: boolean, numbers: IssueKey[]) => {
    const from = now();
    const limit = new AbortController();
    activeRead = limit;
    const timer = setTimeout(() => limit.abort(), STALE_MS);
    // Some steps of the read (the lock reads, locateCheckouts) do not take the signal.
    const ended = new Promise<never>((_, reject) => limit.signal.addEventListener('abort', reject, { once: true }));
    try {
      const next = await Promise.race([
        full ? read(limit.signal) : readTargets(numbers, board as Document, limit.signal),
        ended,
      ]);
      if (stopped) return;
      if (
        board?.queue?.record &&
        next.queue?.record?.id === board.queue.record.id &&
        next.queue.record.revision < board.queue.record.revision
      )
        next.queue = board.queue;
      board = next;
      targetError = null;
      if (full) {
        readAt = new Date(now()).toISOString();
        fullError = null;
      }
    } catch (cause) {
      if (stopped) return;
      const error = limit.signal.aborted
        ? 'the issue read did not end in 60 seconds'
        : firstLine(cause instanceof Error ? cause.message : String(cause)) || 'the issue read failed';
      if (full) {
        fullError = error;
        for (const number of numbers) targets.add(number);
      } else targetError = error;
    } finally {
      clearTimeout(timer);
      activeRead = null;
      if (full) checkedFrom = from;
    }
  };

  const drain = () => {
    if (stopped || !ready || pending || (!fullQueued && (!board || targets.size === 0))) return;
    const full = fullQueued;
    if (full) {
      fullQueued = false;
      askedAt = now();
      clearTimeout(nextCheck);
      nextCheck = setTimeout(check, BACKGROUND_MS);
    }
    const numbers = [...targets].sort(compareKeys);
    targets.clear();
    pending = readData(full, numbers).finally(() => {
      pending = null;
      if (full) {
        fullRequest?.done();
        fullRequest = null;
      }
      drain();
    });
  };

  const refresh = () => {
    if (stopped) return Promise.resolve();
    if (!fullRequest) {
      let done = () => {};
      const promise = new Promise<void>((resolve) => {
        done = resolve;
      });
      fullRequest = { promise, done };
      fullQueued = true;
    }
    const request = fullRequest.promise;
    drain();
    return request;
  };

  const target = (numbers: Iterable<IssueKey>) => {
    if (stopped) return;
    const received = [...numbers];
    if (!received.length) return;
    for (const number of received) targets.add(number);
    if (!board) void refresh();
    else drain();
  };

  const check = () => {
    if (stopped) return;
    if (now() - askedAt >= BACKGROUND_MS) void refresh();
    else nextCheck = setTimeout(check, askedAt + BACKGROUND_MS - now());
  };
  const pollRevisions = async () => {
    try {
      const next = await revisions(AbortSignal.timeout(10_000));
      if (stopped) return;
      if (polled) {
        const last = polled;
        target(new Set([...last.keys(), ...next.keys()].filter((key) => last.get(key) !== next.get(key))));
      }
      polled = next;
      pollFailing = false;
    } catch (cause) {
      if (stopped || pollFailing) return;
      pollFailing = true;
      console.error(`board: the ref poll failed: ${firstLine(cause instanceof Error ? cause.message : String(cause))}`);
    }
  };
  const pollHints = async (initial = false) => {
    const listed = await hints();
    if (stopped) return;
    if (listed !== null) {
      const numbers = [...listed].filter(([name]) => !seenHints.has(name)).map(([, number]) => number);
      seenHints = new Set(listed.keys());
      if (!initial) target(numbers);
    }
    if (grammar().kind === 'local') await pollRevisions();
    if (initial) {
      ready = true;
      void refresh();
    }
    if (!stopped) nextHint = setTimeout(() => void pollHints(), 1_000);
  };
  const stopReads = () => {
    stopped = true;
    clearTimeout(nextCheck);
    clearTimeout(nextHint);
    activeRead?.abort();
    fullRequest?.done();
  };
  return {
    get document() {
      return board;
    },
    get readAt() {
      return readAt;
    },
    get fullError() {
      return fullError;
    },
    get checkedFrom() {
      return checkedFrom;
    },
    get pending() {
      return pending;
    },
    readError,
    revisions: () => polled ?? new Map(),
    refresh,
    target,
    setQueue: (view) => {
      if (board) board.queue = view;
    },
    beforeBoard: async (isLocal, isDue) => {
      if (!isLocal && now() - askedAt > BACKGROUND_MS) void refresh();
      if (!board && !readError() && pending) await pending;
      if (!isLocal && isDue(checkedFrom)) await refresh();
    },
    start: () => void pollHints(true),
    stop: stopReads,
  };
};
