import { readdir, readFile, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { effectiveOrder, readAgentOrder } from './agent-order.ts';
import { activeBlock, readUsage, selectAgent } from './agent-usage.ts';
import type { Diff, Document, Flow, History, LandedIssue, QuotaState } from './board-read-types.ts';
import type { AgentDecision, AgentOrder, Host, UsageBlock } from './config-core.ts';
import { levels } from './effort.ts';
import { commit, isCommit } from './fields.ts';
import { commonDir } from './git.ts';
import { hostAvailability } from './host.ts';
import { hosts } from './host-names.ts';
import { capableOrder } from './hosts.ts';
import { createOperation, locateCheckouts } from './operation.ts';
import { queueOwner, queueView, readQueue, readQueueView } from './queue.ts';
import type { QueueRecord, QueueView } from './queue-types.ts';
import { listRecoveries, recoveryOwner } from './quota-recovery.ts';
import { nextBoard } from './resolver.ts';
import { laneFolder } from './state.ts';
import { readStepEnd, type StepEndRecord } from './step-end.ts';
import type { Exec } from './terminal.ts';
import { type GitHub, github, type Issue, parseIssue } from './tracker.ts';
import { hasPage, visualPage } from './visual.ts';
import { defaultGate, lands, lanes, stages, steps } from './workflow.ts';

export { commonDir } from './git.ts';
export { readRefreshHints } from './refresh-hints.ts';

export type Reconcile = () => Promise<QueueView>;

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
          agent: operation.mainConfig?.agents?.[step] ?? null,
          ...(lands(step) ? { hint: 'It lands the change when the build is done.' } : {}),
        },
      ]),
    ),
    levels: [...levels],
  };
  const issues = [...data.rows];
  if (target) {
    const selected = new Set(target.numbers);
    issues.push(...target.previous.issues.filter((issue) => !selected.has(issue.number)));
    issues.sort((a, b) => a.number - b.number);
  }
  signal.throwIfAborted();
  const agents = Object.fromEntries(
    hosts.map((agent) => {
      const availability = hostAvailability(agent);
      return [agent, { available: availability.available, cause: availability.available ? null : availability.cause }];
    }),
  ) as Document['agents'];
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

function malformed(): never {
  throw new Error('malformed GitHub history');
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) malformed();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string') malformed();
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) malformed();
  return value;
}

function identity(value: unknown): string {
  const sha = text(value);
  if (!commit.test(sha)) malformed();
  return sha;
}

function date(value: unknown): string {
  const at = text(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(at) ||
    !Number.isFinite(Date.parse(at))
  )
    malformed();
  return at;
}

function link(value: unknown): string {
  const href = text(value);
  if (/[\u0000-\u0020\u007f-\u009f]/.test(href)) malformed();
  const url = new URL(href);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) malformed();
  return url.href;
}

const laneHead = new RegExp(
  `^(?:${Object.values(lanes)
    .map(({ prefix }) => prefix)
    .join('|')})/([1-9][0-9]*)-[a-z0-9][a-z0-9-]*$`,
);

async function readHistory(gh: Pick<GitHub, 'api' | 'list'>): Promise<History> {
  const repo = record(await gh.api(''));
  const trunk = text(repo.default_branch);
  const name = text(repo.full_name);
  if (!trunk || !/^[^/\s]+\/[^/\s]+$/.test(name)) malformed();
  const url = `${link(repo.html_url).replace(/\/$/, '')}/commits/${encodeURIComponent(trunk)}`;
  const heads = array(await gh.api(`commits?sha=${encodeURIComponent(trunk)}&per_page=1`));
  const head = identity(record(heads[0]).sha);
  const entries: LandedIssue[] = [];
  const seen = new Set<number>();
  const issues = new Map<number, Issue>();

  async function issueOf(n: number): Promise<Issue | null> {
    if (!Number.isSafeInteger(n) || n < 1) return null;
    let issue = issues.get(n);
    if (!issue) {
      issue = parseIssue(await gh.api(`issues/${n}`));
      link(issue.url);
      issues.set(n, issue);
    }
    return !issue.pull && issue.number === n ? issue : null;
  }

  for (let page = 1; ; page++) {
    const commits = array(await gh.api(`commits?sha=${head}&per_page=100&page=${page}`));
    for (const raw of commits) {
      const row = record(raw);
      const sha = identity(row.sha);
      const commitUrl = link(row.html_url);
      const commit = record(row.commit);
      const subject = text(commit.message).split('\n')[0] as string;
      const committedAt = date(record(commit.committer).date);
      const pulls = array(await gh.list(`commits/${sha}/pulls?per_page=100`));
      let n: number | null = null;
      if (pulls.length === 0) {
        const direct = /^[a-z]+(?:\([^()\r\n]+\))?!?: [^ ].* \(#([1-9][0-9]*)\)$/.exec(subject);
        if (direct) n = Number(direct[1]);
      } else {
        const candidates = new Set<number>();
        for (const raw of pulls) {
          const pull = record(raw);
          const base = record(pull.base);
          const head = record(pull.head);
          const baseRepo = text(record(base.repo).full_name);
          const headRepo = head.repo === null ? null : text(record(head.repo).full_name);
          const baseRef = text(base.ref);
          const headRef = text(head.ref);
          const body = pull.body === null ? '' : text(pull.body);
          const merged = pull.merged_at === null ? null : date(pull.merged_at);
          const mergeSha = pull.merge_commit_sha === null ? null : identity(pull.merge_commit_sha);
          const lane = laneHead.exec(headRef);
          const closes = [...body.matchAll(/\bCloses\s+#([1-9][0-9]*)\b/gi)].map((match) => Number(match[1]));
          if (
            merged &&
            mergeSha === sha &&
            baseRef === trunk &&
            baseRepo === name &&
            headRepo === name &&
            lane &&
            closes.length > 0 &&
            closes.every((number) => number === Number(lane[1]))
          )
            candidates.add(Number(lane[1]));
        }
        if (candidates.size === 1) n = [...candidates][0] as number;
      }
      if (n === null || seen.has(n)) continue;
      const issue = await issueOf(n);
      if (!issue) continue;
      entries.push({ number: n, title: issue.title, url: issue.url, sha, commitUrl, committedAt });
      seen.add(n);
      if (entries.length === 20) return { trunk, url, head, entries };
    }
    if (commits.length < 100) return { trunk, url, head, entries };
  }
}

export type AgentState = Readonly<{
  order: AgentOrder;
  usage: Record<Host, UsageBlock | null>;
  next: AgentDecision;
  starts: Readonly<Record<string, AgentDecision>>;
  quota: ReadonlyMap<number, QuotaState>;
}>;

export async function readAgentState(
  main: string,
  now: number,
  flow: Readonly<Record<string, { agent: Host | null }>>,
): Promise<AgentState> {
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
    usage: Object.fromEntries(hosts.map((host) => [host, activeBlock(records, host, now)])) as AgentState['usage'],
    next: selectAgent({ kind: 'default' }, order.order, records, now, new Set(), false),
    starts: Object.fromEntries(
      steps.flatMap((step) => {
        const entry = flow[step];
        if (!entry) return [];
        const preferred = entry.agent ?? undefined;
        const capable = capableOrder(effectiveOrder(order.order, preferred), { kind: 'step', step }, preferred);
        return [[step, selectAgent({ kind: 'default' }, capable, records, now, new Set(), false)]];
      }),
    ),
    quota,
  };
}

export async function readQueueState(
  main: string,
  projected: QueueView | null | undefined,
): Promise<{
  record: QueueRecord | null;
  owner: string | null;
  matches: boolean;
  next: QueueView['next'];
  actions: QueueView['actions'];
}> {
  const { common } = await locateCheckouts(main);
  if (common === null) throw new Error('queue: need a Git checkout');
  const record = await readQueue(main, common);
  const owner = await queueOwner(main, record);
  const matches = record?.id === projected?.record?.id && record?.revision === projected?.record?.revision;
  const next = matches ? (projected?.next ?? null) : null;
  return { record, owner, matches, next, actions: queueView(record, owner, next).actions };
}

export async function queueReadView(main: string): Promise<QueueView> {
  return readQueueView(await createOperation(await locateCheckouts(main), {}, 'main'));
}

export async function readStepEnds(
  main: string,
  issues: readonly number[],
): Promise<ReadonlyMap<number, StepEndRecord | null>> {
  return new Map(
    await Promise.all([...new Set(issues)].map(async (issue) => [issue, await readStepEnd(main, issue)] as const)),
  );
}

export async function laneOf(main: string, number: number): Promise<string | null> {
  const dir = laneFolder(main);
  const name = (await readdir(dir).catch(() => [])).find((entry) => entry.startsWith(`${number}-`));
  return name ? join(dir, name) : null;
}

export function isInside(main: string, path: unknown): path is string {
  return typeof path === 'string' && (resolve(path) === main || resolve(path).startsWith(`${laneFolder(main)}${sep}`));
}

const count = (text: string, word: string) => Number(new RegExp(`(\\d+) ${word}`).exec(text)?.[1] ?? 0);

export async function readDiff(main: string, folder: string, exec: Exec): Promise<Diff | null> {
  if (!isInside(main, folder)) throw new Error('board: the folder is outside the repository');
  const { code, stdout } = await exec(
    'git',
    ['--no-optional-locks', '-C', resolve(folder), 'diff', '--shortstat', '--merge-base', 'origin/HEAD'],
    { timeout: 10_000 },
  );
  const files = count(stdout, 'files? changed');
  return code === 0 && files > 0
    ? { files, added: count(stdout, 'insertions?'), removed: count(stdout, 'deletions?') }
    : null;
}

export async function hasVisualPage(main: string, sha: string): Promise<boolean> {
  return hasPage(main, sha);
}

export async function readVisualPage(main: string, sha: string): Promise<Buffer | null> {
  return isCommit(sha) && (await hasPage(main, sha)) ? readFile(visualPage(main, sha)) : null;
}
