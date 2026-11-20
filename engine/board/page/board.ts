import type { AgentOrder, Host } from '../../lib/config/core.ts';
import { compareKeys, type IssueKey, parseKey } from '../../lib/tracker/key.ts';
import type { Level, RowSource, StartPair } from '../../lib/workflow/effort.ts';
import type {
  Action,
  AgentReplaceConflict,
  AgentReplaceRequest,
  Board,
  Card,
  Column,
  Columns,
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
  isYourTurn,
  keyOf,
  knownAgent,
  LIVE,
  laneTrack,
  levelSource,
  needsYou,
  notice,
  pageTitle,
  parseOpenEpics,
  parseSeenTurn,
  pipeline,
  runTitle,
  shortPath,
  signature,
  startName,
  startTitle,
  stateLabel,
  tail,
  tone,
  turnLine,
} from '../view.ts';
import { createAgentPicker, OrderConflict } from './agent-picker.ts';
import { drawControl } from './control.ts';
import { setupCoordinator } from './coordinator.ts';
import { drawHome } from './home.ts';
import { closeMenu, openMenu, openPalette, setupMenu, setupPalette } from './palette.ts';
import { drawPanel } from './panel.ts';
import { drawQueue, setQueueOpen, setupQueue } from './queue.ts';
import {
  AREA_NAMES,
  AREAS,
  type Area,
  isChatShown,
  type Pane,
  readShell,
  type Shell,
  TABS,
  type Tab,
} from './shell.ts';
import { dialogOpen, openStopDialog } from './stop-dialog.ts';
import { applyTheme, readTheme, THEME_KEY, THEMES, type Theme, writeTheme } from './theme/choice.ts';
import {
  $,
  actionButton,
  announce,
  copy,
  el,
  gateLabel,
  icon,
  iconButton,
  link,
  mark,
  post,
  prChips,
  SERVER_DOWN,
  send,
  setupToast,
  store,
  timed,
  toast,
} from './ui.ts';
import { isReconnecting, setupUpdates } from './update-dialog.ts';

const COPY: Record<string, string> = { 'no-progress': 'command', 'set-aside': 'command', 'dirty-tree': 'path' };
const STOPPING = 'The daemon ends the session. The card moves to Idle when the session has ended.';
const ON_ISSUE = new Set(['blocked']);
const STATUS_ICONS: Record<string, string> = {
  works: 'works',
  starts: 'works',
  waits: 'target',
  'no-progress': 'alert',
  stopping: 'stop',
  'dirty-tree': 'diff',
  blocked: 'person',
  'quota-wait': 'clock',
};
const FIND_KEY = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
const QUEUE_LEVEL = 'The queue starts this step at the start pair, with no override';

let data: Board | null = null;
let theme: Theme = readTheme();
let shell: Shell = readShell({ area: store.get('area'), tab: store.get('tab') });
let isNotifyOn = store.get('notify') === 'on';
let isKeysOn = store.get('keys') !== 'off';
let openEpics = parseOpenEpics(store.get('open-epics') ?? '');
let isServerDown = false;
let intakePending = false;
let seen: Map<string, string> | null = null;
let needsKeys: Set<string> | null = null;
let starting: Map<IssueKey, string | null> | null = null;
let startupWarnings = new Map<IssueKey, string>();
let byKey = new Map<string, { card: Card; column: Column }>();
let used = new Set<string>();
let coordinatorLine: string | null = null;
type Pressed = Map<IssueKey | null, 'pending' | 'done'>;
const asides: Pressed = new Map();
const stops: Pressed = new Map();
const refusals = new Map<IssueKey | null, { sessionId: string | null; state: string | null; line: string }>();

const SEEN_TURN = 'seen-turn:';
const seenTurn = (terminal: string) => parseSeenTurn(store.get(`${SEEN_TURN}${terminal}`));
const seeTurn = (card: Card) => {
  if (card.sessionId === null || card.waitFor !== 'turn' || typeof card.turn !== 'number') return;
  const name = `${SEEN_TURN}${card.sessionId}`;
  if (store.get(name) === String(card.turn)) return;
  store.set(name, String(card.turn));
  render(false);
};

const who = (card: Card) =>
  card.number === null ? (card.title ? `human session "${card.title}"` : 'a human session') : `#${card.number}`;
const canRunLater = (card: Card) =>
  card.sessionId === null &&
  card.step &&
  (card.state === null || card.state === 'no-progress' || card.state === 'set-aside');
const copyWhat = (card: Card) => (card.act ? COPY[card.state as string] : null);
const onTracker = () => ((data as Board).tracker ? ` on ${(data as Board).tracker}` : '');
const readAgain = () => (data?.tracker ? `Read ${(data as Board).tracker} again` : 'Read the issues again');
let refreshedUntil = 0;
let refreshDone: ReturnType<typeof setTimeout> | undefined;
const refreshTitle = () => (Date.now() < refreshedUntil ? `${readAgain()}: done` : `${readAgain()} (r)`);

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
  announce('Opening an intake tab');
  try {
    const outcome = await post('/api/intake', {}, 'New intake failed', { timeout: 10000 });
    if (outcome.status === 'accepted') announce('Intake tab opened');
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
      announce(`New intake failed. ${detail}`);
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

const runReason = (agent: string | null, number?: IssueKey | null) => {
  if (data?.noRun) return data.noRun;
  const record = data?.queue?.record;
  if (record?.state === 'me-gate' && number != null && record.numbers[0] === number && record.choice) {
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
  title: 'Open the agent order on Control',
  run: () => {
    setArea('control');
    if (!picker.focus()) $('ctl-agents').focus();
  },
};

const namedHost = (card: Card): string | null => {
  const record = data?.queue?.record;
  if (record?.state === 'me-gate' && record.numbers[0] === card.number && record.choice?.kind === 'explicit')
    return record.choice.host;
  const start = card.step ? data?.starts?.[card.step] : undefined;
  return start?.kind === 'start' ? start.host : null;
};

const toMenuEntry = (action: Action, card: Card): MenuEntry => {
  const host = action.id.startsWith('run:') ? action.id.slice(4) : null;
  if (host && data && knownAgent(data.registry, host))
    return {
      icon: action.icon,
      host,
      label: action.label,
      tag: host === namedHost(card) ? 'Default' : undefined,
      isDisabled: action.isDisabled,
      title: action.title,
      run: action.run as () => unknown,
    };
  return {
    icon: action.icon,
    label: action.name,
    key: action.isMain ? 'Enter' : (action.key ?? ''),
    isDisabled: action.isDisabled,
    title: action.title,
    run: action.href ? () => window.open(action.href, '_blank', 'noopener,noreferrer') : (action.run as () => unknown),
  };
};

const refusedRun = (isError: boolean, reason: string) => async () => {
  toast(reason, { isError });
  announce(reason);
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
      run: () => {
        if (card.number === null) seeTurn(card);
        return act('/api/go', { sessionId: card.sessionId }, 'Go failed', () =>
          toast(`Focused the pane of ${who(card)} in herdr`, { detail: 'Switch to your terminal to see it.' }),
        );
      },
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
  if (card.state === 'no-progress' || card.state === 'set-aside') {
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
        title: base.isDisabled
          ? base.title
          : card.state === 'no-progress'
            ? `Start the ${card.step} step again. It made no progress last time.`
            : `Start the ${card.step} step again`,
      });
      list.push(...overrideActionsOf(card, true));
    }
  } else if (card.run) {
    list.push(runAction(card));
    list.push(...overrideActionsOf(card, false));
  }
  if (card.state === 'dirty-tree' || (card.state === 'set-aside' && card.path)) {
    list.push({
      id: 'shell',
      label: 'Open shell',
      icon: 'terminal',
      busy: 'Opening',
      name: `Open shell, #${card.number}`,
      title: `Open a shell in the worktree in a new herdr tab${card.state === 'dirty-tree' ? ' (Enter)' : ''}`,
      run: () =>
        act('/api/shell', { number: card.number }, 'Open shell failed', () =>
          toast(`Opened a shell in the worktree of #${card.number}`, {
            detail:
              card.state === 'dirty-tree'
                ? 'Commit or stash the changes there; then the card moves on.'
                : 'Commit or stash the changes there.',
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
  if (card.aside) {
    const isBusy = asides.has(card.number);
    list.push({
      id: 'aside',
      label: isBusy ? 'Setting aside' : 'Set aside',
      icon: 'aside',
      name: `Set aside #${card.number}`,
      key: 's',
      isGhost: true,
      isBusy,
      isDisabled: isBusy,
      title: isBusy
        ? 'The daemon sets this issue aside.'
        : 'Move this issue to Idle. Auto mode skips it until you press Run or Resume (s)',
      run: () => pressAct(asides, card, '/api/aside', { number: card.number }, asideText(card)),
    });
  }
  if (card.stop) {
    const isBusy = card.state === 'stopping' || stops.has(card.number);
    const reason = isBusy ? STOPPING : card.stop.reason;
    list.push({
      id: 'stop',
      label: isBusy ? 'Stopping' : 'Stop',
      icon: 'stop',
      name: `Stop the ${card.step} session of #${card.number}`,
      key: 's',
      isGhost: true,
      isBusy,
      isDisabled: Boolean(reason),
      title: reason ?? 'End this session and set the issue aside (s)',
      run: card.stop.reason ? refusedRun(card.state !== 'stopping', card.stop.reason) : () => openStop(card),
    });
  }
  list.forEach((action, index) => {
    action.isMain = index === 0;
  });
  return list;
};

const menuOf = (card: Card, key: string): (MenuEntry | 'rule')[] => [
  ...actionsOf(card).map((action) => toMenuEntry(action, card)),
  ...levelEntries(card),
  'rule',
  { icon: 'panel', label: 'Show the details', key: 'Space', run: () => openDetails(key) },
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
  if (card.state === 'set-aside') {
    node.classList.add('aside-pill');
    node.append(icon('aside'), el('span', 'status-label', stateLabel(card)));
    if (card.step) node.append(el('span', 'detail mono', card.step));
    return node;
  }
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
    if (card.gate === 'auto') node.append(gateLabel((data as Board).daemon.auto));
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

const cardShell = (card: Card, column: Column, isCompact: boolean, level: 'h2' | 'h3' | 'h4' = 'h3') => {
  const key = keyFor(card);
  byKey.set(key, { card, column });
  const node = el('article', `card${isCompact ? ' compact' : ''}${key === shell.details ? ' is-selected' : ''}`);
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
  const entries = actions.filter((action) => action.id.startsWith('run:')).map((action) => toMenuEntry(action, card));
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

const asideChip = (action: Action) => {
  const node = el('button', `aside-chip${action.isBusy ? ' is-busy' : ''}`);
  node.type = 'button';
  node.title = action.title;
  node.setAttribute('aria-label', action.name);
  if (action.isDisabled) node.setAttribute('aria-disabled', 'true');
  if (action.isBusy) node.setAttribute('aria-busy', 'true');
  node.append(icon(action.icon), el('span', 'aside-chip-label', action.label));
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    action.run?.();
  });
  return node;
};

const asideLine = (card: Card) =>
  card.state === 'set-aside' && card.path ? `The lane worktree has uncommitted changes: ${shortPath(card.path)}` : null;

const drawCard = (
  card: Card,
  column: Column,
  { isCompact = false, level }: { isCompact?: boolean; level?: 'h2' | 'h3' | 'h4' } = {},
) => {
  const { key, node, title, id } = cardShell(card, column, isCompact, level);
  if (column === 'needs') node.classList.add('is-needs');
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
    const note = startNote(card);
    if (note) main.append(note);
    if (card.warning) main.append(el('p', 'warning', card.warning));
    const line = asideLine(card);
    if (line) main.append(el('p', 'warning', line));
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
  const headAct = actions.find((action) => action.id === 'aside' || action.id === 'stop');
  if (headAct) head.append(asideChip(headAct));
  head.append(more);
  node.append(head, title);
  const refusal = card.number === null ? undefined : refusals.get(card.number);
  for (const part of [
    startNote(card),
    card.state === 'works' ? liveLine(card) : null,
    prChips(card.pr),
    card.act && card.state !== 'no-progress' ? actLine(card) : null,
    card.warning ? el('p', 'warning', card.warning) : null,
    refusal ? el('p', 'warning', refusal.line) : null,
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

const storeOpenEpics = (change: (open: Set<IssueKey>) => void) => {
  const stored = store.get('open-epics');
  const next = new Set(stored === null ? openEpics : parseOpenEpics(stored));
  change(next);
  store.set('open-epics', JSON.stringify([...next].sort(compareKeys)));
  openEpics = next;
};

const showOpenEpics = () => {
  for (const row of document.querySelectorAll<HTMLElement>('.epic-row')) {
    const epic = parseKey(row.dataset.epic ?? '');
    const isOpen = epic !== null && openEpics.has(epic);
    row.setAttribute('aria-expanded', String(isOpen));
    ($(row.getAttribute('aria-controls') as string) as HTMLElement).hidden = !isOpen;
  }
  syncStops();
};

const setEpicOpen = (epic: IssueKey, isOpen: boolean) => {
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
  const bottom =
    Math.min(body.getBoundingClientRect().bottom, $('tp-board').getBoundingClientRect().bottom) -
    (wrap.hidden ? 0 : wrap.offsetHeight);
  const counts = new Map();
  for (const node of body.querySelectorAll<HTMLElement>('.card[data-key]')) {
    const isHidden = node.getBoundingClientRect().bottom > bottom + 1;
    node.dataset.hidden = String(isHidden);
    if (!isHidden) continue;
    const group = node.closest<HTMLElement>('.group') as HTMLElement;
    counts.set(group.dataset.group, {
      short: group.dataset.short,
      count: (counts.get(group.dataset.group)?.count ?? 0) + 1,
    });
  }
  const text = counts.size ? tail([...counts.values()]) : '';
  wrap.hidden = text === '';
  (wrap.querySelector<HTMLElement>('.tail-text') as HTMLElement).textContent = text;
};

const measureFade = () => {
  const board = $('columns');
  board.toggleAttribute(
    'data-fade',
    board.dataset.view === 'pipeline' && board.scrollLeft + board.clientWidth < board.scrollWidth - 2,
  );
};

let tailFrame = 0;
const updateTail = () => {
  cancelAnimationFrame(tailFrame);
  tailFrame = requestAnimationFrame(() => {
    measureTail();
    measureFade();
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

const humanPill = (card: Card) => {
  const key = keyFor(card);
  byKey.set(key, { card, column: 'human' });
  const pill = el('div', 'human-pill');
  pill.dataset.state = card.state ?? '';
  pill.dataset.wait = card.waitFor ?? '';
  const isTurn = isYourTurn(card, seenTurn);
  if (isTurn) pill.dataset.yourTurn = '';
  const open = el('button', `human-open${key === shell.details ? ' is-selected' : ''}`);
  open.type = 'button';
  open.dataset.key = key;
  open.title = 'Show the details and the screen of this session';
  open.append(
    mark(card, registry()),
    el('span', 'human-name', card.title || 'A session'),
    el('i', 'human-dot'),
    el('span', 'human-state', isTurn ? 'your turn' : (stateLabel(card) as string)),
  );
  open.addEventListener('click', () => (shell.details === key ? closeDetails(true) : openDetails(key)));
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

const visualPresses = new Set<IssueKey>();

const makeVisual = async (number: IssueKey) => {
  if (visualPresses.has(number)) return;
  visualPresses.add(number);
  if (shell.tab === 'history') drawHistory();
  await act('/api/visual', { number }, 'Make visual failed');
  visualPresses.delete(number);
  if (shell.tab === 'history') drawHistory();
};

const visualControl = (entry: HistoryRow) => {
  const { number } = entry;
  const state = visualPresses.has(number) && entry.visual === 'none' ? 'starting' : entry.visual;
  let node: HTMLElement;
  let name: string;
  if (state === 'ready') {
    name = `Open the visual of #${number}`;
    node = Object.assign(el('a', 'btn ghost history-action'), {
      href: `/visual/${entry.sha}`,
      target: '_blank',
      rel: 'noreferrer',
    });
    node.append(icon('open'));
  } else if (state === 'making') {
    name = `The visual of #${number} is in the making`;
    node = el('span', 'history-action history-making');
    node.setAttribute('role', 'status');
    node.tabIndex = -1;
    node.append(icon('pending'));
  } else {
    name = state === 'starting' ? `Starting the visual of #${number}` : `Make the visual of #${number}`;
    node = el('button', 'btn ghost history-action');
    (node as HTMLButtonElement).type = 'button';
    node.append(icon('diff'));
    if (state === 'starting') node.setAttribute('aria-busy', 'true');
    else node.addEventListener('click', () => void makeVisual(number));
  }
  node.setAttribute('aria-label', name);
  node.title = name;
  node.dataset.visual = String(number);
  return node;
};

const drawHistory = () => {
  const panel = $('history-pane');
  const active = panel.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
  const href = active?.getAttribute('href');
  const label = active?.getAttribute('aria-label');
  const visual = active?.dataset.visual;
  const scroll = panel.querySelector('.history-body')?.scrollTop ?? 0;
  const history = data?.history;
  const error = isServerDown ? SERVER_DOWN : data?.source.error;
  panel.dataset.state = 'history';
  const head = el('div', 'panel-head history-head');
  head.append(el('h2', '', history ? `Landed on ${history.trunk}` : 'Landed history'));
  const body = el('div', 'history-body');
  if (!history)
    body.append(el('p', 'history-note', error ? `Cannot read history: ${error}` : 'Loading landed history…'));
  else {
    if (error) {
      const warning = el('p', 'warning', `${error}. History shows the last good read.`);
      warning.setAttribute('role', 'status');
      body.append(warning);
    }
    body.append(el('p', 'history-note', 'Latest 20 issues.'));
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

const phone = matchMedia('(max-width: 719px)');
const PANEL_FOCUS = '.panel-actions .btn, .ask .btn, .icon-btn';
const AREA_ICONS: Record<Area, string> = { home: 'home', operations: 'board', control: 'sliders', throughput: 'trend' };
const boardView = (): 'now' | 'pipeline' => (shell.tab === 'pipeline' ? 'pipeline' : 'now');

const markCurrent = (node: Element, isCurrent: boolean) => {
  if (isCurrent) node.setAttribute('aria-current', 'page');
  else node.removeAttribute('aria-current');
};

const moveTo = (node: HTMLElement, parent: HTMLElement, before: Element | null) => {
  if (node.parentElement === parent && node.nextElementSibling === before) return;
  const active = node.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
  parent.insertBefore(node, before);
  active?.focus({ preventScroll: true });
};

const drawShell = () => {
  const { area, tab, details, pane } = shell;
  const isPhone = phone.matches;
  const isOps = area === 'operations';
  const isWide = tab === 'pipeline' && !isPhone;
  const isChat = isChatShown(shell, isPhone);
  const ops = $('area-operations');
  $('work').dataset.area = area;
  for (const each of AREAS) $(`area-${each}`).hidden = each !== area;
  ops.dataset.tab = tab;
  ops.dataset.pane = pane;
  ops.toggleAttribute('data-details', details !== null);
  for (const node of document.querySelectorAll<HTMLElement>('.dest'))
    markCurrent(node, !isPhone && node.dataset.area === area);
  markCurrent($('pb-home'), isPhone && area === 'home');
  markCurrent($('pb-chat'), isPhone && isOps && pane === 'chat');
  markCurrent($('pb-agents'), isPhone && isOps && pane === 'agents');
  markCurrent($('pb-control'), isPhone && area === 'control');
  markCurrent($('board-more'), isPhone && area === 'throughput');
  for (const node of document.querySelectorAll<HTMLElement>('.tab')) {
    const isSelected = node.dataset.tab === tab;
    node.setAttribute('aria-selected', String(isSelected));
    node.tabIndex = isSelected ? 0 : -1;
  }
  $('tp-board').hidden = tab === 'queue' || tab === 'history';
  $('tp-board').setAttribute('aria-labelledby', `tab-${boardView() === 'pipeline' ? 'pipeline' : 'agents'}`);
  $('history-pane').hidden = tab !== 'history';
  if (tab === 'history') drawHistory();
  setQueueOpen(tab === 'queue');
  $('pane-chat').hidden = !isWide;
  $('panel').hidden = details === null;
  if (isWide) moveTo($('panel'), ops, null);
  else moveTo($('panel'), $('center'), null);
  const intake = document.querySelector<HTMLElement>('.intake-control') as HTMLElement;
  if (isPhone) moveTo(intake, $('bar'), $('pb-control'));
  else moveTo(intake, $('side'), $('find'));
  const isDetails = isOps && details !== null && (!isPhone || pane === 'chat');
  const skipCenter = $('skip-center') as HTMLAnchorElement;
  skipCenter.textContent = !isOps ? 'Skip to the work area' : isDetails ? 'Skip to the details' : 'Skip to the chat';
  skipCenter.href = !isOps ? `#area-${area}` : isDetails ? '#panel' : '#coordinator';
  skipCenter.hidden = isOps && !isChat && !isDetails;
  $('skip-pane').hidden = !isOps || (isPhone && pane !== 'agents');
  if (isChat) coordinator.show();
  else coordinator.hide();
  if (area !== 'control') {
    updates.dismiss();
    if ($('agent-picker').querySelector('.ap-handle[aria-expanded="true"]')) closeMenu();
  }
  updateTail();
};
let hiddenFocus: Element | null = null;
document.addEventListener('focusout', (event) => {
  hiddenFocus = event.target instanceof HTMLElement && !event.target.checkVisibility() ? event.target : null;
});
phone.addEventListener('change', () =>
  setShell(shell, document.activeElement === document.body ? hiddenFocus : document.activeElement),
);

const setShell = (next: Shell, active: Element | null = document.activeElement) => {
  const was = shell;
  const wasView = boardView();
  const wasInPanel = active instanceof HTMLElement && $('panel').contains(active);
  shell = next;
  store.set('area', next.area);
  store.set('tab', next.tab);
  if (was.details !== null && next.details !== was.details) {
    $('panel').replaceChildren();
    for (const node of document.querySelectorAll<HTMLElement>('[data-key].is-selected'))
      node.classList.remove('is-selected');
  }
  drawShell();
  if (data && boardView() !== wasView) drawBoard(project(data));
  const now = document.activeElement;
  const isLost = active instanceof HTMLElement && (active.isConnected ? !active.checkVisibility() : wasInPanel);
  if (isLost && (now === active || now === document.body)) {
    const tabNode = $(`tab-${shell.tab}`);
    (shell.area === 'operations' && tabNode.checkVisibility() ? tabNode : $('work')).focus({ preventScroll: true });
  } else if (now === document.body && active instanceof HTMLElement && active.isConnected)
    active.focus({ preventScroll: true });
};

const setArea = (area: Area) => setShell({ ...shell, area });
const setTab = (tab: Tab) =>
  setShell({ ...shell, area: 'operations', tab, ...(phone.matches ? { pane: 'agents' as const, details: null } : {}) });
const setPane = (pane: Pane) => setShell({ ...shell, area: 'operations', pane, details: null });
const showChat = () =>
  setShell({
    ...shell,
    area: 'operations',
    details: null,
    pane: 'chat',
    tab: shell.tab === 'pipeline' ? 'agents' : shell.tab,
  });

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

const drawFavicon = () => {
  if (data) $('favicon').href = favicon(tone(project(data), seenTurn), faviconColors());
};

const THEME_WORDS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const drawTheme = () => {
  const label = `Theme: ${THEME_WORDS[theme]}. Press to change`;
  $('theme').setAttribute('aria-label', label);
  $('theme').title = label;
  $('theme-words').textContent = THEME_WORDS[theme];
};
const setTheme = (next: Theme) => {
  theme = next;
  writeTheme(next);
  applyTheme(next);
  drawTheme();
  drawFavicon();
};
const cycleTheme = () => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'system');

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
            !(card.sessionId === null && card.number !== null && starting?.has(card.number)),
        );
  for (const card of fresh) {
    const { title, body } = notice(card);
    systemNotice(title, body, keyOf(card), () => {
      if (shell.tab === 'pipeline') setTab('agents');
      openDetails(keyOf(card));
    });
  }
  needsKeys = keys;
  return fresh.map((card: Card) => (isYourTurn(card, seenTurn) ? turnLine(card) : notice(card).title));
};

const startNotices = (columns: Columns) => {
  const cards = [...columns.needs, ...columns.running, ...columns.idle];
  const now = new Map<IssueKey, string | null>();
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
    if (previousWarnings.get(number) !== warning)
      lines.push(warning.startsWith(`#${number}: `) ? warning : `#${number}: ${warning}`);
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
        ['s', entry.card.aside ? 'Set aside' : entry.card.stop ? 'Stop' : null],
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

const statusWords = (item: HTMLElement) =>
  `${item.querySelector('.sb-name')?.textContent}: ${item.querySelector('.sb-text')?.textContent}`;

const drawStatus = (source: Board['source'], isDown: boolean) => {
  const changed = isServerDown !== isDown;
  isServerDown = isDown;
  if (changed && shell.tab === 'history') drawHistory();
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
  const failed = [fresh, terminalNode].filter((item) => item.dataset.tone === 'fail').map(statusWords);
  const controlName = ['Control', ...failed].join(', ');
  for (const node of [document.querySelector('.dest[data-area="control"]') as HTMLElement, $('pb-control')]) {
    if (failed.length) {
      node.setAttribute('aria-label', controlName);
      node.title = controlName;
    } else {
      node.removeAttribute('aria-label');
      node.removeAttribute('title');
    }
  }
  drawControl({ daemon: data?.daemon ?? null, isDown });
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

const detailActions = (card: Card): Action[] => {
  const list = actionsOf(card);
  const isAgain = card.state === 'no-progress' || card.state === 'set-aside';
  const host = namedHost(card);
  const mainId = list.find((action) => action.id === 'run' || action.id === 'blocked')?.id;
  const matching = host ? list.find((action) => action.id === `run:${host}`) : undefined;
  if (!mainId || !matching) return list;
  return list
    .filter((action) => action !== matching)
    .map((action) => {
      if (action.id === mainId)
        return {
          ...action,
          label: matching.label,
          name: matching.name,
          ...(isAgain ? { help: 'Starts a new session of the step.' } : {}),
        };
      if (action.id.startsWith('run:')) return { ...action, isGhost: true, group: 'Other agents' };
      if (action.id === 'resume') return { ...action, help: 'Opens the same session again.' };
      return action;
    });
};

const panelContext = (card: Card) => ({
  actions: detailActions(card),
  flow: (data as Board).flow,
  registry: registry(),
  on: onTracker(),
  close: () => closeDetails(true),
  auto: (data as Board).daemon.auto,
});

const drawPanelFor = () => {
  const selected = shell.details as string;
  const entry = byKey.get(selected);
  if (!entry) return closeDetails(false);
  $('panel').setAttribute('aria-label', 'Card details');
  const focused =
    $('panel').contains(document.activeElement) && document.activeElement !== $('panel')
      ? (document.activeElement as Element).getAttribute('aria-label')
      : null;
  const scroll = $('panel').dataset.key === selected ? ($('panel').querySelector('.panel-body')?.scrollTop ?? 0) : 0;
  $('panel').dataset.key = selected;
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
  const epic = parseKey(group?.closest<HTMLElement>('.epic-group')?.dataset.epic ?? '');
  if (epic !== null) setEpicOpen(epic, true);
};

const openDetails = (key: string) => {
  if (!byKey.has(key)) return;
  revealCard(key);
  setShell({ ...shell, area: 'operations', details: key, pane: 'chat' });
  for (const node of document.querySelectorAll<HTMLElement>('[data-key].is-selected'))
    node.classList.remove('is-selected');
  const selected = document.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  selected?.classList.add('is-selected');
  if (shell.tab === 'pipeline') selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  drawPanelFor();
  markSeen(key);
  const entry = byKey.get(key);
  if (entry?.column === 'human') seeTurn(entry.card);
  $('panel').querySelector<HTMLElement>(PANEL_FOCUS)?.focus({ preventScroll: true });
};

function closeDetails(refocus: boolean) {
  const key = shell.details;
  const isBack = refocus && key !== null;
  setShell({
    ...shell,
    details: null,
    ...(isBack && (shell.tab === 'queue' || shell.tab === 'history') ? { tab: 'agents' as const } : {}),
    ...(isBack && phone.matches ? { pane: 'agents' as const } : {}),
  });
  if (isBack) {
    revealCard(key);
    document.querySelector<HTMLElement>(`#tp-board [data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }
}

const reachable = (node: HTMLElement | null | undefined) =>
  node?.closest('.epic-children[hidden]')?.closest('.epic-group')?.querySelector<HTMLElement>('.epic-row') ?? node;

type FocusMark = {
  kind: 'card' | 'control' | 'tail' | 'epic' | 'pill';
  key: string;
  column?: string;
  label?: string;
};

const markFocus = (active: Element | null): FocusMark | null => {
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

const badgeText = (count: number): string => (count === 0 ? '' : count > 999 ? '999+' : String(count));

const drawBadge = (badge: HTMLElement, owner: HTMLElement, name: string, count: number): void => {
  badge.hidden = count === 0;
  badge.textContent = badgeText(count);
  owner.setAttribute('aria-label', count === 0 ? name : `${name}, ${count} need you`);
};

const drawNow = (all: number, work: number, home: number): void => {
  drawBadge($('home-badge'), $('home-badge').closest('button') as HTMLElement, 'Home', home);
  drawBadge($('ops-badge'), $('ops-badge').closest('button') as HTMLElement, 'Operations', all);
  drawBadge($('agents-badge'), $('tab-agents'), 'Agents', work);
  drawBadge($('now-badge'), $('pb-agents'), 'Agents', work);
};

const focusNeed = (): void => {
  if (!data) return;
  const board = project(data);
  if (needsYou(board, seenTurn).length === 0) return;
  if (board.coordinator.state === 'dialog') {
    showChat();
    coordinator.open();
    return;
  }
  setTab('agents');
  const { human } = board.columns;
  const session = human.find((card) => card.waitFor === 'dialog') ?? human.find((card) => isYourTurn(card, seenTurn));
  const target = session
    ? document.querySelector<HTMLElement>(`#human [data-key="${CSS.escape(keyOf(session))}"]`)
    : document.querySelector<HTMLElement>('#col-needs .card');
  target?.focus();
};

const drawBoard = (next: Board) => {
  drawQueue(next);
  const mark = markFocus(document.activeElement);
  used = new Set();
  byKey = new Map();
  const needs = next.columns.needs.length;
  const waiting = needsYou(next, seenTurn);
  document.title = pageTitle(next.repo, waiting.length);
  drawFavicon();
  $('repo').textContent = next.repo;
  $('repo').title = next.repo;
  $('refresh').title = refreshTitle();
  $('dirty').hidden = !next.noRun;
  const banner = next.noRun ?? '';
  if ($('dirty').textContent !== banner) $('dirty').textContent = banner;
  drawNow(waiting.length, waiting.filter(isCard).length, next.columns.needs.length);
  drawHome(next, { open: openDetails });
  if (shell.tab === 'history') drawHistory();
  const board = $('columns');
  board.dataset.view = boardView();
  board.style.setProperty('--stages', String(Math.max(1, next.flow?.stages.length ?? 0)));
  board.classList.toggle('is-calm', needs === 0);
  const bodies = () => board.querySelectorAll<HTMLElement>('.col[aria-labelledby] > .col-body');
  const scrolls = new Map(
    [...bodies()].map((body) => [body.parentElement?.getAttribute('aria-labelledby'), body.scrollTop]),
  );
  board.replaceChildren(
    ...(boardView() === 'pipeline'
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
    ...notify(waiting.filter(isCard)),
    ...startNotices(next.columns),
    ...(coordinatorLine ? [coordinatorLine] : []),
  ];
  coordinatorLine = null;
  if (lines.length) announce(lines.join('. '));
  if (shell.details !== null) {
    if (byKey.has(shell.details)) drawPanelFor();
    else closeDetails(false);
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

const tick = () => {
  drawIntake();
  const now = Date.now();
  for (const node of document.querySelectorAll<HTMLElement>('[data-since]')) {
    const text = `${age(node.dataset.since as string, now, 'fine' in node.dataset)}${node.dataset.suffix ?? ''}`;
    if (node.textContent !== text) node.textContent = text;
  }
  for (const node of document.querySelectorAll<HTMLElement>('.start-line')) drawStartLine(node, now);
};

const isCalm = matchMedia('(prefers-reduced-motion: reduce)');
const layoutOf = (next: Board) =>
  JSON.stringify([
    boardView(),
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
type Launch = { step: string | null; phase: 'pending' | 'done' | 'failed'; at: number; isAnnounced: boolean };
const launches = new Map<IssueKey, Launch>();
const startFailures = new Map<IssueKey, string>();
const SLOW_START = 5000;
const SLOW_START_TEXT = 'The daemon still checks the start';

const drawStartLine = (node: HTMLElement, now: number) => {
  const number = parseKey(node.dataset.number ?? '');
  const entry = number === null ? undefined : launches.get(number);
  const isSlow = entry?.phase === 'pending' && now - entry.at >= SLOW_START;
  node.hidden = !isSlow;
  if (!entry || !isSlow) return;
  node.textContent = `${SLOW_START_TEXT} · ${age(new Date(entry.at).toISOString(), now, true)}`;
  if (!entry.isAnnounced) {
    entry.isAnnounced = true;
    announce(`#${number}: ${SLOW_START_TEXT}`);
  }
};

const startNote = (card: Card) => {
  const failure = card.sessionId === null && card.number !== null ? startFailures.get(card.number) : undefined;
  if (failure !== undefined) return el('p', 'start-failed', `Last start failed: ${failure}`);
  if (card.state !== 'starts' || card.number === null || launches.get(card.number)?.phase !== 'pending') return null;
  const node = el('p', 'start-line');
  node.dataset.number = String(card.number);
  drawStartLine(node, Date.now());
  return node;
};

const project = (board: Board): Board => {
  if (launches.size === 0) return board;
  const columns: Columns = { needs: [], running: [], idle: [], human: [] };
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

const render = (canMove = true) => {
  drawIntake();
  const next = project(data as Board);
  const cards = JSON.stringify([
    next.repo,
    next.noRun,
    next.agents,
    next.next,
    next.starts,
    next.flow,
    next.tracker,
    next.columns,
    next.history,
    next.source.error,
    next.queue,
    next.coordinator.state,
    next.daemon.auto,
    next.terminal.ok,
    next.trends,
    next.columns.human.map((card) => [card.sessionId, card.turn, isYourTurn(card, seenTurn)]),
    [...startFailures],
    [...asides.keys()],
    [...stops.keys()],
    [...refusals],
    [...launches].filter(([, entry]) => entry.phase === 'pending').map(([number, entry]) => [number, entry.step]),
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
  const { number } = card;
  if (isReconnecting() || number === null) return false;
  const current =
    data &&
    Object.values(project(data).columns)
      .flat()
      .find((other) => other.sessionId === null && other.number === number);
  if (!current?.[path === '/api/run' ? 'run' : path === '/api/assist' ? 'assist' : 'resume']) return false;
  if (startFailures.delete(number)) render(false);
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
  const entry: Launch = { step: current.step, phase: 'pending', at: Date.now(), isAnnounced: false };
  launches.set(number, entry);
  render(false);
  if (document.activeElement === document.body)
    document.querySelector<HTMLElement>(`[data-key="${CSS.escape(keyOf(card))}"]`)?.focus({ preventScroll: true });
  const failure = await send(
    path,
    {
      number,
      ...(path === '/api/run' && agent ? { agent } : {}),
      ...(path === '/api/run' && effort ? { effort } : {}),
    },
    path === '/api/run' ? 'Run failed' : path === '/api/assist' ? 'Open agent failed' : 'Resume failed',
  );
  entry.phase = failure === null ? 'done' : 'failed';
  if (failure !== null) startFailures.set(number, failure);
  settled = reads;
  render();
  load();
  return failure === null;
};

type ActText = { busy: string; failure: string; done: string; detail: string };
const asideText = (card: Card): ActText => ({
  busy: `Setting aside #${card.number}`,
  failure: 'Set aside failed',
  done: `Set #${card.number} aside`,
  detail: 'It shows in Idle. Run or Resume starts it again.',
});
const stopText = (card: Card): ActText => ({
  busy: `Stopping the ${card.step} session of #${card.number}`,
  failure: 'Stop failed',
  done: `Stopping the ${card.step} session of #${card.number}`,
  detail: 'The card moves to Idle when the session has ended.',
});

const pressAct = async (
  pressed: Pressed,
  card: Card,
  path: '/api/aside' | '/api/stop',
  value: unknown,
  text: ActText,
) => {
  const { number } = card;
  if (isReconnecting() || pressed.has(number)) return;
  pressed.set(number, 'pending');
  refusals.delete(number);
  announce(text.busy);
  render(false);
  const error = await send(path, value, text.failure);
  if (error === null) {
    pressed.set(number, 'done');
    toast(text.done, { detail: text.detail });
    announce(text.done);
    settled = reads;
    render(false);
    load();
    return;
  }
  pressed.delete(number);
  refusals.set(number, { sessionId: card.sessionId, state: card.state, line: error });
  announce(`${text.failure}. ${error}`);
  render(false);
};

const openStop = (card: Card) => {
  if (stops.has(card.number)) return;
  openStopDialog({
    title: `Stop the ${card.step} session of #${card.number}?`,
    stop: () => pressAct(stops, card, '/api/stop', { number: card.number, sessionId: card.sessionId }, stopText(card)),
    done: () =>
      document
        .querySelector<HTMLElement>(`.card[data-key="${CSS.escape(keyOf(card))}"]`)
        ?.focus({ preventScroll: true }),
  });
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
      for (const pressed of [asides, stops])
        for (const [number, phase] of pressed) if (phase === 'done') pressed.delete(number);
      for (const [number, refusal] of refusals)
        if (
          !Object.values(next.columns)
            .flat()
            .some(
              (card) => card.number === number && card.sessionId === refusal.sessionId && card.state === refusal.state,
            )
        )
          refusals.delete(number);
      for (const card of Object.values(next.columns).flat())
        if (card.sessionId !== null && card.number !== null) startFailures.delete(card.number);
      coordinatorLine = coordinator.update(next.coordinator);
      if (next.terminal.ok === true) {
        const running = new Set(next.columns.human.map((card) => card.sessionId));
        for (const name of store.keys(SEEN_TURN)) if (!running.has(name.slice(SEEN_TURN.length))) store.remove(name);
      }
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

const readEntry = (): MenuEntry => ({
  label: readAgain(),
  icon: 'refresh',
  key: 'r',
  run: () => $('refresh').click(),
});
const toggleHistory = () => setTab(shell.tab === 'history' ? 'agents' : 'history');
const toggleView = () => setTab(shell.tab === 'pipeline' ? 'agents' : 'pipeline');
const historyEntry = (): MenuEntry => ({
  label: shell.tab === 'history' ? 'Hide history' : 'Show history',
  icon: 'clock',
  key: 'd',
  run: toggleHistory,
});
const notifyEntry = (): MenuEntry => ({
  label: isNotifyOn ? 'Turn notifications off' : 'Turn notifications on',
  icon: isNotifyOn ? 'bell-off' : 'bell',
  key: '',
  run: toggleNotify,
});
const themeEntry = (): MenuEntry => ({
  label: `Theme: ${THEME_WORDS[theme]}`,
  icon: `theme-${theme}`,
  key: '',
  run: cycleTheme,
});
const keysEntry = (): MenuEntry => ({
  label: 'Show the keyboard shortcuts',
  icon: 'keyboard',
  key: '?',
  run: () => $('keys').showModal(),
});

const goEntries = (names: Area[]): MenuEntry[] =>
  names.map((area) => ({
    label: `Go to ${AREA_NAMES[area]}`,
    icon: AREA_ICONS[area],
    key: '',
    run: () => setArea(area),
  }));

const boardActions = (): MenuEntry[] => [
  ...goEntries([...AREAS]),
  ...(coordinator.hasSession()
    ? []
    : [{ label: 'Start the coordinator session', icon: 'message', key: '', run: coordinator.start }]),
  { label: 'Show the issue queue', icon: 'queue', key: '', run: () => setTab('queue') },
  readEntry(),
  historyEntry(),
  notifyEntry(),
  themeEntry(),
  keysEntry(),
];

const phoneMenu = (): MenuEntry[] =>
  (['throughput'] as const).map((area) => ({
    label: AREA_NAMES[area],
    icon: AREA_ICONS[area],
    key: '',
    run: () => setArea(area),
  }));

const unnamed = (name: string, number: IssueKey | null) => {
  if (number === null) return name;
  let label = name;
  for (const tail of [`, #${number}`, ` of #${number}`]) if (label.endsWith(tail)) label = label.slice(0, -tail.length);
  const lead = `Open issue #${number}`;
  return label.startsWith(lead) ? `Open issue${label.slice(lead.length)}` : label;
};

const paletteItems = () => {
  if (!data) return [];
  const items: PaletteItem[] = [];
  const add = (group: string, card: Card, _key: string, action: Action) =>
    items.push({
      group,
      number: card.number,
      label: unnamed(action.name, card.number),
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
            if (!document.querySelector(`[data-key="${CSS.escape(key)}"]`)) setTab('agents');
            openDetails(key);
            const node = document.querySelector<HTMLElement>(`#tp-board [data-key="${CSS.escape(key)}"]`);
            if (node?.checkVisibility()) node.focus();
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
          run: () => openDetails(key),
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
  const epics = new Map<IssueKey, string>();
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
        setTab(shell.tab === 'pipeline' && row() ? 'pipeline' : 'agents');
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
      label: shell.tab === 'pipeline' ? 'Show the agents' : 'Show the pipeline',
      context: '',
      icon: shell.tab === 'pipeline' ? 'board' : 'stages',
      key: 'v',
      run: toggleView,
    },
    ...boardActions().map((action) => ({ group: 'Board', number: null, context: '', ...action })),
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
  const button = $('notify');
  if (button.getAttribute('aria-busy') === 'true') return;
  if (!('Notification' in window)) return toast('This browser has no notifications', { isError: true });
  if (!isNotifyOn && Notification.permission === 'default') {
    button.setAttribute('aria-busy', 'true');
    try {
      await Notification.requestPermission();
    } finally {
      button.removeAttribute('aria-busy');
    }
  }
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

const drawKeys = () => {
  $('keys-on').checked = isKeysOn;
  $('keys-switch').setAttribute('aria-pressed', String(isKeysOn));
  $('keys-switch').textContent = isKeysOn ? 'On' : 'Off';
};
const setKeys = (isOn: boolean): void => {
  isKeysOn = isOn;
  store.set('keys', isOn ? 'on' : 'off');
  drawKeys();
};

const KEYS: Record<string, () => void> = {
  j: () => move(0, 1),
  k: () => move(0, -1),
  h: () => move(-1, 0),
  l: () => move(1, 0),
  r: () => $('refresh').click(),
  d: toggleHistory,
  v: toggleView,
  '?': () => $('keys').showModal(),
  '/': () => openPalette(paletteItems()),
};
const CARD_KEYS: Record<string, (card: HTMLElement) => void> = {
  ArrowDown: () => move(0, 1),
  ArrowUp: () => move(0, -1),
  ArrowLeft: () => move(-1, 0),
  ArrowRight: () => move(1, 0),
  Enter: (card: HTMLElement) => card.querySelector<HTMLElement>('.main-action')?.click(),
  ' ': (card: HTMLElement) => openDetails(card.dataset.key as string),
  o: (card: HTMLElement) => card.dataset.url && window.open(card.dataset.url, '_blank', 'noopener,noreferrer'),
  c: (card: HTMLElement) => {
    const entry = byKey.get(card.dataset.key as string);
    if (entry && copyWhat(entry.card)) copy(entry.card.act as string, copyWhat(entry.card) as string);
  },
  s: (card: HTMLElement) => card.querySelector<HTMLElement>('.aside-chip')?.click(),
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
  reveal: showChat,
  changed: (next) => {
    if (!data) return;
    data = { ...data, coordinator: next };
    render();
  },
  notify: (title, open) => systemNotice(title, '', 'coordinator', open),
});
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || updates.contains(event.target)) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (!$('palette').open) openPalette(paletteItems());
    return;
  }
  if ($('agent-picker').contains(event.target as Node)) return;
  if (event.metaKey || event.ctrlKey || event.altKey || $('keys').open || $('palette').open || dialogOpen()) return;
  if ((event.target as Element).closest?.<HTMLElement>('input, textarea, select, [contenteditable]')) return;
  if (event.key === 'Escape' && $('menu').matches(':popover-open')) return;
  if (event.key === 'Escape' && updates.dismiss()) {
    event.preventDefault();
    return;
  }
  if (event.key === 'Escape' && shell.details !== null) {
    event.preventDefault();
    return closeDetails(true);
  }
  const isBoardShown =
    shell.area === 'operations' &&
    (shell.tab === 'agents' || shell.tab === 'pipeline') &&
    !(phone.matches && shell.pane === 'chat');
  if (!isBoardShown && !['r', 'd', 'v', '?', '/'].includes(event.key)) return;
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
  if (shell.details === node.dataset.key) return closeDetails(true);
  openDetails(node.dataset.key as string);
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
$('tp-board').addEventListener('scroll', updateTail, true);
addEventListener('resize', updateTail);
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (theme !== 'system') return;
  applyTheme('system');
  drawFavicon();
});
addEventListener('storage', (event) => {
  if (event.key === null || event.key === THEME_KEY) {
    theme = readTheme();
    applyTheme(theme);
    drawTheme();
    drawFavicon();
  }
  if (data && (event.key === null || event.key.startsWith(store.key(SEEN_TURN)))) render(false);
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
  const isOk = await act('/api/refresh', {}, 'Refresh failed');
  $('refresh').removeAttribute('aria-busy');
  if (!isOk) return;
  refreshedUntil = Date.now() + 2000;
  $('refresh').classList.add('is-done');
  $('refresh').title = refreshTitle();
  announce(data?.tracker ? `${(data as Board).tracker} read again` : 'Issues read again');
  clearTimeout(refreshDone);
  refreshDone = setTimeout(() => {
    $('refresh').classList.remove('is-done');
    $('refresh').title = refreshTitle();
  }, 2000);
});
$('find').prepend(icon('search'));
($('find').querySelector<HTMLElement>('kbd') as HTMLElement).textContent = FIND_KEY;
$('find').addEventListener('click', () => openPalette(paletteItems()));
for (const area of AREAS) {
  const button = document.querySelector<HTMLElement>(`.dest[data-area="${area}"]`) as HTMLElement;
  button.prepend(icon(AREA_ICONS[area]));
  button.addEventListener('click', () => {
    setArea(area);
    if (area === 'operations' && !$('ops-badge').hidden) focusNeed();
  });
}
$('pb-home').prepend(icon('home'));
$('pb-home').addEventListener('click', () => setArea('home'));
$('pb-chat').addEventListener('click', showChat);
$('pb-agents').prepend(icon('board'));
$('pb-agents').addEventListener('click', () => setPane('agents'));
$('pb-control').prepend(icon('sliders'));
$('pb-control').addEventListener('click', () => setArea('control'));
$('pane-chat').addEventListener('click', coordinator.open);
const tabList = TABS.map((tab) => $(`tab-${tab}`));
for (const [at, tab] of TABS.entries()) tabList[at]?.addEventListener('click', () => setTab(tab));
$('tabs').addEventListener('keydown', (event) => {
  const at = tabList.indexOf(event.target as HTMLElement);
  const moves: Record<string, number> = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: tabList.length - 1 };
  const to = moves[event.key];
  if (at < 0 || to === undefined) return;
  const index = (to + TABS.length) % TABS.length;
  const tab = TABS[index];
  const next = tabList[index];
  if (!tab || !next) return;
  event.preventDefault();
  setTab(tab);
  next.focus();
});
$('intake').prepend(icon('spark'));
$('intake').addEventListener('click', () => void openIntake());
drawIntake();
$('notify').addEventListener('click', toggleNotify);
$('theme').addEventListener('click', cycleTheme);
drawTheme();
$('board-more').prepend(icon('dots'));
$('board-more').addEventListener('click', () =>
  openMenu($('board-more'), phoneMenu(), {
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
drawKeys();
$('keys-on').addEventListener('change', () => setKeys($('keys-on').checked));
$('keys-switch').addEventListener('click', () => setKeys(!isKeysOn));
$('toast-close').append(icon('close'));
setupToast();
setupQueue({
  refresh: async () => {
    settled = reads;
    await load();
  },
});
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
const retryWait = async (number: IssueKey, waitId: string) => {
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
drawShell();
drawStatus(source, false);
load();
