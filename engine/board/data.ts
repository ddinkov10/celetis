import { isRecorded, lockHolder } from '../lib/locks.ts';
import { createOperation, locateCheckouts } from '../lib/operation.ts';
import { childEnv } from '../lib/process.ts';
import { reconcileQueue } from '../lib/queue-actions.ts';
import { github } from '../lib/tracker.ts';
import { defaultGate, lands, lanes, stageOf, stages, steps } from '../lib/workflow.ts';
import { jsonRow, nextBoard } from '../next-step.ts';
import { readHistory } from './history.ts';
import type { Document, Flow, Issue } from './types.ts';

export async function readBoard(main: string, signal: AbortSignal): Promise<Document> {
  const operation = createOperation(await locateCheckouts(main), { environment: process.env.CELETIS_AGENT }, 'main');
  const { data, stderr } = await nextBoard(operation, signal);
  if (!data) {
    signal.throwIfAborted();
    throw new Error(stderr.trim() || 'cannot read the issues from GitHub');
  }
  const history = await readHistory(github(main, signal));
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
  const runner = !!(await lockHolder(main, 'runner'));
  signal.throwIfAborted();
  const agents = Object.fromEntries(
    ['claude', 'codex'].map((agent) => {
      const available = !!Bun.which(agent, { PATH: childEnv().PATH });
      return [agent, { available, cause: available ? null : `celetis: ${agent} is not on PATH` }];
    }),
  );
  const receipt = await reconcileQueue(operation, signal);
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
