import { resolve } from 'node:path';
import { AgentOrderConflict } from '../lib/agent-order.ts';
import { commonDir, isInside, readAgentState } from '../lib/board-read.ts';
import type { AgentChoice, AgentOrder, Host } from '../lib/config-core.ts';
import type { DaemonStatus } from '../lib/daemon-types.ts';
import type { Level } from '../lib/effort.ts';
import { hostAvailability } from '../lib/host.ts';
import { isHost } from '../lib/host-names.ts';
import { requireQueueChoice } from '../lib/queue.ts';
import type { QueueAction, QueueView } from '../lib/queue-types.ts';
import { type Exec, focusTerminal, listTerminals, type OpenTab, openTab as openTerminalTab } from '../lib/terminal.ts';
import { visualLink } from '../lib/visual.ts';
import type { Adapter } from './adapter.ts';
import { agentCause, type LaunchFeedback, launchMatches, type Placer, type PressView, type place } from './place.ts';
import type { Reads } from './reads.ts';
import { cleanCause, Refusal, refused } from './requests.ts';
import type { Board, Card, Document, IssueRow } from './types.ts';

const PRESS_MS = 30_000;
type Press = { feedback: LaunchFeedback; at: number };

export type PressBook = PressView & {
  hasDuePress(checkedFrom: number): boolean;
  readonly presses: Record<string, Press>;
  readonly pressRuns: Map<number, { run: string; press: Press; since: number }>;
  readonly operations: Record<string, { step: string | null | undefined; observed: boolean }>;
  readonly visualPresses: Set<number>;
  readonly daemonReads: number;
  queuePress: boolean;
  intakePending: boolean;
};
export type Presses = {
  intake(): Promise<void>;
  assist(number: number): Promise<void>;
  visual(number: number): Promise<void>;
  run(number: number, agent?: Host, effort?: Level): Promise<void>;
  retry(number: number, waitId: string): Promise<void>;
  resume(number: number): Promise<void>;
  shell(number: number): Promise<void>;
  go(sessionId: string): Promise<void>;
  queue(action: QueueAction, choice: AgentChoice): Promise<QueueView>;
  replaceOrder(order: readonly Host[], expectedVersion: string): Promise<AgentOrder>;
};

export const createPressBook = ({
  now,
  target,
}: {
  now: () => number;
  target: (numbers: Iterable<number>) => void;
}): PressBook => {
  const visualPresses = new Set<number>();
  const presses: Record<string, Press> = {};
  const pressRuns = new Map<number, { run: string; press: Press; since: number }>();
  let daemonReads = 0;
  const operations: Record<string, { step: string | null | undefined; observed: boolean }> = {};

  const followPresses = (status: DaemonStatus, read: number, busy: ReadonlySet<number | null>) => {
    for (const [number, record] of pressRuns) {
      if (read <= record.since) continue;
      record.since = read;
      const { press, run } = record;
      const step = press.feedback.step;
      const fail = (warning: string) => {
        press.feedback = { step, kind: 'failed', warning };
        pressRuns.delete(number);
        target([number]);
      };
      if (busy.has(number)) {
        pressRuns.delete(number);
        continue;
      }
      const row = status.runs.find((row) => row.id === run);
      if (!row) fail(`The daemon PID ${status.daemon.pid} has no run ${run.slice(0, 8)} of this press.`);
      else if (row.session !== null) {
        pressRuns.delete(number);
        delete presses[number];
      } else if (row.outcome)
        fail(
          cleanCause(
            row.outcome.reason ||
              row.line ||
              `The run ${run.slice(0, 8)} ended with code ${row.outcome.code} before a session.`,
          ),
        );
      else press.feedback = { step, kind: 'pending' };
    }
  };

  const launchesOf = (
    issues: readonly IssueRow[] | undefined,
    busy: ReadonlySet<number | null>,
    checkedFrom: number,
  ): Record<string, LaunchFeedback> => {
    const launches: Parameters<typeof place>[0]['launches'] = {};
    for (const number of new Set([...Object.keys(presses), ...Object.keys(operations)])) {
      const operation = operations[number];
      const active = operation?.step !== undefined;
      const evidence = active ? operation : presses[number]?.feedback;
      if (!evidence || evidence.step === undefined) continue;
      const issue = issues?.find((issue) => issue.number === Number(number));
      if (busy.has(Number(number)) || !launchMatches(issue, evidence.step)) {
        delete presses[number];
        if (active) operation.observed = true;
      }
      const press = presses[number];
      if (active ? !operation.observed : press) {
        launches[number] = active ? { step: evidence.step, kind: 'pending' } : (press as Press).feedback;
        if (press?.feedback.kind === 'timed')
          launches[number] = { ...press.feedback, expired: checkedFrom >= press.at + PRESS_MS };
      }
    }
    return launches;
  };

  const hasDuePress = (checkedFrom: number) => {
    const isDue = (press: { at: number }) => now() - press.at >= PRESS_MS && checkedFrom < press.at + PRESS_MS;
    return Object.values(presses).some((press) => press.feedback.kind === 'timed' && isDue(press));
  };

  return {
    presses,
    pressRuns,
    operations,
    visualPresses,
    get daemonReads() {
      return daemonReads;
    },
    queuePress: false,
    intakePending: false,
    nextRead: () => ++daemonReads,
    follow: followPresses,
    launches: launchesOf,
    isVisualPressed: (number) => visualPresses.has(number),
    hasDuePress,
  };
};

export const createPresses = ({
  main,
  reads,
  book,
  placer,
  adapter,
  exec,
  now,
}: {
  main: string;
  reads: Reads;
  book: PressBook;
  placer: Placer;
  adapter: Adapter;
  exec: Exec;
  now: () => number;
}): Presses => {
  const { readError, refresh } = reads;
  const { placement, queueView, readSessions, visualOf } = placer;
  const { operations, pressRuns, presses, visualPresses } = book;

  const openTab = async (request: Omit<OpenTab, 'repository' | 'keepShell'>) =>
    openTerminalTab({ repository: { main, common: await commonDir(main) }, keepShell: false, ...request }, exec).catch(
      refused,
    );

  const started = async (request: () => Promise<string>) => {
    try {
      return await request();
    } catch (cause) {
      throw new Refusal(409, cleanCause(cause instanceof Error ? cause.message : cause));
    }
  };

  const issueCardOf = async (number: number) =>
    Object.values((await placement()).columns)
      .flat()
      .find((c) => c.sessionId === null && c.number === number);

  const press = async (
    number: number,
    refusal: string,
    prepare: () => Promise<{ card: Card; start: () => Promise<string | undefined> }>,
  ) => {
    if (
      number in operations ||
      pressRuns.has(number) ||
      (presses[number]?.feedback.kind === 'timed' && now() - presses[number].at < PRESS_MS)
    )
      throw new Refusal(409, refusal);
    const operation: { step: string | null | undefined; observed: boolean } = { step: undefined, observed: false };
    operations[number] = operation;
    try {
      const { card, start } = await prepare();
      operation.step = card.step;
      delete presses[number];
      const run = await start();
      const step = operation.step;
      const press: Press = {
        feedback: run === undefined ? { step, kind: 'timed', expired: false } : { step, kind: 'pending' },
        at: now(),
      };
      if (run !== undefined) pressRuns.set(number, { run, press, since: book.daemonReads });
      if (!operation.observed) presses[number] = press;
    } finally {
      delete operations[number];
    }
    await refresh();
  };

  const choose = async (choice: unknown, unknown: string, work: 'run' | 'session'): Promise<AgentChoice> => {
    const available = (host: Host) => {
      const availability = hostAvailability(host);
      if (!availability.available) throw new Refusal(409, availability.cause);
    };
    if (choice !== undefined && choice !== null) {
      if (!isHost(choice)) throw new Refusal(409, unknown);
      available(choice);
      return { kind: 'explicit', host: choice };
    }
    const { next } = await readAgentState(main, now()).catch((cause: Error) => {
      throw new Refusal(409, agentCause(cause));
    });
    if (next.kind === 'start') available(next.host);
    else if (work === 'session')
      throw new Refusal(
        409,
        cleanCause(
          `every included agent reached a usage limit (${next.blocked.map((block) => `${block.host}: ${block.reason}`).join('; ')}); change the agent order or wait for a reset`,
        ),
      );
    return { kind: 'default' };
  };

  const intake = async () => {
    if (book.intakePending) throw new Refusal(409, 'an intake tab is already opening');
    book.intakePending = true;
    try {
      const choice = await choose(null, 'intake has no agent to run with', 'session');
      const argv = await adapter.intake(choice).catch((cause: Error) => {
        throw new Refusal(409, cleanCause(cause.message));
      });
      await openTab({ folder: main, name: 'Intake', argv, focus: true });
    } finally {
      book.intakePending = false;
    }
  };

  const assist = async (number: number) => {
    const refusal = `#${number} has no blocked issue to assist now`;
    await press(number, refusal, async () => {
      await reads.pending;
      await refresh();
      if (readError()) throw new Refusal(409, cleanCause(readError()));
      let observed: Document | null;
      let current: Board;
      do {
        observed = reads.document;
        current = await placement();
      } while (reads.document !== observed);
      if (readError()) throw new Refusal(409, cleanCause(readError()));
      if (reads.document?.noRun) throw new Refusal(409, cleanCause(reads.document.noRun));
      const choice = await choose(null, `#${number} has no agent to run with`, 'session');
      if (!current.terminal.ok) throw new Refusal(502, current.terminal.error ?? 'hc gave no terminal list');
      const cards = Object.values(current.columns).flat();
      const card = cards.find((card) => card.sessionId === null && card.number === number);
      if (!card) {
        throw new Refusal(
          409,
          cards.some((card) => card.number === number)
            ? `#${number} already has a session; use Go`
            : `#${number} is not on the board`,
        );
      }
      if (card.state !== 'blocked' || !card.assist || current.noRun !== null)
        throw new Refusal(409, current.noRun ?? `#${number} is ${card.state ?? 'ready'}; ${refusal}`);
      return {
        card,
        start: async () => {
          const argv = await adapter.assist(number, choice).catch((cause: Error) => {
            throw new Refusal(409, cleanCause(cause.message));
          });
          await openTab({ folder: main, name: `#${number} assist`, argv, focus: true });
        },
      };
    });
  };

  const visual = async (number: number) => {
    if (visualPresses.has(number)) throw new Refusal(409, `a Make visual press of #${number} is in flight`);
    visualPresses.add(number);
    try {
      const row = reads.document?.history.entries.find((entry) => entry.number === number);
      if (!row) throw new Refusal(409, `#${number} has no row in History`);
      const state = await visualOf(row, await listTerminals(exec).catch(refused), false);
      if (state === 'ready') throw new Refusal(409, `#${number} already has a visual; use Open visual`);
      if (state === 'making') throw new Refusal(409, `the tab ${visualLink(number)} is still open`);
      const choice = await choose(null, `#${number} has no agent to run with`, 'session');
      const argv = await adapter.visual(number, row.sha, choice).catch((cause: Error) => {
        throw new Refusal(409, cleanCause(cause.message));
      });
      await openTab({ folder: main, name: visualLink(number), argv, focus: true });
    } finally {
      visualPresses.delete(number);
    }
  };

  const runStep = async (number: number, choice?: Host, effort?: Level) => {
    const refusal = `#${number} has no step to start now`;
    return press(number, refusal, async () => {
      await reads.pending;
      await refresh();
      if (!reads.document || readError() || reads.document.noRun !== null)
        throw new Refusal(409, readError() || reads.document?.noRun || refusal);
      const card = await issueCardOf(number);
      if (!card?.run) throw new Refusal(409, refusal);
      const view = await queueView();
      if (readError() || !view || (view.error && !view.next))
        throw new Refusal(409, readError() || view?.error || 'queue: no successful initial read');
      const record = view.record;
      if (record?.state === 'me-gate' && record.numbers[0] === number && record.choice) {
        if (effort) throw new Refusal(409, 'The queue starts this step at the start pair, with no override');
        if (isHost(choice)) {
          try {
            requireQueueChoice(record.choice, { kind: 'explicit', host: choice });
          } catch (cause) {
            throw new Refusal(409, (cause as Error).message);
          }
        }
        if (!view.actions.continue || view.next?.kind !== 'run' || view.next.step !== card.step)
          throw new Refusal(409, 'queue: that action is not available; refresh the queue');
        const action: QueueAction = {
          kind: 'continue',
          expected: { id: record.id, revision: record.revision, current: number },
          step: view.next.step,
        };
        return {
          card,
          start: async () => {
            await queue(action);
          },
        };
      }
      const agent = await choose(choice, `#${number} has no agent "${String(choice)}"`, 'run');
      return {
        card,
        start: () => started(() => adapter.run(number, agent, effort)),
      };
    });
  };

  const resume = async (number: number) => {
    const refusal = `#${number} has no session to resume now`;
    return press(number, refusal, async () => {
      const card = await issueCardOf(number);
      if (!card?.resume) throw new Refusal(409, refusal);
      return {
        card,
        start: () => started(() => adapter.resume(number)),
      };
    });
  };

  const queue = async (action: QueueAction, requested: AgentChoice = { kind: 'default' }): Promise<QueueView> => {
    if (book.queuePress) throw new Refusal(409, 'queue: another press is active');
    book.queuePress = true;
    try {
      const view = await adapter
        .queue(action, action.kind === 'add' ? requested : { kind: 'default' })
        .catch((cause: Error) => {
          throw new Refusal(409, cleanCause(cause.message));
        });
      reads.setQueue(view);
      return view;
    } finally {
      book.queuePress = false;
    }
  };

  const retryQuota = async (number: number, waitId: string) => {
    await adapter.retryQuota(number, waitId).catch((cause: Error) => {
      throw new Refusal(409, cleanCause(cause.message));
    });
  };

  const replaceOrder = async (order: readonly Host[], expectedVersion: string) => {
    try {
      return await adapter.replaceAgentOrder(order, expectedVersion);
    } catch (cause) {
      if (cause instanceof AgentOrderConflict) throw cause;
      throw new Refusal(409, agentCause(cause));
    }
  };

  const shell = async (number: number) => {
    const card = await issueCardOf(number);
    if (card?.state !== 'dirty-tree' || !isInside(main, card.act) || resolve(card.act) === main)
      throw new Refusal(409, `#${number} has no dirty worktree`);
    await openTab({ folder: resolve(card.act), name: `#${number} shell`, argv: null, focus: true });
  };

  const go = async (sessionId: string) => {
    if (!(await readSessions()).some((session) => session.sessionId === sessionId))
      throw new Refusal(404, 'no herdr agent of this repository has that id');
    await focusTerminal(sessionId, exec).catch(refused);
  };

  return { intake, assist, visual, run: runStep, retry: retryQuota, resume, shell, go, queue, replaceOrder };
};
