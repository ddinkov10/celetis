import { headings } from '../contract/contract.ts';
import { compareKeys, type IssueKey } from '../tracker/key.ts';
import type { Blocker } from '../tracker/tracker.ts';
import { type Decision, type Entry, headed, isDeferral, removedAfter } from '../workflow/workflow.ts';
import type { HoldBlocker, RowHold } from './types.ts';

export type BlockerRead =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'failed' }>
  | Readonly<{ kind: 'read'; blockers: readonly Blocker[] }>;

const reasonLimit = 140;
const isMarker = (line: string) => /^\s*<!--.*-->\s*$/.test(line);
const isBlank = (line: string) => line.trim() === '';

function firstParagraph(body: string): string {
  const lines = body.split('\n').slice(1);
  const skip = (from: number) => {
    let at = from;
    while (at < lines.length && (isBlank(lines[at] as string) || isMarker(lines[at] as string))) at++;
    return at;
  };
  let start = skip(0);
  if (lines[start]?.trimStart().startsWith('Step:')) start = skip(start + 1);
  const end = lines.findIndex((line, at) => at >= start && isBlank(line));
  return lines
    .slice(start, end === -1 ? undefined : end)
    .filter((line) => !isMarker(line))
    .map((line) => line.trim())
    .join(' ');
}

export function holdReason(history: readonly Entry[]): string | null {
  const comment = headed(history, headings.stopped, headings.beforeLanding)
    .filter(({ body, own }) => own && !isDeferral(body))
    .at(-1);
  if (comment === undefined || removedAfter(history, 'ready-for-human', comment.position)) return null;
  const paragraph = firstParagraph(
    comment.body
      .replaceAll('\r\n', '\n')
      .replaceAll('\t', ' ')
      .replace(/(?!\n)[\p{Cc}\p{Cf}]/gu, ''),
  );
  const sentence = paragraph.match(/^.*?[.!?](?=\s|$)/s)?.[0] ?? paragraph;
  return [...sentence.trim()].slice(0, reasonLimit).join('').trim() || null;
}

export function readsBlockers(decision: Decision): boolean {
  return decision.kind === 'stop' && decision.reason === 'ready-for-human' && decision.variant === 'your-step';
}

function byKey(a: Blocker, b: Blocker): number {
  if (a.key !== null && b.key !== null) return compareKeys(a.key, b.key);
  if (a.key !== null) return -1;
  if (b.key !== null) return 1;
  return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
}

const shown = ({ ref, title }: Blocker): HoldBlocker => ({ ref, title });
const refs = (blockers: readonly HoldBlocker[], separator = ', ') => blockers.map(({ ref }) => ref).join(separator);

export function rowHoldOf(
  n: IssueKey,
  decision: Decision,
  history: readonly Entry[],
  read: BlockerRead,
): Readonly<{ rowHold: RowHold; act: string }> | null {
  if (decision.kind === 'stop' && decision.reason === 'deferred')
    return {
      rowHold: { place: 'waiting', group: 'deferred', text: 'deferred by you', reason: null, open: [], closed: [] },
      act: `Run celetis --agent <host> issue ${n} undefer to bring it back.`,
    };
  if (!readsBlockers(decision)) return null;
  const reason = holdReason(history);
  const inAct = (text: string, act: string, open: readonly HoldBlocker[], closed: readonly HoldBlocker[]) => ({
    rowHold: { place: 'act', group: null, text, reason, open, closed } as const,
    act,
  });
  if (read.kind === 'failed')
    return inAct(
      'blockers not read',
      'Read the issue, because its blockers could not be read. Then do the act of its latest hold comment, and remove ready-for-human.',
      [],
      [],
    );
  const sorted = read.kind === 'read' ? [...read.blockers].sort(byKey) : [];
  const open = sorted.filter(({ state }) => state === 'open').map(shown);
  const closed = sorted.filter(({ state }) => state === 'closed').map(shown);
  if (open.length > 0)
    return {
      rowHold: {
        place: 'waiting',
        group: `blockers:${refs(open, ',')}`,
        text: `waits for ${refs(open)}`,
        reason,
        open,
        closed,
      },
      act: `No act from you now. The card moves to Act now when ${refs(open)} close. The hold stays until you remove ready-for-human.`,
    };
  if (closed.length > 0)
    return inAct(
      `blockers closed: ${refs(closed)}`,
      'Check that the closed blockers end the reason of the hold, then remove ready-for-human.',
      open,
      closed,
    );
  if (reason !== null)
    return inAct(reason, 'Do the act that the reason names, then remove ready-for-human.', open, closed);
  return inAct(
    'no reason recorded',
    'Read the issue, because the hold has no readable reason. Do its act, then remove ready-for-human.',
    open,
    closed,
  );
}
