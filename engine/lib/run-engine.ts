import type { Config, Host } from './config-core.ts';
import { type ExitCode, exits } from './contract.ts';
import type { Level, Model } from './effort.ts';
import { HostError } from './errors.ts';
import { recordEvent } from './events.ts';
import { createLockOwner, type Identity, isRecorded, type LockOwner, lockHolder } from './locks.ts';
import { createOperation, type HostSelection, locateCheckouts, type Operation } from './operation.ts';
import { childEnv } from './process.ts';
import { activities, createIo, detachRun, die, failedOf, type Io, type Options, perform } from './run-activities.ts';
import { type Effect, type Event, initial, on, type RunFacts, type State, type Working } from './run-machine.ts';
import type { RunRecord } from './run-record.ts';
import type { RepositoryLayout } from './state.ts';
import { closeTerminal, requireTerminals, TerminalError } from './terminal.ts';
import { versionFolderGone } from './version-folder.ts';
import { autoTakes, defaultGate, type Step } from './workflow.ts';

export type Place = Readonly<{ main: string; common: string; state: RepositoryLayout; root: string }>;
export type RunInput =
  | Readonly<{ kind: 'number'; number: number; selection: HostSelection; effort: Level | null; model: Model | null }>
  | Readonly<{ kind: 'auto'; number: number; selection: HostSelection }>
  | Readonly<{ kind: 'queue'; id: string; token: string; selection: HostSelection }>
  | Readonly<{ kind: 'resume'; number: number; selection: HostSelection }>;
export type RunState =
  | 'starting'
  | 'running'
  | 'checking'
  | 'waiting'
  | 'exiting'
  | 'quota-wait'
  | 'ending'
  | 'taken-over'
  | 'finished';
export type Admission = Readonly<{ ok: true }> | Readonly<{ ok: false; line: string; code: ExitCode }>;
export type RunEnd = Readonly<{ kind: 'closed' | 'gate' | 'stopped' | 'detached'; code: ExitCode; reason: string }>;
export type RunHooks = Readonly<{ ready?: () => Promise<void>; removed: () => void; fatal: () => void }>;
export type RunView = Readonly<{
  issue: number | null;
  numbers: readonly number[] | null;
  step: Step | null;
  host: Host | null;
  tab: string | null;
  state: RunState;
  changedMs: number;
  barrier: Identity | null;
  terminal: string | null;
  turn: number | null;
}>;
export interface RunHandle {
  readonly id: string;
  readonly input: RunInput;
  readonly admitted: Promise<Admission>;
  readonly done: Promise<RunEnd>;
  view(): RunView;
  detach(): void;
}

export { barrierOf, removed } from './run-activities.ts';

export async function requireSetup(gh: boolean): Promise<void> {
  if (gh && !Bun.which('gh', { PATH: childEnv().PATH })) die('gh is not on PATH', exits.prerequisite);
  try {
    await requireTerminals();
  } catch (error) {
    if (!(error instanceof TerminalError)) throw error;
    die(error.message, error.code);
  }
}

type Filter = Options['filter'];
type Tabs = NonNullable<Options['tabs']>;
type Journal = Options['journal'];
type Started = Options & Readonly<{ from?: RunRecord }>;
type Settled = Readonly<{ end: RunEnd; started: boolean }>;

function handled<T>(work: Promise<T>): Promise<T> {
  work.catch(() => {});
  return work;
}

export function createRun(
  place: Place,
  input: RunInput,
  options: { hooks: RunHooks; locks?: LockOwner; journal: Journal; from?: RunRecord },
): RunHandle {
  return begin(place, input, {
    hooks: options.hooks,
    locks: options.locks ?? createLockOwner(place.main),
    filter: { said: '', repeat: input.kind === 'auto' },
    journal: options.journal,
    from: options.from,
  }).handle;
}

type Entry = (state: State, event: Event, run: RunFacts) => Readonly<{ state: State; effects: readonly Effect[] }>;
const act = activities as Record<Working, (state: State, io: Io) => Promise<Event>>;
const table = on as Record<Working, Record<Event['kind'], Entry>>;

function begin(place: Place, input: RunInput, options: Started): { handle: RunHandle; settled: Promise<Settled> } {
  const { from } = options;
  const io = createIo(place, input, options, from);
  const run: RunFacts = { input, shared: io.shared };
  const drive = async (): Promise<Settled> => {
    let located = false;
    let state = initial(input, from);
    while (state.kind !== 'finished') {
      const entries = table[state.kind];
      let event: Event;
      try {
        if (!located) {
          located = true;
          io.checkout = options.checkout ?? (await locateCheckouts(process.cwd()));
        }
        event = await act[state.kind](state, io);
      } catch (error) {
        event = failedOf(io, error);
      }
      let step: ReturnType<Entry>;
      try {
        step = entries[event.kind](state, event, run);
        for (const effect of step.effects) await perform(effect, io);
      } catch (error) {
        step = entries.failed(state, failedOf(io, error), run);
        for (const effect of step.effects) await perform(effect, io);
      }
      state = step.state;
    }
    if (!state.result.ok) throw state.result.error;
    return { end: state.result.end, started: state.result.started };
  };
  const { id, admit, admitted } = io;
  const ended = handled(
    drive().then(
      ({ end, started }) => {
        admit({ ok: false, line: io.told ?? end.reason, code: end.code });
        return { end, started };
      },
      (error: unknown) => {
        admit({ ok: false, line: error instanceof Error ? error.message : String(error), code: exits.internal });
        throw error;
      },
    ),
  );
  const handle: RunHandle = {
    id,
    input,
    admitted,
    done: handled(ended.then((each) => each.end)),
    view: () => Object.freeze({ ...io.shown }),
    detach() {
      detachRun(io);
    },
  };
  return { handle, settled: ended };
}

export function autoLoop(
  place: Place,
  input: { selection: HostSelection },
  options: {
    hooks: RunHooks;
    active: () => boolean;
    signal: AbortSignal;
    launch: <T extends Readonly<{ handle: RunHandle }>>(start: () => T) => T;
    leaving?: () => void;
    journal: Journal;
    adopted?: Promise<ExitCode>;
  },
): { admitted: Promise<Admission>; done: Promise<ExitCode> } {
  const { main, common, root } = place;
  const { hooks, signal } = options;
  const filter: Filter = { said: '', repeat: true };
  const locks = createLockOwner(main);
  let admit: (admission: Admission) => void = () => {};
  const admitted = new Promise<Admission>((done) => {
    admit = done;
  });
  const say = (message: string) => {
    if (message === filter.said) return false;
    filter.said = message;
    console.log(`daemon: ${message}`);
    return true;
  };
  const aborted = new Promise<null>((done) => {
    if (signal.aborted) done(null);
    else signal.addEventListener('abort', () => done(null), { once: true });
  });
  const running = () => !signal.aborted && options.active();
  const tabs: Tabs = { finished: '' };
  const loop = async (): Promise<ExitCode> => {
    try {
      const checkout = await locateCheckouts(process.cwd());
      const fresh = () => createOperation(checkout, input.selection, 'main');
      let initial: Operation | undefined = await fresh();
      await hooks.ready?.();
      const holder = await locks.take('auto');
      if (holder !== null) die(`auto mode of another daemon or its session has PID ${holder}`, exits.prerequisite);
      admit({ ok: true });
      if (options.adopted) {
        const code = await Promise.race([options.adopted, aborted]);
        if (code) return code;
        initial = undefined;
      }
      while (running()) {
        if (await versionFolderGone(root)) {
          hooks.removed();
          await aborted;
          return exits.done;
        }
        const current = initial ?? (await fresh());
        initial = undefined;
        const config = current.mainConfig as Config;
        if (current.choice.kind === 'explicit')
          await (await import('./plugin-policy.ts')).requireUpdatePolicy(current.host, main);
        const { nextOpen } = await import('./resolver.ts');
        const { lineOf } = await import('./lines.ts');
        const { rows, stderr } = await nextOpen(current, signal);
        process.stderr.write(stderr);
        if (signal.aborted) break;
        let started = false;
        if (rows) {
          let pick = 0;
          for (const { number, next } of rows) {
            const n = String(number);
            if (next.kind !== 'run' || (config.gates?.[next.step] ?? defaultGate) !== 'auto') continue;
            if (!autoTakes(config.autoLanes, next)) continue;
            if ((await lockHolder(main, `issue-${n}`)) || (await isRecorded(common, n, lineOf(n, next)))) continue;
            pick = number;
            break;
          }
          if (pick) {
            // No await may come between this check and `launch`, or a signal can miss the run.
            if (!running()) break;
            const start = () =>
              begin(
                place,
                { kind: 'auto', number: pick, selection: input.selection },
                {
                  hooks: { removed: hooks.removed, fatal: hooks.fatal },
                  locks: createLockOwner(main),
                  filter: { said: '', repeat: true },
                  checkout,
                  tabs,
                  journal: options.journal,
                },
              );
            const run = options.launch(start);
            const result = await run.settled;
            if (result.end.code !== exits.done) return result.end.code;
            started = result.started;
          } else say('no auto step can start; auto mode asks again each 60 seconds');
        } else if (say('stop cannot read the open issues from GitHub'))
          recordEvent({ name: 'issues-read', message: 'daemon: stop cannot read the open issues from GitHub' });
        if (!started) {
          const until = performance.now() + 60_000;
          while (running() && performance.now() < until) await Bun.sleep(50);
        }
      }
      return exits.done;
    } catch (error) {
      if (error instanceof HostError) {
        if (error.message) console.error(error.message);
        admit({ ok: false, line: error.message, code: error.code });
        return error.code;
      }
      throw error;
    } finally {
      options.leaving?.();
      const id = tabs.finished;
      tabs.finished = '';
      if (id) await closeTerminal(id);
      await locks.releaseAll();
    }
  };
  const done = handled(
    loop().then(
      (code) => {
        admit({ ok: false, line: '', code });
        return code;
      },
      (error: unknown) => {
        admit({ ok: false, line: error instanceof Error ? error.message : String(error), code: exits.internal });
        throw error;
      },
    ),
  );
  return { admitted, done };
}
