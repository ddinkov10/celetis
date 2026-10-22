import { $, actionButton, copy, el, icon, iconButton, link, mark, timed } from './ui.mjs';
import { agentOf, diffText, gateOf, laneTrack, prFacts, shortPath, stateLabel } from './view.mjs';

const TONES = {
  waits: 'needs',
  blocked: 'needs',
  works: 'working',
  starts: 'working',
  'no-progress': 'danger',
  'dirty-tree': 'amber',
  unknown: 'muted',
};
const PILL_ICONS = {
  works: 'works',
  starts: 'works',
  waits: 'target',
  'no-progress': 'alert',
  'dirty-tree': 'diff',
  blocked: 'person',
  unknown: 'pending',
};
const ASKS = { dialog: ['question', 'waits for your answer'], turn: ['message', 'ended its turn'] };
const COPIES = { 'no-progress': 'command', 'dirty-tree': 'path' };

const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const section = (title, aside, ...children) => {
  const node = el('section', 'sec');
  const head = el('h3', 'sec-label', title);
  if (aside) head.append(el('span', 'aside', aside));
  node.append(head, ...children);
  return node;
};

const screen = (card) => (card.screen?.length ? el('pre', 'screen', card.screen.join('\n')) : null);

const ask = (card, actions) => {
  const [glyph, verb] = ASKS[card.waitFor] ?? ['target', 'waits for your answer'];
  const node = el('div', 'ask');
  const head = el('div', 'ask-who');
  head.append(
    icon(glyph),
    el('b', '', agentOf(card)?.name ?? 'The agent'),
    el('span', '', verb),
    timed(card.since, true, ' ago'),
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

const steps = (card, flow) => {
  const track = laneTrack(card, flow);
  if (!track) return null;
  const list = el('ol', 'steps');
  for (const step of track) {
    const item = el('li', step.state);
    const node = el('span', 'node');
    node.append(
      icon(step.state === 'done' ? 'check' : step.state === 'now' ? (PILL_ICONS[card.state] ?? 'pending') : 'pending'),
    );
    const note = step.state === 'done' ? 'done' : step.state === 'now' ? (card.state ? stateLabel(card) : 'next') : '';
    item.append(node, el('span', 'name', step.name), el('span', 'note', note));
    item.append(
      gateOf(flow, step.name) === 'auto'
        ? Object.assign(el('span', 'gate gate-auto', 'auto'), {
            title: 'The automatic runner starts this step by itself',
          })
        : el('span'),
    );
    list.append(item);
  }
  return section(
    'Lane',
    `${card.type} · step ${track.findIndex((step) => step.state === 'now') + 1} of ${track.length}`,
    list,
  );
};

const facts = (rows) => {
  const list = el('dl', 'facts');
  for (const [term, value, copyable] of rows.filter(Boolean)) {
    const dd = el('dd', typeof value === 'string' ? 'mono' : '');
    dd.append(value);
    list.append(el('dt', '', term), dd);
    list.append(
      copyable ? iconButton('copy', `Copy the ${copyable[1]}`, () => copy(copyable[0], copyable[1])) : el('span'),
    );
  }
  return list;
};

const pr = (card) => {
  const items = prFacts(card.pr);
  if (items.length === 0) return null;
  const row = el('div', 'chips');
  for (const item of items) {
    const chip = link(`chip2 chip-${item.kind}`, '', item.url);
    chip.append(
      icon(
        item.kind === 'pr'
          ? 'pr'
          : item.kind.startsWith('checks-fail')
            ? 'xcircle'
            : item.kind.startsWith('checks-pass') || item.kind === 'review-approved'
              ? 'check'
              : 'clock',
      ),
      item.text,
    );
    row.append(chip);
  }
  return section('Pull request', null, row);
};

export const drawPanel = (card, { actions, flow, on, close }) => {
  const { state } = card;
  const head = el('div', 'panel-head');
  const crumbs = el('div', 'crumbs');
  crumbs.append(
    mark(card),
    card.number === null ? el('span', 'num none', 'no issue') : link('num', `#${card.number}`, card.url),
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
  const title = el(
    'h2',
    'panel-title',
    card.title || (card.number === null ? 'A session with no prompt yet' : `Issue #${card.number}`),
  );
  title.id = 'panel-title';
  const line = el('div', 'panel-state');
  if (state) {
    const pill = el('span', `pill pill-${TONES[state] ?? 'muted'}`);
    pill.append(icon(PILL_ICONS[state] ?? 'pending'), el('span', 'pill-label', stateLabel(card)));
    line.append(pill);
  } else {
    const pill = el('span', 'pill pill-muted');
    pill.append(icon('pending'), el('span', 'pill-label', `next: ${card.step}`));
    line.append(pill);
  }
  if (card.state !== 'starts') line.append(el('span', '', 'since'), timed(card.since, Boolean(card.sessionId)));
  top.append(title, line);

  const body = el('div', 'panel-body');
  body.append(top);
  if (card.state === 'waits') body.append(ask(card, actions));
  else if (actions.length) {
    const row = el('div', 'panel-actions');
    row.append(...actions.map((action) => actionButton(action)));
    body.append(row);
  }
  const isSession = Boolean(card.sessionId);
  const details = isSession
    ? [
        ['Agent', agentOf(card)?.name ?? 'unknown'],
        card.cwd && ['Folder', card.cwd, [card.cwd, 'folder']],
        card.diff && [
          'Changes',
          `${diffText(card.diff)} · ${card.diff.files} ${card.diff.files === 1 ? 'file' : 'files'}`,
        ],
      ]
    : [
        card.act &&
          COPIES[card.state] && [
            COPIES[card.state] === 'path' ? 'Worktree' : 'Command',
            shortPath(card.act),
            [card.act, COPIES[card.state]],
          ],
        card.act && !COPIES[card.state] && ['Your act', card.act],
        ['Updated', `${clock(card.since)}`],
      ];
  const pane = isSession && card.state !== 'waits' ? screen(card) : null;
  body.append(
    ...[
      pr(card),
      steps(card, flow),
      section(isSession ? 'Session' : 'Issue', null, facts(details)),
      pane && section('Screen', 'the last lines of its pane', pane),
    ].filter(Boolean),
  );
  $('panel').setAttribute('aria-labelledby', 'panel-title');
  $('panel').dataset.state = state ?? 'next';
  return [head, body];
};
