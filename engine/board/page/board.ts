import { QueryObserver, type QueryObserverResult } from '@tanstack/react-query';
import type { AgentOrder, Host } from '../../lib/config/core.ts';
import type { IssueKey } from '../../lib/tracker/key.ts';
import type {
  Action,
  AgentReplaceConflict,
  AgentReplaceRequest,
  Board,
  Card,
  Column,
  Columns,
  MenuEntry,
  PaletteItem,
  RunRequest,
} from '../types.ts';
import { favicon, isCard, isYourTurn, keyOf, needsYou, notice, pageTitle, runTitle, tone, turnLine } from '../view.ts';
import { createAgentPicker, OrderConflict } from './agent-picker.ts';
import { coordinator } from './coordinator/coordinator.ts';
import { actionsOf, agentDisplay, defaultReason, launch, onTracker } from './operations/actions.ts';
import { handleKey, showHints, toggleHistory, toggleView } from './operations/keys.ts';
import {
  closeDetails,
  focusNeed,
  openDetails,
  screen,
  setArea,
  setPane,
  setTab,
  showChat,
} from './operations/state.ts';
import { closeMenu, openMenu, openPalette, setupMenu, setupPalette } from './palette.ts';
import { boardKey, pollOptions, queryClient } from './query.ts';
import { drawQueue, setQueueOpen, setupQueue } from './queue.ts';
import { AREA_ICONS, AREA_NAMES, AREAS, type Area, type Shell } from './shell.ts';
import { shellStore } from './store.ts';
import { THEME_WORDS } from './theme/choice.ts';
import { $, announce, icon, openUrl, post, SERVER_DOWN, setupToast, toast } from './ui.ts';
import { isReconnecting, setupUpdates } from './update-dialog.ts';

const shell = (): Shell => shellStore.get().shell;
const settings = () => shellStore.get().settings;
const isServerDown = () => queryClient.getQueryState(boardKey)?.status === 'error';
let intakePending = false;
let needsKeys: Set<string> | null = null;
let starting: Map<IssueKey, string | null> | null = null;
let startupWarnings = new Map<IssueKey, string>();
let coordinatorLine: string | null = null;
const { seenTurn, setEpicOpen } = screen;

const readAgainText = () =>
  screen.read()?.tracker ? `Read ${(screen.read() as Board).tracker} again` : 'Read the issues again';

const intakeReason = () => {
  if (isReconnecting()) return 'The board is reconnecting';
  if (intakePending) return 'An intake tab is opening';
  const data = screen.read();
  const readAt = Date.parse(data?.source.readAt ?? '');
  if (!data || isServerDown() || data.source.error || !Number.isFinite(readAt) || Date.now() - readAt > 60_000)
    return null;
  return defaultReason();
};

function drawIntake(): void {
  shellStore.setInputs({ intake: { reason: intakeReason(), pending: intakePending } });
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

const agentOrder = () => {
  setArea('control');
  if (!picker.focus()) $('ctl-agents').focus();
};
const agentOrderEntry = {
  icon: 'person',
  label: 'Change the agent order',
  key: '',
  title: 'Open the agent order on Control',
  run: () => agentOrder(),
};

const faviconColors = () => {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return { tile: token('--card'), bar: token('--fg'), needs: token('--needs'), works: token('--working') };
};

const drawFavicon = () => {
  const board = screen.board();
  if (board) $('favicon').href = favicon(tone(board, seenTurn), faviconColors());
};

const systemNotice = (title: string, body: string, tag: string, open: () => void) => {
  const isAway = document.hidden || !document.hasFocus();
  if (!settings().notify || !isAway || !('Notification' in window) || Notification.permission !== 'granted') return;
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
      if (shell().tab === 'pipeline') setTab('agents');
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

const drawStatus = (isDown: boolean) => {
  const data = screen.read();
  if (data?.picker) picker.update(data.picker, data.registry);
  document.body.toggleAttribute('data-stale', isDown);
  coordinator.down(isDown);
};

const drawNow = (all: number, work: number, home: number): void => {
  shellStore.setInputs({ badges: { home, operations: all, agents: work } });
};

const drawRead = (next: Board) => {
  drawQueue(next);
  const waiting = needsYou(next, seenTurn);
  document.title = pageTitle(next.repo, waiting.length);
  drawFavicon();
  drawNow(waiting.length, waiting.filter(isCard).length, next.columns.needs.length);
  shellStore.setInputs({ board: next });
  const lines = [
    ...notify(waiting.filter(isCard)),
    ...startNotices(next.columns),
    ...(coordinatorLine ? [coordinatorLine] : []),
  ];
  coordinatorLine = null;
  if (lines.length) announce(lines.join('. '));
  const { details } = shell();
  if (details !== null && !screen.index().byKey.has(details)) closeDetails(false);
  showHints(
    (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>('#columns .card[data-key]')?.dataset.key ??
      null,
  );
};
const tick = () => {
  drawIntake();
};

let last = '';
const render = () => {
  drawIntake();
  const next = screen.board() as Board;
  const cards = JSON.stringify([
    next.repo,
    next.noRun,
    next.agents,
    next.next,
    next.starts,
    next.flow,
    next.tracker,
    next.grammar,
    next.columns,
    next.history,
    next.source.error,
    next.queue,
    next.coordinator.state,
    next.daemon.auto,
    next.terminal.ok,
    next.trends,
    next.columns.human.map((card) => [card.sessionId, card.turn, isYourTurn(card, seenTurn)]),
    [...screen.startFailures()],
    [...screen.asides().keys()],
    [...screen.stops().keys()],
    [...screen.refusals()],
    [...screen.launches()]
      .filter(([, entry]) => entry.phase === 'pending')
      .map(([number, entry]) => [number, entry.step]),
  ]);
  if (cards === last) {
    drawQueue(next);
    return;
  }
  drawRead(next);
  last = cards;
};

const observer = new QueryObserver(queryClient, pollOptions);
const waiters: (() => void)[] = [];
const settle = () => {
  for (const resolve of waiters.splice(0)) resolve();
};
const readAgain = (): Promise<void> => {
  if (isReconnecting()) return Promise.resolve();
  const next = new Promise<void>((resolve) => waiters.push(resolve));
  // invalidateQueries keeps a read in flight when the query has no data yet.
  void queryClient
    .cancelQueries({ queryKey: boardKey })
    .then(() => queryClient.invalidateQueries({ queryKey: boardKey }));
  return next;
};
document.addEventListener('board-reconnect', () => {
  drawIntake();
  observer.setOptions({ ...pollOptions, enabled: false });
  void queryClient.cancelQueries({ queryKey: boardKey });
  settle();
  screen.fail();
  const board = screen.board();
  if (board) drawQueue(board);
});
document.addEventListener('board-connected', () => {
  drawIntake();
  observer.setOptions({ ...pollOptions, enabled: true });
});

const accept = (next: Board) => {
  coordinatorLine = coordinator.update(next.coordinator);
  screen.accept({ ...next, coordinator: coordinator.view() });
  render();
  drawStatus(false);
};
const fail = () => {
  if (isReconnecting()) return;
  screen.fail();
  drawStatus(true);
  const board = screen.board();
  if (board) drawQueue(board);
};
let dataAt = 0;
let errorAt = 0;
const onRead = ({ data: next, dataUpdatedAt, errorUpdatedAt }: QueryObserverResult<Board>) => {
  const isNew = dataUpdatedAt !== dataAt && next !== undefined;
  const isFailed = errorUpdatedAt !== errorAt;
  if (!isNew && !isFailed) return;
  dataAt = dataUpdatedAt;
  errorAt = errorUpdatedAt;
  try {
    if (isNew) accept(next);
    else fail();
    tick();
  } finally {
    settle();
  }
};

const readEntry = (): MenuEntry => ({
  label: readAgainText(),
  icon: 'refresh',
  key: 'r',
  run: () => void shellStore.refresh(),
});
const historyEntry = (): MenuEntry => ({
  label: shell().tab === 'history' ? 'Hide history' : 'Show history',
  icon: 'clock',
  key: 'd',
  run: toggleHistory,
});
const notifyEntry = (): MenuEntry => ({
  label: settings().notify ? 'Turn notifications off' : 'Turn notifications on',
  icon: settings().notify ? 'bell-off' : 'bell',
  key: '',
  run: () => void shellStore.toggleNotify(),
});
const themeEntry = (): MenuEntry => ({
  label: `Theme: ${THEME_WORDS[settings().theme]}`,
  icon: `theme-${settings().theme}`,
  key: '',
  run: () => shellStore.cycleTheme(),
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
  const data = screen.read();
  const shown = screen.board();
  if (!data || !shown) return [];
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
      run: action.href ? () => openUrl(action.href) : (action.run as () => unknown),
    });
  const goTo: PaletteItem[] = [];
  for (const [column, group] of [
    ['needs', 'Needs you'],
    ['running', 'Running'],
    ['idle', 'Run the next step'],
    ['human', 'Human sessions'],
  ] as [Column, string][]) {
    for (const card of shown.columns[column]) {
      const key = screen.index().keyOf.get(card) ?? keyOf(card);
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
            if (!document.querySelector(`#tp-board [data-key="${CSS.escape(key)}"]`)) setTab('agents');
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
        const row = () => document.querySelector<HTMLElement>(`#tp-board .epic-row[data-epic="${number}"]`);
        setTab(shell().tab === 'pipeline' && row() ? 'pipeline' : 'agents');
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
        run: () => openUrl(card.url),
      });
  items.push(
    { group: 'Board', number: null, context: '', ...agentOrderEntry },
    {
      group: 'Board',
      number: null,
      label: shell().tab === 'pipeline' ? 'Show the agents' : 'Show the pipeline',
      context: '',
      icon: shell().tab === 'pipeline' ? 'board' : 'stages',
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
        screen.setEpicsOpen((open) => {
          for (const card of shown.columns.idle) if (card.epic) open.add(card.epic.number);
        });
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
        screen.setEpicsOpen((open) => open.clear());
      },
    },
  );
  return [...goTo, ...items];
};

let drawnSettings = settings();
shellStore.subscribe(() => {
  if (settings() === drawnSettings) return;
  drawnSettings = settings();
  $('keys-on').checked = settings().keys;
  drawFavicon();
});

const KEYS: Record<string, () => void> = {
  r: () => void shellStore.refresh(),
  '?': () => $('keys').showModal(),
  '/': () => openPalette(paletteItems()),
};
const updates = setupUpdates();
coordinator.handle({
  reveal: showChat,
  changed: (next) => {
    if (!screen.read()) return;
    screen.setCoordinator(next);
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
  if (
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    $('keys').open ||
    $('palette').open ||
    screen.get().stopFor !== null
  )
    return;
  if ((event.target as Element).closest?.<HTMLElement>('input, textarea, select, [contenteditable]')) return;
  if (event.key === 'Escape' && $('menu').matches(':popover-open')) return;
  if (event.key === 'Escape' && updates.dismiss()) {
    event.preventDefault();
    return;
  }
  if (handleKey(event)) return;
  const press = settings().keys && KEYS[event.key];
  if (!press) return;
  event.preventDefault();
  press();
});

let drawnShell = shellStore.get();
const followShell = () => {
  drawnShell = shellStore.get();
  const { area, tab } = shell();
  setQueueOpen(tab === 'queue');
  if (area !== 'control') {
    updates.dismiss();
    if ($('agent-picker').querySelector('.ap-handle[aria-expanded="true"]')) closeMenu();
  }
};
shellStore.subscribe(() => {
  const next = shellStore.get();
  if (next.shell !== drawnShell.shell || next.isPhone !== drawnShell.isPhone) followShell();
});

let drawnTurns = screen.get().turns;
screen.subscribe(() => {
  const was = drawnTurns;
  drawnTurns = screen.get().turns;
  if (drawnTurns !== was && screen.get().read) render();
});
addEventListener('blur', () => screen.markAllSeen());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) screen.markAllSeen();
  else void readAgain();
});

$('find').addEventListener('click', () => openPalette(paletteItems()));
shellStore.handle({
  go: (area) => {
    setArea(area);
    if (area === 'operations' && shellStore.get().inputs.badges.operations > 0) focusNeed();
  },
  showChat,
  agents: () => setPane('agents'),
  intake: () => void openIntake(),
  agentOrder,
  readAgain,
  isReconnecting,
  open: openDetails,
});
screen.handle({ openChat: coordinator.open, render });
drawIntake();
$('board-more').addEventListener('click', () =>
  openMenu($('board-more'), phoneMenu(), {
    label: 'Board actions',
  }),
);
$('keys-close').append(icon('close'));
$('keys-close').addEventListener('click', () => $('keys').close());
$('keys').addEventListener('click', (event) => {
  if (event.target === $('keys')) $('keys').close();
});
$('keys-on').checked = settings().keys;
$('keys-on').addEventListener('change', () => shellStore.setKeys($('keys-on').checked));
$('toast-close').append(icon('close'));
setupToast();
setupQueue({
  refresh: readAgain,
});
const replaceOrder = async (order: readonly Host[], expectedVersion: string): Promise<AgentOrder> => {
  if (isReconnecting()) throw new Error('the board is reconnecting');
  void readAgain();
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
    void readAgain();
  }
};
const retryWait = async (number: IssueKey, waitId: string) => {
  const outcome = await post('/api/run', { number, waitId } satisfies RunRequest, 'Retry failed', { timeout: 150_000 });
  void readAgain();
  if (outcome.status !== 'accepted') throw new Error(outcome.error ?? SERVER_DOWN);
};
const picker = createAgentPicker($('agent-picker'), { replace: replaceOrder, retry: retryWait });
setupPalette();
setupMenu();
showHints(null);
setInterval(tick, 1000);
followShell();
drawStatus(false);
observer.subscribe(onRead);
