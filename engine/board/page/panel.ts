import type { Registry } from '../../lib/host/names.ts';
import type { RowSource, StartPair } from '../../lib/workflow/effort.ts';
import type { Action, Card, DaemonView, Flow } from '../types.ts';
import {
  agentOf,
  clock,
  diffText,
  gateOf,
  LIVE,
  laneTrack,
  levelSource,
  modelSource,
  shortPath,
  stateLabel,
} from '../view.ts';
import { $, actionButton, copy, el, gateLabel, icon, iconButton, link, mark, prChips, timed } from './ui.ts';

const TONES: Record<string, string> = {
  waits: 'needs',
  blocked: 'needs',
  works: 'working',
  starts: 'working',
  'no-progress': 'danger',
  'quota-wait': 'muted',
  'dirty-tree': 'amber',
};
const PILL_ICONS: Record<string, string> = {
  works: 'works',
  starts: 'works',
  waits: 'target',
  'no-progress': 'alert',
  'set-aside': 'aside',
  stopping: 'stop',
  'dirty-tree': 'diff',
  blocked: 'person',
  'quota-wait': 'clock',
};
const ASKS: Record<string, [string, string]> = {
  dialog: ['question', 'waits for your answer'],
  turn: ['message', 'ended its turn'],
};
const COPIES: Record<string, string> = { 'no-progress': 'command', 'set-aside': 'command', 'dirty-tree': 'path' };

const section = (title: string, aside: string | null, ...children: HTMLElement[]) => {
  const node = el('section', 'sec');
  const head = el('h3', 'sec-label', title);
  if (aside) head.append(el('span', 'aside', aside));
  node.append(head, ...children);
  return node;
};

const screen = (card: Card) => (card.screen?.length ? el('pre', 'screen', card.screen.join('\n')) : null);

const ask = (card: Card, actions: Action[], registry: Registry) => {
  const [glyph, verb] = ASKS[card.waitFor as string] ?? ['target', 'waits for your answer'];
  const node = el('div', 'ask');
  const head = el('div', 'ask-who');
  head.append(
    icon(glyph),
    el('b', '', agentOf(card, registry)?.name ?? 'The agent'),
    el('span', '', verb),
    timed(card.since, LIVE.has(card.state as string), ' ago'),
  );
  node.append(head);
  const lines = screen(card);
  if (lines) node.append(lines);
  const foot = el('div', 'ask-foot');
  foot.append(
    el('span', 'hint', 'Answer it in the terminal pane.'),
    ...actions.slice(0, 1).map((action) => actionButton(action)),
  );
  node.append(foot);
  return node;
};

const steps = (card: Card, flow: Flow | null, auto: DaemonView['auto']) => {
  const track = laneTrack(card, flow);
  if (!track) return null;
  const list = el('ol', 'steps');
  for (const step of track) {
    const item = el('li', step.state);
    const node = el('span', 'node');
    node.append(
      icon(
        step.state === 'done'
          ? 'check'
          : step.state === 'now'
            ? (PILL_ICONS[card.state as string] ?? 'pending')
            : 'pending',
      ),
    );
    const note = step.state === 'done' ? 'done' : step.state === 'now' ? (card.state ? stateLabel(card) : 'next') : '';
    item.append(node, el('span', 'name', step.name), el('span', 'note', note));
    item.append(gateOf(flow, step.name) === 'auto' ? gateLabel(auto) : el('span'));
    list.append(item);
  }
  return section(
    'Lane',
    `${card.type} · step ${track.findIndex((step) => step.state === 'now') + 1} of ${track.length}`,
    list,
  );
};

type Fact = [string, string | HTMLElement, [string, string]?];
const facts = (rows: (Fact | null | false | '' | undefined)[]) => {
  const list = el('dl', 'facts');
  for (const [term, value, copyable] of rows.filter((row): row is Fact => Boolean(row))) {
    const dd = el('dd', typeof value === 'string' ? 'mono' : '');
    dd.append(value);
    list.append(el('dt', '', term), dd);
    list.append(
      copyable ? iconButton('copy', `Copy the ${copyable[1]}`, () => copy(copyable[0], copyable[1])) : el('span'),
    );
  }
  return list;
};

const whyOf = (pair: StartPair<RowSource>) => {
  const pinned = (['model', 'level'] as const).filter((part) => pair.source[part] === 'pinned');
  const pin = pinned.length
    ? `The config pins ${pinned.length === 2 ? 'the model and the level' : `the ${pinned[0]}`} of this step.`
    : '';
  const decision = pair.decision
    ? pair.decision.reason || 'No reason given.'
    : pin
      ? ''
      : 'No decision on the issue; the default applies.';
  return [decision, pin].filter(Boolean).join(' ');
};

const effortFacts = (pair: StartPair<RowSource> | null | undefined): Fact[] =>
  pair
    ? [
        ['Model', `${pair.model} · ${modelSource(pair)}`],
        ['Effort', `${pair.level} · ${levelSource(pair)}`],
        ['Why', el('span', 'why', whyOf(pair))],
      ]
    : [];

const pr = (card: Card) => {
  const row = prChips(card.pr);
  return row && section('Pull request', null, row);
};

export const drawPanel = (
  card: Card,
  {
    actions,
    flow,
    registry,
    on,
    close,
    auto,
  }: {
    actions: Action[];
    flow: Flow | null;
    registry: Registry;
    on: string;
    close: () => void;
    auto: DaemonView['auto'];
  },
) => {
  const { state } = card;
  const asks = state === 'waits' && (card.number !== null || card.waitFor === 'dialog');
  const head = el('div', 'panel-head');
  const crumbs = el('div', 'crumbs');
  crumbs.append(
    mark(card, registry, true),
    card.number === null ? el('span', 'num none', 'human session') : link('num', `#${card.number}`, card.url),
  );
  for (const part of [card.type, card.step === card.type ? null : card.step])
    if (part) crumbs.append(el('span', 'sep', '·'), el('span', '', part));
  head.append(crumbs);
  if (card.url) {
    const open = Object.assign(el('a', 'icon-btn'), {
      href: card.url,
      target: '_blank',
      rel: 'noreferrer',
      title: `Open the issue${on} (o)`,
    });
    open.setAttribute('aria-label', `Open the issue${on}`);
    open.append(icon('open'));
    head.append(open);
  }
  head.append(iconButton('close', 'Close the details (Esc)', close));

  const top = el('div', 'panel-top');
  const title = el('h2', 'panel-title', card.title || (card.number === null ? 'A session' : `Issue #${card.number}`));
  title.id = 'panel-title';
  const line = el('div', 'panel-state');
  if (state) {
    const pill = el('span', `pill pill-${(state !== 'waits' || asks ? TONES[state] : null) ?? 'muted'}`);
    pill.append(icon(PILL_ICONS[state] ?? 'pending'), el('span', 'pill-label', stateLabel(card)));
    line.append(pill);
  } else {
    const pill = el('span', 'pill pill-muted');
    pill.append(icon('pending'), el('span', 'pill-label', `next: ${card.step}`));
    line.append(pill);
  }
  if (card.state !== 'starts')
    line.append(el('span', '', 'since'), timed(card.since, Boolean(card.sessionId) && LIVE.has(card.state as string)));
  top.append(title, line);
  if (card.warning) top.append(el('p', 'warning', card.warning));

  const body = el('div', 'panel-body');
  body.append(top);
  if (asks) body.append(ask(card, actions, registry));
  else if (actions.length) {
    const row = el('div', 'panel-actions');
    actions.forEach((action, index) => {
      if (action.group && action.group !== actions[index - 1]?.group)
        row.append(el('span', 'action-group', action.group));
      row.append(actionButton(action));
      if (action.help) row.append(el('span', 'action-help', action.help));
    });
    body.append(row);
  }
  const isSession = Boolean(card.sessionId);
  const details: (Fact | null | false | '' | undefined)[] = isSession
    ? [
        ['Agent', agentOf(card, registry)?.name ?? 'unknown'],
        card.cwd && ['Folder', card.cwd, [card.cwd, 'folder']],
        card.diff && [
          'Changes',
          `${diffText(card.diff)} · ${card.diff.files} ${card.diff.files === 1 ? 'file' : 'files'}`,
        ],
      ]
    : [
        card.act &&
          COPIES[card.state as string] && [
            COPIES[card.state as string] === 'path' ? 'Worktree' : 'Command',
            shortPath(card.act),
            [card.act, COPIES[card.state as string] as string],
          ],
        card.act && !COPIES[card.state as string] && ['Your act', card.act],
        ...effortFacts(card.effort),
        ['Updated', clock(card.since)],
      ];
  const pane = isSession && !asks ? screen(card) : null;
  body.append(
    ...[
      pr(card),
      steps(card, flow, auto),
      section(isSession ? 'Session' : 'Issue', null, facts(details)),
      pane && section('Screen', 'the last lines of its pane', pane),
    ].filter((node): node is HTMLElement => Boolean(node)),
  );
  $('panel').setAttribute('aria-labelledby', 'panel-title');
  $('panel').dataset.state = state ?? 'next';
  return [head, body];
};
