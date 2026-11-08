import { realpath } from 'node:fs/promises';
import { readAgentOrder } from '../lib/agent-order.ts';
import { activeBlock, readUsage, selectAgent } from '../lib/agent-usage.ts';
import type { AgentDecision, AgentOrder, Host, UsageBlock } from '../lib/config-core.ts';
import { levels } from '../lib/effort.ts';
import { commonDir } from '../lib/host.ts';
import { isRecorded, lockHolder } from '../lib/locks.ts';
import { createOperation, locateCheckouts } from '../lib/operation.ts';
import { childEnv } from '../lib/process.ts';
import { readQueue, readQueueView } from '../lib/queue.ts';
import type { QueueView } from '../lib/queue-types.ts';
import { listRecoveries, recoveryOwner } from '../lib/quota-recovery.ts';
import { github } from '../lib/tracker.ts';
import { defaultGate, lands, lanes, stageOf, stages, steps } from '../lib/workflow.ts';
import { jsonRow, nextBoard } from '../next-step.ts';
import { readHistory } from './history.ts';
import type { Document, Flow, Issue, QuotaState } from './types.ts';

type Reconcile = () => Promise<QueueView>;

// Half of the 60-second read limit of the server, which leaves time for the read-view fallback.
const RECONCILE_MS = 30_000;

const reconciled = (reconcile: Reconcile, signal: AbortSignal) =>
  new Promise<QueueView>((resolve, reject) => {
    signal.throwIfAborted();
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    reconcile().then(resolve, reject);
  });

export async function readBoard(main: string, reconcile: Reconcile, signal: AbortSignal): Promise<Document> {
  return readDocument(main, reconcile, signal);
}

export async function readBoardTargets(
  main: string,
  reconcile: Reconcile,
  numbers: readonly number[],
  previous: Document,
  signal: AbortSignal,
): Promise<Document> {
  return readDocument(main, reconcile, signal, { numbers, previous });
}

async function readDocument(
  main: string,
  reconcile: Reconcile,
  signal: AbortSignal,
  target?: { numbers: readonly number[]; previous: Document },
): Promise<Document> {
  const operation = await createOperation(await locateCheckouts(main), {}, 'main');
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
    levels: [...levels],
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
                act: `celetis --agent <host> run resume ${row.number}`,
              }
            : {}),
    });
  }
  if (target) {
    const selected = new Set(target.numbers);
    issues.push(...target.previous.issues.filter((issue) => !selected.has(issue.number)));
    issues.sort((a, b) => a.number - b.number);
  }
  signal.throwIfAborted();
  const agents = Object.fromEntries(
    ['claude', 'codex'].map((agent) => {
      const available = !!Bun.which(agent, { PATH: childEnv().PATH });
      return [agent, { available, cause: available ? null : `celetis: ${agent} is not on PATH` }];
    }),
  );
  const queue = target ? await readQueue(main, common) : null;
  signal.throwIfAborted();
  const view =
    !target || queue?.numbers.some((number) => target.numbers.includes(number))
      ? await reconciled(reconcile, AbortSignal.any([signal, AbortSignal.timeout(RECONCILE_MS)])).catch(() =>
          readQueueView(operation, signal),
        )
      : target.previous.queue;
  signal.throwIfAborted();
  return {
    history,
    tracker: 'GitHub',
    agents,
    flow,
    noRun: data.noRun,
    issues,
    queue: view,
  };
}

export type AgentState = Readonly<{
  order: AgentOrder;
  usage: Record<Host, UsageBlock | null>;
  next: AgentDecision;
  quota: ReadonlyMap<number, QuotaState>;
}>;

export async function readAgentState(main: string, now: number): Promise<AgentState> {
  const common = await realpath(await commonDir(main));
  const order = await readAgentOrder(common);
  const records = await readUsage(common);
  const quota = new Map<number, QuotaState>();
  for (const record of await listRecoveries(main)) {
    if (!(await recoveryOwner(record))) quota.set(record.issue, { kind: 'orphaned' });
    else if (record.state === 'waiting' && record.waitId)
      quota.set(record.issue, {
        kind: 'waiting',
        wait: { number: record.issue, waitId: record.waitId, nextResetAt: record.nextResetAt },
      });
  }
  return {
    order,
    usage: { claude: activeBlock(records, 'claude', now), codex: activeBlock(records, 'codex', now) },
    next: selectAgent({ kind: 'default' }, order.order, records, now, new Set(), false),
    quota,
  };
}
