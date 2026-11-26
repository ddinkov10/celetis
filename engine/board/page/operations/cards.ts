import type { IssueKey } from '../../../lib/tracker/key.ts';
import type { Board, Card, Column, Columns } from '../../types.ts';
import { COLUMNS, type EpicItem, groupEpics, groupNeeds, keyOf, pipeline, waitGroups } from '../../view.ts';

export type Entry = Readonly<{ card: Card; column: Column | 'human' }>;
export type View = 'now' | 'pipeline';
export type Launch = Readonly<{ step: string | null; phase: 'pending' | 'done' | 'failed'; at: number }>;
export type CardIndex = Readonly<{ byKey: ReadonlyMap<string, Entry>; keyOf: ReadonlyMap<Card, string> }>;
export const SLOW_START = 5000;
export const SLOW_START_TEXT = 'The daemon still checks the start';

export const project = (board: Board, launches: ReadonlyMap<IssueKey, Launch>): Board => {
  if (launches.size === 0) return board;
  const columns: Columns = { needs: [], waiting: [], running: [], idle: [], human: [] };
  for (const [key, cards] of Object.entries(board.columns) as [Column, Card[]][])
    for (const card of cards) {
      const launch = card.sessionId === null && card.number !== null ? launches.get(card.number) : undefined;
      if (!launch) columns[key].push(card);
      else if (
        launch.phase !== 'failed' &&
        card.step === launch.step &&
        (card.state === null ||
          card.state === 'no-progress' ||
          card.state === 'set-aside' ||
          (card.state === 'blocked' && launch.step === null))
      )
        columns.running.unshift({
          ...card,
          state: 'starts',
          act: null,
          assist: false,
          run: false,
          resume: false,
          go: false,
          aside: false,
          warning: null,
          effort: null,
        });
      else columns[key].push({ ...card, assist: false, run: false, resume: false, aside: false });
    }
  return { ...board, columns };
};

export const layoutOf = (next: Board, view: View): string =>
  JSON.stringify([
    view,
    Object.entries(next.columns).map(([key, cards]) => [key, cards.map((card: Card) => keyOf(card))]),
  ]);

const cardsOf = (item: EpicItem) => (item.kind === 'group' ? item.cards : [item.card]);

export const indexCards = (board: Board, view: View): CardIndex => {
  const used = new Set<string>();
  const byKey = new Map<string, Entry>();
  const keys = new Map<Card, string>();
  const keyFor = (card: Card) => {
    let key = keyOf(card);
    while (used.has(key)) key += '-x';
    used.add(key);
    return key;
  };
  const add = (card: Card, column: Column) => {
    const key = keyFor(card);
    byKey.set(key, { card, column });
    keys.set(card, key);
  };
  const { columns } = board;
  if (view === 'pipeline') {
    const where = new Map<Card, Column>([
      ...columns.needs.map((card): [Card, Column] => [card, 'needs']),
      ...columns.waiting.map((card): [Card, Column] => [card, 'waiting']),
      ...columns.running.map((card): [Card, Column] => [card, 'running']),
      ...columns.idle.map((card): [Card, Column] => [card, 'idle']),
    ]);
    const { stages, hold } = pipeline(
      [...columns.needs, ...columns.waiting, ...columns.running, ...columns.idle],
      board.flow,
    );
    for (const card of hold) add(card, where.get(card) as Column);
    for (const stage of stages)
      for (const item of groupEpics(stage.cards, (card) => where.get(card) === 'idle'))
        for (const card of cardsOf(item)) add(card, where.get(card) as Column);
  } else {
    for (const { key } of COLUMNS) {
      const cards = columns[key];
      if (key === 'needs') for (const group of groupNeeds(cards)) for (const card of group.cards) add(card, key);
      else if (key === 'idle')
        for (const item of groupEpics(cards, () => true)) for (const card of cardsOf(item)) add(card, key);
      else for (const card of cards) add(card, key);
      if (key === 'needs')
        for (const group of waitGroups(columns.waiting)) for (const card of group.cards) add(card, 'waiting');
    }
  }
  for (const card of columns.human) add(card, 'human');
  return { byKey, keyOf: keys };
};
