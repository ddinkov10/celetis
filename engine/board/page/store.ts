import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { Board } from '../types.ts';
import { boardKey, queryClient } from './query.ts';
import { type Area, readShell, type Shell } from './shell.ts';
import { applyTheme, readTheme, THEME_KEY, THEMES, type Theme, writeTheme } from './theme/choice.ts';
import { announce, post, store, toast } from './ui.ts';

export type Settings = Readonly<{ theme: Theme; notify: boolean; keys: boolean }>;
export type Inputs = Readonly<{
  badges: { home: number; operations: number; agents: number };
  intake: { reason: string | null; pending: boolean };
  hints: readonly (readonly string[])[];
  chat: { state: string; stale: boolean; unseen: boolean; label: string; title: string };
  updateAccent: boolean;
  moreOpen: boolean;
}>;
export type Control = Readonly<{ isNotifying: boolean; refresh: 'rest' | 'busy' | 'done' }>;
export type State = Readonly<{ shell: Shell; isPhone: boolean; settings: Settings; inputs: Inputs; control: Control }>;
export type Handlers = {
  go(area: Area): void;
  showChat(): void;
  agents(): void;
  intake(): void;
  readAgain(): Promise<void>;
  isReconnecting(): boolean;
};

export const phone = matchMedia('(max-width: 719px)');
const light = matchMedia('(prefers-color-scheme: light)');
const listeners = new Set<() => void>();

let state: State = {
  shell: readShell({ area: store.get('area'), tab: store.get('tab') }),
  isPhone: phone.matches,
  settings: { theme: readTheme(), notify: store.get('notify') === 'on', keys: store.get('keys') !== 'off' },
  inputs: {
    badges: { home: 0, operations: 0, agents: 0 },
    intake: { reason: null, pending: false },
    hints: [],
    chat: { state: '', stale: false, unseen: false, label: '', title: '' },
    updateAccent: false,
    moreOpen: false,
  },
  control: { isNotifying: false, refresh: 'rest' },
};
let handlers: Handlers = {
  go: () => {},
  showChat: () => {},
  agents: () => {},
  intake: () => {},
  readAgain: () => Promise.resolve(),
  isReconnecting: () => false,
};
let refreshDone: ReturnType<typeof setTimeout> | undefined;

const emit = (next: State) => {
  state = next;
  flushSync(() => {
    for (const listener of listeners) listener();
  });
};
const setSettings = (change: Partial<Settings>) => emit({ ...state, settings: { ...state.settings, ...change } });
const setControl = (change: Partial<Control>) => emit({ ...state, control: { ...state.control, ...change } });
const setNotify = (notify: boolean) => {
  store.set('notify', notify ? 'on' : 'off');
  setSettings({ notify });
};

async function toggleNotify(): Promise<void> {
  if (state.control.isNotifying) return;
  if (!('Notification' in window)) return toast('This browser has no notifications', { isError: true });
  if (!state.settings.notify && Notification.permission === 'default') {
    setControl({ isNotifying: true });
    try {
      await Notification.requestPermission();
    } finally {
      setControl({ isNotifying: false });
    }
  }
  if (Notification.permission === 'denied') {
    setNotify(false);
    toast('The browser blocks notifications for this page', {
      detail: 'Allow them in the site settings of the browser, then press Notify again.',
      isError: true,
    });
  } else if (Notification.permission === 'default') {
    setNotify(false);
    toast('Notifications stay off', {
      detail: 'The browser did not get your permission. Press Notify again to answer it.',
    });
  } else {
    setNotify(!state.settings.notify);
    toast(state.settings.notify ? 'Notifications are on' : 'Notifications are off', {
      detail: state.settings.notify
        ? 'A system notification shows when a card needs you and the board is not in front.'
        : '',
    });
  }
}

const cycleTheme = () =>
  shellStore.setTheme(THEMES[(THEMES.indexOf(state.settings.theme) + 1) % THEMES.length] ?? 'system');

async function refresh(): Promise<void> {
  if (state.control.refresh === 'busy') return;
  setControl({ refresh: 'busy' });
  const isOk = !handlers.isReconnecting() && (await post('/api/refresh', {}, 'Refresh failed'));
  await handlers.readAgain();
  const tracker = queryClient.getQueryData<Board>(boardKey)?.tracker;
  if (!isOk) return setControl({ refresh: 'rest' });
  setControl({ refresh: 'done' });
  announce(tracker ? `${tracker} read again` : 'Issues read again');
  clearTimeout(refreshDone);
  refreshDone = setTimeout(() => setControl({ refresh: 'rest' }), 2000);
}

export const shellStore = {
  get: (): State => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setShell: (next: Shell) => {
    store.set('area', next.area);
    store.set('tab', next.tab);
    emit({ ...state, shell: next, isPhone: phone.matches });
  },
  setInputs: (patch: Partial<Inputs>) => {
    const changed = Object.entries(patch).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(state.inputs[key as keyof Inputs]),
    );
    if (changed.length) emit({ ...state, inputs: { ...state.inputs, ...Object.fromEntries(changed) } });
  },
  handle: (next: Handlers) => {
    handlers = next;
  },
  handlers: (): Handlers => handlers,
  setTheme: (theme: Theme) => {
    writeTheme(theme);
    applyTheme(theme);
    setSettings({ theme });
  },
  toggleNotify,
  refresh,
  cycleTheme,
  setKeys: (keys: boolean) => {
    store.set('keys', keys ? 'on' : 'off');
    setSettings({ keys });
  },
};

export const useShellStore = <T>(select: (state: State) => T): T =>
  useSyncExternalStore(shellStore.subscribe, () => select(state));

light.addEventListener('change', () => {
  if (state.settings.theme !== 'system') return;
  applyTheme('system');
  setSettings({});
});
addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== THEME_KEY) return;
  const theme = readTheme();
  applyTheme(theme);
  setSettings({ theme });
});
