import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { grammar, useGrammar } from '../../../lib/tracker/grammar.ts';
import { compareKeys, type IssueKey } from '../../../lib/tracker/key.ts';
import type { Action, Board, Card, CoordinatorView } from '../../types.ts';
import { isYourTurn, keyOf, needsYou, parseOpenEpics, parseSeenTurn, pipeline, signature } from '../../view.ts';
import type { Area, Pane, Shell, Tab } from '../shell.ts';
import { phone, shellStore } from '../store.ts';
import { announce, store } from '../ui.ts';
import { type CardIndex, indexCards, type Launch, project, SLOW_START_TEXT, type View } from './cards.ts';

type Pressed = ReadonlyMap<IssueKey | null, 'pending' | 'done'>;
type Refusal = Readonly<{ sessionId: string | null; state: string | null; line: string }>;
export type ScreenState = Readonly<{
  read: Board | null;
  seen: ReadonlyMap<string, string> | null;
  turns: number;
  openEpics: ReadonlySet<IssueKey>;
  launches: ReadonlyMap<IssueKey, Launch>;
  startFailures: ReadonlyMap<IssueKey, string>;
  asides: Pressed;
  stops: Pressed;
  stopFor: Readonly<{ card: Card; key: string }> | null;
  refusals: ReadonlyMap<IssueKey | null, Refusal>;
  visualPresses: ReadonlySet<IssueKey>;
  pressing: ReadonlySet<string>;
  menu: Readonly<{ key: string; kind: MenuKind; isCompact: boolean }> | null;
  columnStops: ReadonlyMap<string, string>;
  now: number;
}>;
export type MenuKind = 'actions' | 'run';

export type ScreenHandlers = {
  openChat(): void;
  render(): void;
};

const listeners = new Set<() => void>();
let handlers: ScreenHandlers = { openChat: () => {}, render: () => {} };
let state: ScreenState = {
  read: null,
  seen: null,
  turns: 0,
  openEpics: parseOpenEpics(store.get('open-epics') ?? ''),
  launches: new Map(),
  startFailures: new Map(),
  asides: new Map(),
  stops: new Map(),
  stopFor: null,
  refusals: new Map(),
  visualPresses: new Set(),
  pressing: new Set(),
  menu: null,
  columnStops: new Map(),
  now: Date.now(),
};

const emit = (next: ScreenState, isSync = true) => {
  state = next;
  const notify = () => {
    for (const listener of listeners) listener();
  };
  if (isSync) flushSync(notify);
  else notify();
};
export type Cause = 'read' | 'quiet' | null;
let cause: Cause = null;
const emitFor = (reason: Cause, next: ScreenState, isSync = true) => {
  const was = cause;
  cause = reason;
  try {
    emit(next, isSync);
  } finally {
    cause = was;
  }
};
const edited = <T>(value: T, change: (value: T) => void): T => {
  change(value);
  return value;
};

export const view = (): View => (shellStore.get().shell.tab === 'pipeline' ? 'pipeline' : 'now');
let projected: { read: Board; launches: ScreenState['launches']; board: Board } | null = null;
const board = (): Board | null => {
  const { read, launches } = state;
  if (read === null) return null;
  if (projected === null || projected.read !== read || projected.launches !== launches)
    projected = { read, launches, board: project(read, launches) };
  return projected.board;
};
const NO_CARDS: CardIndex = { byKey: new Map(), keyOf: new Map() };
let indexed: { board: Board | null; view: View; index: CardIndex } | null = null;
const index = (): CardIndex => {
  const shown = board();
  const at = view();
  if (indexed === null || indexed.board !== shown || indexed.view !== at)
    indexed = { board: shown, view: at, index: shown ? indexCards(shown, at) : NO_CARDS };
  return indexed.index;
};

const SEEN_TURN = 'seen-turn:';
const seenTurn = (terminal: string) => parseSeenTurn(store.get(`${SEEN_TURN}${terminal}`));
const seeTurn = (card: Card) => {
  if (card.sessionId === null || card.waitFor !== 'turn' || typeof card.turn !== 'number') return;
  const name = `${SEEN_TURN}${card.sessionId}`;
  if (store.get(name) === String(card.turn)) return;
  store.set(name, String(card.turn));
  emit({ ...state, turns: state.turns + 1 });
};

const setEpicsOpen = (change: (open: Set<IssueKey>) => void) => {
  const stored = store.get('open-epics');
  const next = new Set(stored === null ? state.openEpics : parseOpenEpics(stored));
  change(next);
  store.set('open-epics', JSON.stringify([...next].sort(compareKeys)));
  emit({ ...state, openEpics: next });
};

const markSeen = (key: string) => {
  const entry = index().byKey.get(key);
  if (!entry || state.seen === null) return;
  emitFor('quiet', { ...state, seen: new Map(state.seen).set(key, signature(entry.card, entry.column)) });
};

const markAllSeen = () => {
  if (state.seen === null) return;
  const seen = new Map(state.seen);
  for (const [key, { card, column }] of index().byKey) seen.set(key, signature(card, column));
  emitFor('quiet', { ...state, seen });
};

const isUnseen = (key: string) => {
  const entry = index().byKey.get(key);
  return entry !== undefined && state.seen !== null && state.seen.get(key) !== signature(entry.card, entry.column);
};

const accept = (next: Board) => {
  let { openEpics } = state;
  if (next.grammar !== grammar().kind) {
    useGrammar(next.grammar);
    openEpics = parseOpenEpics(store.get('open-epics') ?? '');
  }
  const launches = new Map(state.launches);
  const asides = new Map(state.asides);
  const stops = new Map(state.stops);
  const refusals = new Map(state.refusals);
  const startFailures = new Map(state.startFailures);
  for (const [number, launch] of launches) if (launch.phase !== 'pending') launches.delete(number);
  for (const pressed of [asides, stops])
    for (const [number, phase] of pressed) if (phase === 'done') pressed.delete(number);
  for (const [number, refusal] of refusals)
    if (
      !Object.values(next.columns)
        .flat()
        .some((card) => card.number === number && card.sessionId === refusal.sessionId && card.state === refusal.state)
    )
      refusals.delete(number);
  for (const card of Object.values(next.columns).flat())
    if (card.sessionId !== null && card.number !== null) startFailures.delete(card.number);
  if (next.terminal.ok === true) {
    const running = new Set(next.columns.human.map((card) => card.sessionId));
    for (const name of store.keys(SEEN_TURN)) if (!running.has(name.slice(SEEN_TURN.length))) store.remove(name);
  }
  const isFirst = state.seen === null;
  emitFor('read', {
    ...state,
    read: next,
    openEpics,
    launches,
    asides,
    stops,
    refusals,
    startFailures,
    seen: state.seen ?? new Map(),
  });
  if (isFirst) markAllSeen();
  if (state.menu !== null && !index().byKey.has(state.menu.key)) emitFor('quiet', { ...state, menu: null });
};

export const pressId = (card: Card, action: Action) => `${keyOf(card)} ${action.id}`;
const press = async (card: Card, action: Action) => {
  const id = pressId(card, action);
  if (state.pressing.has(id)) return;
  emitFor('quiet', { ...state, pressing: new Set(state.pressing).add(id) });
  try {
    await action.run?.();
  } finally {
    const pressing = new Set(state.pressing);
    pressing.delete(id);
    emitFor('quiet', { ...state, pressing });
  }
};

const announced = new WeakSet<Launch>();
const announceStart = (number: IssueKey) => {
  const launch = state.launches.get(number);
  if (!launch || announced.has(launch)) return;
  announced.add(launch);
  announce(`#${number}: ${SLOW_START_TEXT}`);
};

const fail = () => {
  if (state.read) emit({ ...state, read: { ...state.read, queue: null } });
};

const shell = (): Shell => shellStore.get().shell;

const PANEL_FOCUS = '[data-slot="button"]';

let hiddenFocus: Element | null = null;
document.addEventListener('focusout', (event) => {
  hiddenFocus = event.target instanceof HTMLElement && !event.target.checkVisibility() ? event.target : null;
});
phone.addEventListener('change', () =>
  setShell(shell(), document.activeElement === document.body ? hiddenFocus : document.activeElement),
);

export const areaStop = () => {
  const tabNode = document.getElementById(`tab-${shell().tab}`) as HTMLElement;
  return shell().area === 'operations' && tabNode.checkVisibility()
    ? tabNode
    : (document.getElementById('work') as HTMLElement);
};

export const setShell = (next: Shell, active: Element | null = document.activeElement) => {
  const wasInPanel =
    active instanceof HTMLElement && (document.getElementById('panel') as HTMLElement).contains(active);
  const wasInBoard = active instanceof HTMLElement && Boolean(document.getElementById('tp-board')?.contains(active));
  const leavesQueue =
    next.tab !== 'queue' &&
    active instanceof HTMLElement &&
    Boolean(document.getElementById('queue')?.contains(active));
  const activeId = active?.id;
  shellStore.setShell(next);
  const now = document.activeElement;
  const isHidden = wasInPanel || (wasInBoard && document.getElementById('tp-board') === null);
  const isLost =
    active instanceof HTMLElement && (leavesQueue || (active.isConnected ? !active.checkVisibility() : isHidden));
  if (isLost && (now === active || now === document.body)) {
    areaStop().focus({ preventScroll: true });
  } else if (now === document.body && active instanceof HTMLElement && active.isConnected)
    active.focus({ preventScroll: true });
  else if (now === document.body && activeId) {
    const twin = document.getElementById(activeId);
    if (twin?.checkVisibility()) twin.focus({ preventScroll: true });
  }
};

export const setArea = (area: Area) => setShell({ ...shell(), area });
export const setTab = (tab: Tab) =>
  setShell({
    ...shell(),
    area: 'operations',
    tab,
    ...(phone.matches ? { pane: 'agents' as const, details: null } : {}),
  });
export const setPane = (pane: Pane) => setShell({ ...shell(), area: 'operations', pane, details: null });
export const showChat = () =>
  setShell({
    ...shell(),
    area: 'operations',
    details: null,
    pane: 'chat',
    tab: shell().tab === 'pipeline' ? 'agents' : shell().tab,
  });

export const openDetails = (key: string) => {
  if (!screen.index().byKey.has(key)) return;
  revealCard(key);
  markSeen(key);
  setShell({ ...shell(), area: 'operations', details: key, pane: 'chat' });
  const selected = document.querySelector<HTMLElement>(`#tp-board [data-key="${CSS.escape(key)}"]`);
  if (shell().tab === 'pipeline') selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const entry = screen.index().byKey.get(key);
  if (entry?.column === 'human') seeTurn(entry.card);
  (document.getElementById('panel') as HTMLElement)
    .querySelector<HTMLElement>(PANEL_FOCUS)
    ?.focus({ preventScroll: true });
};

const revealCard = (key: string) => {
  const shown = board();
  const entry = index().byKey.get(key);
  if (!shown || entry?.column !== 'idle' || !entry.card.epic || state.openEpics.has(entry.card.epic.number)) return;
  const { columns, flow } = shown;
  if (
    view() === 'pipeline' &&
    pipeline([...columns.needs, ...columns.running, ...columns.idle], flow).hold.includes(entry.card)
  )
    return;
  screen.setEpicOpen(entry.card.epic.number, true);
};

export function closeDetails(refocus: boolean) {
  const key = shell().details;
  const isBack = refocus && key !== null;
  setShell({
    ...shell(),
    details: null,
    ...(isBack && (shell().tab === 'queue' || shell().tab === 'history') ? { tab: 'agents' as const } : {}),
    ...(isBack && phone.matches ? { pane: 'agents' as const } : {}),
  });
  if (isBack) {
    revealCard(key);
    document.querySelector<HTMLElement>(`#tp-board [data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }
}

export const focusNeed = (): void => {
  const shown = board();
  if (!shown) return;
  if (needsYou(shown, seenTurn).length === 0) return;
  if (shown.coordinator.state === 'dialog') {
    showChat();
    handlers.openChat();
    return;
  }
  setTab('agents');
  const { human } = shown.columns;
  const session = human.find((card) => card.waitFor === 'dialog') ?? human.find((card) => isYourTurn(card, seenTurn));
  const target = session
    ? document.querySelector<HTMLElement>(`#human [data-key="${CSS.escape(keyOf(session))}"]`)
    : document.querySelector<HTMLElement>('#col-needs .card');
  target?.focus();
};

export const screen = {
  get: (): ScreenState => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  handle: (next: ScreenHandlers) => {
    handlers = next;
  },
  handlers: (): ScreenHandlers => handlers,
  read: (): Board | null => state.read,
  board,
  index,
  accept,
  fail,
  setCoordinator: (coordinator: CoordinatorView) => {
    if (state.read) emit({ ...state, read: { ...state.read, coordinator } });
  },
  markSeen,
  markAllSeen,
  isUnseen,
  seenTurn,
  seeTurn,
  openEpics: (): ReadonlySet<IssueKey> => state.openEpics,
  setEpicOpen: (epic: IssueKey, isOpen: boolean) =>
    setEpicsOpen((open) => (isOpen ? open.add(epic) : open.delete(epic))),
  setEpicsOpen,
  launches: () => state.launches,
  setLaunches: (change: (launches: Map<IssueKey, Launch>) => void) =>
    emit({ ...state, launches: edited(new Map(state.launches), change) }),
  startFailures: () => state.startFailures,
  setStartFailures: (change: (failures: Map<IssueKey, string>) => void) =>
    emit({ ...state, startFailures: edited(new Map(state.startFailures), change) }),
  asides: () => state.asides,
  setAsides: (change: (asides: Map<IssueKey | null, 'pending' | 'done'>) => void) =>
    emit({ ...state, asides: edited(new Map(state.asides), change) }),
  stops: () => state.stops,
  setStops: (change: (stops: Map<IssueKey | null, 'pending' | 'done'>) => void) =>
    emit({ ...state, stops: edited(new Map(state.stops), change) }),
  refusals: () => state.refusals,
  setRefusals: (change: (refusals: Map<IssueKey | null, Refusal>) => void) =>
    emit({ ...state, refusals: edited(new Map(state.refusals), change) }),
  visualPresses: () => state.visualPresses,
  setVisualPresses: (change: (presses: Set<IssueKey>) => void) =>
    emitFor('quiet', { ...state, visualPresses: edited(new Set(state.visualPresses), change) }),
  press,
  openStop: (card: Card) => {
    if (state.stops.has(card.number)) return;
    emitFor('quiet', { ...state, stopFor: { card, key: screen.index().keyOf.get(card) ?? keyOf(card) } });
  },
  closeStop: () => emitFor('quiet', { ...state, stopFor: null }),
  openMenu: (key: string, kind: MenuKind, isCompact: boolean) =>
    emitFor('quiet', { ...state, menu: { key, kind, isCompact } }),
  closeMenu: (key: string, kind: MenuKind) => {
    if (state.menu?.key === key && state.menu.kind === kind) emitFor('quiet', { ...state, menu: null });
  },
  setColumnStop: (column: string, key: string) => {
    if (state.columnStops.get(column) !== key)
      emitFor('quiet', { ...state, columnStops: new Map(state.columnStops).set(column, key) });
  },
  announceStart,
  cause: (): Cause => cause,
  now: (): number => state.now,
};

export const useScreen = <T>(select: (state: ScreenState) => T): T =>
  useSyncExternalStore(screen.subscribe, () => select(state));

setInterval(() => emitFor('quiet', { ...state, now: Date.now() }, false), 1000);
addEventListener('storage', (event) => {
  if (event.key === null || event.key.startsWith(store.key(SEEN_TURN))) emit({ ...state, turns: state.turns + 1 });
  if (event.key !== null && event.key !== store.key('open-epics')) return;
  emitFor('read', { ...state, openEpics: parseOpenEpics(event.newValue ?? '') });
});
