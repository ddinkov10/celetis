import { constants } from 'node:os';
import { HostError } from '../command/errors.ts';
import { exits, signalExit } from '../contract/contract.ts';
import { described, type LandingEnd, lockedLanding } from '../landing/landing.ts';
import { recordEvent } from '../state/events.ts';
import { createLockOwner } from '../state/locks.ts';
import type { IssueKey } from '../tracker/key.ts';
import type { DaemonRequest, LandingRow } from './types.ts';

// One latin1 character per written byte; `own` is false for the wait line and the suite output that streamBun forwards.
export type Sink = (stream: 'out' | 'err', text: string, own: boolean) => void;
type LandRequest = Extract<DaemonRequest, { kind: 'land' }>;
type Context = Readonly<{
  main: string;
  start: string;
  pid: number;
  enter<T>(issue: IssueKey, sink: Sink, work: () => T): T;
}>;
export type Landings = Readonly<{
  answer(request: LandRequest, signal: AbortSignal): Response;
  rows(): LandingRow[];
  stop(): Promise<void>;
}>;
type Place = LandingRow & { abort: AbortController; first: PromiseWithResolvers<void>; reason: HostError | null };
type Running = { place: Place; done: Promise<void> };

const heartbeat = 5_000;
const drain = 5_000;
const encoder = new TextEncoder();
const aborted = () => new HostError('', signalExit(constants.signals.SIGTERM));
const stopped = (issue: IssueKey) =>
  new HostError(`the daemon stops; start it again, then run celetis --agent <host> land ${issue} again`, exits.blocked);
const aborts = (signal: AbortSignal) =>
  new Promise<void>((resolve) =>
    signal.aborted ? resolve() : signal.addEventListener('abort', () => resolve(), { once: true }),
  );
const abortWith = (place: Place, reason: HostError) => {
  place.reason ??= reason;
  place.abort.abort(reason);
};

export function createLandings(context: Context): Landings {
  const running = new Set<Running>();
  const line: Place[] = [];
  const leave = (place: Place) => {
    line.splice(line.indexOf(place), 1);
    line[0]?.first.resolve();
  };

  return {
    answer(request, signal) {
      const ahead = line[0];
      const place: Place = {
        issue: request.number,
        state: ahead ? 'waits' : 'runs',
        changedMs: Date.now(),
        abort: new AbortController(),
        first: Promise.withResolvers<void>(),
        reason: null,
      };
      let stream: ReadableStreamDefaultController<Uint8Array> | null = null;
      let last = '';
      const push = (value: string) => {
        try {
          stream?.enqueue(encoder.encode(value));
        } catch {
          stream = null;
        }
      };
      const away = Promise.withResolvers<void>();
      const gone = () => {
        stream = null;
        abortWith(place, aborted());
        away.resolve();
      };
      const sink: Sink = (kind, text, own) => {
        if (own) for (const line of text.split('\n')) if (line.startsWith('land: ')) last = line;
        push(`${JSON.stringify(kind === 'out' ? { out: text } : { err: text })}\n`);
      };
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          stream = controller;
        },
        cancel: gone,
      });
      if (signal.aborted) gone();
      else signal.addEventListener('abort', gone, { once: true });
      push('\n');
      const beat = setInterval(() => push('\n'), heartbeat);
      if (!ahead) place.first.resolve();
      line.push(place);
      if (ahead)
        context.enter(
          request.number,
          (kind, text) => sink(kind, text, false),
          () =>
            console.log(
              `land: #${place.issue} waits for the landing of #${ahead.issue} in the daemon PID ${context.pid}`,
            ),
        );
      const entry: Running = { place, done: Promise.resolve() };
      const settle = async () => {
        let end: LandingEnd;
        try {
          await Promise.race([place.first.promise, aborts(place.abort.signal)]);
          const { reason } = place;
          if (reason) {
            if (reason.code === exits.blocked)
              context.enter(request.number, sink, () => console.error(`land: blocked: ${reason.message}`));
            end = { status: reason.code, defect: null };
          } else {
            place.state = 'runs';
            place.changedMs = Date.now();
            end = await context.enter(request.number, sink, () =>
              lockedLanding(request, context.main, createLockOwner(context.main, context.start), place.abort.signal),
            );
          }
        } catch (error) {
          end = { status: exits.internal, defect: { error } };
        }
        leave(place);
        clearInterval(beat);
        push(`${JSON.stringify({ code: end.status })}\n`);
        if (end.status !== exits.done)
          recordEvent(
            end.defect
              ? {
                  name: 'land-defect',
                  message: described(end.defect.error),
                  issue: request.number,
                  code: end.status,
                  error: end.defect.error,
                }
              : {
                  name: 'land-exit',
                  message: Buffer.from(last, 'latin1').toString('utf8'),
                  issue: request.number,
                  code: end.status,
                },
          );
        // Open until the client leaves: a stop of the daemon then removes the socket after the client exits.
        const timer = setTimeout(away.resolve, drain);
        await away.promise;
        clearTimeout(timer);
        signal.removeEventListener('abort', gone);
        try {
          stream?.close();
        } catch {}
        running.delete(entry);
      };
      running.add(entry);
      entry.done = settle();
      return new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
    },
    rows: () => line.map(({ issue, state, changedMs }) => ({ issue, state, changedMs })),
    async stop() {
      for (const { place } of running) abortWith(place, place.state === 'waits' ? stopped(place.issue) : aborted());
      await Promise.all([...running].map(({ done }) => done));
    },
  };
}
