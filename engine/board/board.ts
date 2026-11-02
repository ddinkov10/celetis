import { type Effort, type Level, levels } from '../lib/effort.ts';
import { openMenu, openPalette, setupMenu, setupPalette } from './palette.ts';
import { drawPanel } from './panel.ts';
import { drawQueue, setQueueOpen, setupQueue } from './queue.ts';
import type { Action, Board, Card, Column, Columns, Flow, MenuEntry, PaletteItem } from './types.ts';
import {
  $,
  actionButton,
  copy,
  el,
  icon,
  iconButton,
  link,
  mark,
  post,
  SERVER_DOWN,
  store,
  timed,
  toast,
} from './ui.ts';
import { isReconnecting, setupUpdates } from './update-dialog.ts';
import {
  age,
  agentOf,
  COLUMNS,
  cleanCause,
  effortSource,
  favicon,
  groupNeeds,
  keyOf,
  laneTrack,
  needsYou,
  notice,
  pageTitle,
  pipeline,
  prFacts,
  runTitle,
  shortPath,
  signature,
  startTitle,
  stateLabel,
  tail,
  tone,
} from './view.ts';

const SUMMARY: [Column | 'history', string][] = [
  ['needs', 'need you'],
  ['running', 'running'],
  ['idle', 'idle'],
  ['history', 'landed'],
];
const COPY: Record<string, string> = { 'no-progress': 'command', 'dirty-tree': 'path' };
const ON_ISSUE = new Set(['blocked']);
const LIVE = new Set(['works', 'waits']);
const GATES: Record<string, string> = {
  me: 'This step starts only when you press Run',
  auto: 'The automatic runner starts this step by itself',
};
const STATUS_ICONS: Record<string, string> = {
  works: 'works',
  starts: 'works',
  waits: 'target',
  'no-progress': 'alert',
  'dirty-tree': 'diff',
  blocked: 'person',
};
const FIND_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
const DEFAULT_AGENT_REASON = 'The main .celetis.yaml controls the default agent. Change host there.';
const QUEUE_LEVEL = 'The queue starts this step at the decided level';

let data: Board | null = null;
let selected: string | null = null;
let view = store.get('view') === 'pipeline' ? 'pipeline' : 'now';
let isNotifyOn = store.get('notify') === 'on';
let isKeysOn = store.get('keys') !== 'off';
let isHistoryOpen = false;
let isQueueOpen = false;
let isServerDown = false;
let intakePending = false;
let seen: Map<string, string> | null = null;
let needsKeys: Set<string> | null = null;
let starting: Map<number, string | null> | null = null;
let byKey = new Map<string, { card: Card; column: Column }>();
let used = new Set<string>();

const who = (card: Card) =>
  card.number === null ? (card.title ? `human session "${card.title}"` : 'a human session') : `#${card.number}`;
const canRunLater = (card: Card) =>
  card.sessionId === null && card.step && (card.state === null || card.state === 'no-progress');
const copyWhat = (card: Card) => (card.act ? COPY[card.state as string] : null);
const onTracker = () => ((data as Board).tracker ? ` on ${(data as Board).tracker}` : '');
const readAgain = () => (data?.tracker ? `Read ${(data as Board).tracker} again` : 'Read the issues again');

const act = async (path: string, value: unknown, failure: string, onDone?: () => void) => {
  if (isReconnecting()) return false;
  const isOk = await post(path, value, failure);
  if (isOk) onDone?.();
  await load();
  return isOk;
};

const intakeReason = () => {
  if (isReconnecting()) return 'The board is reconnecting';
  if (intakePending) return 'An intake tab is opening';
  const readAt = Date.parse(data?.source.readAt ?? '');
  if (!data || isServerDown || data.source.error || !Number.isFinite(readAt) || Date.now() - readAt > 60_000)
    return null;
  const agent = data.defaultAgent === null ? undefined : data.agents?.[data.defaultAgent];
  return agent?.available === false ? cleanCause(agent.cause) || 'The default agent is unavailable' : null;
};

function drawIntake(): void {
  const button = $('intake');
  const reason = intakeReason();
  button.setAttribute('aria-disabled', String(reason !== null));
  button.setAttribute('aria-busy', String(intakePending));
  button.title = reason ?? 'Open a fresh intake session';
  (button.querySelector('.label') as HTMLElement).textContent = intakePending ? 'Opening…' : 'New intake';
  $('intake-reason').textContent = intakePending ? '' : (reason ?? '');
  $('intake-reason').hidden = intakePending || reason === null;
}

async function openIntake(): Promise<void> {
  if (intakeReason() !== null) return;
  intakePending = true;
  drawIntake();
  $('announce').textContent = 'Opening an intake tab';
  try {
    const outcome = await post('/api/intake', {}, 'New intake failed', { timeout: 10000 });
    if (outcome.status === 'accepted') $('announce').textContent = 'Intake tab opened';
    else {
      const detail =
        outcome.status === 'rejected'
          ? outcome.error
          : [
              outcome.error,
              'The launch outcome is unknown. Check Human sessions or herdr before pressing New intake again.',
            ]
              .filter(Boolean)
              .join(' ');
      toast('New intake failed', { detail, isError: true });
      $('announce').textContent = `New intake failed. ${detail}`;
    }
  } finally {
    intakePending = false;
    drawIntake();
  }
}

const agentDisplay = (id: string) => agentOf({ agent: id })?.name ?? id;

const runReason = (agent: string | null, number?: number | null) => {
  if (data?.noRun) return data.noRun;
  const record = data?.queue?.record;
  if (record?.state === 'me-gate' && record.numbers[0] === number) {
    if (agent !== null && agent !== record.host) return `queue: recorded host is ${record.host}`;
    agent = record.host;
  }
  const agents = data?.agents;
  if (agent) {
    const entry = agents?.[agent];
    if (entry && entry.available === false) return cleanCause(entry.cause);
    return null;
  }
  const def = data?.defaultAgent;
  if (def != null && agents?.[def]?.available === false) return cleanCause(agents[def].cause);
  return null;
};

const runName = ({ step, effort, number }: Card) =>
  `Run ${step}${effort ? ` at ${effort.level} (${effortSource(effort)})` : ''}, #${number}`;

const runAction = (card: Card, agent: string | null = null): Action => {
  const display = agent ? agentDisplay(agent) : null;
  const reason = runReason(agent, card.number);
  const name = agent ? `Run ${card.step}, #${card.number} with ${display}` : runName(card);
  return {
    id: agent ? `run:${agent}` : 'run',
    label: agent ? `Run with ${display}` : 'Run',
    icon: 'run',
    busy: 'Starting',
    name,
    title: reason ?? runTitle(card.step, (data as Board).flow, card.effort),
    isDisabled: Boolean(reason),
    run: reason
      ? async () => toast(reason, { isError: true })
      : async () => {
          if (await launch(card, '/api/run', agent ?? undefined))
            toast(`Started the ${card.step} step of #${card.number} in a new herdr tab`);
        },
  };
};

const overrideActionsOf = (card: Card, isAgain: boolean): Action[] => {
  const agents = data?.agents;
  if (!card.run || !agents || data?.noRun) return [];
  return Object.keys(agents).map((id) => {
    const display = agentDisplay(id);
    const base = runAction(card, id);
    return isAgain
      ? {
          ...base,
          label: `Run again with ${display}`,
          name: `Run ${card.step} again, #${card.number} with ${display}`,
          isGhost: true,
          title: base.isDisabled ? base.title : `Start the ${card.step} step again. It made no progress last time.`,
        }
      : base;
  });
};

const levelEntries = (card: Card): (MenuEntry | 'rule')[] => {
  const { effort } = card;
  if (!effort || !(card.run || data?.noRun)) return [];
  const record = data?.queue?.record;
  const reason =
    data?.noRun ||
    (record?.state === 'me-gate' && record.numbers[0] === card.number ? QUEUE_LEVEL : runReason(null, card.number));
  return [
    'rule',
    ...levels.map((level) => ({
      icon: level === effort.level ? 'check' : 'run',
      label: `Run at ${level}${level === effort.level ? ` (${effortSource(effort)})` : ''}`,
      title: reason ?? startTitle(card.step, effort, level),
      isDisabled: Boolean(reason),
      run: reason
        ? async () => toast(reason, { isError: true })
        : async () => {
            if (await launch(card, '/api/run', undefined, level))
              toast(`Started the ${card.step} step of #${card.number} at ${level} in a new herdr tab`);
          },
    })),
  ];
};

const defaultAgentEntry = {
  icon: 'person',
  label: 'Default agent is read-only',
  key: '',
  isDisabled: true,
  title: DEFAULT_AGENT_REASON,
  run: async () => toast(DEFAULT_AGENT_REASON, { isError: true }),
};

const agentMenuOf = () => [defaultAgentEntry];

const toMenuEntry = (action: Action): MenuEntry => ({
  icon: action.icon,
  label: action.name,
  key: action.isMain ? 'Enter' : '',
  isDisabled: action.isDisabled,
  title: action.title,
  run: action.href ? () => window.open(action.href, '_blank', 'noopener,noreferrer') : (action.run as () => unknown),
});

const actionsOf = (card: Card): Action[] => {
  const list: Action[] = [];
  if (card.go) {
    list.push({
      id: 'go',
      label: 'Go',
      icon: 'go',
      busy: 'Focusing',
      name: `Go to the pane of ${who(card)}`,
      title: 'Focus its pane in herdr (Enter)',
      run: () =>
        act('/api/go', { sessionId: card.sessionId }, 'Go failed', () =>
          toast(`Focused the pane of ${who(card)} in herdr`, { detail: 'Switch to your terminal to see it.' }),
        ),
    });
  }
  if (card.state === 'blocked') {
    const reason = runReason(null);
    list.push({
      id: 'assist',
      label: 'Open agent',
      icon: 'terminal',
      busy: 'Starting',
      name: `Open agent for #${card.number}`,
      title: reason ?? 'Open an assistance session in a new herdr tab (Enter)',
      isDisabled: Boolean(reason) || !card.assist,
      run: async () => {
        if (await launch(card, '/api/assist'))
          toast(`Opened an assistance session for #${card.number} in a new herdr tab`, {
            detail: 'Switch to your terminal to see it.',
          });
      },
    });
  }
  if (card.state === 'no-progress') {
    if (card.resume) {
      list.push({
        id: 'resume',
        label: 'Resume',
        icon: 'terminal',
        busy: 'Opening',
        name: `Resume the ${card.step} session of #${card.number}`,
        title: 'Open the session of this step again in a new herdr tab (Enter)',
        run: async () => {
          if (await launch(card, '/api/resume'))
            toast(`Opened the ${card.step} session of #${card.number} in a new herdr tab`, {
              detail: 'Switch to your terminal to see it.',
            });
        },
      });
    }
    if (card.run) {
      const base = runAction(card);
      list.push({
        ...base,
        label: 'Run again',
        name: `Run ${card.step} again, #${card.number}`,
        isGhost: true,
        title: base.isDisabled ? base.title : `Start the ${card.step} step again. It made no progress last time.`,
      });
      list.push(...overrideActionsOf(card, true));
    }
  } else if (card.run) {
    list.push(runAction(card));
    list.push(...overrideActionsOf(card, false));
  }
  if (card.state === 'dirty-tree') {
    list.push({
      id: 'shell',
      label: 'Open shell',
      icon: 'terminal',
      busy: 'Opening',
      name: `Open a shell in the worktree of #${card.number}`,
      title: 'Open a shell in the worktree in a new herdr tab (Enter)',
      run: () =>
        act('/api/shell', { number: card.number }, 'Open shell failed', () =>
          toast(`Opened a shell in the worktree of #${card.number}`, {
            detail: 'Commit or stash the changes there; then the card moves on.',
          }),
        ),
    });
  }
  if (ON_ISSUE.has(card.state as string) && card.url) {
    list.push({
      id: 'open',
      label: 'Open issue',
      icon: 'open',
      name: `Open issue #${card.number}${onTracker()}`,
      title: `Open the issue${onTracker()}${list.length === 0 ? ' (Enter)' : ''}`,
      href: card.url,
    });
  }
  const { noRun } = data as Board;
  if (noRun && canRunLater(card)) {
    list.push({
      id: 'blocked',
      label: 'Run',
      icon: 'run',
      name: runName(card),
      title: noRun,
      isDisabled: true,
      run: async () => toast(noRun, { isError: true }),
    });
    if (data?.agents)
      for (const id of Object.keys(data.agents)) {
        const display = agentDisplay(id);
        list.push({
          id: `run:${id}`,
          label: `Run with ${display}`,
          icon: 'run',
          name: `Run ${card.step}, #${card.number} with ${display}`,
          title: noRun,
          isDisabled: true,
          run: async () => toast(noRun, { isError: true }),
        });
      }
  }
  list.forEach((action, index) => {
    action.isMain = index === 0;
  });
  return list;
};

const menuOf = (card: Card, key: string): (MenuEntry | 'rule')[] => [
  ...actionsOf(card).map(toMenuEntry),
  ...levelEntries(card),
  'rule',
  { icon: 'panel', label: 'Show the details', key: 'Space', run: () => openPanel(key) },
  ...(card.url && !ON_ISSUE.has(card.state as string)
    ? [
        {
          icon: 'open',
          label: `Open the issue${onTracker()}`,
          key: 'o',
          run: () => window.open(card.url as string, '_blank', 'noopener,noreferrer'),
        },
      ]
    : []),
  ...(copyWhat(card)
    ? [
        {
          icon: 'copy',
          label: `Copy the ${copyWhat(card)}`,
          key: 'c',
          run: () => copy(card.act as string, copyWhat(card) as string),
        },
      ]
    : []),
];

const track = (card: Card) => {
  const steps = laneTrack(card, (data as Board).flow);
  if (!steps) return null;
  const at = steps.findIndex((step) => step.state === 'now');
  const node = el('span', 'track');
  node.setAttribute('role', 'img');
  node.setAttribute(
    'aria-label',
    `Step ${at + 1} of ${steps.length}: ${(steps[at] as { name: string; state: string }).name}`,
  );
  node.title = steps
    .map((step) => (step.state === 'next' ? step.name : `${step.name} (${step.state === 'now' ? 'now' : 'done'})`))
    .join(' · ');
  node.append(...steps.map((step) => el('i', `seg ${step.state}`)));
  return node;
};

const gate = (value: string | null) =>
  value === 'auto' ? Object.assign(el('span', 'gate gate-auto', 'auto'), { title: GATES.auto }) : null;

const effortChip = (effort: Effort) => {
  const chip = el('span', `effort${effort.source === 'default' ? ' is-default' : ''}`, effort.level);
  chip.title = `effort ${effort.level}, ${effortSource(effort)}`;
  chip.setAttribute('role', 'img');
  chip.setAttribute('aria-label', chip.title);
  return chip;
};

const status = (card: Card, hasGlyph = true, isShort = false) => {
  const node = el('span', 'status');
  if (card.state) {
    if (hasGlyph) node.append(icon(STATUS_ICONS[card.state as string] ?? 'pending'));
    node.append(el('span', 'status-label', stateLabel(card)));
    if (isShort) return node;
    const agent = agentOf(card);
    if (agent) node.append(el('span', 'detail agent-name', agent.name));
    if (card.step && card.step !== card.type) node.append(el('span', 'detail mono', card.step));
  } else if (card.step) {
    node.classList.add('next');
    if (hasGlyph) node.append(icon('pending'));
    node.append(el('span', 'lead', 'next'), el('span', 'mono step', card.step));
    if (card.effort) node.append(effortChip(card.effort));
    const auto = gate(card.gate);
    if (auto) node.append(auto);
  }
  return node;
};

const liveLine = (card: Card) => {
  if (!card.diff) return null;
  const node = el('div', 'live');
  const delta = el('span', 'delta');
  delta.append(el('i', '', `+${card.diff.added}`), ` −${card.diff.removed}`);
  node.append(
    icon('diff'),
    el('span', 'target', `${card.diff.files} ${card.diff.files === 1 ? 'file' : 'files'} changed`),
    delta,
  );
  node.title = 'Changed since the branch left its base';
  return node;
};

const chips = (card: Card) => {
  const items = prFacts(card.pr);
  if (items.length === 0) return null;
  const node = el('div', 'chips');
  for (const item of items) {
    const chip = link(`chip2 chip-${item.kind}`, '', item.url);
    chip.append(
      icon(
        item.kind === 'pr'
          ? 'pr'
          : item.kind === 'checks-fail'
            ? 'xcircle'
            : item.kind === 'checks-pass' || item.kind === 'review-approved'
              ? 'check'
              : 'clock',
      ),
      item.text,
    );
    if (item.url) chip.addEventListener('click', (event) => event.stopPropagation());
    node.append(chip);
  }
  return node;
};

const actLine = (card: Card) => {
  const what = copyWhat(card);
  if (!what) return el('p', 'act', card.act);
  const node = el('p', 'act code');
  const code = el('code');
  shortPath(card.act as string)
    .split('/')
    .forEach((part, index) => {
      code.append(...(index ? [el('wbr'), `/${part}`] : [part]));
    });
  code.title = card.act as string;
  node.append(
    code,
    iconButton('copy', `Copy the ${what}`, () => copy(card.act as string, what), 'copy'),
  );
  (node.lastChild as HTMLElement).title = `Copy the ${what} (c)`;
  return node;
};

const keyFor = (card: Card) => {
  let key = keyOf(card);
  while (used.has(key)) key += '-x';
  used.add(key);
  return key;
};

const shell = (card: Card, column: Column, isCompact: boolean, level: 'h2' | 'h3' | 'h4' = 'h3') => {
  const key = keyFor(card);
  byKey.set(key, { card, column });
  const node = el('article', `card${isCompact ? ' compact' : ''}${key === selected ? ' is-selected' : ''}`);
  node.dataset.state = card.state ?? 'next';
  node.dataset.key = key;
  node.tabIndex = -1;
  node.style.viewTransitionName = key;
  if (card.url) node.dataset.url = card.url;
  if (seen !== null && seen.get(key) !== signature(card, column)) node.classList.add('is-unseen');
  const text = card.title || `Issue #${card.number}`;
  const title = el(level, 'title');
  title.id = `t-${key}`;
  title.title = text;
  title.append(link('', text, card.url));
  title.querySelector<HTMLElement>('a')?.addEventListener('click', (event) => event.stopPropagation());
  node.setAttribute('aria-labelledby', title.id);
  const id = link('num', `#${card.number}`, card.url);
  id.addEventListener('click', (event) => event.stopPropagation());
  return { key, node, title, id };
};

const unseenDot = () => Object.assign(el('i', 'unseen'), { title: 'Changed since you last looked' });

const runWithButton = (card: Card) => {
  const actions = actionsOf(card);
  if (!['run', 'blocked'].includes(actions[0]?.id as string)) return null;
  const entries = actions.filter((action) => action.id.startsWith('run:')).map(toMenuEntry);
  if (entries.length === 0) return null;
  const levelled = levelEntries(card);
  const button = iconButton(
    'chevron',
    levelled.length ? 'Run with another agent or at another level' : 'Run with another agent',
    (event) => openMenu(event.currentTarget as HTMLElement, [...entries, ...levelled]),
  );
  button.setAttribute('aria-haspopup', 'menu');
  return button;
};

const drawCard = (
  card: Card,
  column: Column,
  { isCompact = false, level }: { isCompact?: boolean; level?: 'h2' | 'h3' | 'h4' } = {},
) => {
  const { key, node, title, id } = shell(card, column, isCompact, level);
  const actions = actionsOf(card);
  const isQuiet = column !== 'needs';
  if (isCompact) {
    const meta = el('div', 'meta');
    meta.append(id);
    if (card.type && card.type !== card.step) {
      const type = el('span', 'meta-type');
      type.append(el('span', 'sep', '·'), card.type);
      meta.append(type);
    }
    meta.append(el('span', 'sep', '·'), status(card, card.state === 'starts', true));
    const main = el('div', 'main');
    main.append(title, meta);
    if (card.warning) main.append(el('p', 'warning', card.warning));
    node.append(mark(card), main);
    if (actions[0]) {
      const withButton = runWithButton(card);
      if (withButton) {
        const btns = el('div', 'compact-btns');
        btns.append(actionButton(actions[0], isQuiet), withButton);
        node.append(btns);
      } else {
        node.append(actionButton(actions[0], isQuiet));
      }
    }
    if (node.classList.contains('is-unseen')) node.append(unseenDot());
    return node;
  }
  const head = el('div', 'card-head');
  if (node.classList.contains('is-unseen')) head.append(unseenDot());
  head.append(mark(card), id);
  if (card.type) head.append(el('span', 'sep', '·'), el('span', 'type', card.type));
  const lane = track(card);
  if (lane) head.append(lane);
  const more = iconButton('dots', 'More actions (m)', () => openMenu(more, menuOf(card, key)), 'more');
  more.setAttribute('aria-haspopup', 'menu');
  head.append(more);
  node.append(head, title);
  for (const part of [
    card.state === 'works' ? liveLine(card) : null,
    chips(card),
    card.act ? actLine(card) : null,
    card.warning ? el('p', 'warning', card.warning) : null,
  ])
    if (part) node.append(part);
  const end = el('div', 'foot-end');
  if (card.state !== 'starts') end.append(timed(card.since, Boolean(card.sessionId) && LIVE.has(card.state as string)));
  if (actions[0]) end.append(actionButton(actions[0], isQuiet));
  const withButton = runWithButton(card);
  if (withButton) end.append(withButton);
  const foot = el('div', 'card-foot');
  foot.append(status(card), end);
  node.append(foot);
  return node;
};

const glyph = (key: Column) => {
  const node = el('span', 'glyph');
  node.append(icon(`col-${key}`));
  return node;
};

const empty = (key: Column, [title, text]: [string, string]) => {
  const node = el('div', `empty empty-${key}`);
  node.append(
    icon(key === 'needs' ? 'clear' : `col-${key}`),
    el('p', 'empty-title', title),
    el('p', 'empty-text', text),
  );
  return node;
};

const needsBody = (cards: Card[]) =>
  groupNeeds(cards).map((group) => {
    const node = el('div', `group group-${group.key}`);
    node.dataset.group = group.key;
    node.dataset.short = group.short;
    const label = el('h3', 'group-label');
    label.id = `g-${group.key}`;
    label.append(el('span', '', group.label), el('span', 'group-count', String(group.cards.length)));
    node.setAttribute('role', 'group');
    node.setAttribute('aria-labelledby', label.id);
    node.append(
      label,
      ...group.cards.map((card: Card) => drawCard(card, 'needs', { isCompact: group.isCompact, level: 'h4' })),
    );
    return node;
  });

const column = ({ key, name, note, empty: copyOf }: (typeof COLUMNS)[number], cards: Card[]) => {
  const section = el('section', `col col-${key}`);
  section.id = `col-${key}`;
  section.setAttribute('aria-labelledby', `h-${key}`);
  section.classList.toggle(
    'has-waits',
    cards.some((card: Card) => card.state === 'waits'),
  );
  const heading = el('h2', 'col-name', name);
  heading.id = `h-${key}`;
  const head = el('header', 'col-head');
  head.title = note;
  head.append(glyph(key), heading, el('span', 'count', String(cards.length)));
  const body = el('div', 'col-body');
  if (cards.length === 0) body.append(empty(key, copyOf));
  else if (key === 'needs') body.append(...needsBody(cards), drawTail());
  else body.append(...cards.map((card: Card) => drawCard(card, key, { isCompact: key === 'idle' })));
  section.append(head, body);
  return section;
};

const drawTail = () => {
  const wrap = el('div', 'tail-wrap');
  const button = el('button', 'tail');
  button.type = 'button';
  button.append(icon('chevron'), el('span', 'tail-text'));
  button.addEventListener('click', () => {
    const first = [...document.querySelectorAll<HTMLElement>('.col-needs .card[data-key]')].find(
      (node) => node.dataset.hidden === 'true',
    );
    first?.scrollIntoView({
      block: 'center',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    first?.focus({ preventScroll: true });
  });
  wrap.append(button);
  wrap.hidden = true;
  return wrap;
};

let tailFrame = 0;
const updateTail = () => {
  cancelAnimationFrame(tailFrame);
  tailFrame = requestAnimationFrame(() => {
    const body = document.querySelector<HTMLElement>('.col-needs .col-body');
    const wrap = body?.querySelector<HTMLElement>('.tail-wrap');
    if (!body || !wrap) return;
    const bottom = body.getBoundingClientRect().bottom - (wrap.hidden ? 0 : wrap.offsetHeight);
    const counts = new Map();
    for (const node of body.querySelectorAll<HTMLElement>('.card[data-key]')) {
      const isHidden = node.getBoundingClientRect().top > bottom - 24;
      node.dataset.hidden = String(isHidden);
      if (!isHidden) continue;
      const group = node.closest<HTMLElement>('.group') as HTMLElement;
      counts.set(group.dataset.group, {
        short: group.dataset.short,
        count: (counts.get(group.dataset.group)?.count ?? 0) + 1,
      });
    }
    const text = body.scrollHeight > body.clientHeight + 4 ? tail([...counts.values()]) : '';
    wrap.hidden = text === '';
    (wrap.querySelector<HTMLElement>('.tail-text') as HTMLElement).textContent = text;
  });
};

const pipelineView = (columns: Columns, flow: Flow | null) => {
  const cards = [...columns.needs, ...columns.running, ...columns.idle];
  const where = new Map<Card, Column>([
    ...columns.needs.map((c): [Card, Column] => [c, 'needs']),
    ...columns.running.map((c): [Card, Column] => [c, 'running']),
    ...columns.idle.map((c): [Card, Column] => [c, 'idle']),
  ]);
  const { stages, hold } = pipeline(cards, flow);
  const sections = [];
  if (hold.length) {
    const strip = el('section', 'col hold');
    strip.setAttribute('aria-label', 'Not in a lane step');
    const label = el('h2', 'hold-label', 'Not in a step');
    const list = el('div', 'hold-list');
    list.append(...hold.map((card: Card) => drawCard(card, where.get(card) as Column, { isCompact: true })));
    strip.append(label, list);
    sections.push(strip);
  }
  for (const stage of stages) {
    const section = el('section', 'col stage');
    section.setAttribute('aria-labelledby', `s-${stage.key}`);
    const head = el('header', 'col-head');
    head.title = stage.steps.join(', ');
    const heading = el('h2', 'col-name', stage.name);
    heading.id = `s-${stage.key}`;
    head.append(heading, el('span', 'count', String(stage.cards.length)));
    const body = el('div', 'col-body');
    body.append(
      ...(stage.cards.length
        ? stage.cards.map((card: Card) => drawCard(card, where.get(card) as Column, { isCompact: true }))
        : [el('p', 'stage-empty', 'No issue at this step')]),
    );
    section.append(head, body);
    sections.push(section);
  }
  return sections;
};

const focusFirst = (selector: string) => {
  if (isQueueOpen) showQueue(false);
  const target = document.querySelector<HTMLElement>(selector);
  target?.focus();
  target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

const summary = (columns: Columns) =>
  SUMMARY.map(([key, label]) => {
    const count =
      key === 'history'
        ? (data?.history?.entries.length ?? 0)
        : key === 'needs'
          ? needsYou(columns).length
          : columns[key].length;
    const chip = el('button', `chip chip-${key}`);
    chip.type = 'button';
    chip.classList.toggle('hot', key === 'needs' && count > 0);
    chip.append(el('i', 'dot'), el('b', '', String(count)), el('span', '', label));
    chip.addEventListener('click', () => {
      if (key === 'history') return setHistory(true);
      if (view !== 'now') setView('now');
      focusFirst(
        `${key === 'needs' ? '.human-pill[data-wait="dialog"] .human-open, ' : ''}#col-${key} .card, #col-${key} .empty`,
      );
    });
    return chip;
  });

const humanPill = (card: Card) => {
  const key = keyFor(card);
  byKey.set(key, { card, column: 'human' });
  const pill = el('div', 'human-pill');
  pill.dataset.state = card.state ?? '';
  pill.dataset.wait = card.waitFor ?? '';
  const open = el('button', `human-open${key === selected ? ' is-selected' : ''}`);
  open.type = 'button';
  open.dataset.key = key;
  open.title = 'Show the details and the screen of this session';
  open.append(
    mark(card),
    el('span', 'human-name', card.title || 'A session'),
    el('i', 'human-dot'),
    el('span', 'human-state', stateLabel(card) as string),
    timed(card.since, true),
  );
  open.addEventListener('click', () => (selected === key ? closePanel() : openPanel(key)));
  const [go] = actionsOf(card) as [Action];
  pill.append(
    open,
    iconButton('go', go.name, () => go.run?.(), 'human-go'),
  );
  return pill;
};

const drawHuman = (cards: Card[]) => {
  const strip = $('human');
  strip.hidden = cards.length === 0;
  strip.replaceChildren(
    ...(cards.length ? [Object.assign(el('h2', 'hold-label', 'Human sessions'), { id: 'human-title' })] : []),
    ...cards.map(humanPill),
  );
};

const drawHistory = () => {
  const panel = $('panel');
  const active = panel.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
  const href = active?.getAttribute('href');
  const label = active?.getAttribute('aria-label');
  const scroll = panel.querySelector('.history-body')?.scrollTop ?? 0;
  const history = data?.history;
  const error = isServerDown ? SERVER_DOWN : data?.source.error;
  panel.dataset.state = 'history';
  panel.setAttribute('aria-label', 'Landed history');
  const head = el('div', 'panel-head history-head');
  head.append(
    el('h2', '', history ? `Landed on ${history.trunk}` : 'Landed history'),
    iconButton('close', 'Close history (Esc)', () => setHistory(false)),
  );
  const body = el('div', 'history-body');
  if (!history)
    body.append(el('p', 'history-note', error ? `Cannot read history: ${error}` : 'Loading landed history…'));
  else {
    if (error) {
      const warning = el('p', 'warning', `${error}. History shows the last good read.`);
      warning.setAttribute('role', 'status');
      body.append(warning);
    }
    body.append(el('p', 'history-note', 'Latest 20 issues. A landing can later be reverted.'));
    const list = el('ol', 'history-list');
    for (const entry of history.entries) {
      const row = el('li', 'history-row');
      const issue = link('history-number', `#${entry.number}`, entry.url);
      const title = link('history-title', entry.title, entry.url);
      const commit = link('history-sha', entry.sha.slice(0, 7), entry.commitUrl);
      commit.setAttribute('aria-label', `Commit ${entry.sha}`);
      commit.title = entry.sha;
      const time = el(
        'time',
        '',
        new Date(entry.committedAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
      time.dateTime = entry.committedAt;
      time.title = `Commit time: ${entry.committedAt}`;
      time.setAttribute('aria-label', time.title);
      row.append(issue, title, commit, time);
      list.append(row);
    }
    body.append(history.entries.length ? list : el('p', 'history-note', `No landed issues found on ${history.trunk}.`));
    body.append(link('history-more', `View ${history.trunk}`, history.url));
  }
  panel.replaceChildren(head, body);
  body.scrollTop = scroll;
  if (active) {
    const match = [...panel.querySelectorAll<HTMLElement>('a, button')].find((node) =>
      href
        ? node.getAttribute('href') === href &&
          node.className === active.className &&
          node.getAttribute('aria-label') === label
        : node.getAttribute('aria-label') === label,
    );
    (match ?? panel.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
  }
};

const setHistory = (isOpen: boolean) => {
  if (isOpen && isQueueOpen) showQueue(false);
  if (!isOpen) return closePanel();
  selected = null;
  for (const node of document.querySelectorAll('[data-key].is-selected')) node.classList.remove('is-selected');
  isHistoryOpen = true;
  $('history').setAttribute('aria-expanded', 'true');
  document.body.classList.add('has-panel');
  $('panel').hidden = false;
  drawHistory();
  $('panel').querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  updateTail();
};

const markSeen = (key: string) => {
  const entry = byKey.get(key);
  if (!entry || seen === null) return;
  seen.set(key, signature(entry.card, entry.column));
  const node = document.querySelector<HTMLElement>(`.card[data-key="${CSS.escape(key)}"]`);
  node?.classList.remove('is-unseen');
  node?.querySelector<HTMLElement>('.unseen')?.remove();
};

const markAllSeen = () => {
  if (seen === null) return;
  for (const [key, { card, column }] of byKey) seen.set(key, signature(card, column));
};

const notify = (cards: Card[]) => {
  const keys = new Set(cards.map((card: Card) => keyOf(card)));
  const fresh =
    needsKeys === null
      ? []
      : cards.filter(
          (card: Card) =>
            !(needsKeys as Set<string>).has(keyOf(card)) &&
            !(card.sessionId === null && starting?.has(card.number as number)),
        );
  const isAway = document.hidden || !document.hasFocus();
  if (isNotifyOn && isAway && 'Notification' in window && Notification.permission === 'granted') {
    for (const card of fresh) {
      const { title, body } = notice(card);
      const shown = new Notification(title, { body, tag: keyOf(card), icon: favicon('needs') });
      shown.addEventListener('click', () => {
        window.focus();
        if (view !== 'now') setView('now');
        openPanel(keyOf(card));
      });
    }
  }
  needsKeys = keys;
  return fresh.map((card: Card) => notice(card).title);
};

const startNotices = (columns: Columns) => {
  const cards = [...columns.needs, ...columns.running, ...columns.idle];
  const now = new Map<number, string | null>();
  for (const card of cards) if (card.state === 'starts' && card.number !== null) now.set(card.number, card.step);
  const lines: string[] = [];
  const before = starting;
  starting = now;
  if (before === null) return lines;
  for (const [number, step] of now)
    if (!before.has(number))
      lines.push(step ? `#${number} is starting the ${step} step` : `#${number} is starting a session`);
  for (const [number, step] of before) {
    if (now.has(number)) continue;
    const card = cards.find((other) => other.number === number);
    if (card?.warning) lines.push(`#${number}: ${card.warning}`);
    else if (card?.sessionId) lines.push(step ? `#${number} started the ${step} step` : `#${number} opened a session`);
  }
  return lines;
};

const drawHints = (card: HTMLElement | null) => {
  const hints = $('hints');
  const entry = card ? byKey.get(card.dataset.key as string) : null;
  const pairs = entry
    ? [
        ['Enter', actionsOf(entry.card)[0]?.label],
        ['Space', 'Details'],
        ['o', entry.card.url ? 'Open' : null],
        ['c', copyWhat(entry.card) ? 'Copy' : null],
        ['m', 'Menu'],
      ]
    : [
        ['j', 'k', 'Move'],
        [FIND_KEY, 'Search'],
      ];
  hints.replaceChildren(
    ...pairs
      .filter((pair) => pair.at(-1))
      .map((pair) => {
        const node = el('span', 'hint');
        node.append(...pair.slice(0, -1).map((key) => el('kbd', '', key)), pair.at(-1) as string);
        return node;
      }),
  );
};

const drawStatus = (source: Board['source'], isDown: boolean) => {
  const changed = isServerDown !== isDown;
  isServerDown = isDown;
  if (changed && isHistoryOpen) drawHistory();
  const fresh = $('fresh');
  const state = isDown || source.error ? 'fail' : source.readAt ? 'ok' : 'wait';
  const name = data?.tracker ?? 'Issues';
  const text = el('span', 'sb-text');
  if (isDown) text.append(SERVER_DOWN);
  else if (source.error) text.append(`cannot read: ${source.error}`);
  else if (!source.readAt) text.append('no data yet');
  else text.append('read ', timed(source.readAt, false, ' ago'));
  fresh.dataset.tone = state;
  fresh.title = source.readAt ? `${name} was read at ${new Date(source.readAt).toLocaleTimeString()}` : '';
  fresh.replaceChildren(el('i', 'dot'), el('span', 'sb-name', name), text);
  const terminal = data?.terminal;
  const terminalNode = $('terminal');
  terminalNode.dataset.tone = terminal?.ok === true ? 'ok' : terminal?.ok === false ? 'fail' : 'wait';
  terminalNode.title = terminal?.error ? `herdr: ${terminal.error}` : 'Run and Go use herdr';
  (terminalNode.querySelector('.sb-text') as HTMLElement).textContent =
    terminal?.ok === true ? 'up' : terminal?.ok === false ? 'down' : 'checking';
  const runner = $('runner');
  runner.hidden = data?.runner === null || data?.runner === undefined;
  runner.dataset.tone = data?.runner ? 'ok' : 'off';
  runner.title = data?.runner
    ? 'The automatic runner starts each auto step'
    : 'No automatic runner runs: auto steps wait';
  runner.replaceChildren(
    el('i', 'dot'),
    el('span', 'sb-name', 'Runner'),
    el('span', 'sb-text', data?.runner ? 'on' : 'off'),
  );
  const agentNode = $('agent');
  if (agentNode) {
    const agents = data?.agents;
    const def = data?.defaultAgent;
    agentNode.hidden = !data;
    const defText = def ? agentDisplay(def) : 'No default agent';
    const defReason = def != null && agents?.[def]?.available === false ? cleanCause(agents[def].cause) : null;
    agentNode.dataset.tone = defReason ? 'fail' : def != null && agents?.[def]?.available ? 'ok' : 'wait';
    agentNode.title = DEFAULT_AGENT_REASON;
    agentNode.setAttribute('aria-haspopup', 'menu');
    agentNode.setAttribute('aria-label', `Agent: ${defText}. ${DEFAULT_AGENT_REASON}`);
    agentNode.replaceChildren(
      icon('person'),
      el('span', 'sb-name', 'Agent'),
      el('span', 'sb-text', defText),
      icon('chevron'),
    );
  }
  document.body.toggleAttribute('data-stale', isDown);
  $('stale').hidden = !isDown && !source.error;
};

const drawNotify = () => {
  const button = $('notify');
  const isBlocked = 'Notification' in window && Notification.permission === 'denied';
  const isOn = isNotifyOn && !isBlocked;
  button.replaceChildren(
    icon(isOn ? 'bell' : 'bell-off'),
    el('span', 'sb-name', 'Notify'),
    el('b', '', isBlocked ? 'blocked' : isOn ? 'on' : 'off'),
  );
  button.setAttribute('aria-pressed', String(isOn));
  button.title = isBlocked
    ? 'The browser blocks notifications for this page'
    : isOn
      ? 'A system notification shows when a card needs you'
      : 'Show a system notification when a card needs you';
};

const panelContext = (card: Card) => ({
  actions: actionsOf(card),
  flow: (data as Board).flow,
  on: onTracker(),
  close: closePanel,
});

const drawPanelFor = () => {
  const entry = byKey.get(selected as string);
  if (!entry) return closePanel();
  $('panel').setAttribute('aria-label', 'Card details');
  const focused = $('panel').contains(document.activeElement)
    ? (document.activeElement as Element).getAttribute('aria-label')
    : null;
  $('panel').replaceChildren(...drawPanel(entry.card, panelContext(entry.card)));
  if (focused)
    (
      $('panel').querySelector<HTMLElement>(`[aria-label="${CSS.escape(focused)}"]`) ??
      $('panel').querySelector<HTMLElement>('.panel-head > .icon-btn:last-child')
    )?.focus({ preventScroll: true });
};

const openPanel = (key: string) => {
  if (isQueueOpen) showQueue(false);
  if (!byKey.has(key)) return;
  isHistoryOpen = false;
  $('history').setAttribute('aria-expanded', 'false');
  selected = key;
  for (const node of document.querySelectorAll<HTMLElement>('[data-key].is-selected'))
    node.classList.remove('is-selected');
  document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.classList.add('is-selected');
  document.body.classList.add('has-panel');
  $('panel').hidden = false;
  drawPanelFor();
  markSeen(key);
  $('panel').querySelector<HTMLElement>('.panel-actions .btn, .ask .btn, .icon-btn')?.focus({ preventScroll: true });
  updateTail();
};

function closePanel() {
  const key = selected;
  const wasHistory = isHistoryOpen;
  isHistoryOpen = false;
  $('history').setAttribute('aria-expanded', 'false');
  selected = null;
  document.body.classList.remove('has-panel');
  $('panel').hidden = true;
  $('panel').replaceChildren();
  for (const node of document.querySelectorAll<HTMLElement>('[data-key].is-selected'))
    node.classList.remove('is-selected');
  if (wasHistory) $('history').focus({ preventScroll: true });
  if (key) document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  updateTail();
}

const drawBoard = (next: Board) => {
  drawQueue(next);
  const active = document.activeElement as HTMLElement | null;
  const holder = active?.closest?.<HTMLElement>('.human-pill, [data-key]');
  const target = (holder?.querySelector<HTMLElement>('[data-key]') ?? holder)?.dataset.key;
  const isGo = Boolean(active?.matches?.('.human-go'));
  used = new Set();
  byKey = new Map();
  const needs = next.columns.needs.length;
  document.title = pageTitle(next.repo, needsYou(next.columns).length);
  $('favicon').href = favicon(tone(next.columns));
  $('repo').textContent = next.repo;
  $('refresh').title = `${readAgain()} (r)`;
  $('dirty').hidden = !next.noRun;
  const banner = next.noRun ?? '';
  if ($('dirty').textContent !== banner) $('dirty').textContent = banner;
  $('summary').replaceChildren(...summary(next.columns));
  $('history-total').textContent = String(next.history?.entries.length ?? 0);
  if (isHistoryOpen) drawHistory();
  const board = $('columns');
  board.dataset.view = view;
  board.style.setProperty('--stages', String(Math.max(1, next.flow?.stages.length ?? 0)));
  board.classList.toggle('is-calm', needs === 0);
  board.replaceChildren(
    ...(view === 'pipeline'
      ? pipelineView(next.columns, next.flow)
      : COLUMNS.map((spec) => column(spec, next.columns[spec.key]))),
  );
  drawHuman(next.columns.human);
  board.setAttribute('aria-busy', 'false');
  if (seen === null) {
    seen = new Map();
    markAllSeen();
  }
  const lines = [...notify(needsYou(next.columns)), ...startNotices(next.columns)];
  if (lines.length) $('announce').textContent = lines.join('. ');
  if (selected) {
    if (byKey.has(selected)) drawPanelFor();
    else closePanel();
  }
  if (target) {
    const node = document.querySelector<HTMLElement>(`[data-key="${CSS.escape(target)}"]`);
    const go = isGo ? node?.closest('.human-pill')?.querySelector<HTMLElement>('.human-go') : null;
    (go ?? node)?.focus({ preventScroll: true });
  }
  drawHints((document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>('.card[data-key]') ?? null);
  updateTail();
};

const drawSkeleton = () =>
  $('columns').replaceChildren(
    ...COLUMNS.map(({ key, name }) => {
      const section = el('section', `col col-${key}`);
      const head = el('header', 'col-head');
      head.append(glyph(key), el('h2', 'col-name', name));
      const body = el('div', 'col-body');
      body.append(...[0, 1, 2].map(() => el('div', 'card ghost-card')));
      section.append(head, body);
      return section;
    }),
  );

const showQueue = (open: boolean) => {
  isQueueOpen = open;
  if (open) {
    closePanel();
    setHistory(false);
  }
  setQueueOpen(open);
  if (!open) $('queue-open').focus();
};

const setView = (next: string) => {
  if (isQueueOpen) showQueue(false);
  view = next;
  store.set('view', next);
  for (const button of document.querySelectorAll<HTMLElement>('.views button'))
    button.setAttribute('aria-pressed', String(button.dataset.view === next));
  if (data) drawBoard(project(data));
};

const tick = () => {
  drawIntake();
  const now = Date.now();
  for (const node of document.querySelectorAll<HTMLElement>('[data-since]'))
    node.textContent = `${age(node.dataset.since as string, now, 'fine' in node.dataset)}${node.dataset.suffix ?? ''}`;
};

const isCalm = matchMedia('(prefers-reduced-motion: reduce)');
const layoutOf = (next: Board) =>
  JSON.stringify([
    view,
    Object.entries(next.columns).map(([key, cards]) => [key, cards.map((card: Card) => keyOf(card))]),
  ]);
let last = '';
let lastLayout = '';
let source: Board['source'] = { readAt: null, error: null };
let hasRead = false;
let timer: ReturnType<typeof setTimeout> | number = 0;
let reads = 0;
let accepted = 0;
let settled = 0;
type Launch = { step: string | null; phase: 'pending' | 'done' | 'failed' };
const launches = new Map<number, Launch>();

const project = (board: Board): Board => {
  if (launches.size === 0) return board;
  const columns: Columns = { needs: [], running: [], idle: [], human: [] };
  for (const [key, cards] of Object.entries(board.columns) as [Column, Card[]][])
    for (const card of cards) {
      const launch = card.sessionId === null ? launches.get(card.number as number) : undefined;
      if (!launch) columns[key].push(card);
      else if (
        launch.phase !== 'failed' &&
        card.step === launch.step &&
        (card.state === null || card.state === 'no-progress' || (card.state === 'blocked' && launch.step === null))
      )
        columns.running.unshift({
          ...card,
          state: 'starts',
          act: null,
          assist: false,
          run: false,
          resume: false,
          go: false,
          warning: null,
          effort: null,
        });
      else columns[key].push({ ...card, assist: false, run: false, resume: false });
    }
  return { ...board, columns };
};

const render = (canMove = true) => {
  drawIntake();
  const next = project(data as Board);
  const cards = JSON.stringify([
    next.repo,
    next.noRun,
    next.agents,
    next.defaultAgent,
    next.flow,
    next.tracker,
    next.columns,
    next.history,
    next.source.error,
    next.queue,
  ]);
  if (cards === last) {
    drawQueue(next);
    return;
  }
  const layout = layoutOf(next);
  const isMove = lastLayout !== '' && layout !== lastLayout && !document.hidden;
  if (canMove && isMove && document.startViewTransition && !isCalm.matches)
    document.startViewTransition(() => drawBoard(project(data as Board)));
  else drawBoard(next);
  last = cards;
  lastLayout = layout;
};

const launch = async (card: Card, path: '/api/run' | '/api/resume' | '/api/assist', agent?: string, effort?: Level) => {
  if (isReconnecting()) return false;
  const number = card.number as number;
  const current =
    data &&
    Object.values(project(data).columns)
      .flat()
      .find((other) => other.sessionId === null && other.number === number);
  if (!current?.[path === '/api/run' ? 'run' : path === '/api/assist' ? 'assist' : 'resume']) return false;
  const reason =
    path === '/api/resume'
      ? data?.noRun
      : runReason(path === '/api/assist' ? null : (agent ?? null), path === '/api/run' ? number : undefined);
  if (reason) {
    toast(reason, { isError: true });
    return false;
  }
  const entry: Launch = { step: current.step, phase: 'pending' };
  launches.set(number, entry);
  render(false);
  if (document.activeElement === document.body)
    document.querySelector<HTMLElement>(`[data-key="${CSS.escape(keyOf(card))}"]`)?.focus({ preventScroll: true });
  const isOk = await post(
    path,
    {
      number,
      ...(path === '/api/run' && agent ? { agent } : {}),
      ...(path === '/api/run' && effort ? { effort } : {}),
    },
    path === '/api/run' ? 'Run failed' : path === '/api/assist' ? 'Open agent failed' : 'Resume failed',
  );
  entry.phase = isOk ? 'done' : 'failed';
  settled = reads;
  render();
  load();
  return isOk;
};

let loadRequest: AbortController | undefined;
document.addEventListener('board-reconnect', () => {
  drawIntake();
  loadRequest?.abort();
  if (data) {
    data = { ...data, queue: null };
    drawQueue(project(data));
  }
});
document.addEventListener('board-connected', () => {
  drawIntake();
  void load();
});

async function load() {
  clearTimeout(timer);
  if (isReconnecting()) return;
  loadRequest = new AbortController();
  const isLocal = hasRead && document.hidden;
  const read = ++reads;
  try {
    const response = await fetch(`/api/board${isLocal ? '?local=1' : ''}`, { signal: loadRequest.signal });
    if (!response.ok) throw new Error(response.statusText);
    const next = (await response.json()) as Board;
    if (read > accepted && read > settled) {
      accepted = read;
      data = next;
      hasRead = true;
      for (const [number, launch] of launches) if (launch.phase !== 'pending') launches.delete(number);
      render();
      source = data.source;
      drawStatus(source, false);
    }
  } catch {
    if (!isReconnecting() && read > accepted && read > settled) {
      accepted = read;
      if (data) data = { ...data, queue: null };
      drawStatus(source, true);
      if (data) drawQueue(project(data));
    }
  }
  tick();
  timer = setTimeout(load, document.hidden ? 15_000 : 5000);
}

const move = (across: number, down: number) => {
  const lists = [...document.querySelectorAll<HTMLElement>('#columns .col')].map((col) => [
    ...col.querySelectorAll<HTMLElement>('.card[data-key]'),
  ]);
  const current = (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>('.card[data-key]');
  const at = lists.findIndex((list) => list.includes(current as HTMLElement));
  if (at < 0) return lists.flat()[0]?.focus();
  const row = (lists[at] as HTMLElement[]).indexOf(current as HTMLElement);
  if (down)
    return (
      (lists[at] as HTMLElement[])[
        Math.min(Math.max(row + down, 0), (lists[at] as HTMLElement[]).length - 1)
      ] as HTMLElement
    ).focus();
  for (let next = at + across; next >= 0 && next < lists.length; next += across) {
    if ((lists[next] as HTMLElement[]).length)
      return (
        (lists[next] as HTMLElement[])[Math.min(row, (lists[next] as HTMLElement[]).length - 1)] as HTMLElement
      ).focus();
  }
};

const boardActions = () => [
  { label: 'Show the issue queue', icon: 'stages', key: '', run: () => showQueue(true) },
  { label: readAgain(), icon: 'refresh', key: 'r', run: () => $('refresh').click() },
  {
    label: isHistoryOpen ? 'Hide history' : 'Show history',
    icon: 'clock',
    key: 'd',
    run: () => setHistory(!isHistoryOpen),
  },
  {
    label: isNotifyOn ? 'Turn notifications off' : 'Turn notifications on',
    icon: isNotifyOn ? 'bell-off' : 'bell',
    key: '',
    run: toggleNotify,
  },
  { label: 'Show the keyboard shortcuts', icon: 'keyboard', key: '?', run: () => $('keys').showModal() },
];

const paletteItems = () => {
  if (!data) return [];
  const items: PaletteItem[] = [];
  const add = (group: string, card: Card, _key: string, action: Action) =>
    items.push({
      group,
      number: card.number,
      label: action.name
        .replace(/, #\d+$/, '')
        .replace(/ of #\d+$/, '')
        .replace(/^(Open issue) #\d+/, '$1'),
      context: card.title,
      icon: action.icon,
      tone: group === 'Needs you' ? 'needs' : null,
      key: '',
      run: action.href
        ? () => window.open(action.href, '_blank', 'noopener,noreferrer')
        : (action.run as () => unknown),
    });
  const shown = project(data);
  for (const [column, group] of [
    ['needs', 'Needs you'],
    ['running', 'Running'],
    ['idle', 'Run the next step'],
    ['human', 'Human sessions'],
  ] as [Column, string][]) {
    for (const card of shown.columns[column]) {
      const key = [...byKey].find(([, entry]) => entry.card === card)?.[0] ?? keyOf(card);
      const [main] = actionsOf(card);
      if (main && !main.isDisabled) add(group, card, key, main);
      else if (card.number !== null || card.sessionId)
        items.push({
          group,
          number: card.number,
          label: 'Show the details',
          context: card.title,
          icon: 'panel',
          tone: null,
          key: '',
          run: () => openPanel(key),
        });
      if (card.run && card.number !== null && data?.agents && !data?.noRun) {
        for (const [id, entry] of Object.entries(data.agents)) {
          if (!entry.available) continue;
          const display = agentDisplay(id);
          items.push({
            group,
            number: card.number,
            label: `Run #${card.number} with ${id}`,
            context: card.title,
            icon: 'run',
            tone: group === 'Needs you' ? 'needs' : null,
            key: '',
            title: runTitle(card.step, (data as Board).flow, card.effort),
            run: async () => {
              if (await launch(card, '/api/run', id))
                toast(`Started the ${card.step} step of #${card.number} with ${display} in a new herdr tab`);
            },
          });
        }
      }
    }
  }
  for (const card of shown.history?.entries ?? [])
    if (card.url)
      items.push({
        group: 'History',
        number: card.number,
        label: `Open the issue${onTracker()}`,
        context: card.title,
        icon: 'open',
        tone: null,
        key: '',
        run: () => window.open(card.url as string, '_blank', 'noopener,noreferrer'),
      });
  items.push(
    { group: 'Board', number: null, context: '', ...defaultAgentEntry },
    {
      group: 'Board',
      number: null,
      label: view === 'now' ? 'Show the pipeline' : 'Show what needs you now',
      context: '',
      icon: view === 'now' ? 'stages' : 'board',
      key: 'v',
      run: () => setView(view === 'now' ? 'pipeline' : 'now'),
    },
    ...boardActions().map((action) => ({ group: 'Board', number: null, context: '', ...action })),
  );
  return items;
};

async function toggleNotify() {
  if (!('Notification' in window)) return toast('This browser has no notifications', { isError: true });
  if (!isNotifyOn && Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'denied') {
    isNotifyOn = false;
    toast('The browser blocks notifications for this page', {
      detail: 'Allow them in the site settings of the browser, then press Notify again.',
      isError: true,
    });
  } else if (Notification.permission === 'default') {
    isNotifyOn = false;
    toast('Notifications stay off', {
      detail: 'The browser did not get your permission. Press Notify again to answer it.',
    });
  } else {
    isNotifyOn = !isNotifyOn;
    toast(isNotifyOn ? 'Notifications are on' : 'Notifications are off', {
      detail: isNotifyOn ? 'A system notification shows when a card needs you and the board is not in front.' : '',
    });
  }
  store.set('notify', isNotifyOn ? 'on' : 'off');
  drawNotify();
}

const KEYS: Record<string, () => void> = {
  j: () => move(0, 1),
  k: () => move(0, -1),
  h: () => move(-1, 0),
  l: () => move(1, 0),
  r: () => $('refresh').click(),
  d: () => setHistory(!isHistoryOpen),
  v: () => setView(view === 'now' ? 'pipeline' : 'now'),
  '?': () => $('keys').showModal(),
  '/': () => openPalette(paletteItems()),
};
const CARD_KEYS: Record<string, (card: HTMLElement) => void> = {
  ArrowDown: () => move(0, 1),
  ArrowUp: () => move(0, -1),
  ArrowLeft: () => move(-1, 0),
  ArrowRight: () => move(1, 0),
  Enter: (card: HTMLElement) => card.querySelector<HTMLElement>('.main-action')?.click(),
  ' ': (card: HTMLElement) => openPanel(card.dataset.key as string),
  o: (card: HTMLElement) => card.dataset.url && window.open(card.dataset.url, '_blank', 'noopener,noreferrer'),
  c: (card: HTMLElement) => {
    const entry = byKey.get(card.dataset.key as string);
    if (entry && copyWhat(entry.card)) copy(entry.card.act as string, copyWhat(entry.card) as string);
  },
  m: (card: HTMLElement) => {
    const entry = byKey.get(card.dataset.key as string);
    if (entry)
      openMenu(card.querySelector<HTMLElement>('.more') ?? card, menuOf(entry.card, card.dataset.key as string));
  },
};

const updates = setupUpdates();
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || updates.contains(event.target)) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (!$('palette').open) openPalette(paletteItems());
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || $('keys').open || $('palette').open) return;
  if ((event.target as Element).closest?.<HTMLElement>('input, textarea, select, [contenteditable]')) return;
  if (event.key === 'Escape' && isHistoryOpen) {
    event.preventDefault();
    return setHistory(false);
  }
  if (event.key === 'Escape' && selected) {
    event.preventDefault();
    return closePanel();
  }
  if (isQueueOpen && !['r', 'd', 'v', '?', '/'].includes(event.key)) return;
  const card = document.activeElement?.matches?.('.card[data-key]') ? (document.activeElement as HTMLElement) : null;
  const press = (card && CARD_KEYS[event.key]) || (isKeysOn && KEYS[event.key]);
  if (!press) return;
  event.preventDefault();
  (press as (card: HTMLElement | null) => void)(card);
});

const columns = $('columns');
columns.addEventListener('click', (event) => {
  const node = (event.target as Element).closest<HTMLElement>('.card[data-key]');
  if (!node || (event.target as Element).closest<HTMLElement>('a, button')) return;
  if (selected === node.dataset.key) return closePanel();
  openPanel(node.dataset.key as string);
});
columns.addEventListener('contextmenu', (event) => {
  const node = (event.target as Element).closest<HTMLElement>('.card[data-key]');
  const entry = node && byKey.get(node.dataset.key as string);
  if (!entry) return;
  event.preventDefault();
  openMenu(
    (node as HTMLElement).querySelector<HTMLElement>('.more') ?? (node as HTMLElement),
    menuOf(entry.card, (node as HTMLElement).dataset.key as string),
  );
});
columns.addEventListener('focusin', (event) => {
  const node = (event.target as Element).closest<HTMLElement>('.card[data-key]');
  if (node) markSeen(node.dataset.key as string);
  drawHints(node);
});
columns.addEventListener('focusout', (event) => {
  if (!columns.contains(event.relatedTarget as Node | null)) drawHints(null);
});
columns.addEventListener('pointerover', (event) => {
  const node = (event.target as Element).closest<HTMLElement>('.card[data-key].is-unseen');
  if (node) markSeen(node.dataset.key as string);
});
columns.addEventListener('scroll', updateTail, true);
addEventListener('resize', updateTail);
addEventListener('blur', markAllSeen);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) markAllSeen();
  else load();
});

$('logo').append(icon('logo'));
$('refresh').prepend(icon('refresh'));
$('refresh').addEventListener('click', async () => {
  if ($('refresh').getAttribute('aria-busy') === 'true') return;
  $('refresh').setAttribute('aria-busy', 'true');
  await act('/api/refresh', {}, 'Refresh failed');
  $('refresh').removeAttribute('aria-busy');
});
$('find').prepend(icon('search'));
($('find').querySelector<HTMLElement>('kbd') as HTMLElement).textContent = FIND_KEY;
$('find').addEventListener('click', () => openPalette(paletteItems()));
for (const button of document.querySelectorAll<HTMLElement>('.views button')) {
  button.prepend(icon(button.dataset.view === 'now' ? 'board' : 'stages'));
  button.setAttribute('aria-label', `${(button.querySelector<HTMLElement>('.label') as HTMLElement).textContent} view`);
  button.setAttribute('aria-pressed', String(button.dataset.view === view));
  button.addEventListener('click', () => setView(button.dataset.view as string));
}
$('intake').prepend(icon('spark'));
$('intake').addEventListener('click', () => void openIntake());
drawIntake();
$('history').prepend(icon('clock'));
$('history').addEventListener('click', () => setHistory(!isHistoryOpen));
$('history-count').prepend(icon('clock'));
$('history-count').addEventListener('click', () => setHistory(true));
$('notify').addEventListener('click', toggleNotify);
$('board-more').append(icon('dots'));
$('board-more').addEventListener('click', () => openMenu($('board-more'), boardActions()));
$('agent').addEventListener('click', () => openMenu($('agent'), agentMenuOf()));
$('keys-open').prepend(icon('keyboard'));
$('keys-open').addEventListener('click', () => $('keys').showModal());
$('keys-close').append(icon('close'));
$('keys-close').addEventListener('click', () => $('keys').close());
$('keys').addEventListener('click', (event) => {
  if (event.target === $('keys')) $('keys').close();
});
$('keys-on').checked = isKeysOn;
$('keys-on').addEventListener('change', () => {
  isKeysOn = $('keys-on').checked;
  store.set('keys', isKeysOn ? 'on' : 'off');
});
$('toast-close').append(icon('close'));
$('toast-close').addEventListener('click', () => {
  $('toast').hidden = true;
});
setupQueue({
  back: () => showQueue(false),
  refresh: async () => {
    settled = reads;
    await load();
  },
});
$('queue-open').addEventListener('click', () => showQueue(!isQueueOpen));
setupPalette();
setupMenu();
drawNotify();
drawHints(null);
setInterval(tick, 1000);
drawSkeleton();
drawStatus(source, false);
load();
