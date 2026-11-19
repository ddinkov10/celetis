import { randomUUID } from 'node:crypto';
import { coordinatorKeys, coordinatorStateOf, permittedActions } from '../lib/coordinator/types.ts';
import type { CodexClient } from '../lib/host/codex/app-server.ts';
import type { Host } from '../lib/host/names.ts';
import { isSessionId } from '../lib/state/fields.ts';
import { type Exec, readHistory, readTerminal } from '../lib/terminal/terminal.ts';
import type { Terminal } from '../lib/terminal/types.ts';
import type { Adapter } from './adapter.ts';
import { type ChatEvent, foldChat, type RecordRead } from './chat/chat.ts';
import { createClaudeRecord } from './chat/claude.ts';
import { createCodexRecord } from './chat/codex.ts';
import { cleanScreen } from './place.ts';
import { firstLine } from './requests.ts';
import type { ChatEntry, CoordinatorChat, CoordinatorView } from './types.ts';

const factsFailed = 'coordinator: cannot read the hc facts of the tab Coordinator';
const screenFailed = 'coordinator: cannot read the screen of the tab Coordinator';
const badSession = 'coordinator: the session ID of the coordinator record is not valid';

export type CoordinatorReads = Readonly<{
  view(terminals: Terminal[] | null): CoordinatorView;
  chat(since: string | null): Promise<CoordinatorChat>;
  close(): Promise<void>;
}>;
type Conversation = {
  host: Host;
  session: string;
  record: { read(): Promise<RecordRead> };
  events: Map<string, ChatEvent>;
  waiting: boolean;
  entries: ChatEntry[];
  revision: string;
  unknown: number;
  readAt: string | null;
  error: string | null;
};
type Dialog = { terminal: string; lines: string[]; readAt: string | null; error: string | null };

const same = (kept: ChatEvent | undefined, event: ChatEvent): boolean => {
  if (!kept) return false;
  const fields = Object.entries(event);
  return (
    fields.length === Object.keys(kept).length &&
    fields.every(([name, value]) => (kept as Record<string, unknown>)[name] === value)
  );
};

export const createCoordinatorReads = ({
  adapter,
  exec,
  now,
  codex,
}: {
  adapter: Pick<Adapter, 'coordinator'>;
  exec: Exec;
  now: () => number;
  codex: () => CodexClient;
}): CoordinatorReads => {
  let last: CoordinatorView = {
    state: 'none',
    kind: null,
    host: null,
    since: null,
    turn: null,
    actions: [...permittedActions.none],
    keys: [],
    sessionId: null,
    readAt: null,
    error: null,
  };
  let lastKey: string | null = null;
  const prefix = randomUUID().slice(0, 8);
  let count = 0;
  let conversation: Conversation | null = null;
  let dialog: Dialog | null = null;
  let client: CodexClient | null = null;
  let reading: Promise<CoordinatorChat> | null = null;

  const view = (terminals: Terminal[] | null): CoordinatorView => {
    const facts = adapter.coordinator();
    if (facts && terminals === null) return { ...last, error: factsFailed };
    const terminal = facts && terminals?.find((each) => each.id === facts.terminal);
    const state = facts && terminal ? coordinatorStateOf(terminal) : 'none';
    const kind = state === 'dialog' ? (terminal?.kind ?? null) : null;
    const key = `${facts?.terminal}|${state}|${kind}`;
    const at = new Date(now()).toISOString();
    last = {
      state,
      kind,
      host: facts && terminal ? facts.host : null,
      since: key === lastKey ? last.since : at,
      turn: terminal?.turn ?? null,
      actions: [...permittedActions[state]],
      keys: state === 'dialog' ? [...coordinatorKeys] : [],
      sessionId: facts && terminal ? facts.terminal : null,
      readAt: at,
      error: null,
    };
    lastKey = key;
    return last;
  };

  const at = () => new Date(now()).toISOString();
  const revision = () => `${prefix}.${++count}`;
  const codexClient = () => {
    client ??= codex();
    return client;
  };

  const readDialog = async (id: string): Promise<Dialog> => {
    const screen = await readHistory(id, 0, exec);
    const kept = dialog?.terminal === id ? dialog : null;
    dialog = screen
      ? { terminal: id, lines: cleanScreen(screen.text, null), readAt: at(), error: null }
      : { terminal: id, lines: kept?.lines ?? [], readAt: kept?.readAt ?? null, error: screenFailed };
    return dialog;
  };

  const readChat = async (
    { host, session, prompt }: { host: Host; session: string | null; prompt: string },
    waiting: boolean,
  ): Promise<Pick<CoordinatorChat, 'chat' | 'readAt' | 'error'>> => {
    if (session === null) return { chat: null, readAt: null, error: null };
    if (host === 'opencode' || !isSessionId(host, session)) return { chat: null, readAt: null, error: badSession };
    if (conversation?.host !== host || conversation.session !== session)
      conversation = {
        host,
        session,
        record:
          host === 'claude' ? createClaudeRecord(session, prompt) : createCodexRecord(session, codexClient(), prompt),
        events: new Map(),
        waiting: false,
        entries: [],
        revision: revision(),
        unknown: 0,
        readAt: null,
        error: null,
      };
    const kept = conversation;
    let changed = false;
    try {
      const { events, unknown } = await kept.record.read();
      for (const event of events) {
        const key = `${event.kind}:${event.id}`;
        if (same(kept.events.get(key), event)) continue;
        kept.events.set(key, event);
        changed = true;
      }
      if (unknown > 0) {
        kept.unknown += unknown;
        console.log(`board: coordinator chat: skipped ${kept.unknown} unknown rows of the record`);
      }
      kept.readAt = at();
      kept.error = null;
    } catch (cause) {
      kept.error = `coordinator: cannot read the session record: ${firstLine(String((cause as Error)?.message ?? cause))}`;
    }
    if (changed || waiting !== kept.waiting) {
      kept.waiting = waiting;
      kept.entries = foldChat([...kept.events.values()], waiting);
      kept.revision = revision();
    }
    return {
      chat: { session, revision: kept.revision, entries: kept.entries },
      readAt: kept.readAt,
      error: kept.error,
    };
  };

  const read = async (): Promise<CoordinatorChat> => {
    const facts = adapter.coordinator();
    if (!facts) return { view: view([]), chat: null, dialog: null, readAt: null, error: null };
    const terminal = await readTerminal(facts.terminal, { exec });
    const current = view(terminal ? [terminal] : null);
    const waiting = current.state === 'dialog';
    if (!waiting) dialog = null;
    const [shown, record] = await Promise.all([waiting ? readDialog(facts.terminal) : null, readChat(facts, waiting)]);
    return {
      view: current,
      dialog: shown && { lines: shown.lines, readAt: shown.readAt, error: shown.error },
      ...record,
    };
  };

  return {
    view,
    chat: async (since) => {
      reading ??= read().finally(() => {
        reading = null;
      });
      const answer = await reading;
      return answer.chat?.revision === since ? { ...answer, chat: { ...answer.chat, entries: null } } : answer;
    },
    close: async () => {
      await reading?.catch(() => {});
      await client?.close();
    },
  };
};
