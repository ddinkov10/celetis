import { FIND_KEY } from '../shell.ts';
import { phone, shellStore } from '../store.ts';
import { $, copy, openUrl } from '../ui.ts';
import { actionsOf, copyWhat } from './actions.ts';
import { closeDetails, openDetails, screen, setTab } from './state.ts';

export const STOPS = '.card[data-key], .epic-row';
export const isStop = (node: Element) => !node.closest('.epic-children[hidden]');
export const columnId = (col: Element) => col.id || col.getAttribute('aria-labelledby') || 'hold';
export const stopKey = (node: HTMLElement) => node.dataset.key ?? node.dataset.group ?? '';
export const columnStop = (column: string | null | undefined) =>
  [...document.querySelectorAll<HTMLElement>('#columns .col')]
    .find((col) => columnId(col) === column)
    ?.querySelector<HTMLElement>(`:is(${STOPS})[tabindex="0"], .empty`);

export const move = (across: number, down: number) => {
  const lists = [...document.querySelectorAll<HTMLElement>('#columns .col')].map((col) =>
    [...col.querySelectorAll<HTMLElement>(STOPS)].filter(isStop),
  );
  const current = (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>(STOPS) ?? null;
  const at = lists.findIndex((list) => current !== null && list.includes(current));
  const list = lists[at];
  if (!list || !current) return lists.flat()[0]?.focus();
  const row = list.indexOf(current);
  if (down) return list[Math.min(Math.max(row + down, 0), list.length - 1)]?.focus();
  for (let next = at + across; next >= 0 && next < lists.length; next += across) {
    const other = lists[next] as HTMLElement[];
    if (other.length) return other[Math.min(row, other.length - 1)]?.focus();
  }
};

export const showHints = (key: string | null) => {
  const entry = key === null ? undefined : screen.index().byKey.get(key);
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
  shellStore.setInputs({ hints: pairs.flatMap((pair) => (pair.at(-1) ? [pair as string[]] : [])) });
};

const shell = () => shellStore.get().shell;
export const toggleHistory = () => setTab(shell().tab === 'history' ? 'agents' : 'history');
export const toggleView = () => setTab(shell().tab === 'pipeline' ? 'agents' : 'pipeline');

const SHORT: Record<string, () => void> = {
  j: () => move(0, 1),
  k: () => move(0, -1),
  h: () => move(-1, 0),
  l: () => move(1, 0),
  d: toggleHistory,
  v: toggleView,
};
const ARROWS: Record<string, () => void> = {
  ArrowDown: () => move(0, 1),
  ArrowUp: () => move(0, -1),
  ArrowLeft: () => move(-1, 0),
  ArrowRight: () => move(1, 0),
};

const cardPress = (node: HTMLElement, key: string): (() => void) | undefined => {
  const cardKey = node.dataset.key as string;
  const entry = screen.index().byKey.get(cardKey);
  if (ARROWS[key]) return ARROWS[key];
  if (!entry) return undefined;
  const { card } = entry;
  const act = (action = actionsOf(card)[0]) =>
    action && (action.href ? openUrl(action.href) : void screen.press(card, action));
  const presses: Record<string, () => void> = {
    Enter: () => act(),
    ' ': () => openDetails(cardKey),
    o: () => openUrl(card.url),
    c: () => {
      const what = copyWhat(card);
      if (what) void copy(card.act as string, what);
    },
    s: () => {
      if (!node.classList.contains('compact'))
        act(actionsOf(card).find((action) => action.id === 'aside' || action.id === 'stop'));
    },
    m: () => screen.openMenu(cardKey, 'actions', node.classList.contains('compact')),
  };
  return presses[key];
};

const pressOf = (event: KeyboardEvent): (() => void) | undefined => {
  const { key } = event;
  if (key === 'Escape')
    return shell().details !== null && screen.get().menu === null && !$('menu').matches(':popover-open')
      ? () => closeDetails(true)
      : undefined;
  const isBoardShown =
    shell().area === 'operations' &&
    (shell().tab === 'agents' || shell().tab === 'pipeline') &&
    !(phone.matches && shell().pane === 'chat');
  if (!isBoardShown && key !== 'd' && key !== 'v') return undefined;
  const active = document.activeElement as HTMLElement | null;
  const press =
    (active?.matches('.card[data-key]') && cardPress(active, key)) ||
    (active?.matches('.epic-row') && ARROWS[key]) ||
    undefined;
  return press ?? (shellStore.get().settings.keys ? SHORT[key] : undefined);
};

export const handleKey = (event: KeyboardEvent): boolean => {
  const target = event.target as Element;
  if (
    screen.get().stopFor !== null ||
    target.closest?.('[data-slot="dropdown-menu-content"], [data-slot="alert-dialog-content"]')
  )
    return false;
  const press = pressOf(event);
  if (!press) return false;
  event.preventDefault();
  press();
  return true;
};
