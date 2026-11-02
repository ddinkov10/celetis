import { isRecorded, lockHolder } from '../lib/locks.ts';
import { createOperation, locateCheckouts } from '../lib/operation.ts';
import { childEnv } from '../lib/process.ts';
import { readQueue } from '../lib/queue.ts';
import { reconcileQueue } from '../lib/queue-actions.ts';
import { github } from '../lib/tracker.ts';
import { defaultGate, lands, lanes, stageOf, stages, steps } from '../lib/workflow.ts';
import { jsonRow, nextBoard } from '../next-step.ts';
import { readHistory } from './history.ts';
import type { Document, Flow, Issue } from './types.ts';

export async function readBoard(main: string, signal: AbortSignal): Promise<Document> {
  return readDocument(main, signal);
}

export async function readBoardTargets(
  main: string,
  numbers: readonly number[],
  previous: Document,
  signal: AbortSignal,
): Promise<Document> {
  return readDocument(main, signal, { numbers, previous });
}

async function readDocument(
  main: string,
  signal: AbortSignal,
  target?: { numbers: readonly number[]; previous: Document },
): Promise<Document> {
  const operation = createOperation(await locateCheckouts(main), { environment: process.env.CELETIS_AGENT }, 'main');
  const { data, stderr } = await nextBoard(operation, signal, target?.numbers);
  if (!data) {
    signal.throwIfAborted();
    throw new Error(stderr.trim() || 'cannot read the issues from GitHub');
  }
  const history = !target || data.closed ? await readHistory(github(main, signal)) : target.previous.history;
  const common = operation.checkout.common as string;
  const flow: Flow = {
    lanes: Object.fromEntries(Object.entries(lanes).map(([lane, definition]) => [lane, [...definition.steps]])),
    stages: stages.map((stage) => ({ name: stage.name, steps: [...stage.steps] })),
    steps: Object.fromEntries(
      [...steps].sort().map((step) => [
        step,
        {
          gate: operation.mainConfig?.gates?.[step] ?? defaultGate,
          ...(lands(step) ? { hint: 'It lands the change when the build is done.' } : {}),
        },
      ]),
    ),
  };
  const issues: Issue[] = [];
  for (const row of data.rows) {
    const { line, state, closedAt: _closedAt, ...shown } = jsonRow(row);
    if (state === 'done') continue;
    const step = row.next.kind === 'run' ? row.next.step : null;
    const locked = !!(await lockHolder(main, `issue-${row.number}`));
    const stuck = await isRecorded(common, String(row.number), line);
    issues.push({
      ...shown,
      state,
      step,
      started: step !== null && stageOf(step) > 1,
      urgent: shown.type === 'hotfix',
      ...(locked
        ? { state: 'starting' }
        : state === 'dirty'
          ? {}
          : stuck
            ? {
                state: 'stuck',
                act: `celetis --agent <host> celetis-flow --resume ${row.number}`,
              }
            : {}),
    });
  }
  if (target) {
    const selected = new Set(target.numbers);
    issues.push(...target.previous.issues.filter((issue) => !selected.has(issue.number)));
    issues.sort((a, b) => a.number - b.number);
  }
  const runner = !!(await lockHolder(main, 'runner'));
  signal.throwIfAborted();
  const agents = Object.fromEntries(
    ['claude', 'codex'].map((agent) => {
      const available = !!Bun.which(agent, { PATH: childEnv().PATH });
      return [agent, { available, cause: available ? null : `celetis: ${agent} is not on PATH` }];
    }),
  );
  const queue = target ? await readQueue(common) : null;
  signal.throwIfAborted();
  const receipt =
    !target || queue?.numbers.some((number) => target.numbers.includes(number))
      ? await reconcileQueue(operation, signal)
      : { view: target.previous.queue, wake: null };
  signal.throwIfAborted();
  return {
    history,
    tracker: 'GitHub',
    agents,
    defaultAgent: operation.host,
    flow,
    noRun: data.noRun,
    runner,
    issues,
    queue: receipt.view,
    queueWake: receipt.wake,
  };
}
