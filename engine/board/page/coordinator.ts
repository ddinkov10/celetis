import type { CoordinatorKey, CoordinatorState } from '../../lib/coordinator/types.ts';
import type { ChatEntry, CoordinatorChat, CoordinatorView } from '../types.ts';
import { clock } from '../view.ts';
import { createChat, KEYS } from './chat.ts';
import { $, announce, el, icon, post, SERVER_DOWN, store, timed } from './ui.ts';
import { isReconnecting } from './update-dialog.ts';

type Shown = CoordinatorState | 'ended';
type Act = 'open' | 'say' | 'key' | 'interrupt' | 'end';
type Line = { act: Act; text: string; tone: 'error' | 'status' };
export type CoordinatorHooks = Readonly<{
  reveal(): void;
  changed(view: CoordinatorView): void;
  notify(title: string, open: () => void): void;
}>;

const LIMIT = 4096;
const RECONNECT = 'The board reconnects after an update, so the press did nothing. Press again after the reconnect.';
const OPEN_BOUND = 30_000;
const FOLD_BOUND = 5_000;
const WORDS: Record<Shown, string> = {
  none: 'no session',
  starting: 'starts',
  dialog: 'waits for your answer',
  works: 'works',
  'turn-ended': 'turn ended',
  ended: 'ended',
};
const IN_FLIGHT: Record<Act, string> = {
  open: 'The session starts.',
  say: 'The message is in flight.',
  key: 'The key is in flight.',
  interrupt: 'The interrupt is in flight.',
  end: 'The exit request is in flight.',
};
// Copies of unknownOutcome (engine/lib/coordinator/coordinator.ts) and the open line (engine/board/adapter.ts): the bundle takes no engine/lib code.
const UNKNOWN: Record<Act, string> = {
  open: 'coordinator: the outcome of the open is unknown; press Coordinator again to open or show the session',
  say: 'coordinator: the outcome of the message is unknown; read the log of the panel before you send again',
  key: 'coordinator: the outcome of the key is unknown; read the log of the panel before you press a key again',
  interrupt:
    'coordinator: the outcome of the interrupt is unknown; read the log of the panel before you interrupt again',
  end: 'coordinator: the outcome of the exit request is unknown; read the log of the panel before you end the session again',
};

const none: CoordinatorView = {
  state: 'none',
  kind: null,
  host: null,
  since: null,
  turn: null,
  actions: ['open'],
  keys: [],
  sessionId: null,
  readAt: null,
  error: null,
};

export function setupCoordinator(hooks: CoordinatorHooks) {
  const mirrors = [$('pane-chat'), $('pb-chat')];
  const aside = $('coordinator');
  const log = $('coordinator-log');
  const toEnd = $('coordinator-to-end');
  const form = $('coordinator-form') as HTMLFormElement;
  const field = $('coordinator-field') as HTMLTextAreaElement;
  const send = $('coordinator-send');
  const hint = $('coordinator-hint');
  const interrupt = $('coordinator-interrupt');
  const end = $('coordinator-end');
  const go = $('coordinator-go');
  const startBlock = $('coordinator-start-block');
  const startText = $('coordinator-start-text');
  const start = $('coordinator-start');

  let view = none;
  let known: Shown | null = null;
  let host = '';
  let ended = false;
  let liveId: string | null = null;
  let foldAt: number | null = null;
  let opening = 0;
  let busy: Act | null = null;
  let line: Line | null = null;
  let entries: ChatEntry[] = [];
  let revision: string | null = null;
  let chatAt: string | null = null;
  let chatError: string | null = null;
  let lines: string[] = [];
  let linesAt: string | null = null;
  let linesError: string | null = null;
  let isDown = false;
  let isOpen = false;
  let follow = true;
  let behind = false;
  let lastTop = 0;
  let reading = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pillKey = '';
  let seen = store.get('coordinator-seen');

  const shown = (): Shown => {
    if (ended) return 'ended';
    if (opening && view.state === 'none' && Date.now() - opening < OPEN_BOUND) return 'starting';
    return view.state;
  };
  const turnKey = () => `${view.sessionId}:${view.turn}`;
  const isUnseen = () => view.state === 'turn-ended' && view.sessionId !== null && turnKey() !== seen;
  const staleCause = () => view.error ?? (isDown ? SERVER_DOWN : null);
  const timeOf = (iso: string | null) => (iso ? clock(iso) : 'no good read');
  const atEnd = () => log.scrollHeight - log.scrollTop - log.clientHeight < 4;
  const can = (action: CoordinatorView['actions'][number]) => view.actions.includes(action) && !ended;
  const setText = (node: HTMLElement, value: string) => {
    if (node.textContent !== value) node.textContent = value;
  };
  const isSelecting = () => {
    const selection = getSelection();
    return Boolean(selection && !selection.isCollapsed && log.contains(selection.anchorNode));
  };

  const settle = () => {
    if (behind && !isSelecting()) {
      behind = false;
      if (follow) log.scrollTop = log.scrollHeight;
      lastTop = log.scrollTop;
    }
    toEnd.hidden = atEnd();
  };

  const sendBlock = (): string | null => {
    if (busy) return `Wait: ${IN_FLIGHT[busy]}`;
    const state = shown();
    if (state === 'dialog') return 'The host shows a dialog: answer it with a key first';
    if (state === 'starting') return 'The session starts: send after its first status';
    if (!can('say')) return `The session ${WORDS[state]}`;
    if (field.value.length > LIMIT) return `A message takes at most ${LIMIT} characters`;
    if (field.value.trim() === '') return 'Write a message first';
    return null;
  };
  const hintOf = (): [string, 'error' | 'status' | 'plain'] => {
    if (field.value.length > LIMIT)
      return [`The message is longer than ${LIMIT} characters. Make it shorter to send it.`, 'error'];
    if (busy === 'say') return ['Sending. The message waits until the tab holds no unsent text.', 'status'];
    if (busy) return [`${IN_FLIGHT[busy]} The other acts wait for it.`, 'status'];
    if (line && line.act !== 'open') return [line.text, line.tone];
    const state = shown();
    if (state === 'dialog') return ['Send waits while the host shows a dialog. Your text stays here.', 'plain'];
    if (state === 'starting')
      return ['The session starts. Send waits for its first status. Your text stays here.', 'plain'];
    if (state === 'works') return ['The session works. A message goes into its tab now.', 'plain'];
    return ['Enter sends. Shift+Enter adds a line.', 'plain'];
  };

  const disable = (node: HTMLElement, reason: string | null, title: string) => {
    node.setAttribute('aria-disabled', String(reason !== null));
    node.title = reason ?? title;
  };

  const draw = () => {
    const active = document.activeElement as HTMLElement | null;
    const wasInPanel = active !== null && aside.contains(active);
    const state = shown();
    const header = ended ? 'none' : state;
    const cause = staleCause();
    const unseen = isUnseen();
    for (const control of mirrors) {
      control.dataset.state = header;
      control.toggleAttribute('data-stale', cause !== null);
      control.toggleAttribute('data-new', unseen);
      control.setAttribute(
        'aria-label',
        `Chat, coordinator ${WORDS[header]}${unseen ? ', new text' : ''}${cause ? ', not current' : ''}`,
      );
      control.title = cause
        ? `${cause}. The state is from ${timeOf(view.readAt)}, not current.`
        : 'Show the chat with the coordinator';
      const words = control.querySelector<HTMLElement>('.co-open-state');
      if (words) setText(words, WORDS[header]);
    }

    aside.dataset.state = state;
    const banner = $('coordinator-banner');
    const chatCause = isOpen ? (chatError ?? cause) : null;
    const linesCause = isOpen && state === 'dialog' ? linesError : null;
    const aged = view.state === 'starting' && view.sessionId !== null && view.sessionId === liveId;
    aside.toggleAttribute('data-stale', ended || chatCause !== null || linesCause !== null || aged);
    const bannerText = ended
      ? 'The coordinator session ended. This is its last conversation.'
      : chatCause
        ? `${chatCause}. The conversation can be out of date: it is from ${timeOf(chatAt)}.`
        : linesCause
          ? `${linesCause}. The dialog lines can be out of date: they are from ${timeOf(linesAt)}.`
          : null;
    banner.hidden = bannerText === null;
    banner.dataset.tone = ended ? 'plain' : 'error';
    setText(banner, bannerText ?? '');
    if (view.host) host = view.host;
    setText($('coordinator-host'), host);
    const pill = $('coordinator-head-state');
    const age = state === 'ended' || state === 'none' ? null : view.since;
    if (pillKey !== `${state}|${age}`) {
      pillKey = `${state}|${age}`;
      pill.replaceChildren(
        el('span', '', WORDS[state]),
        ...(age ? [timed(age, state === 'starting' || state === 'works' || state === 'dialog')] : []),
      );
    }

    const dialog = state === 'dialog' ? { lines, keys: can('key') ? view.keys : [] } : null;
    if (chat.draw(entries, dialog, state)) behind = true;
    settle();

    const wait = busy ? `Wait: ${IN_FLIGHT[busy]}` : null;
    interrupt.hidden = !can('interrupt');
    end.hidden = !can('end');
    go.hidden = !can('go') || !view.sessionId;
    disable(interrupt, busy && busy !== 'interrupt' ? wait : null, 'Press the stop key in the session');
    disable(end, busy && busy !== 'end' ? wait : null, 'Send the exit request of the host to the session');
    interrupt.setAttribute('aria-busy', String(busy === 'interrupt'));
    end.setAttribute('aria-busy', String(busy === 'end'));

    form.hidden = state === 'none' || state === 'ended';
    for (const key of log.querySelectorAll<HTMLElement>('[data-key]')) {
      disable(
        key,
        busy && busy !== 'key' ? wait : null,
        `Press ${key.getAttribute('aria-label') ?? key.textContent} in the session`,
      );
      key.setAttribute('aria-busy', String(busy === 'key'));
    }
    const block = sendBlock();
    disable(send, block, 'Send the message (Enter)');
    send.setAttribute('aria-busy', String(busy === 'say'));
    setText(send.querySelector('.label') as HTMLElement, busy === 'say' ? 'Sending' : 'Send');
    const [words, tone] = hintOf();
    setText(hint, words);
    hint.dataset.tone = tone;
    if (tone === 'plain') hint.removeAttribute('role');
    else hint.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    field.setAttribute(
      'aria-invalid',
      String(field.value.length > LIMIT || (line?.act === 'say' && line.tone === 'error')),
    );

    startBlock.hidden = !((state === 'none' || state === 'ended') && view.actions.includes('open'));
    setText(start.querySelector('.label') as HTMLElement, ended ? 'Start a new session' : 'Start a session');
    disable(start, wait, 'Start a coordinator session in a quiet tab of the Herdr app');
    const startLine = line?.act === 'open' ? line.text : null;
    startText.hidden = startLine === null;
    setText(startText, startLine ?? '');
    if (startLine) startText.setAttribute('role', 'alert');

    const now = document.activeElement;
    if (isOpen && wasInPanel && !(now instanceof HTMLElement && aside.contains(now) && now.checkVisibility()))
      focusIn();
  };

  const take = (read: CoordinatorView): string | null => {
    if (read.error === null && view.error === null && read.readAt && view.readAt && read.readAt < view.readAt)
      return null;
    // A server with no good read yet knows no state, so the state of the page stays, marked not current.
    let next = read.error !== null && read.readAt === null ? { ...view, error: read.error } : read;
    if (next.state === 'works' || next.state === 'dialog' || next.state === 'turn-ended') {
      liveId = next.sessionId;
      foldAt = null;
    } else if (next.state === 'starting' && next.sessionId !== null && next.sessionId === liveId) {
      foldAt ??= Date.now();
      if (Date.now() - foldAt < FOLD_BOUND) next = { ...view, readAt: next.readAt, error: next.error };
    } else foldAt = null;
    if (view.state !== 'none' && next.state === 'none' && next.error === null && isOpen && !opening) ended = true;
    if (next.state !== 'none') {
      ended = false;
      opening = 0;
    }
    if (view.sessionId !== next.sessionId && next.sessionId !== null) resetChat();
    view = next;
    const state = shown();
    draw();
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
          seen = turnKey();
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
      draw();
      schedule(from);
    }
  }

  const act = async (kind: Act, path: string, body: Record<string, string>): Promise<boolean> => {
    if (busy) return false;
    if (isReconnecting()) {
      line = { act: kind, text: RECONNECT, tone: 'status' };
      draw();
      return false;
    }
    busy = kind;
    line = null;
    draw();
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
    draw();
    void readChat();
    return error === null;
  };

  const pressKey = async (key: CoordinatorKey): Promise<boolean> => {
    if (busy || !can('key')) return false;
    const sent = await act('key', '/api/coordinator/key', { key });
    if (sent) line = { act: 'key', text: `The key ${KEYS[key].name} is in the session.`, tone: 'status' };
    draw();
    return sent;
  };
  const chat = createChat(log, pressKey);
  const resetChat = () => {
    entries = [];
    revision = null;
    chatAt = null;
    chatError = null;
    lines = [];
    linesAt = null;
    linesError = null;
    chat.reset();
  };

  const sendText = async () => {
    if (sendBlock()) return;
    const sent = field.value;
    if (!(await act('say', '/api/coordinator/say', { text: sent }))) return;
    if (field.value === sent) field.value = '';
    line = { act: 'say', text: 'The message is in the session.', tone: 'status' };
    draw();
  };

  const startSession = async () => {
    if (busy || !view.actions.includes('open')) return;
    if (isReconnecting()) {
      line = { act: 'open', text: RECONNECT, tone: 'status' };
      hooks.reveal();
      draw();
      return;
    }
    ended = false;
    liveId = null;
    opening = Date.now();
    resetChat();
    known = 'starting';
    announce(`Coordinator: ${WORDS.starting}`);
    hooks.reveal();
    draw();
    (field.checkVisibility() ? field : start).focus({ preventScroll: true });
    if (!(await act('open', '/api/coordinator/open', {}))) {
      opening = 0;
      known = shown();
      draw();
    }
  };

  const show = () => {
    if (isOpen) return;
    isOpen = true;
    follow = true;
    aside.hidden = false;
    draw();
    log.scrollTop = log.scrollHeight;
    lastTop = log.scrollTop;
    void readChat();
  };

  const hide = () => {
    if (!isOpen) return;
    isOpen = false;
    ended = false;
    clearTimeout(timer);
    aside.hidden = true;
    draw();
  };

  const focusIn = () =>
    (field.checkVisibility() ? field : start.checkVisibility() ? start : log).focus({ preventScroll: true });

  function open(): void {
    hooks.reveal();
    focusIn();
  }

  log.addEventListener('scroll', () => {
    if (log.scrollTop < lastTop - 1 && !atEnd()) follow = false;
    else if (atEnd()) follow = true;
    lastTop = log.scrollTop;
    toEnd.hidden = atEnd();
  });
  new ResizeObserver(() => {
    behind = true;
    settle();
  }).observe(log);
  new ResizeObserver(() => {
    toEnd.hidden = atEnd();
  }).observe(log.firstElementChild as HTMLElement);
  toEnd.prepend(icon('chevron'));
  toEnd.addEventListener('click', () => {
    follow = true;
    log.focus({ preventScroll: true });
    log.scrollTop = log.scrollHeight;
  });
  field.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    form.requestSubmit();
  });
  field.addEventListener('input', () => {
    if (line?.act !== 'open') line = null;
    draw();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendText();
  });
  interrupt.addEventListener('click', async () => {
    if (busy || !can('interrupt')) return;
    if (await act('interrupt', '/api/coordinator/interrupt', {}))
      line = {
        act: 'interrupt',
        text: 'The stop key is in the session. The state shows the effect at the next read.',
        tone: 'status',
      };
    draw();
  });
  end.addEventListener('click', async () => {
    if (busy || !can('end')) return;
    if (await act('end', '/api/coordinator/end', {}))
      line = {
        act: 'end',
        text: 'The exit request is in the session. The state shows the effect at the next read.',
        tone: 'status',
      };
    draw();
  });
  go.prepend(icon('go'));
  go.addEventListener('click', () => {
    if (view.sessionId) void post('/api/go', { sessionId: view.sessionId }, 'Go failed');
  });
  start.addEventListener('click', () => void startSession());
  for (const control of mirrors) control.prepend(icon('message'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else void readChat();
  });
  draw();

  return {
    update: take,
    view: () => view,
    down(value: boolean) {
      if (isDown === value) return;
      isDown = value;
      draw();
    },
    show,
    hide,
    open,
    start: () => void startSession(),
    isShown: () => isOpen,
    hasSession: () => shown() !== 'none' && shown() !== 'ended',
  };
}
