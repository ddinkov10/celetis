import type { CoordinatorKey, CoordinatorState } from '../../../lib/coordinator/types.ts';
import type { ChatCall, ChatEntry, CoordinatorView } from '../../types.ts';

export type Shown = CoordinatorState | 'ended';
export type Act = 'open' | 'say' | 'key' | 'interrupt' | 'end';
export type Line = { act: Act; text: string; tone: 'error' | 'status' };
export type Answer = Readonly<{ id: number; after: string | null; key: CoordinatorKey | null }>;
export type Mirror = Readonly<{
  state: CoordinatorState;
  words: string;
  stale: boolean;
  unseen: boolean;
  label: string;
  title: string;
}>;
export type LogItem =
  | Readonly<{ kind: 'entry'; key: string; entry: ChatEntry }>
  | Readonly<{ kind: 'answer'; key: string; words: string; isAnswered: boolean }>
  | Readonly<{
      kind: 'ask';
      key: 'ask';
      call: ChatCall | undefined;
      lines: readonly string[];
      keys: readonly CoordinatorKey[];
    }>
  | Readonly<{ kind: 'works'; key: 'works' }>
  | Readonly<{ kind: 'empty'; key: 'empty'; title: string; text: string }>;
type TimeOf = (iso: string | null) => string;
type Fold = Readonly<{ liveId: string | null; foldAt: number | null; ended: boolean; opening: number }>;
type Settled = Readonly<{ asking: Answer | null; answers: readonly Answer[] }>;

export const LIMIT = 4096;
export const RECONNECT =
  'The board reconnects after an update, so the press did nothing. Press again after the reconnect.';
export const OPEN_BOUND = 30_000;
export const FOLD_BOUND = 5_000;
export const WORDS: Record<Shown, string> = {
  none: 'no session',
  starting: 'starts',
  dialog: 'waits for your answer',
  works: 'works',
  'turn-ended': 'turn ended',
  ended: 'ended',
};
export const IN_FLIGHT: Record<Act, string> = {
  open: 'The session starts.',
  say: 'The message is in flight.',
  key: 'The key is in flight.',
  interrupt: 'The interrupt is in flight.',
  end: 'The exit request is in flight.',
};
// Copies of unknownOutcome (engine/lib/coordinator/coordinator.ts) and the open line (engine/board/adapter.ts): the bundle takes no engine/lib code.
export const UNKNOWN: Record<Act, string> = {
  open: 'coordinator: the outcome of the open is unknown; press Coordinator again to open or show the session',
  say: 'coordinator: the outcome of the message is unknown; read the log of the panel before you send again',
  key: 'coordinator: the outcome of the key is unknown; read the log of the panel before you press a key again',
  interrupt:
    'coordinator: the outcome of the interrupt is unknown; read the log of the panel before you interrupt again',
  end: 'coordinator: the outcome of the exit request is unknown; read the log of the panel before you end the session again',
};

export const NONE: CoordinatorView = {
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

export const KEYS: Record<CoordinatorKey, { cap: string; name: string }> = {
  up: { cap: '↑', name: 'Up' },
  down: { cap: '↓', name: 'Down' },
  enter: { cap: 'Enter', name: 'Enter' },
  esc: { cap: 'Esc', name: 'Esc' },
  '1': { cap: '1', name: '1' },
  '2': { cap: '2', name: '2' },
  '3': { cap: '3', name: '3' },
};

export const turnKeyOf = (view: CoordinatorView) => `${view.sessionId}:${view.turn}`;

export const shownOf = ({
  ended,
  opening,
  view,
}: Readonly<{ ended: boolean; opening: number; view: CoordinatorView }>): Shown => {
  if (ended) return 'ended';
  if (opening && view.state === 'none' && Date.now() - opening < OPEN_BOUND) return 'starting';
  return view.state;
};

export const sendBlock = ({
  busy,
  state,
  canSay,
  text,
}: Readonly<{ busy: Act | null; state: Shown; canSay: boolean; text: string }>): string | null => {
  if (busy) return `Wait: ${IN_FLIGHT[busy]}`;
  if (state === 'dialog') return 'The host shows a dialog: answer it with a key first';
  if (state === 'starting') return 'The session starts: send after its first status';
  if (!canSay) return `The session ${WORDS[state]}`;
  if (text.length > LIMIT) return `A message takes at most ${LIMIT} characters`;
  if (text.trim() === '') return 'Write a message first';
  return null;
};

export const hintOf = ({
  text,
  busy,
  line,
  state,
}: Readonly<{ text: string; busy: Act | null; line: Line | null; state: Shown }>): [
  string,
  'error' | 'status' | 'plain',
] => {
  if (text.length > LIMIT)
    return [`The message is longer than ${LIMIT} characters. Make it shorter to send it.`, 'error'];
  if (busy === 'say') return ['Sending. The message waits until the tab holds no unsent text.', 'status'];
  if (busy) return [`${IN_FLIGHT[busy]} The other acts wait for it.`, 'status'];
  if (line && line.act !== 'open') return [line.text, line.tone];
  if (state === 'dialog') return ['Send waits while the host shows a dialog. Your text stays here.', 'plain'];
  if (state === 'starting')
    return ['The session starts. Send waits for its first status. Your text stays here.', 'plain'];
  if (state === 'works') return ['The session works. A message goes into its tab now.', 'plain'];
  return ['Enter sends. Shift+Enter adds a line.', 'plain'];
};

export const bannerOf = ({
  ended,
  chatCause,
  linesCause,
  chatAt,
  linesAt,
  timeOf,
}: Readonly<{
  ended: boolean;
  chatCause: string | null;
  linesCause: string | null;
  chatAt: string | null;
  linesAt: string | null;
  timeOf: TimeOf;
}>): string | null =>
  ended
    ? 'The coordinator session ended. This is its last conversation.'
    : chatCause
      ? `${chatCause}. The conversation can be out of date: it is from ${timeOf(chatAt)}.`
      : linesCause
        ? `${linesCause}. The dialog lines can be out of date: they are from ${timeOf(linesAt)}.`
        : null;

export const mirrorOf = ({
  state,
  view,
  seen,
  cause,
  timeOf,
}: Readonly<{
  state: Shown;
  view: CoordinatorView;
  seen: string | null;
  cause: string | null;
  timeOf: TimeOf;
}>): Mirror => {
  const header = state === 'ended' ? 'none' : state;
  const unseen = view.state === 'turn-ended' && view.sessionId !== null && turnKeyOf(view) !== seen;
  return {
    state: header,
    words: WORDS[header],
    stale: cause !== null,
    unseen,
    label: `Chat, coordinator ${WORDS[header]}${unseen ? ', new text' : ''}${cause ? ', not current' : ''}`,
    title: cause
      ? `${cause}. The state is from ${timeOf(view.readAt)}, not current.`
      : 'Show the chat with the coordinator',
  };
};

export const foldRead = ({
  read,
  view,
  isOpen,
  ...fold
}: Fold & Readonly<{ read: CoordinatorView; view: CoordinatorView; isOpen: boolean }>):
  | (Fold & Readonly<{ next: CoordinatorView }>)
  | null => {
  let { liveId, foldAt, ended, opening } = fold;
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
  return { next, liveId, foldAt, ended, opening };
};

export const settleAnswers = ({
  state,
  entries,
  asking,
  answers,
  nextId,
}: Settled & Readonly<{ state: Shown; entries: readonly ChatEntry[]; nextId: number }>): Settled => {
  if (state === 'dialog') {
    const after = entries.at(-1)?.id ?? null;
    if (asking === null) return { asking: { id: nextId, after, key: null }, answers };
    return { asking: asking.after === after ? asking : { ...asking, after }, answers };
  }
  return asking ? { asking: null, answers: [...answers, asking] } : { asking, answers };
};

export const withKey = ({
  asking,
  answers,
  id,
  key,
}: Settled & Readonly<{ id: number; key: CoordinatorKey }>): Settled => {
  const keyed = (record: Answer) => (record.id === id ? { ...record, key } : record);
  return { asking: asking && keyed(asking), answers: answers.map(keyed) };
};

export const logItems = ({
  entries,
  answers,
  dialog,
  state,
}: Readonly<{
  entries: readonly ChatEntry[];
  answers: readonly Answer[];
  dialog: Readonly<{ lines: readonly string[]; keys: readonly CoordinatorKey[] }> | null;
  state: Shown;
}>): LogItem[] => {
  const answerItems = (after: string | null): LogItem[] =>
    answers.flatMap((answer, index): LogItem[] => {
      if (answer.after !== after) return [];
      const words = answer.key ? `Answered with ${KEYS[answer.key].name}` : 'The dialog closed';
      return [{ kind: 'answer', key: `a:${index}`, words, isAnswered: answer.key !== null }];
    });
  const items: LogItem[] = answerItems(null);
  for (const entry of entries) items.push({ kind: 'entry', key: `e:${entry.id}`, entry }, ...answerItems(entry.id));
  if (dialog) {
    const call = entries
      .flatMap((entry) => (entry.kind === 'steps' ? entry.calls : []))
      .filter((item) => item.state === 'waits')
      .at(-1);
    items.push({ kind: 'ask', key: 'ask', call, lines: dialog.lines, keys: dialog.keys });
  }
  if (state === 'works') items.push({ kind: 'works', key: 'works' });
  if (entries.length === 0 && state !== 'works' && state !== 'dialog') {
    const absent = state === 'none' || state === 'ended';
    const title = absent ? 'No coordinator session' : 'The session starts';
    items.push({
      kind: 'empty',
      key: 'empty',
      title,
      text: absent
        ? 'Start a session to steer the runs from here.'
        : 'The conversation shows here when the session writes its first message.',
    });
  }
  return items;
};
