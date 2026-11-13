import { coordinatorKeys, coordinatorStateOf, permittedActions } from '../lib/coordinator-types.ts';
import { type Exec, readHistory, readTerminal } from '../lib/terminal.ts';
import type { Terminal } from '../lib/terminal-types.ts';
import type { Adapter } from './adapter.ts';
import { cleanScreen } from './place.ts';
import type { CoordinatorText, CoordinatorView } from './types.ts';

const HISTORY_LINES = 200;
const factsFailed = 'coordinator: cannot read the hc facts of the tab Coordinator';
const screenFailed = 'coordinator: cannot read the screen of the tab Coordinator';

export type CoordinatorReads = Readonly<{
  view(terminals: Terminal[] | null): CoordinatorView;
  text(): Promise<CoordinatorText>;
}>;
type Kept = { terminal: string; turn: number; text: string; full: boolean; readAt: string };

export const createCoordinatorReads = ({
  adapter,
  exec,
  now,
}: {
  adapter: Pick<Adapter, 'coordinator'>;
  exec: Exec;
  now: () => number;
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
  let shown: Kept | null = null;
  let history: Kept | null = null;
  let tried: { terminal: string; turn: number } | null = null;
  let loading: { terminal: string; turn: number; screen: Kept } | null = null;
  let reading: Promise<CoordinatorText> | null = null;

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

  const answer = (current: CoordinatorView, kept: Kept): CoordinatorText => {
    shown = kept;
    return { view: current, text: kept.text, full: kept.full, readAt: kept.readAt, error: null };
  };
  const failed = (current: CoordinatorView, terminal: string, error: string): CoordinatorText => {
    const kept = shown?.terminal === terminal ? shown : null;
    return { view: current, text: kept?.text ?? '', full: kept?.full ?? false, readAt: kept?.readAt ?? null, error };
  };

  const read = async (): Promise<CoordinatorText> => {
    const facts = adapter.coordinator();
    if (!facts) return { view: view([]), text: '', full: false, readAt: null, error: null };
    const id = facts.terminal;
    const terminal = await readTerminal(id, { exec });
    if (!terminal) return failed(view(null), id, factsFailed);
    const current = view([terminal]);
    const { turn } = terminal;
    const at = () => new Date(now()).toISOString();
    const visible = async (): Promise<Kept | null> => {
      const screen = await readHistory(id, 0, exec);
      if (!screen) return null;
      return { terminal: id, turn, text: cleanScreen(screen.text, null).join('\n'), full: false, readAt: at() };
    };
    if (current.state === 'turn-ended') {
      if (history?.terminal === id && history.turn === turn) return answer(current, history);
      if (loading?.terminal === id && loading.turn === turn) return answer(current, loading.screen);
      const fresh = !loading && (tried?.terminal !== id || tried.turn !== turn);
      const screen = await visible();
      if (!screen) return failed(current, id, screenFailed);
      if (fresh) {
        tried = { terminal: id, turn };
        loading = { terminal: id, turn, screen };
        void readHistory(id, HISTORY_LINES, exec)
          .then((full) => {
            if (full?.complete)
              history = { terminal: id, turn, text: cleanScreen(full.text, null).join('\n'), full: true, readAt: at() };
          })
          .finally(() => {
            loading = null;
          });
      }
      return answer(current, screen);
    }
    const screen = await visible();
    return screen ? answer(current, screen) : failed(current, id, screenFailed);
  };

  return {
    view,
    text: () => {
      reading ??= read().finally(() => {
        reading = null;
      });
      return reading;
    },
  };
};
