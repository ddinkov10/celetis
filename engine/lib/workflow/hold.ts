import { headings } from '../contract/contract.ts';
import type { IssueData, Lane } from './workflow.ts';

export type HoldRecord =
  | Readonly<{ kind: 'held'; head: string; patch: string; subject: string }>
  | Readonly<{ kind: 'released'; head: string; patch: string }>
  | Readonly<{ kind: 'refused' }>;
type Held = Extract<HoldRecord, { kind: 'held' }>;
type Released = Extract<HoldRecord, { kind: 'released' }>;
export type Hold = Readonly<{ active: boolean; latest: HoldRecord | null; held: Held | null }>;
type Source = Pick<IssueData, 'labels' | 'history'>;

const id = '([0-9a-f]{40})';
const heldForm = new RegExp(`^${headings.held}\\nhead: ${id}\\npatch: ${id}\\nsubject: ([^\\r\\n]+)\\n?$`);
const releasedForm = new RegExp(`^${headings.released}\\nhead: ${id}\\npatch: ${id}\\n?$`);

const firstLine = (body: string) => body.split(/\r?\n/, 1)[0];

function recordOf(body: string): HoldRecord | null {
  const held = heldForm.exec(body);
  if (held) return { kind: 'held', head: held[1] as string, patch: held[2] as string, subject: held[3] as string };
  const released = releasedForm.exec(body);
  if (released) return { kind: 'released', head: released[1] as string, patch: released[2] as string };
  return firstLine(body) === headings.landingRefused ? { kind: 'refused' } : null;
}

export function holdOf({ labels, history }: Source): Hold {
  const bodies = history.flatMap((entry) => (entry.kind === 'comment' && entry.own ? [entry.body] : []));
  const records = bodies.flatMap((body) => recordOf(body) ?? []);
  return {
    active:
      labels.includes('hold-landing') ||
      history.some((entry) => entry.kind === 'label' && entry.change === 'added' && entry.name === 'hold-landing') ||
      bodies.some((body) => firstLine(body) === headings.held),
    latest: records.at(-1) ?? null,
    held: records.findLast((record): record is Held => record.kind === 'held') ?? null,
  };
}

export function holdApplies(issue: Source, lane: Lane, setting: boolean): boolean {
  return (lane === 'feature' || lane === 'bug') && (setting || holdOf(issue).active);
}

export function heldComment({ head, patch, subject }: Omit<Held, 'kind'>): string {
  return `${headings.held}\nhead: ${head}\npatch: ${patch}\nsubject: ${subject}`;
}

export function releasedComment({ head, patch }: Omit<Released, 'kind'>): string {
  return `${headings.released}\nhead: ${head}\npatch: ${patch}`;
}
