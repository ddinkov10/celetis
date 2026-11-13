import type { Level, RowSource, StartPair } from '../lib/effort.ts';
import type { Host, Registry } from '../lib/host-names.ts';
import type { Board, Card, Column, CoordinatorView, Diff, Flow, ParentEpic, Pull } from './types.ts';
export const COLUMNS: { key: Column; name: string; note: string; empty: [string, string] }[] = [
  {
    key: 'needs',
    name: 'Needs you',
    note: 'Answer, unblock, or run the next step',
    empty: ['No issue needs you', 'No agent of an issue waits, and no step is stuck.'],
  },
  {
    key: 'running',
    name: 'Running',
    note: 'Agents at work',
    empty: ['No agent runs', 'Run starts the next step of an issue.'],
  },
  {
    key: 'idle',
    name: 'Idle',
    note: 'Next steps not started yet',
    empty: ['No issue waits', 'Open issues show here until their first step runs.'],
  },
];

export const GROUPS = [
  { key: 'answer', label: 'Waits for your answer', short: 'waiting', states: ['waits'], isCompact: false },
  { key: 'stuck', label: 'Stuck', short: 'stuck', states: ['no-progress', 'dirty-tree'], isCompact: false },
  { key: 'input', label: 'Your input on the issue', short: 'input on the issue', states: ['blocked'], isCompact: true },
  { key: 'paused', label: 'Paused by usage limits', short: 'paused', states: ['quota-wait'], isCompact: true },
  { key: 'ready', label: 'Ready to run', short: 'ready to run', states: null, isCompact: true },
];

export const STATES: Record<string, string> = {
  works: 'works',
  waits: 'waits for you',
  starts: 'Starting',
  'checks-step': 'checks step',
  'dirty-tree': 'dirty tree',
  'no-progress': 'no progress',
  'quota-wait': 'waits for a usage limit',
};

const WAITS: Record<string, string> = { dialog: 'waits for your answer', turn: 'turn ended' };

export const gateOf = (flow: Partial<Flow> | null | undefined, step: string | null) =>
  flow?.steps?.[step as string]?.gate ?? null;

export const sourceText = (source: RowSource, by: string | null): string =>
  source === 'decided' ? `decided by ${by}` : source === 'pinned' ? 'pinned by the config' : 'default';

export const modelSource = (pair: StartPair<RowSource>) => sourceText(pair.source.model, pair.decision?.by ?? null);

export const levelSource = (pair: StartPair<RowSource>) => sourceText(pair.source.level, pair.decision?.by ?? null);

export const startName = (pair: StartPair<RowSource>) =>
  `model ${pair.model}, ${modelSource(pair)}; effort ${pair.level}, ${levelSource(pair)}`;

export const startTitle = (step: string | null, pair: StartPair<RowSource>, level: Level = pair.level) =>
  `Start the ${step} step on ${pair.model} at ${level}, ${level === pair.level ? levelSource(pair) : 'this start only'}`;

export const runTitle = (
  step: string | null,
  flow: Partial<Flow> | null | undefined,
  effort?: StartPair<RowSource> | null,
) => {
  const hint = flow?.steps?.[step as string]?.hint;
  const start = effort
    ? `Start the ${step} step on ${effort.model} (${modelSource(effort)}) at ${effort.level} (${levelSource(effort)})`
    : `Start the ${step} step`;
  return `${start}${hint ? `. ${hint}` : ''} (Enter)`;
};

export const cleanCause = (cause: unknown) => {
  const line =
    String(cause ?? '')
      .split('\n')
      .map((part) => part.trim())
      .find(Boolean) ?? '';
  return line.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200);
};

export const groupNeeds = (cards: Card[]) => {
  const left = new Set(cards);
  return GROUPS.map((group) => {
    const members = cards.filter(
      (card) => left.has(card) && (group.states === null || group.states.includes(card.state as string)),
    );
    for (const card of members) left.delete(card);
    return { ...group, cards: members };
  }).filter((group) => group.cards.length > 0);
};

export type EpicItem = { kind: 'card'; card: Card } | { kind: 'group'; epic: ParentEpic; cards: Card[] };

export const groupEpics = (cards: Card[], canGroup: (card: Card) => boolean): EpicItem[] => {
  const groups = new Map<number, Extract<EpicItem, { kind: 'group' }>>();
  const items: EpicItem[] = [];
  for (const card of cards) {
    if (!card.epic || !canGroup(card)) {
      items.push({ kind: 'card', card });
      continue;
    }
    const known = groups.get(card.epic.number);
    if (known) {
      known.cards.push(card);
      continue;
    }
    const group = { kind: 'group' as const, epic: card.epic, cards: [card] };
    groups.set(card.epic.number, group);
    items.push(group);
  }
  return items;
};

export const parseOpenEpics = (value: string): Set<number> => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => Number.isSafeInteger(item) && item > 0))
      return new Set<number>(parsed);
  } catch {}
  return new Set();
};

export const laneTrack = (card: Pick<Card, 'type' | 'step'>, flow: Partial<Flow> | null | undefined) => {
  const steps = card.type && flow?.lanes?.[card.type];
  const at = steps ? steps.indexOf(card.step as string) : -1;
  if (at < 0) return null;
  return (steps as string[]).map((name, index) => ({
    name,
    state: index < at ? 'done' : index === at ? 'now' : 'next',
  }));
};

export const knownAgent = (registry: Registry, agent: string | null): agent is Host =>
  agent !== null && Object.hasOwn(registry, agent);

export const agentOf = (card: Pick<Card, 'agent'>, registry: Registry) => {
  if (!card.agent) return null;
  const name = knownAgent(registry, card.agent) ? registry[card.agent].name : card.agent;
  return { name, letter: (card.agent[0] as string).toUpperCase() };
};

export const stateLabel = (card: Card) => {
  if (card.state === 'waits' && WAITS[card.waitFor as string]) return WAITS[card.waitFor as string];
  if (card.state === 'blocked') return card.reason;
  return STATES[card.state as string] ?? card.state;
};

export const age = (iso: string, now: number, isFine = false) => {
  const seconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (Number.isNaN(seconds)) return '';
  if (minutes < 1) return `${seconds}s`;
  if (hours < 1) return isFine ? `${minutes}m ${String(seconds % 60).padStart(2, '0')}s` : `${minutes}m`;
  if (hours < 24) return isFine ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m` : `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export const keyOf = (card: Pick<Card, 'number' | 'sessionId'>) =>
  `k-${String(card.number ?? card.sessionId).replace(/[^\w-]/g, '-')}`;

export const signature = (card: Card, column: string) => [column, card.state, card.step, card.waitFor].join('|');

export const pageTitle = (repo: string, needs: number) => `${needs > 0 ? `(${needs}) ` : ''}${repo} · Agent board`;

// The chip, title, tab icon, and Notify count this list; the Needs you column counts only columns.needs (#142).
export const needsYou = ({
  columns,
  coordinator,
}: Pick<Board, 'columns' | 'coordinator'>): (Card | CoordinatorView)[] => [
  ...(coordinator.state === 'dialog' ? [coordinator] : []),
  ...columns.human.filter((card) => card.waitFor === 'dialog'),
  ...columns.needs,
];

export const isCard = (entry: Card | CoordinatorView): entry is Card => !('actions' in entry);

export const tone = (board: Pick<Board, 'columns' | 'coordinator'>) => {
  if (needsYou(board).length > 0) return 'needs';
  return board.columns.running.some((card) => card.state === 'works') ? 'works' : 'calm';
};

const BADGES: Record<string, string> = { needs: '#FF7A45', works: '#5EA2FF' };

export const favicon = (badge: string) => {
  const dot = BADGES[badge]
    ? `<circle cx="24" cy="8" r="6" fill="${BADGES[badge]}" stroke="#18181B" stroke-width="2"/>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#18181B"/><rect x="7" y="7" width="7.5" height="18" rx="2.25" fill="#EEEEF0"/><rect x="17.5" y="7" width="7.5" height="11" rx="2.25" fill="#EEEEF0"/>${dot}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const who = (card: Card) =>
  card.number === null ? (card.title ? `Human session "${card.title}"` : 'A human session') : `#${card.number}`;

const NOTICES: Record<string, (card: Card) => string | null> = {
  waits: (card) => (card.waitFor === 'turn' ? 'ended its turn' : 'waits for your answer'),
  'no-progress': () => 'made no progress',
  'dirty-tree': () => 'has a dirty worktree',
  blocked: (card) => card.reason,
};

export const notice = (card: Card) => ({
  title: `${who(card)} ${(NOTICES[card.state as string] ?? (() => `is ready to run ${card.step}`))(card)}`,
  body: card.title || '',
});

export const tail = (groups: { count: number; short: string }[]) => {
  const parts = groups.filter((group) => group.count > 0).map((group) => `${group.count} ${group.short}`);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return total > 0 ? `${total} more below: ${parts.join(', ')}` : '';
};

export const diffText = (diff: Diff | null | undefined) => (diff ? `+${diff.added} −${diff.removed}` : '');

export const shortPath = (path: string) =>
  path.includes('/.claude/worktrees/') ? path.slice(path.indexOf('.claude/worktrees/')) : path;

const CHECKS: Record<string, string> = { pass: 'CI passed', fail: 'CI failed', pending: 'CI running' };
const REVIEWS: Record<string, string> = {
  approved: 'Approved',
  changes: 'Changes requested',
  required: 'Review required',
};

export const prFacts = (pr: Pull | null | undefined): { kind: string; text: string; url?: string | null }[] =>
  pr
    ? [
        { kind: 'pr', text: `${pr.draft ? 'Draft ' : ''}PR #${pr.number}`, url: pr.url },
        ...(CHECKS[pr.checks as string]
          ? [{ kind: `checks-${pr.checks}`, text: CHECKS[pr.checks as string] as string }]
          : []),
        ...(REVIEWS[pr.review as string]
          ? [{ kind: `review-${pr.review}`, text: REVIEWS[pr.review as string] as string }]
          : []),
      ]
    : [];

export const pipeline = (cards: Card[], flow: Partial<Flow> | null | undefined) => {
  const stages = (flow?.stages ?? []).map((stage, index) => ({
    ...stage,
    key: index,
    cards: cards.filter((card) => stage.steps.includes(card.step as string)),
  }));
  const placed = new Set(stages.flatMap((stage) => stage.cards));
  return { stages, hold: cards.filter((card) => !placed.has(card)) };
};

export const filterItems = <T extends { number: number | null; label: string; context?: string; isGoTo?: boolean }>(
  items: T[],
  query: string,
): T[] => {
  const text = query.trim().toLowerCase();
  if (text === '') return items.filter((item) => !item.isGoTo);
  const number = /^#?(\d+)$/.exec(text)?.[1];
  if (number) {
    const found = items.filter((item) => item.number !== null && String(item.number).startsWith(number));
    const exact = found.filter((item) => String(item.number) === number);
    return [
      ...exact.filter((item) => item.isGoTo),
      ...exact.filter((item) => !item.isGoTo),
      ...items.filter((item) => item.number === null && item.context === text),
      ...found.filter((item) => String(item.number) !== number),
    ];
  }
  const words = text.split(/\s+/);
  return items.filter(
    (item) => !item.isGoTo && words.every((word) => `${item.label} ${item.context ?? ''}`.toLowerCase().includes(word)),
  );
};
