import { grammar } from '../../lib/tracker/grammar.ts';
import type { Board } from '../types.ts';
import { clock } from '../view.ts';

export const queueText = (board: Board) => {
  const count = board.queue?.record?.numbers.length ?? 0;
  return count === 0 ? 'empty' : `${count} issue${count === 1 ? '' : 's'}`;
};

export const facts = (board: Board): [string, string][] => {
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

export type Tile = {
  label: string;
  value: string;
  unit: string;
  change: { dir: 'up' | 'down' | null; text: string } | null;
  window: string;
  source: string;
  state: { kind: 'line'; points: (number | null)[] } | { kind: 'few' | 'reading' | 'failed'; text: string };
  name: string;
};

export type Kind = 'needs' | 'working' | 'landed' | 'median';

const NONE = '–';
const BEFORE = 'the 7 days before';

export const sparkPath = (points: readonly (number | null)[]) => {
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

export const tileOf = (kind: Kind, board: Board): Tile => {
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
      ? {
          kind: 'few',
          text: isLive
            ? 'Too few samples yet'
            : grammar().kind === 'local'
              ? 'No landings listed'
              : 'Too few landings yet',
        }
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
