import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import { type Choice, services } from '../services/services.ts';
import { repositoryLayout, withLock } from '../state/state.ts';
import type { IssueKey } from '../tracker/key.ts';
import { writeRefreshHint } from '../tracker/refresh-hints.ts';
import type { Tracker } from '../tracker/tracker.ts';
import {
  type AcceptedEpic,
  type AcceptedEpicResult,
  decideEpicCompletion,
  type EpicSnapshot,
  type EpicSubmission,
  laneOf,
} from '../workflow/workflow.ts';
import { completionIdentity, type EpicForms, parseAcceptedEpic, parseEpicAcceptance } from './acceptance.ts';

export type EpicCompletionResult =
  | Readonly<{ kind: 'closed' }>
  | Readonly<{ kind: 'completed'; completionId: string }>
  | Readonly<{ kind: 'pending'; reason: string; nextAction: string }>;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const passed: readonly number[] = [exits.usage, exits.prerequisite, exits.blocked];
const nextAction = (n: IssueKey) => `/celetis:accept-epic #${n}`;

async function snapshot(gh: Tracker, n: IssueKey): Promise<EpicSnapshot> {
  try {
    return await gh.epic(n);
  } catch (error) {
    throw new HostError(`epic: cannot read #${n}: ${message(error)}\n${gh.stderr()}`.trimEnd(), exits.blocked);
  }
}

export async function readEpic(choice: Choice, main: string, n: IssueKey): Promise<EpicSnapshot> {
  return snapshot(services(choice, main).tracker, n);
}

export async function withEpicLock<T>(
  common: string,
  n: IssueKey,
  signal: AbortSignal | undefined,
  change: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const layout = repositoryLayout(common);
  const controller = new AbortController();
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
  const interrupt = () => controller.abort(new Error('epic operation interrupted'));
  if (signal) {
    signal.addEventListener('abort', interrupt, { once: true });
    if (signal.aborted) interrupt();
  } else for (const name of signals) process.on(name, interrupt);
  try {
    return await withLock(
      layout.epicLock(n),
      async () => {
        controller.signal.throwIfAborted();
        return change(controller.signal);
      },
      { signal: controller.signal },
    );
  } catch (error) {
    if (error instanceof HostError && passed.includes(error.code)) throw error;
    throw new HostError(`epic: #${n}: ${message(error)}`, exits.blocked);
  } finally {
    if (signal) signal.removeEventListener('abort', interrupt);
    else for (const name of signals) process.off(name, interrupt);
  }
}

export async function writeEpicDefinition(
  choice: Choice,
  main: string,
  common: string,
  n: IssueKey,
  body: string,
): Promise<void> {
  const declaration = parseEpicAcceptance(body, services(choice, main).tracker.forms);
  if (declaration.kind === 'unresolved') throw new HostError(`epic: ${declaration.reason}`, exits.usage);
  await withEpicLock(common, n, undefined, async (signal) => {
    const gh = services(choice, main, signal).tracker;
    const current = await snapshot(gh, n);
    const { data, children } = current;
    const lane = laneOf(data.labels);
    if (data.state !== 'open' || (lane.kind !== 'epic' && !(lane.kind === 'lane' && lane.lane === 'feature')))
      throw new HostError(`epic: #${n}: definition requires an open feature or epic`, exits.prerequisite);
    const urls = new Set(children.map((child) => child.url));
    if (
      declaration.acceptance.mode === 'combined' &&
      declaration.acceptance.scenarios.some((scenario) => scenario.children.some((url) => !urls.has(url)))
    )
      throw new HostError(`epic: #${n}: a scenario references a child outside the current epic`, exits.prerequisite);
    const done: string[] = [];
    let attempt = '';
    try {
      if (data.body !== body) {
        attempt = 'body write';
        await gh.edit(n, { body });
        done.push('body saved');
      }
      if (!data.labels.includes('epic')) {
        attempt = 'epic label addition';
        await gh.addLabels(n, ['epic']);
        done.push('epic label added');
      }
      if (data.labels.includes('enhancement')) {
        attempt = 'enhancement label removal';
        await gh.removeLabel(n, 'enhancement');
        done.push('enhancement label removed');
      }
    } catch (error) {
      throw new HostError(
        `epic: #${n}: ${done.length ? done.join('; ') : 'no write acknowledged'}; ${attempt} outcome is unknown. Inspect the parent body and labels, fix the access/write failure, and re-enter ${nextAction(n)} for current checks.\n${message(error)}`,
        exits.blocked,
      );
    }
    for (const child of children) await writeRefreshHint(main, child.number);
  });
}

function accepted(snapshot: EpicSnapshot, submission: EpicSubmission | null): AcceptedEpic {
  const { declaration } = snapshot;
  if (declaration.kind !== 'valid') throw new Error('acceptance is unresolved');
  if (declaration.acceptance.mode === 'independent') {
    return {
      repository: snapshot.repository,
      parent: snapshot.parent,
      definitionHash: declaration.definitionHash,
      children: snapshot.children,
      review: { session: `celetis:${process.pid}`, at: new Date().toISOString() },
      mode: 'independent',
      targets: [],
      results: [],
    };
  }
  if (!submission) throw new Error('combined acceptance needs a submission');
  return {
    ...submission,
    mode: 'combined',
    results: submission.results.filter(
      (result): result is AcceptedEpicResult => result.result === 'PASS' || result.result === 'inapplicable',
    ),
  };
}

function recorded(snapshot: EpicSnapshot, id: string, forms: EpicForms): boolean {
  return snapshot.data.history.some((entry) => {
    if (entry.kind !== 'comment') return false;
    const match = /^## Epic accepted\r?\n([\s\S]*?)\r?\n```json\r?\n([\s\S]*?)\r?\n```[ \t]*(?:\r?\n\s*)?$/.exec(
      entry.body,
    );
    const summary = match?.[1];
    const text = match?.[2];
    if (summary === undefined || text === undefined || /^ {0,3}(?:`{3,}|~{3,})/m.test(summary)) return false;
    try {
      return parseAcceptedEpic(text, forms).completionId === id;
    } catch {
      return false;
    }
  });
}

function inputs(snapshot: EpicSnapshot, submission: EpicSubmission | null): string {
  const references = new Set(
    submission?.results.flatMap((result) => (result.result === 'inapplicable' ? [result.decision] : result.reports)),
  );
  return JSON.stringify({
    repository: snapshot.repository,
    parent: snapshot.parent,
    declaration: snapshot.declaration,
    children: snapshot.children,
    references: snapshot.data.history.filter((entry) => entry.kind === 'comment' && references.has(entry.id)),
  });
}

export async function completeEpic(
  choice: Choice,
  main: string,
  common: string,
  n: IssueKey,
  submission?: EpicSubmission,
  signal?: AbortSignal,
): Promise<EpicCompletionResult> {
  const evidence = submission === undefined ? null : structuredClone(submission);
  return withEpicLock(common, n, signal, async (locked) => {
    const gh = services(choice, main, locked).tracker;
    const initial = await snapshot(gh, n);
    const decision = decideEpicCompletion({ snapshot: initial, submission: evidence });
    if (decision.kind === 'closed') return decision;
    const pending = (reason: string): EpicCompletionResult => ({ kind: 'pending', reason, nextAction: nextAction(n) });
    if (decision.kind === 'refused') return pending(decision.reason);
    const record = accepted(initial, evidence);
    const completionId = completionIdentity(record);
    const original = inputs(initial, evidence);
    const fresh = (current: EpicSnapshot) => {
      const check = decideEpicCompletion({ snapshot: current, submission: evidence });
      if (check.kind !== 'complete') return check;
      return inputs(current, evidence) === original
        ? check
        : ({ kind: 'refused', reason: 'epic inputs changed during completion; review current acceptance' } as const);
    };
    const current = await snapshot(gh, n);
    const before = fresh(current);
    if (before.kind === 'closed') return before;
    if (before.kind === 'refused') return pending(before.reason);
    let published = recorded(current, completionId, gh.forms);
    let phase = 'completion record publication';
    try {
      if (!published) {
        const summary =
          record.mode === 'independent'
            ? 'Independent acceptance: no combined runtime check was required.'
            : `Combined acceptance: ${record.results.length} declared scenarios accepted with current evidence.`;
        await gh.comment(
          n,
          `## Epic accepted\n\n${summary}\n\n\`\`\`json\n${JSON.stringify({ ...record, completionId }, null, 2)}\n\`\`\``,
        );
        published = true;
      }
      phase = 'pre-close read';
      const latest = await snapshot(gh, n);
      const beforeClose = fresh(latest);
      if (beforeClose.kind === 'closed') return beforeClose;
      if (beforeClose.kind === 'refused') throw new Error(beforeClose.reason);
      if (!recorded(latest, completionId, gh.forms))
        throw new Error('the accepted completion record is missing or changed');
      phase = 'parent close';
      await gh.edit(n, { state: 'closed', state_reason: 'completed' });
      return { kind: 'completed', completionId };
    } catch (error) {
      const state = published
        ? `completion record ${completionId} is published; ${phase === 'parent close' ? 'close outcome is unknown' : 'no close was attempted'}`
        : `publication of completion record ${completionId} is uncertain; no close was attempted`;
      throw new HostError(
        `epic: #${n}: ${state}. Inspect the record and parent state, fix the access/write failure or changed prerequisite, and re-enter ${nextAction(n)} for current checks.\n${message(error)}`,
        exits.blocked,
      );
    }
  });
}
