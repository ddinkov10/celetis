import type { AgentOrder, Host } from '../../lib/config-core.ts';
import type { Level, RowSource, StartPair } from '../../lib/effort.ts';
import type {
  Action,
  AgentReplaceConflict,
  AgentReplaceRequest,
  Board,
  Card,
  Column,
  Columns,
  DaemonView,
  Flow,
  HistoryRow,
  MenuEntry,
  PaletteItem,
  ParentEpic,
  RunRequest,
} from '../types.ts';
import {
  age,
  agentOf,
  COLUMNS,
  cleanCause,
  clock,
  favicon,
  groupEpics,
  groupNeeds,
  isCard,
  keyOf,
  knownAgent,
  LIVE,
  laneTrack,
  levelSource,
  needsYou,
  notice,
  pageTitle,
  parseOpenEpics,
  pipeline,
  runTitle,
  shortPath,
  signature,
  startName,
  startTitle,
  stateLabel,
  tail,
  tone,
} from '../view.ts';
import { createAgentPicker, OrderConflict } from './agent-picker.ts';
import { setupCoordinator } from './coordinator.ts';
import { openMenu, openPalette, setupMenu, setupPalette } from './palette.ts';
import { drawPanel } from './panel.ts';
import { drawQueue, setQueueOpen, setupQueue } from './queue.ts';
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
  prChips,
  SERVER_DOWN,
  store,
  timed,
  toast,
} from './ui.ts';
import { isReconnecting, setupUpdates } from './update-dialog.ts';

const SUMMARY: [Column | 'history', string][] = [
  ['needs', 'need you'],
  ['running', 'running'],
  ['idle', 'idle'],
  ['history', 'landed'],
];
const COPY: Record<string, string> = { 'no-progress': 'command', 'dirty-tree': 'path' };
const ON_ISSUE = new Set(['blocked']);
const GATES: Record<string, string> = {
  auto: 'Auto mode of the daemon starts this step by itself',
};
const AUTO: Record<DaemonView['auto'], { tone: string; title: string }> = {
  on: { tone: 'ok', title: 'Auto mode starts each auto step.' },
  off: { tone: 'off', title: 'Auto mode is off: auto steps wait.' },
  stopping: { tone: 'off', title: 'Auto mode stops after its current work.' },
};
const STATUS_ICONS: Record<string, string> = {
  works: 'works',
  starts: 'works',
  waits: 'target',
  'no-progress': 'alert',
  'dirty-tree': 'diff',
  blocked: 'person',
  'quota-wait': 'clock',
};
const FIND_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
const QUEUE_LEVEL = 'The queue starts this step at the start pair, with no override';

let data: Board | null = null;
let selected: string | null = null;
let view = store.get('view') === 'pipeline' ? 'pipeline' : 'now';
let isNotifyOn = store.get('notify') === 'on';
let isKeysOn = store.get('keys') !== 'off';
let openEpics = parseOpenEpics(store.get('open-epics') ?? '');
let isHistoryOpen = false;
let isQueueOpen = false;
let isServerDown = false;
let intakePending = false;
let seen: Map<string, string> | null = null;
let needsKeys: Set<string> | null = null;
let starting: Map<number, string | null> | null = null;
let startupWarnings = new Map<number, string>();
let byKey = new Map<string, { card: Card; column: Column }>();
let used = new Set<string>();
let coordinatorLine: string | null = null;

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
  return defaultReason();
};

let drawnIntake = '';
function drawIntake(): void {
  const button = $('intake');
  const reason = intakeReason();
  const state = `${intakePending}|${reason}`;
  if (state === drawnIntake) return;
  drawnIntake = state;
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

const registry = () => (data as Board).registry;
const agentDisplay = (id: string) => agentOf({ agent: id }, registry())?.name ?? id;

const defaultReason = (work: 'run' | 'session' = 'session') => {
  const next = data?.next;
  if (next?.kind === 'wait') return work === 'session' ? 'Every included agent is limited. See the agent order.' : null;
  const entry = next ? data?.agents?.[next.host] : undefined;
  return entry?.available === false ? cleanCause(entry.cause) : null;
};

const runReason = (agent: string | null, number?: number | null) => {
  if (data?.noRun) return data.noRun;
  const record = data?.queue?.record;
  if (record?.state === 'me-gate' && record.numbers[0] === number && record.choice) {
    if (record.choice.kind === 'default') {
      if (agent !== null) return 'queue: recorded agent choice is the default order';
    } else {
      if (agent !== null && agent !== record.choice.host)
        return `queue: recorded agent choice is ${record.choice.host}`;
      agent = record.choice.host;
    }
  }
  const agents = data?.agents;
  if (agent) {
    const entry = data && knownAgent(data.registry, agent) ? agents?.[agent] : undefined;
    if (entry && entry.available === false) return cleanCause(entry.cause);
    return null;
  }
  return defaultReason('run');
};

const runName = ({ step, effort, number }: Card) =>
  `Run ${step}${effort ? ` on ${effort.model} at ${effort.level}` : ''}, #${number}`;

const runAction = (card: Card, agent: string | null = null): Action => {
  const display = agent ? agentDisplay(agent) : null;
  const reason = runReason(agent, card.number);
  const name = agent ? `Run with ${display}, ${card.step} of #${card.number}` : runName(card);
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
          name: `Run again with ${display}, ${card.step} of #${card.number}`,
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
    ...(data?.flow?.levels ?? []).map((level) => ({
      icon: level === effort.level ? 'check' : 'run',
      label: `Run at ${level}${level === effort.level ? ` (${levelSource(effort)})` : ''}`,
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

const agentOrderEntry = {
  icon: 'person',
  label: 'Change the agent order',
  key: '',
  title: 'Open the agent order in the footer',
  run: () => {
    const trigger = $('agent-picker').querySelector<HTMLElement>('.ap-trigger');
    if (trigger?.getAttribute('aria-expanded') !== 'true') trigger?.click();
  },
};

const toMenuEntry = (action: Action): MenuEntry => {
  const host = action.id.startsWith('run:') ? action.id.slice(4) : null;
  if (host && data && knownAgent(data.registry, host))
    return {
      icon: action.icon,
      host,
      label: action.label,
      tag: data.picker?.order.order[0] === host ? 'Default' : undefined,
      isDisabled: action.isDisabled,
      title: action.title,
      run: action.run as () => unknown,
    };
  return {
    icon: action.icon,
    label: action.name,
    key: action.isMain ? 'Enter' : '',
    isDisabled: action.isDisabled,
    title: action.title,
    run: action.href ? () => window.open(action.href, '_blank', 'noopener,noreferrer') : (action.run as () => unknown),
  };
};

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
  if (card.state === 'quota-wait')
    list.push({
      id: 'agent-order',
      label: 'Agent order',
      icon: 'person',
      name: `Show the agent order and Retry of #${card.number}`,
      title: 'Show the usage limits and Retry in the agent order (Enter)',
      run: agentOrderEntry.run,
    });
  if (card.state === 'blocked') {
    const reason = data?.noRun || defaultReason();
    list.push({
      id: 'assist',
      label: 'Open agent',
      icon: 'terminal',
      busy: 'Starting',
      name: `Open agent, #${card.number}`,
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
        name: `Run again, #${card.number}`,
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
      name: `Open shell, #${card.number}`,
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

const startLabel = (pair: StartPair<RowSource>) => {
  const node = el('span', 'start');
  node.title = startName(pair);
  node.setAttribute('role', 'img');
  node.setAttribute('aria-label', node.title);
  for (const [part, value] of [
    ['model', pair.model],
    ['level', pair.level],
  ] as const) {
    const segment = el('span', 'start-part');
    segment.dataset.part = part;
    segment.dataset.source = pair.source[part];
    if (pair.source[part] === 'pinned') segment.append(icon('pin'));
    segment.append(el('span', '', value));
    node.append(segment);
  }
  return node;
};

const status = (card: Card, hasGlyph = true, isShort = false) => {
  const node = el('span', 'status');
  if (card.state) {
    if (hasGlyph) node.append(icon(STATUS_ICONS[card.state as string] ?? 'pending'));
    node.append(el('span', 'status-label', stateLabel(card)));
    if (isShort) return node;
    const agent = agentOf(card, registry());
    if (agent) node.append(el('span', 'detail agent-name', agent.name));
    if (card.step && card.step !== card.type) node.append(el('span', 'detail mono', card.step));
  } else if (card.step) {
    node.classList.add('next');
    if (hasGlyph) node.append(icon('pending'));
    node.append(el('span', 'lead', 'next'), el('span', 'mono step', card.step));
    if (card.effort) node.append(startLabel(card.effort));
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

const unseenDot = () => {
  const dot = Object.assign(el('i', 'unseen'), { title: 'Changed since you last looked' });
  dot.append(el('span', 'sr-only', 'Changed since you last looked'));
  return dot;
};

const menuName = (card: Card, prefix: string) => `${prefix} ${card.number === null ? card.title : `#${card.number}`}`;

const runWithButton = (card: Card) => {
  const actions = actionsOf(card);
  if (!['run', 'blocked'].includes(actions[0]?.id as string)) return null;
  const entries = actions.filter((action) => action.id.startsWith('run:')).map(toMenuEntry);
  if (entries.length === 0) return null;
  const levelled = levelEntries(card);
  const button = iconButton(
    'chevron',
    levelled.length ? 'Run with another agent or at another level' : 'Run with another agent',
    (event) =>
      openMenu(event.currentTarget as HTMLElement, [...entries, ...levelled], {
        label: menuName(card, 'Run options of'),
      }),
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
    node.append(mark(card, registry()), main);
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
  head.append(mark(card, registry(), Boolean(card.state)), id);
  if (card.type) head.append(el('span', 'sep', '·'), el('span', 'type', card.type));
  const lane = track(card);
  if (lane) head.append(lane);
  const more = iconButton(
    'dots',
    'More actions (m)',
    () => openMenu(more, menuOf(card, key), { label: menuName(card, 'Actions of') }),
    'more',
  );
  more.setAttribute('aria-haspopup', 'menu');
  head.append(more);
  node.append(head, title);
  for (const part of [
    card.state === 'works' ? liveLine(card) : null,
    prChips(card.pr),
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
  node.tabIndex = -1;
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

const storeOpenEpics = (change: (open: Set<number>) => void) => {
  const stored = store.get('open-epics');
  const next = new Set(stored === null ? openEpics : parseOpenEpics(stored));
  change(next);
  store.set('open-epics', JSON.stringify([...next].sort((a, b) => a - b)));
  openEpics = next;
};

const showOpenEpics = () => {
  for (const row of document.querySelectorAll<HTMLElement>('.epic-row')) {
    const isOpen = openEpics.has(Number(row.dataset.epic));
    row.setAttribute('aria-expanded', String(isOpen));
    ($(row.getAttribute('aria-controls') as string) as HTMLElement).hidden = !isOpen;
  }
  syncStops();
};

const setEpicOpen = (epic: number, isOpen: boolean) => {
  storeOpenEpics((open) => (isOpen ? open.add(epic) : open.delete(epic)));
  showOpenEpics();
};

const epicGroup = (epic: ParentEpic, cards: Card[], scope: string) => {
  const id = `eg-${scope}-${epic.number}`;
  const isOpen = openEpics.has(epic.number);
  const row = el('button', 'epic-row');
  row.type = 'button';
  row.tabIndex = -1;
  row.id = `${id}-row`;
  row.dataset.epic = String(epic.number);
  row.dataset.group = `${scope}-${epic.number}`;
  row.setAttribute('aria-expanded', String(isOpen));
  row.setAttribute('aria-controls', id);
  const count = el('span', 'epic-count', String(cards.length));
  count.append(el('span', 'sr-only', cards.length === 1 ? ' issue' : ' issues'));
  row.append(
    icon('chevron'),
    el('span', 'epic-num', `#${epic.number}`),
    el('span', 'epic-title', epic.title),
    count,
    unseenDot(),
  );
  row.addEventListener('click', () => setEpicOpen(epic.number, row.getAttribute('aria-expanded') !== 'true'));
  const children = el('div', 'epic-children');
  children.id = id;
  children.hidden = !isOpen;
  children.setAttribute('role', 'group');
  children.setAttribute('aria-labelledby', row.id);
  children.append(...cards.map((card) => drawCard(card, 'idle', { isCompact: true })));
  const node = el('div', 'epic-group');
  node.dataset.epic = String(epic.number);
  node.append(row, children);
  return node;
};

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
  else if (key === 'idle')
    body.append(
      ...groupEpics(cards, () => true).map((item) =>
        item.kind === 'group'
          ? epicGroup(item.epic, item.cards, 'idle')
          : drawCard(item.card, 'idle', { isCompact: true }),
      ),
    );
  else body.append(...cards.map((card: Card) => drawCard(card, key)));
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

const measureTail = () => {
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
};

let tailFrame = 0;
const updateTail = () => {
  cancelAnimationFrame(tailFrame);
  tailFrame = requestAnimationFrame(measureTail);
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
    strip.setAttribute('aria-labelledby', 'hold-title');
    const label = el('h2', 'hold-label', 'Not in a step');
    label.id = 'hold-title';
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
        ? groupEpics(stage.cards, (card) => where.get(card) === 'idle').map((item) =>
            item.kind === 'group'
              ? epicGroup(item.epic, item.cards, `s${stage.key}`)
              : drawCard(item.card, where.get(item.card) as Column, { isCompact: true }),
          )
        : [el('p', 'stage-empty', 'No issue at this step')]),
    );
    section.append(head, body);
    sections.push(section);
  }
  return sections;
};

const isStop = (node: Element) => !node.closest('.epic-children[hidden]');

const STOPS = '.card[data-key], .epic-row';
const stopKeys = new Map<string, string>();
const stopKey = (node: HTMLElement) => (node.dataset.key ?? node.dataset.group) as string;
const columnId = (col: Element) => col.id || col.getAttribute('aria-labelledby') || 'hold';

const syncStops = () => {
  for (const col of document.querySelectorAll<HTMLElement>('#columns .col')) {
    const stops = [...col.querySelectorAll<HTMLElement>(STOPS)].filter(isStop);
    const active = document.activeElement?.closest<HTMLElement>(STOPS);
    const kept = stopKeys.get(columnId(col));
    const stop = stops.find((node) => node === active) ?? stops.find((node) => stopKey(node) === kept) ?? stops[0];
    for (const node of stops) node.tabIndex = node === stop ? 0 : -1;
  }
};

const focusFirst = (selector: string) => {
  if (isQueueOpen) showQueue(false);
  const target = [...document.querySelectorAll<HTMLElement>(selector)].find(isStop);
  target?.focus();
  target?.scrollIntoView({ block: 'nearest', behavior: isCalm.matches ? 'auto' : 'smooth' });
};

const summary = (board: Board) =>
  SUMMARY.map(([key, label]) => {
    const count =
      key === 'history'
        ? (data?.history?.entries.length ?? 0)
        : key === 'needs'
          ? needsYou(board).length
          : board.columns[key].length;
    const chip = el('button', `chip chip-${key}`);
    chip.type = 'button';
    chip.classList.toggle('hot', key === 'needs' && count > 0);
    chip.append(el('i', 'dot'), el('b', '', String(count)), el('span', '', label));
    chip.addEventListener('click', () => {
      if (key === 'history') return setHistory(true);
      if (key === 'needs' && data?.coordinator.state === 'dialog') return coordinator.focus();
      if (view !== 'now') setView('now');
      focusFirst(
        `${key === 'needs' ? '.human-pill[data-wait="dialog"] .human-open, ' : ''}#col-${key} .card, #col-${key} .epic-row, #col-${key} .empty`,
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
    mark(card, registry()),
    el('span', 'human-name', card.title || 'A session'),
    el('i', 'human-dot'),
    el('span', 'human-state', stateLabel(card) as string),
  );
  open.addEventListener('click', () => (selected === key ? closePanel() : openPanel(key)));
  const [go] = actionsOf(card) as [Action];
  pill.append(
    open,
    timed(card.since, LIVE.has(card.state as string)),
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

const visualPresses = new Set<number>();

const makeVisual = async (number: number) => {
  if (visualPresses.has(number)) return;
  visualPresses.add(number);
  if (isHistoryOpen) drawHistory();
  await act('/api/visual', { number }, 'Make visual failed');
  visualPresses.delete(number);
  if (isHistoryOpen) drawHistory();
};

const visualControl = (entry: HistoryRow) => {
  const { number } = entry;
  const state = visualPresses.has(number) && entry.visual === 'none' ? 'starting' : entry.visual;
  let node: HTMLElement;
  if (state === 'ready') {
    node = Object.assign(el('a', 'btn ghost history-action'), {
      href: `/visual/${entry.sha}`,
      target: '_blank',
      rel: 'noreferrer',
    });
    node.append(icon('open'), el('span', 'label', 'Open visual'));
    node.setAttribute('aria-label', `Open visual, #${number}`);
  } else if (state === 'making') {
    node = el('span', 'history-action history-making');
    node.setAttribute('role', 'status');
    node.tabIndex = -1;
    node.title = `The tab #${number} visual makes the page`;
    node.append(icon('pending'), el('span', '', 'Making…'));
  } else {
    node = el('button', 'btn ghost history-action');
    (node as HTMLButtonElement).type = 'button';
    node.append(icon('diff'), el('span', 'label', state === 'starting' ? 'Starting…' : 'Make visual'));
    node.setAttribute('aria-label', `Make visual, #${number}`);
    if (state === 'starting') node.setAttribute('aria-busy', 'true');
    else node.addEventListener('click', () => void makeVisual(number));
  }
  node.dataset.visual = String(number);
  return node;
};

const drawHistory = () => {
  const panel = $('panel');
  const active = panel.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
  const href = active?.getAttribute('href');
  const label = active?.getAttribute('aria-label');
  const visual = active?.dataset.visual;
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
      const time = el('time', '', clock(entry.committedAt, true));
      time.dateTime = entry.committedAt;
      time.title = `Commit time: ${clock(entry.committedAt, true)}`;
      time.setAttribute('aria-label', time.title);
      const meta = el('span', 'history-meta');
      const dot = el('span', '', '·');
      dot.setAttribute('aria-hidden', 'true');
      meta.append(commit, dot, time);
      row.append(issue, title, meta, visualControl(entry));
      list.append(row);
    }
    body.append(history.entries.length ? list : el('p', 'history-note', `No landed issues found on ${history.trunk}.`));
    body.append(link('history-more', `View ${history.trunk}`, history.url));
  }
  panel.replaceChildren(head, body);
  body.scrollTop = scroll;
  if (active) {
    const match = [...panel.querySelectorAll<HTMLElement>('a, button, [data-visual]')].find((node) =>
      visual
        ? node.dataset.visual === visual
        : href
          ? node.getAttribute('href') === href &&
            node.className === active.className &&
            node.getAttribute('aria-label') === label
          : node.getAttribute('aria-label') === label,
    );
    (match ?? panel.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
  }
};

const covering = matchMedia('(max-width: 1099px), (max-height: 700px)');
const PANEL_FOCUS = '.panel-actions .btn, .ask .btn, .icon-btn';
const syncCover = () => {
  const panel = $('panel');
  const isCovered = !panel.hidden && covering.matches;
  const isFocusOutside = !panel.contains(document.activeElement);
  for (const node of document.querySelectorAll<HTMLElement>('.top, #human, #queue, #columns, .statusbar'))
    node.inert = isCovered;
  document.body.classList.toggle('is-covered', isCovered);
  if (isCovered) {
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
  } else {
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
  }
  if (isCovered && isFocusOutside)
    (panel.querySelector<HTMLElement>(PANEL_FOCUS) ?? panel.querySelector<HTMLElement>('button'))?.focus({
      preventScroll: true,
    });
};
covering.addEventListener('change', syncCover);

const setHistory = (isOpen: boolean) => {
  if (isOpen && isQueueOpen) showQueue(false);
  if (!isOpen) return closePanel();
  coordinator.close(false);
  selected = null;
  for (const node of document.querySelectorAll('[data-key].is-selected')) node.classList.remove('is-selected');
  isHistoryOpen = true;
  $('history').setAttribute('aria-expanded', 'true');
  document.body.classList.add('has-panel');
  $('panel').hidden = false;
  drawHistory();
  syncCover();
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

const faviconColors = () => {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return { tile: token('--card'), bar: token('--fg'), needs: token('--needs'), works: token('--working') };
};

const systemNotice = (title: string, body: string, tag: string, open: () => void) => {
  const isAway = document.hidden || !document.hasFocus();
  if (!isNotifyOn || !isAway || !('Notification' in window) || Notification.permission !== 'granted') return;
  const shown = new Notification(title, { body, tag, icon: favicon('needs', faviconColors()) });
  shown.addEventListener('click', () => {
    window.focus();
    open();
  });
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
  for (const card of fresh) {
    const { title, body } = notice(card);
    systemNotice(title, body, keyOf(card), () => {
      if (view !== 'now') setView('now');
      openPanel(keyOf(card));
    });
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
  const previousWarnings = startupWarnings;
  starting = now;
  startupWarnings = new Map(
    cards.flatMap((card) => (card.number !== null && card.warning ? [[card.number, card.warning] as const] : [])),
  );
  if (before === null) return lines;
  for (const [number, warning] of startupWarnings)
    if (previousWarnings.get(number) !== warning) lines.push(`#${number}: ${warning}`);
  for (const [number, step] of now)
    if (!before.has(number))
      lines.push(step ? `#${number} is starting the ${step} step` : `#${number} is starting a session`);
  for (const [number, step] of before) {
    if (now.has(number)) continue;
    const card = cards.find((other) => other.number === number);
    if (card?.sessionId) lines.push(step ? `#${number} started the ${step} step` : `#${number} opened a session`);
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

const daemonItem = (daemon: DaemonView): { text: string; tone: string; title: string } => {
  const { tone, title } = AUTO[daemon.auto];
  return { text: `auto ${daemon.auto}`, tone, title: `The daemon PID ${daemon.pid} runs. ${title}` };
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
  fresh.title =
    !isDown && source.error
      ? `cannot read: ${source.error}`
      : source.readAt
        ? `${name} was read at ${clock(source.readAt)}`
        : '';
  fresh.replaceChildren(el('i', 'dot'), el('span', 'sb-name', name), text);
  const terminal = data?.terminal;
  const terminalNode = $('terminal');
  terminalNode.dataset.tone = terminal?.ok === true ? 'ok' : terminal?.ok === false ? 'fail' : 'wait';
  terminalNode.title = terminal?.error ? `herdr: ${terminal.error}` : 'Run and Go use herdr';
  (terminalNode.querySelector('.sb-text') as HTMLElement).textContent =
    terminal?.ok === true ? 'up' : terminal?.ok === false ? 'down' : 'checking';
  const daemon = $('daemon');
  daemon.hidden = !data;
  if (data) {
    const item = daemonItem(data.daemon);
    daemon.dataset.tone = item.tone;
    daemon.title = item.title;
    daemon.replaceChildren(el('i', 'dot'), el('span', 'sb-name', 'Daemon'), el('span', 'sb-text', item.text));
  }
  if (data?.picker) picker.update(data.picker, data.registry);
  document.body.toggleAttribute('data-stale', isDown);
  coordinator.down(isDown);
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
  registry: registry(),
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
  const scroll = $('panel').dataset.key === selected ? ($('panel').querySelector('.panel-body')?.scrollTop ?? 0) : 0;
  $('panel').dataset.key = selected as string;
  $('panel').replaceChildren(...drawPanel(entry.card, panelContext(entry.card)));
  const body = $('panel').querySelector('.panel-body');
  if (body) body.scrollTop = scroll;
  if (focused)
    (
      $('panel').querySelector<HTMLElement>(`[aria-label="${CSS.escape(focused)}"]`) ??
      $('panel').querySelector<HTMLElement>('.panel-head > .icon-btn:last-child')
    )?.focus({ preventScroll: true });
};

const revealCard = (key: string) => {
  const group = document
    .querySelector(`[data-key="${CSS.escape(key)}"]`)
    ?.closest<HTMLElement>('.epic-children[hidden]');
  if (group) setEpicOpen(Number(group.closest<HTMLElement>('.epic-group')?.dataset.epic), true);
};

const openPanel = (key: string) => {
  if (isQueueOpen) showQueue(false);
  if (!byKey.has(key)) return;
  coordinator.close(false);
  revealCard(key);
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
  syncCover();
  $('panel').querySelector<HTMLElement>(PANEL_FOCUS)?.focus({ preventScroll: true });
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
  syncCover();
  for (const node of document.querySelectorAll<HTMLElement>('[data-key].is-selected'))
    node.classList.remove('is-selected');
  if (wasHistory) $('history').focus({ preventScroll: true });
  if (key) {
    revealCard(key);
    document.querySelector<HTMLElement>(`#columns [data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }
  updateTail();
}

const reachable = (node: HTMLElement | null | undefined) =>
  node?.closest('.epic-children[hidden]')?.closest('.epic-group')?.querySelector<HTMLElement>('.epic-row') ?? node;

type FocusMark = {
  kind: 'card' | 'control' | 'chip' | 'tail' | 'epic' | 'pill';
  key: string;
  column?: string;
  label?: string;
};

const markFocus = (active: Element | null): FocusMark | null => {
  const chip = active?.closest('#summary .chip');
  if (chip) return { kind: 'chip', key: [...chip.classList].find((name) => name.startsWith('chip-')) as string };
  const pill = active?.closest<HTMLElement>('.human-pill');
  if (pill) {
    const key = (pill.querySelector('[data-key]') as HTMLElement).dataset.key as string;
    return { kind: 'pill', key, label: active?.matches('.human-go') ? 'go' : undefined };
  }
  if (!active?.closest('#columns')) return null;
  const column = columnId(active.closest('.col') as Element);
  if (active.closest('.tail')) return { kind: 'tail', key: '', column };
  const row = active.closest<HTMLElement>('.epic-row');
  if (row) return { kind: 'epic', key: row.dataset.group as string, column };
  const card = active.closest<HTMLElement>('.card[data-key]');
  if (!card) return null;
  const key = card.dataset.key as string;
  return card === active
    ? { kind: 'card', key, column }
    : { kind: 'control', key, column, label: active.getAttribute('aria-label') ?? active.textContent?.trim() ?? '' };
};

const restoreFocus = (mark: FocusMark) => {
  const one = (selector: string) => document.querySelector<HTMLElement>(selector);
  const keyed = (key: string, scope = '#columns') => one(`${scope} [data-key="${CSS.escape(key)}"]`);
  const card = mark.kind === 'card' || mark.kind === 'control' ? keyed(mark.key) : null;
  const control =
    mark.kind === 'control'
      ? [...(card?.querySelectorAll<HTMLElement>('button, a') ?? [])].find(
          (node) => (node.getAttribute('aria-label') ?? node.textContent?.trim()) === mark.label,
        )
      : null;
  const stop = [...document.querySelectorAll<HTMLElement>('#columns .col')]
    .find((col) => columnId(col) === mark.column)
    ?.querySelector<HTMLElement>(`:is(${STOPS})[tabindex="0"], .empty`);
  if (mark.kind === 'tail') measureTail();
  const target = {
    chip: () => one(`#summary .${mark.key}`),
    tail: () => (one('.col-needs .tail-wrap')?.hidden === false ? one('.col-needs .tail') : stop),
    epic: () => one(`.epic-row[data-group="${CSS.escape(mark.key)}"]`) ?? stop,
    pill: () => {
      const open = keyed(mark.key, '#human');
      return (mark.label ? open?.closest('.human-pill')?.querySelector<HTMLElement>('.human-go') : open) ?? stop;
    },
    card: () => reachable(card) ?? stop,
    control: () => control ?? reachable(card) ?? stop,
  }[mark.kind]();
  target?.focus({ preventScroll: true });
};

const drawBoard = (next: Board) => {
  drawQueue(next);
  const mark = markFocus(document.activeElement);
  used = new Set();
  byKey = new Map();
  const needs = next.columns.needs.length;
  document.title = pageTitle(next.repo, needsYou(next).length);
  $('favicon').href = favicon(tone(next), faviconColors());
  $('repo').textContent = next.repo;
  $('repo').title = next.repo;
  $('refresh').title = `${readAgain()} (r)`;
  $('dirty').hidden = !next.noRun;
  const banner = next.noRun ?? '';
  if ($('dirty').textContent !== banner) $('dirty').textContent = banner;
  $('summary').replaceChildren(...summary(next));
  $('history-total').textContent = String(next.history?.entries.length ?? 0);
  if (isHistoryOpen) drawHistory();
  const board = $('columns');
  board.dataset.view = view;
  board.style.setProperty('--stages', String(Math.max(1, next.flow?.stages.length ?? 0)));
  board.classList.toggle('is-calm', needs === 0);
  const bodies = () => board.querySelectorAll<HTMLElement>('.col[aria-labelledby] > .col-body');
  const scrolls = new Map(
    [...bodies()].map((body) => [body.parentElement?.getAttribute('aria-labelledby'), body.scrollTop]),
  );
  board.replaceChildren(
    ...(view === 'pipeline'
      ? pipelineView(next.columns, next.flow)
      : COLUMNS.map((spec) => column(spec, next.columns[spec.key]))),
  );
  for (const body of bodies()) {
    const top = scrolls.get(body.parentElement?.getAttribute('aria-labelledby'));
    if (top !== undefined) body.scrollTop = top;
  }
  drawHuman(next.columns.human);
  board.setAttribute('aria-busy', 'false');
  if (seen === null) {
    seen = new Map();
    markAllSeen();
  }
  const lines = [
    ...notify(needsYou(next).filter(isCard)),
    ...startNotices(next.columns),
    ...(coordinatorLine ? [coordinatorLine] : []),
  ];
  coordinatorLine = null;
  if (lines.length) $('announce').textContent = lines.join('. ');
  if (selected) {
    if (byKey.has(selected)) drawPanelFor();
    else closePanel();
  }
  syncStops();
  if (mark) restoreFocus(mark);
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
    coordinator.close(false);
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
  for (const node of document.querySelectorAll<HTMLElement>('[data-since]')) {
    const text = `${age(node.dataset.since as string, now, 'fine' in node.dataset)}${node.dataset.suffix ?? ''}`;
    if (node.textContent !== text) node.textContent = text;
  }
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
    next.next,
    next.flow,
    next.tracker,
    next.columns,
    next.history,
    next.source.error,
    next.queue,
    next.coordinator.state,
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
      : path === '/api/assist'
        ? data?.noRun || defaultReason()
        : runReason(agent ?? null, number);
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
      hasRead = true;
      for (const [number, launch] of launches) if (launch.phase !== 'pending') launches.delete(number);
      coordinatorLine = coordinator.update(next.coordinator);
      data = { ...next, coordinator: coordinator.view() };
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
  const lists = [...document.querySelectorAll<HTMLElement>('#columns .col')].map((col) =>
    [...col.querySelectorAll<HTMLElement>('.card[data-key], .epic-row')].filter(isStop),
  );
  const current = (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>('.card[data-key], .epic-row');
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

const boardActions = (isPhoneMenu: boolean) => [
  { label: coordinator.label(), icon: 'message', key: '', run: coordinator.toggle },
  ...(isPhoneMenu ? [] : [{ label: 'Show the issue queue', icon: 'stages', key: '', run: () => showQueue(true) }]),
  { label: readAgain(), icon: 'refresh', key: 'r', run: () => $('refresh').click() },
  ...(isPhoneMenu
    ? []
    : [
        {
          label: isHistoryOpen ? 'Hide history' : 'Show history',
          icon: 'clock',
          key: 'd',
          run: () => setHistory(!isHistoryOpen),
        },
      ]),
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
  const goTo: PaletteItem[] = [];
  for (const [column, group] of [
    ['needs', 'Needs you'],
    ['running', 'Running'],
    ['idle', 'Run the next step'],
    ['human', 'Human sessions'],
  ] as [Column, string][]) {
    for (const card of shown.columns[column]) {
      const key = [...byKey].find(([, entry]) => entry.card === card)?.[0] ?? keyOf(card);
      if (card.number !== null)
        goTo.push({
          group: 'Go to',
          isGoTo: true,
          number: card.number,
          label: `Go to #${card.number}`,
          context: card.title,
          icon: 'panel',
          tone: null,
          key: '',
          run: () => {
            if (!document.querySelector(`[data-key="${CSS.escape(key)}"]`)) setView('now');
            openPanel(key);
            document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus();
          },
        });
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
            label: `Run with ${display}`,
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
  const epics = new Map<number, string>();
  for (const card of [...shown.columns.needs, ...shown.columns.running, ...shown.columns.idle])
    if (card.epic) epics.set(card.epic.number, card.epic.title);
  for (const [number, title] of epics)
    goTo.push({
      group: 'Go to',
      isGoTo: true,
      number,
      label: `Go to epic #${number}`,
      context: title,
      icon: 'chevron',
      tone: null,
      key: '',
      run: () => {
        const row = () => document.querySelector<HTMLElement>(`.epic-row[data-epic="${number}"]`);
        if (!row()) setView('now');
        if (!$('panel').hidden && (covering.matches || row()?.offsetParent === null)) closePanel();
        setEpicOpen(number, true);
        row()?.focus();
      },
    });
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
    { group: 'Board', number: null, context: '', ...agentOrderEntry },
    {
      group: 'Board',
      number: null,
      label: view === 'now' ? 'Show the pipeline' : 'Show what needs you now',
      context: '',
      icon: view === 'now' ? 'stages' : 'board',
      key: 'v',
      run: () => setView(view === 'now' ? 'pipeline' : 'now'),
    },
    ...boardActions(false).map((action) => ({ group: 'Board', number: null, context: '', ...action })),
    {
      group: 'Board',
      number: null,
      label: 'Expand all epic groups',
      context: '',
      icon: 'chevron',
      key: '',
      run: () => {
        storeOpenEpics((open) => {
          for (const card of shown.columns.idle) if (card.epic) open.add(card.epic.number);
        });
        drawBoard(project(data as Board));
      },
    },
    {
      group: 'Board',
      number: null,
      label: 'Collapse all epic groups',
      context: '',
      icon: 'chevron',
      key: '',
      run: () => {
        storeOpenEpics((open) => open.clear());
        drawBoard(project(data as Board));
      },
    },
  );
  return [...goTo, ...items];
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
      openMenu(card.querySelector<HTMLElement>('.more') ?? card, menuOf(entry.card, card.dataset.key as string), {
        label: menuName(entry.card, 'Actions of'),
      });
  },
};

const ROW_KEYS: Record<string, () => void> = {
  ArrowDown: () => move(0, 1),
  ArrowUp: () => move(0, -1),
  ArrowLeft: () => move(-1, 0),
  ArrowRight: () => move(1, 0),
};

const updates = setupUpdates();
const coordinator = setupCoordinator({
  closeOthers: () => {
    if (isQueueOpen) showQueue(false);
    if (selected || isHistoryOpen) closePanel();
  },
  changed: (next) => {
    if (!data) return;
    data = { ...data, coordinator: next };
    render();
  },
  notify: (title, open) => systemNotice(title, '', 'coordinator', open),
});
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || updates.contains(event.target) || $('agent-picker').contains(event.target as Node))
    return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (!$('palette').open) openPalette(paletteItems());
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || $('keys').open || $('palette').open) return;
  if ((event.target as Element).closest?.<HTMLElement>('input, textarea, select, [contenteditable]')) return;
  if (event.key === 'Escape' && $('menu').matches(':popover-open')) return;
  if (event.key === 'Escape' && updates.dismiss()) {
    event.preventDefault();
    return;
  }
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
  const isRow = document.activeElement?.matches?.('.epic-row');
  const press = (card && CARD_KEYS[event.key]) || (isRow && ROW_KEYS[event.key]) || (isKeysOn && KEYS[event.key]);
  if (!press) return;
  event.preventDefault();
  (press as (card: HTMLElement | null) => void)(card);
});

const columns = $('columns');
columns.addEventListener('focusin', (event) => {
  const node = (event.target as Element).closest<HTMLElement>(STOPS);
  const col = node?.closest('.col');
  if (!node || !col) return;
  stopKeys.set(columnId(col), stopKey(node));
  syncStops();
});
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
    { label: menuName(entry.card, 'Actions of') },
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
addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== store.key('open-epics')) return;
  const active = document.activeElement as HTMLElement | null;
  openEpics = parseOpenEpics(event.newValue ?? '');
  showOpenEpics();
  if (active?.closest('.epic-children[hidden]')) reachable(active)?.focus({ preventScroll: true });
});
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
$('board-more').addEventListener('click', () =>
  openMenu($('board-more'), boardActions(matchMedia('(max-width: 719px)').matches), {
    label: 'Board actions',
  }),
);
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
const replaceOrder = async (order: readonly Host[], expectedVersion: string): Promise<AgentOrder> => {
  if (isReconnecting()) throw new Error('the board is reconnecting');
  settled = reads;
  try {
    let response: Response;
    try {
      response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, expectedVersion } satisfies AgentReplaceRequest),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(`${SERVER_DOWN}. Refresh before another change.`);
    }
    const body = (await response.json().catch(() => null)) as
      | { order: AgentOrder }
      | AgentReplaceConflict
      | { error: string }
      | null;
    if (response.ok && body && 'order' in body) return body.order;
    if (response.status === 409 && body && 'latest' in body) throw new OrderConflict(body.latest, body.error);
    throw new Error(body && 'error' in body ? body.error : `the server answered ${response.status}`);
  } finally {
    settled = reads;
    void load();
  }
};
const retryWait = async (number: number, waitId: string) => {
  const outcome = await post('/api/run', { number, waitId } satisfies RunRequest, 'Retry failed', { timeout: 150_000 });
  settled = reads;
  void load();
  if (outcome.status !== 'accepted') throw new Error(outcome.error ?? SERVER_DOWN);
};
const picker = createAgentPicker($('agent-picker'), { replace: replaceOrder, retry: retryWait });
setupPalette();
setupMenu();
drawNotify();
drawHints(null);
setInterval(tick, 1000);
drawSkeleton();
drawStatus(source, false);
load();
