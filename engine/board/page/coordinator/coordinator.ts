import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import type { CoordinatorKey } from '../../../lib/coordinator/types.ts';
import type { ChatEntry, CoordinatorChat, CoordinatorView } from '../../types.ts';
import { clock } from '../../view.ts';
import { isChatShown } from '../shell.ts';
import { phone, shellStore } from '../store.ts';
import { announce, post, SERVER_DOWN, store } from '../ui.ts';
import { isReconnecting } from '../update/state.ts';
import {
  type Act,
  type Answer,
  foldRead,
  KEYS,
  type Line,
  type Mirror,
  mirrorOf,
  NONE,
  RECONNECT,
  type Shown,
  sendBlock,
  settleAnswers,
  shownOf,
  turnKeyOf,
  UNKNOWN,
  WORDS,
  withKey,
} from './rules.ts';

export type CoordinatorHooks = Readonly<{
  reveal(): void;
  changed(view: CoordinatorView): void;
  notify(title: string, open: () => void): void;
}>;
export type PanelState = Readonly<{
  view: CoordinatorView;
  shown: Shown;
  aged: boolean;
  isOpen: boolean;
  isDown: boolean;
  busy: Act | null;
  line: Line | null;
  host: string;
  entries: readonly ChatEntry[];
  chatAt: string | null;
  chatError: string | null;
  lines: readonly string[];
  linesAt: string | null;
  linesError: string | null;
  answers: readonly Answer[];
  asking: Answer | null;
  openRows: ReadonlyMap<string, boolean>;
  text: string;
  mirror: Mirror;
  focusAsks: number;
  scrollAsks: number;
}>;

export const timeOf = (iso: string | null) => (iso ? clock(iso) : 'no good read');

const listeners = new Set<() => void>();
let hooks: CoordinatorHooks = { reveal: () => {}, changed: () => {}, notify: () => {} };
let view = NONE;
let known: Shown | null = null;
let host = '';
let ended = false;
let liveId: string | null = null;
let foldAt: number | null = null;
let opening = 0;
let busy: Act | null = null;
let line: Line | null = null;
let entries: readonly ChatEntry[] = [];
let revision: string | null = null;
let chatAt: string | null = null;
let chatError: string | null = null;
let lines: readonly string[] = [];
let linesAt: string | null = null;
let linesError: string | null = null;
let isDown = false;
let isOpen = false;
let reading = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let seen = store.get('coordinator-seen');
let answers: readonly Answer[] = [];
let asking: Answer | null = null;
let nextAnswer = 0;
let openRows: ReadonlyMap<string, boolean> = new Map();
let text = '';
let focusAsks = 0;
let scrollAsks = 0;
let mirror: Mirror | null = null;

const shown = () => shownOf({ ended, opening, view });
const can = (action: CoordinatorView['actions'][number]) => view.actions.includes(action) && !ended;

const snapshot = (): PanelState => {
  const state = shown();
  ({ asking, answers } = settleAnswers({ state, entries, asking, answers, nextId: nextAnswer }));
  if (asking?.id === nextAnswer) nextAnswer += 1;
  if (view.host) host = view.host;
  const next = mirrorOf({ state, view, seen, cause: view.error ?? (isDown ? SERVER_DOWN : null), timeOf });
  if (mirror === null || JSON.stringify(mirror) !== JSON.stringify(next)) mirror = next;
  return {
    view,
    shown: state,
    aged: view.state === 'starting' && view.sessionId !== null && view.sessionId === liveId,
    isOpen,
    isDown,
    busy,
    line,
    host,
    entries,
    chatAt,
    chatError,
    lines,
    linesAt,
    linesError,
    answers,
    asking,
    openRows,
    text,
    mirror,
    focusAsks,
    scrollAsks,
  };
};

let panel = snapshot();

const commit = () => {
  panel = snapshot();
  flushSync(() => {
    for (const listener of listeners) listener();
  });
};

const resetChat = () => {
  entries = [];
  revision = null;
  chatAt = null;
  chatError = null;
  lines = [];
  linesAt = null;
  linesError = null;
  openRows = new Map();
  answers = [];
  asking = null;
};

const take = (read: CoordinatorView): string | null => {
  const folded = foldRead({ read, view, isOpen, liveId, foldAt, ended, opening });
  if (folded === null) return null;
  const { next } = folded;
  ({ liveId, foldAt, ended, opening } = folded);
  if (view.sessionId !== next.sessionId && next.sessionId !== null) resetChat();
  view = next;
  const state = shown();
  commit();
  if (known === null || known === state) {
    known = state;
    return null;
  }
  known = state;
  if (state === 'dialog') hooks.notify('The coordinator waits for your answer', open);
  if (state === 'turn-ended') hooks.notify('The coordinator ended its turn', open);
  return state === 'ended' ? 'The coordinator session ended' : `Coordinator: ${WORDS[state]}`;
};

const schedule = (from: number) => {
  clearTimeout(timer);
  if (isOpen && !document.hidden) timer = setTimeout(readChat, Math.max(0, 2000 - (Date.now() - from)));
};

async function readChat(): Promise<void> {
  clearTimeout(timer);
  if (!isOpen || document.hidden || reading) return;
  reading = true;
  const from = Date.now();
  try {
    const since = revision === null ? '' : `?since=${encodeURIComponent(revision)}`;
    const response = await fetch(`/api/coordinator${since}`, { cache: 'no-store' });
    const body = (await response.json()) as CoordinatorChat;
    if (!response.ok || !body?.view) throw new Error(SERVER_DOWN);
    const said = take(body.view);
    if (!ended && view.state !== 'none') {
      chatError = body.error;
      const exiting = body.view.state === 'starting' && body.view.sessionId === liveId;
      if (!exiting) {
        if (body.chat?.entries) {
          entries = body.chat.entries;
          revision = body.chat.revision;
        }
        if (body.error === null || body.readAt !== null) chatAt = body.readAt;
        lines = body.dialog?.lines ?? [];
        linesAt = body.dialog?.readAt ?? null;
        linesError = body.dialog?.error ?? null;
      }
      if (body.error === null && body.view.state === 'turn-ended' && isOpen && !document.hidden) {
        seen = turnKeyOf(view);
        store.set('coordinator-seen', seen);
      }
    }
    if (said) {
      announce(said);
      hooks.changed(view);
    }
  } catch {
    chatError = SERVER_DOWN;
  } finally {
    reading = false;
    commit();
    schedule(from);
  }
}

const act = async (kind: Act, path: string, body: Record<string, string>): Promise<boolean> => {
  if (busy) return false;
  if (isReconnecting()) {
    line = { act: kind, text: RECONNECT, tone: 'status' };
    commit();
    return false;
  }
  busy = kind;
  line = null;
  commit();
  let error: string | null = null;
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const answer = (await response.json().catch(() => null)) as { ok?: unknown; error?: unknown } | null;
    if (!response.ok || answer?.ok !== true) error = typeof answer?.error === 'string' ? answer.error : UNKNOWN[kind];
  } catch {
    error = UNKNOWN[kind];
  }
  busy = null;
  if (error) line = { act: kind, text: error, tone: 'error' };
  commit();
  void readChat();
  return error === null;
};

const pressKey = async (key: CoordinatorKey): Promise<boolean> => {
  const id = asking?.id ?? null;
  if (busy || !can('key')) return false;
  const sent = await act('key', '/api/coordinator/key', { key });
  if (sent) line = { act: 'key', text: `The key ${KEYS[key].name} is in the session.`, tone: 'status' };
  commit();
  if (sent && id !== null) {
    ({ asking, answers } = withKey({ asking, answers, id, key }));
    commit();
  }
  return sent;
};

const sendText = async () => {
  if (sendBlock({ busy, state: shown(), canSay: can('say'), text })) return;
  const sent = text;
  if (!(await act('say', '/api/coordinator/say', { text: sent }))) return;
  if (text === sent) text = '';
  line = { act: 'say', text: 'The message is in the session.', tone: 'status' };
  commit();
};

const startSession = async () => {
  if (busy || !view.actions.includes('open')) return;
  if (isReconnecting()) {
    line = { act: 'open', text: RECONNECT, tone: 'status' };
    hooks.reveal();
    commit();
    return;
  }
  ended = false;
  liveId = null;
  opening = Date.now();
  resetChat();
  known = 'starting';
  announce(`Coordinator: ${WORDS.starting}`);
  hooks.reveal();
  focusAsks += 1;
  commit();
  if (!(await act('open', '/api/coordinator/open', {}))) {
    opening = 0;
    known = shown();
    commit();
  }
};

const interrupt = async () => {
  if (busy || !can('interrupt')) return;
  if (await act('interrupt', '/api/coordinator/interrupt', {}))
    line = {
      act: 'interrupt',
      text: 'The stop key is in the session. The state shows the effect at the next read.',
      tone: 'status',
    };
  commit();
};

const end = async () => {
  if (busy || !can('end')) return;
  if (await act('end', '/api/coordinator/end', {}))
    line = {
      act: 'end',
      text: 'The exit request is in the session. The state shows the effect at the next read.',
      tone: 'status',
    };
  commit();
};

const show = () => {
  if (isOpen) return;
  isOpen = true;
  scrollAsks += 1;
  commit();
  void readChat();
};

const hide = () => {
  if (!isOpen) return;
  isOpen = false;
  ended = false;
  clearTimeout(timer);
  commit();
};

function open(): void {
  hooks.reveal();
  focusAsks += 1;
  commit();
}

const followShell = () => {
  if (isChatShown(shellStore.get().shell, phone.matches)) show();
  else hide();
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(timer);
  else void readChat();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const coordinator = {
  get: (): PanelState => panel,
  subscribe,
  handle: (next: CoordinatorHooks) => {
    hooks = next;
    shellStore.subscribe(followShell);
    followShell();
  },
  update: take,
  view: () => view,
  down: (value: boolean) => {
    if (isDown === value) return;
    isDown = value;
    commit();
  },
  open,
  start: () => void startSession(),
  isShown: () => isOpen,
  hasSession: () => shown() !== 'none' && shown() !== 'ended',
  send: () => void sendText(),
  interrupt: () => void interrupt(),
  end: () => void end(),
  go: () => {
    if (view.sessionId) void post('/api/go', { sessionId: view.sessionId }, 'Go failed');
  },
  pressKey,
  setText: (next: string) => {
    text = next;
    if (line?.act !== 'open') line = null;
    commit();
  },
  setRowOpen: (row: string, value: boolean) => {
    openRows = new Map(openRows).set(row, value);
    commit();
  },
};

export const useCoordinator = <T>(select: (state: PanelState) => T): T =>
  useSyncExternalStore(subscribe, () => select(panel));
