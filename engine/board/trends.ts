import { appendSample, hourlySeries, pruneTrends, readSamples } from '../lib/board-read/board-read.ts';
import type { DeliveryWindow, Sample, Trends } from '../lib/board-read/types.ts';
import { firstLine } from './requests.ts';

const SAMPLE_MS = 300_000;
const PRUNE_MS = 86_400_000;
const READ_LIMIT_MS = 60_000;
const STALE_MS = 3_600_000;

const lineOf = (cause: unknown) => firstLine(cause instanceof Error ? cause.message : String(cause));

export const createTrends = ({
  common,
  count,
  head,
  readDelivery,
  now,
}: {
  common: string;
  count: () => Promise<{ needs: number; working: number } | null>;
  head: () => string | null;
  readDelivery: (signal: AbortSignal) => Promise<DeliveryWindow[]>;
  now: () => number;
}) => {
  let samples: Sample[] = [];
  let liveAt: string | null = null;
  let liveError: string | null = null;
  let windows: DeliveryWindow[] | null = null;
  let deliveryAt: string | null = null;
  let goodAt = Number.NEGATIVE_INFINITY;
  let startedAt: number | null = null;
  let deliveryError: string | null = null;
  let running: AbortController | null = null;
  let startedHead: string | null = null;
  let again = false;
  let stopped = false;
  let sampler: ReturnType<typeof setInterval> | undefined;
  let pruner: ReturnType<typeof setInterval> | undefined;

  const load = async () => {
    try {
      samples = await readSamples(common);
      liveAt = new Date(now()).toISOString();
      liveError = null;
    } catch (cause) {
      liveError = lineOf(cause) || 'the sample read failed';
    }
  };

  const startRead = () => {
    const limit = new AbortController();
    running = limit;
    startedAt = now();
    startedHead = head();
    again = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      limit.abort();
    }, READ_LIMIT_MS);
    Promise.resolve()
      .then(() => readDelivery(limit.signal))
      .then(
        (next) => {
          if (stopped) return;
          windows = next;
          goodAt = now();
          deliveryAt = new Date(goodAt).toISOString();
          deliveryError = null;
        },
        (cause) => {
          if (stopped) return;
          deliveryError = timedOut
            ? 'the trend read did not end in 60 seconds'
            : lineOf(cause) || 'the trend read failed';
        },
      )
      .finally(() => {
        clearTimeout(timer);
        running = null;
        if (!stopped && again) startRead();
      });
  };

  // After a failed read the hour counts from its start, so a failing read runs at most once an hour.
  const stale = () => startedAt !== null && now() - Math.max(goodAt, startedAt) > STALE_MS;

  const checkRead = () => {
    const current = head();
    if (stopped) return;
    if (current !== null && current !== startedHead) {
      // The start read begins before the first document, so it adopts that document's head.
      if (running && startedHead === null) startedHead = current;
      else if (running) again = true;
      else startRead();
    } else if (!running && stale()) startRead();
  };

  const sample = async () => {
    const counts = (await count().catch((cause) => {
      console.error(`board: trends: ${lineOf(cause)}`);
      return null;
    })) ?? { needs: null, working: null };
    if (stopped) return;
    try {
      await appendSample(common, { at: new Date(now()).toISOString(), ...counts });
    } catch (cause) {
      console.error(`board: trends: ${lineOf(cause)}`);
    }
    if (stopped) return;
    await load();
    checkRead();
  };

  const prune = () => pruneTrends(common, now()).catch((cause) => console.error(`board: trends: ${lineOf(cause)}`));

  return {
    start() {
      void prune().then(load);
      startRead();
      sampler = setInterval(() => void sample(), SAMPLE_MS);
      pruner = setInterval(() => void prune(), PRUNE_MS);
    },
    stop() {
      stopped = true;
      clearInterval(sampler);
      clearInterval(pruner);
      running?.abort();
    },
    view(): Trends {
      checkRead();
      return {
        live: {
          needs: hourlySeries(samples, now(), 'needs'),
          working: hourlySeries(samples, now(), 'working'),
          readAt: liveAt,
          error: liveError,
        },
        delivery: { windows, readAt: deliveryAt, error: deliveryError },
      };
    },
  };
};
