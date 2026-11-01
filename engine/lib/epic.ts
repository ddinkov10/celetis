import { closeSync, constants, fstatSync, openSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { completionIdentity, parseAcceptedEpic, parseEpicAcceptance } from './epic-acceptance.ts';
import { HostError } from './host.ts';
import { type GitHub, github } from './tracker.ts';
import { tryFlock } from './update-lock.ts';
import { openLockFile } from './windows.ts';
import {
  type AcceptedEpic,
  type AcceptedEpicResult,
  decideEpicCompletion,
  type EpicSnapshot,
  type EpicSubmission,
  laneOf,
} from './workflow.ts';

export type EpicCompletionResult =
  | Readonly<{ kind: 'closed' }>
  | Readonly<{ kind: 'completed'; completionId: string }>
  | Readonly<{ kind: 'pending'; reason: string; nextAction: string }>;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const nextAction = (n: string) => `/celetis:accept-epic #${n}`;

async function snapshot(gh: GitHub, n: string): Promise<EpicSnapshot> {
  try {
    return await gh.epic(n);
  } catch (error) {
    throw new HostError(`epic: cannot read #${n}: ${message(error)}\n${gh.stderr()}`.trimEnd(), 6);
  }
}

export async function readEpic(main: string, n: string): Promise<EpicSnapshot> {
  return snapshot(github(main), n);
}

async function withEpicLock<T>(common: string, n: string, change: (signal: AbortSignal) => Promise<T>): Promise<T> {
  if (!/^[1-9][0-9]*$/.test(n) || !Number.isSafeInteger(Number(n)))
    throw new HostError('epic: need a positive safe issue number', 2);
  const controller = new AbortController();
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
  const interrupt = () => controller.abort(new Error('epic operation interrupted'));
  for (const signal of signals) process.on(signal, interrupt);
  try {
    const dir = join(common, 'celetis-flow');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const path = join(dir, `epic-${n}.lock`);
    const fd =
      process.platform === 'win32'
        ? openLockFile(path)
        : openSync(path, constants.O_RDWR | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
    try {
      const file = fstatSync(fd);
      if (!file.isFile() || (process.platform !== 'win32' && (file.mode & 0o077) !== 0))
        throw new Error(`need a private regular lock file: ${path}`);
      const deadline = performance.now() + 5_000;
      while (!tryFlock(fd)) {
        controller.signal.throwIfAborted();
        if (performance.now() >= deadline) throw new Error('completion lock is busy; refresh and try again');
        await Bun.sleep(50);
      }
      controller.signal.throwIfAborted();
      return await change(controller.signal);
    } finally {
      closeSync(fd);
    }
  } catch (error) {
    if (error instanceof HostError && [2, 3, 6].includes(error.code)) throw error;
    throw new HostError(`epic: #${n}: ${message(error)}`, 6);
  } finally {
    for (const signal of signals) process.off(signal, interrupt);
  }
}

export async function writeEpicDefinition(main: string, common: string, n: string, body: string): Promise<void> {
  const declaration = parseEpicAcceptance(body);
  if (declaration.kind === 'unresolved') throw new HostError(`epic: ${declaration.reason}`, 2);
  await withEpicLock(common, n, async (signal) => {
    const gh = github(main, signal);
    const current = await snapshot(gh, n);
    const { data, children } = current;
    const lane = laneOf(data.labels);
    if (data.state !== 'open' || (lane.kind !== 'epic' && !(lane.kind === 'lane' && lane.lane === 'feature')))
      throw new HostError(`epic: #${n}: definition requires an open feature or epic`, 3);
    const urls = new Set(children.map((child) => child.url));
    if (
      declaration.acceptance.mode === 'combined' &&
      declaration.acceptance.scenarios.some((scenario) => scenario.children.some((url) => !urls.has(url)))
    )
      throw new HostError(`epic: #${n}: a scenario references a child outside the current epic`, 3);
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
        6,
      );
    }
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

function recorded(snapshot: EpicSnapshot, id: string): boolean {
  return snapshot.data.history.some((entry) => {
    if (entry.kind !== 'comment') return false;
    const match = /^## Epic accepted\r?\n([\s\S]*?)\r?\n```json\r?\n([\s\S]*?)\r?\n```[ \t]*(?:\r?\n\s*)?$/.exec(
      entry.body,
    );
    const summary = match?.[1];
    const text = match?.[2];
    if (summary === undefined || text === undefined || /^ {0,3}(?:`{3,}|~{3,})/m.test(summary)) return false;
    try {
      return parseAcceptedEpic(text).completionId === id;
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
  main: string,
  common: string,
  n: string,
  submission?: EpicSubmission,
): Promise<EpicCompletionResult> {
  const evidence = submission === undefined ? null : structuredClone(submission);
  return withEpicLock(common, n, async (signal) => {
    const gh = github(main, signal);
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
    let published = recorded(current, completionId);
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
      if (!recorded(latest, completionId)) throw new Error('the accepted completion record is missing or changed');
      phase = 'parent close';
      await gh.edit(n, { state: 'closed', state_reason: 'completed' });
      return { kind: 'completed', completionId };
    } catch (error) {
      const state = published
        ? `completion record ${completionId} is published; ${phase === 'parent close' ? 'close outcome is unknown' : 'no close was attempted'}`
        : `publication of completion record ${completionId} is uncertain; no close was attempted`;
      throw new HostError(
        `epic: #${n}: ${state}. Inspect the record and parent state, fix the access/write failure or changed prerequisite, and re-enter ${nextAction(n)} for current checks.\n${message(error)}`,
        6,
      );
    }
  });
}
