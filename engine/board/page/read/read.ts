import { QueryObserver, type QueryObserverResult } from '@tanstack/react-query';
import type { IssueKey } from '../../../lib/tracker/key.ts';
import type { Board, Card, Columns } from '../../types.ts';
import { favicon, isCard, isYourTurn, keyOf, needsYou, notice, pageTitle, tone, turnLine } from '../../view.ts';
import { agentStore } from '../agents/state.ts';
import { coordinator } from '../coordinator/coordinator.ts';
import { drawIntake, openIntake } from '../intake/intake.ts';
import { showHints } from '../operations/keys.ts';
import {
  closeDetails,
  focusNeed,
  openDetails,
  screen,
  setArea,
  setPane,
  setTab,
  showChat,
} from '../operations/state.ts';
import { agentOrder } from '../palette/items.ts';
import { boardKey, pollOptions, queryClient } from '../query.ts';
import { queueStore } from '../queue/state.ts';
import type { Shell } from '../shell.ts';
import { shellStore } from '../store.ts';
import { announce } from '../ui.ts';
import { isReconnecting, updateStore } from '../update/state.ts';

const shell = (): Shell => shellStore.get().shell;
const settings = () => shellStore.get().settings;
let needsKeys: Set<string> | null = null;
let starting: Map<IssueKey, string | null> | null = null;
let startupWarnings = new Map<IssueKey, string>();
let coordinatorLine: string | null = null;
const { seenTurn } = screen;

const faviconColors = () => {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return { tile: token('--card'), bar: token('--fg'), needs: token('--needs'), works: token('--working') };
};

const drawFavicon = () => {
  const board = screen.board();
  if (board)
    (document.getElementById('favicon') as HTMLLinkElement).href = favicon(tone(board, seenTurn), faviconColors());
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
  const cards = [...columns.needs, ...columns.waiting, ...columns.running, ...columns.idle];
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
  if (data?.picker) agentStore.update(data.picker, data.registry);
  document.body.toggleAttribute('data-stale', isDown);
  coordinator.down(isDown);
};

const drawNow = (all: number, work: number, home: number): void => {
  shellStore.setInputs({ badges: { home, operations: all, agents: work } });
};

const drawRead = (next: Board) => {
  queueStore.update(next);
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
    queueStore.update(next);
    return;
  }
  drawRead(next);
  last = cards;
};

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
  if (board) queueStore.update(board);
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

export function startRead(): void {
  const observer = new QueryObserver(queryClient, pollOptions);

  const reconnect = () => {
    drawIntake();
    observer.setOptions({ ...pollOptions, enabled: false });
    void queryClient.cancelQueries({ queryKey: boardKey });
    settle();
    screen.fail();
    const board = screen.board();
    if (board) queueStore.update(board);
  };
  const connected = () => {
    drawIntake();
    observer.setOptions({ ...pollOptions, enabled: true });
  };

  updateStore.handle({ reconnect, connected });
  updateStore.start();

  let drawnSettings = settings();
  shellStore.subscribe(() => {
    if (settings() === drawnSettings) return;
    drawnSettings = settings();
    drawFavicon();
  });

  coordinator.handle({
    reveal: showChat,
    changed: (next) => {
      if (!screen.read()) return;
      screen.setCoordinator(next);
      render();
    },
    notify: (title, open) => systemNotice(title, '', 'coordinator', open),
  });

  let drawnShell = shellStore.get();
  const followShell = () => {
    drawnShell = shellStore.get();
    const { area } = shell();
    if (area !== 'control') {
      updateStore.dismiss();
      agentStore.closeMenu();
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
  showHints(null);
  setInterval(tick, 1000);
  followShell();
  drawStatus(false);
  observer.subscribe(onRead);
}
