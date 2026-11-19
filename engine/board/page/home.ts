import type { Board, Card } from '../types.ts';
import { agentOf, clock, keyOf, stateLabel } from '../view.ts';
import { $, el, icon } from './ui.ts';

type Actions = { open(key: string): void };

const needsRow = (card: Card, actions: Actions) => {
  const meta = stateLabel(card) ?? card.reason ?? '';
  const open = el('button', 'btn primary', 'Open');
  open.type = 'button';
  open.setAttribute('aria-label', `Open #${card.number} ${card.title}`);
  open.addEventListener('click', () => actions.open(keyOf(card)));
  const text = el('div', 'home-row-text');
  text.append(
    el('p', 'home-title', card.title),
    el('p', 'home-meta', card.number === null ? meta : `#${card.number} · ${meta}`),
  );
  const row = el('li', 'home-row');
  row.dataset.key = keyOf(card);
  row.append(text, open);
  return row;
};

const agentRow = (card: Card, board: Board, actions: Actions) => {
  const meta = [card.step, agentOf(card, board.registry)?.name, stateLabel(card)].filter(Boolean).join(' · ');
  const button = el('button', 'home-agent');
  button.type = 'button';
  button.append(el('span', 'home-title', `#${card.number} ${card.title}`), el('span', 'home-meta', meta));
  button.addEventListener('click', () => actions.open(keyOf(card)));
  const row = el('li');
  row.dataset.key = keyOf(card);
  row.append(button);
  return row;
};

const LISTS = ['home-needs', 'home-agents'] as const;
type Spot = { list: (typeof LISTS)[number]; index: number; key: string };

const spotOf = (): Spot | null => {
  const row = document.activeElement?.closest('li');
  for (const list of LISTS) {
    const rows = [...$(`${list}-list`).children];
    if (row && rows.includes(row)) return { list, index: rows.indexOf(row), key: row.dataset.key as string };
  }
  return null;
};

const restore = ({ list, index, key }: Spot): void => {
  const rows = (id: string) => [...$(`${id}-list`).children] as HTMLElement[];
  const mine = rows(list);
  const other = rows(LISTS.find((id) => id !== list) as string);
  const row = mine.find((each) => each.dataset.key === key) ?? mine[Math.min(index, mine.length - 1)] ?? other[0];
  (row?.querySelector('button') ?? $('work')).focus({ preventScroll: true });
};

const drawList = (id: string, cards: Card[], row: (card: Card) => HTMLElement) => {
  $(`${id}-list`).hidden = cards.length === 0;
  $(`${id}-empty`).hidden = cards.length > 0;
  $(`${id}-list`).replaceChildren(...cards.map(row));
};

const queueText = (board: Board) => {
  const count = board.queue?.record?.numbers.length ?? 0;
  return count === 0 ? 'empty' : `${count} issue${count === 1 ? '' : 's'}`;
};

const facts = (board: Board): [string, string][] => {
  const names = Object.entries(board.agents ?? {})
    .filter(([, state]) => state.available)
    .map(([host]) => board.registry[host as keyof Board['registry']].name);
  return [
    ['Auto mode', board.daemon.auto],
    ['Queue', queueText(board)],
    ['Agents', names.join(', ') || 'none'],
    ['Herdr', board.terminal.ok === null ? 'checking' : board.terminal.ok ? 'up' : 'down'],
  ];
};

type Tile = {
  label: string;
  value: string;
  unit: string;
  change: { dir: 'up' | 'down' | null; text: string } | null;
  window: string;
  source: string;
  state: { kind: 'line'; points: (number | null)[] } | { kind: 'few' | 'reading' | 'failed'; text: string };
  name: string;
};

type Kind = 'needs' | 'working' | 'landed' | 'median';

const NS = 'http://www.w3.org/2000/svg';
const NONE = '–';
const BEFORE = 'the 7 days before';

const sparkPath = (points: readonly (number | null)[]) => {
  const known = points.filter((point): point is number => point !== null);
  if (known.length < 2) return null;
  const min = Math.min(...known);
  const max = Math.max(...known);
  const round = (n: number) => Math.round(n * 100) / 100;
  let d = '';
  let dot = { x: 0, y: 0 };
  points.forEach((point, i) => {
    if (point === null) return;
    const x = round(3 + (i * 90) / (points.length - 1));
    const y = round(max === min ? 16 : 3 + ((max - point) / (max - min)) * 26);
    const alone = points[i - 1] == null && points[i + 1] == null;
    d += `${points[i - 1] == null ? `${d ? ' ' : ''}M` : ' L'}${x} ${y}${alone ? ' h0' : ''}`;
    dot = { x, y };
  });
  return { d, dot, last: known[known.length - 1] as number };
};

const tileOf = (kind: Kind, board: Board): Tile => {
  const { live, delivery } = board.trends;
  const isLive = kind === 'needs' || kind === 'working';
  const read = isLive ? live : delivery;
  const windows = delivery.windows;
  const series = isLive
    ? live.error && !live.readAt
      ? null
      : live[kind]
    : windows?.map((each) => (kind === 'landed' ? each.landed : each.medianDays));
  const span = isLive ? 'last 24 hours' : 'last 8 weeks';
  const source = isLive
    ? 'local samples'
    : kind === 'landed'
      ? 'the trunk history'
      : 'the issues and the trunk history';
  const stale = series && read.error && read.readAt ? clock(read.readAt) : null;
  const state: Tile['state'] = !series
    ? read.error
      ? { kind: 'failed', text: 'The history read failed' }
      : { kind: 'reading', text: 'Reading the history' }
    : series.filter((point) => point !== null).length < 2
      ? { kind: 'few', text: isLive ? 'Too few samples yet' : 'Too few landings yet' }
      : { kind: 'line', points: series };
  const now = windows?.[7];
  const before = windows?.[6];
  let label = 'Needs you';
  let value = NONE;
  let unit = '';
  let phrase = '';
  let change: Tile['change'] = null;
  if (isLive) {
    label = kind === 'needs' ? 'Needs you' : 'Agents working';
    value = String(board.columns[kind === 'needs' ? 'needs' : 'running'].length);
    unit = kind === 'needs' ? 'issues wait for your step' : 'sessions of issues';
    const known = (series ?? []).filter((point): point is number => point !== null);
    if (known.length) change = { dir: null, text: `peak ${Math.max(...known)} in 24 hours` };
  } else if (kind === 'landed') {
    label = 'Landed per week';
    unit = 'issues in 7 days';
    if (now && before) {
      value = String(now.landed);
      const gap = now.landed - before.landed;
      change = gap
        ? { dir: gap > 0 ? 'up' : 'down', text: `${Math.abs(gap)} ${gap > 0 ? 'more' : 'fewer'} than ${BEFORE}` }
        : { dir: null, text: `same as ${BEFORE}` };
    }
  } else {
    label = 'Intent to landing';
    unit = now ? `median of ${now.landed} landings` : 'median of landings';
    phrase = unit;
    if (now && before) {
      if (now.medianDays === null) change = { dir: null, text: 'no landing in the last 7 days' };
      else {
        value = `${now.medianDays.toFixed(1)} d`;
        phrase = `median ${now.medianDays.toFixed(1)} days of ${now.landed} landings in the last 7 days`;
        const gap = Math.round((now.medianDays - (before.medianDays ?? now.medianDays)) * 10) / 10;
        change =
          before.medianDays === null
            ? { dir: null, text: 'no landing in the 7 days before' }
            : gap
              ? {
                  dir: gap < 0 ? 'down' : 'up',
                  text: `${Math.abs(gap).toFixed(1)} d ${gap < 0 ? 'faster' : 'slower'} than ${BEFORE}`,
                }
              : { dir: null, text: `same as ${BEFORE}` };
      }
    }
  }
  const lead = phrase || `${value} ${unit}`;
  const changeText = change ? `, ${change.text.replace(/^(\S+) d /, '$1 days ')}` : '';
  const trend = state.kind === 'line' ? `Trend over the ${span}, from ${source}.` : `${state.text}.`;
  return {
    label,
    value,
    unit,
    change,
    window: stale ? `last read ${stale}` : span,
    source,
    state,
    name: `${label}: ${lead}${changeText}. ${kind === 'median' ? 'Down is good. ' : ''}${trend}${stale ? ` Last read ${stale}.` : ''}`,
  };
};

const svgOf = (tag: string, attributes: Record<string, string>) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

const tileNode = (tile: Tile) => {
  const row = el('div', 'trend-row');
  row.append(el('p', 'trend-value', tile.value));
  if (tile.state.kind === 'line') {
    const spark = sparkPath(tile.state.points);
    if (spark) {
      const line = svgOf('svg', { class: 'trend-line', viewBox: '0 0 96 32', 'aria-hidden': 'true' });
      line.append(
        svgOf('path', { d: spark.d }),
        svgOf('circle', { cx: String(spark.dot.x), cy: String(spark.dot.y), r: '2.5' }),
      );
      const last = el('span', 'trend-last', spark.last % 1 ? spark.last.toFixed(1) : String(spark.last));
      last.setAttribute('aria-hidden', 'true');
      row.append(line, last);
    }
  } else row.append(el('p', 'trend-state', tile.state.text));
  const change = el('p', 'trend-change');
  if (tile.change?.dir) change.append(icon(tile.change.dir === 'up' ? 'trend-up' : 'trend-down'));
  if (tile.change) change.append(el('span', '', tile.change.text));
  const node = el('div', 'trend');
  node.setAttribute('role', 'group');
  node.setAttribute('aria-label', tile.name);
  node.append(
    el('h3', 'trend-label', tile.label),
    row,
    el('p', 'trend-unit', tile.unit),
    change,
    el('p', 'trend-window', tile.window),
  );
  return node;
};

const drawTiles = (board: Board): void => {
  $('home-tiles').replaceChildren(
    ...(['needs', 'working', 'landed', 'median'] as const).map((kind) => tileNode(tileOf(kind, board))),
  );
};

export const drawHome = (board: Board, actions: Actions): void => {
  const spot = spotOf();
  drawList('home-needs', board.columns.needs, (card) => needsRow(card, actions));
  drawList('home-agents', board.columns.running, (card) => agentRow(card, board, actions));
  $('home-system-facts').replaceChildren(
    ...facts(board).map(([name, value]) => {
      const fact = el('div', 'home-fact');
      fact.append(el('dt', '', name), el('dd', '', value));
      return fact;
    }),
  );
  if (spot) restore(spot);
  drawTiles(board);
};
