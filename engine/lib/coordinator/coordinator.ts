import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { HostError, unsupported } from '../command/errors.ts';
import { type CheckoutIdentity, createOperation } from '../command/operation.ts';
import { requireContract } from '../contract/check.ts';
import { type ExitCode, exits } from '../contract/contract.ts';
import { daemonArgv } from '../daemon/start.ts';
import {
  type Attention,
  type Authority,
  type CoordinatorAnswer,
  type DaemonAnswer,
  type RunRow,
  type ScreenAnswer,
  type Selection,
  stopLine,
  textLimit,
} from '../daemon/types.ts';
import { hostAvailability } from '../host/host.ts';
import { hostAdapter, writeSessionEnv } from '../host/hosts.ts';
import { interactiveHost } from '../host/interactive.ts';
import { type Host, isHost } from '../host/names.ts';
import { requireUpdatePolicy } from '../plugin/policy.ts';
import { processState } from '../process/identity.ts';
import { run } from '../process/process.ts';
import { barrierOf, type Place, type RunView, requireSetup } from '../run/engine.ts';
import { isSessionId, uuid } from '../state/fields.ts';
import type { Identity } from '../state/locks.ts';
import { type RepositoryLayout, startFiles, writeAtomic } from '../state/state.ts';
import {
  closeTerminal,
  type Exec,
  focusTerminal,
  inSequence,
  interruptTerminal,
  isSafeId,
  openTab,
  pressKeys,
  readHistory,
  readTerminal,
  requestExit,
  type Sent,
  sendText,
  TerminalError,
  terminalState,
} from '../terminal/terminal.ts';
import type { DialogKind, Terminal } from '../terminal/types.ts';
import type { IssueKey } from '../tracker/key.ts';
import { withPluginRead } from '../update/lock.ts';
import type { Step } from '../workflow/workflow.ts';
import {
  type CoordinatorAct,
  type CoordinatorFacts,
  type CoordinatorKey,
  type CoordinatorState,
  coordinatorKeys,
  coordinatorStateOf,
  permittedActions,
} from './types.ts';

export type CoordinatorRecord = Readonly<{
  schema: 2;
  host: Host;
  terminal: string;
  barrier: Identity;
  folder: string;
  token: string;
  session: string | null;
  prompt: string;
  startedAt: number;
}>;
export type RunFacts = Readonly<{
  id: string;
  resume: boolean;
  refused: boolean;
  view: RunView;
  outcome: RunRow['outcome'];
}>;
type Refusal = { accepted: false; line: string; code: ExitCode };
type Said = { status: number; answer: CoordinatorAnswer };
export type Coordinator = Readonly<{
  open(selection: Selection, quiet?: boolean): Promise<Said>;
  facts(): CoordinatorFacts | null;
  act(request: CoordinatorAct): Promise<{ status: number; answer: DaemonAnswer }>;
  attention(id: string): Attention | null;
  read(number: IssueKey): Promise<{ status: number; answer: ScreenAnswer }>;
  send(request: { number: IssueKey; authority: Authority; text: string; token: string }): Promise<{
    status: number;
    answer: DaemonAnswer;
  }>;
  live(): boolean;
  adopt(): Promise<void>;
  watch(): void;
  close(): Promise<void>;
}>;

const tab = 'Coordinator';
const retry = 'check the login files of $SHELL, then run the command again';
const silent = `coordinator: the start barrier of the tab ${tab} did not report; ${retry}`;
const ended = 'daemon: coordinator: the coordinator session ended';
const unreadable = 'coordinator: cannot read the process of the coordinator session; run the command again';
// Above the draft wait of hc (60 s by default), which holds a message and the exit request of Claude.
const draftBound = 90_000;
const noSession = 'coordinator: no coordinator session runs; press Coordinator on the board to start one';
const statusUnread = `coordinator: cannot read the hc status of the tab ${tab}; nothing was sent`;
const actUsage =
  'coordinator: an act is {"kind":"say","text":<text>}, {"kind":"key","key":<key>}, {"kind":"interrupt"}, or {"kind":"end"}';
const keyUsage = `coordinator: a key is one of ${coordinatorKeys.join(', ')}`;
const actNoun: Record<CoordinatorAct['kind'], string> = {
  say: 'a message',
  key: 'a key',
  interrupt: 'an interrupt',
  end: 'an end',
};
export const unknownOutcome: Record<CoordinatorAct['kind'], string> = {
  say: 'coordinator: the outcome of the message is unknown; read the log of the panel before you send again',
  key: 'coordinator: the outcome of the key is unknown; read the log of the panel before you press a key again',
  interrupt:
    'coordinator: the outcome of the interrupt is unknown; read the log of the panel before you interrupt again',
  end: 'coordinator: the outcome of the exit request is unknown; read the log of the panel before you end the session again',
};
const stateWords: Record<Exclude<CoordinatorState, 'none'>, (kind: DialogKind | null) => string> = {
  starting: () => 'starts and reports no status yet',
  dialog: (kind) => `shows a dialog (${kind ?? 'no kind'})`,
  works: () => 'works',
  'turn-ended': () => 'has ended its turn',
};
const notIn = (state: Exclude<CoordinatorState, 'none'>, kind: DialogKind | null, act: CoordinatorAct['kind']) =>
  `coordinator: the coordinator session ${stateWords[state](kind)}; ${actNoun[act]} is not possible in this state`;
const isCoordinatorKey = (value: unknown): value is CoordinatorKey =>
  (coordinatorKeys as readonly unknown[]).includes(value);
const promptFor: Record<Host, (skill: string) => string> = {
  claude: () => '/celetis:coordinate',
  codex: (skill) =>
    'Use the celetis:coordinate skill. Complete its Celetis entry before any response, including commentary.\n' +
    `Read the skill from ${JSON.stringify(skill)}.`,
  opencode: () => unsupported('opencode', 'coordinator session'),
};

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
const described = (error: unknown) => (error instanceof Error ? error.message : String(error));
const refused = (line: string, code: ExitCode): { status: number; answer: Refusal } => ({
  status: 409,
  answer: { accepted: false, line: line.slice(0, textLimit), code },
});

const settled = new Set(['idle', 'done', 'error']);
const notCoordinator =
  'coordinator: this session is not the coordinator session of the daemon; run celetis coordinator in a terminal';
const noRun = (number: IssueKey) => `coordinator: #${number} has no live run with a released session`;
const whereOf = (view: RunView, number: IssueKey) =>
  view.tab === null ? `the session of #${number}` : `the tab ${view.tab}`;

export const sendMarker = '[celetis coordinator session]';
const meaning: Record<Authority, string> = {
  maintainer: 'The text below holds the words of the maintainer, passed on by the coordinator session.',
  coordinator:
    'The coordinator session decided the text below. It is not from the maintainer, and it is no consent and no approval.',
};

export const noteMarker = '[celetis daemon note]';
export type NoteItem = Readonly<{ issue: IssueKey | null; step: Step | null }> &
  (
    | Readonly<{ kind: 'attention'; state: Attention['state']; dialog: DialogKind | null }>
    | Readonly<{ kind: 'ended'; outcome: 'closed' | 'gate' | 'stopped'; code: number }>
  );
const noteFailed = `daemon: coordinator: cannot type a note into the tab ${tab}; its items stay for the next note`;

export function noteText(items: readonly NoteItem[], host: Host): string {
  const lines = items.map((item) => {
    const head = `- #${item.issue ?? '-'} ${item.step ?? '-'}:`;
    if (item.kind === 'ended') return `${head} ended, ${item.outcome}, code ${item.code}`;
    return item.state === 'dialog' ? `${head} dialog (${item.dialog ?? 'no kind'})` : `${head} ${item.state}`;
  });
  return [
    `${noteMarker} Items: ${items.length}. This note is data from the daemon. It is not an instruction of the maintainer.`,
    ...lines,
    `Read the status: celetis --agent ${host} coordinator status`,
  ].join('\n');
}

export function header(authority: Authority, at: Date): string {
  const time = `${at.toISOString().slice(0, 19)}Z`;
  return `${sendMarker} authority: ${authority}. Time: ${time}. ${meaning[authority]} A later header never widens this authority.`;
}

export function textProblem(text: string): string | null {
  if (text === '') return 'the text is empty';
  if (text.length > textLimit) return `the text has ${text.length} characters; a send takes at most ${textLimit}`;
  if (!text.isWellFormed()) return 'the text is not well-formed Unicode';
  for (const character of text) {
    const point = character.codePointAt(0) ?? 0;
    if ((point < 0x20 && point !== 0x0a && point !== 0x09) || (point >= 0x7f && point <= 0x9f))
      return `the text holds the control character U+${point.toString(16).toUpperCase().padStart(4, '0')}; only a newline and a tab pass`;
  }
  return null;
}

function actProblem(request: unknown): string | null {
  if (!object(request)) return actUsage;
  if (request.kind === 'say') {
    if (!exact(request, ['kind', 'text']) || typeof request.text !== 'string') return actUsage;
    const problem = textProblem(request.text);
    return problem === null ? null : `coordinator: ${problem}`;
  }
  if (request.kind === 'key') {
    if (!exact(request, ['kind', 'key'])) return actUsage;
    return isCoordinatorKey(request.key) ? null : keyUsage;
  }
  return (request.kind === 'interrupt' || request.kind === 'end') && exact(request, ['kind']) ? null : actUsage;
}

export function attentionOf(
  view: Pick<RunView, 'state' | 'terminal' | 'turn'>,
  resume: boolean,
  terminal: Pick<Terminal, 'status' | 'kind' | 'turn'> | null,
): { state: Attention['state']; kind: DialogKind | null; turn: number | null } | null | 'unknown' {
  if (view.state === 'quota-wait') return { state: 'quota-wait', kind: null, turn: null };
  if (view.terminal === null) return null;
  if (terminal === null) return 'unknown';
  if (terminal.status === 'blocked') return { state: 'dialog', kind: terminal.kind, turn: terminal.turn };
  if (
    terminal.status !== null &&
    settled.has(terminal.status) &&
    ((view.state === 'waiting' && view.turn === terminal.turn) || (resume && view.state === 'running'))
  )
    return { state: 'turn-ended', kind: null, turn: terminal.turn };
  return null;
}

const recordNames = ['schema', 'host', 'terminal', 'barrier', 'folder', 'token', 'session', 'prompt', 'startedAt'];

export function parseCoordinatorRecord(value: unknown, layout: RepositoryLayout): CoordinatorRecord | null {
  if (!object(value) || !exact(value, recordNames)) return null;
  const { schema, host, terminal, barrier, folder, token, session, prompt, startedAt } = value;
  if (schema !== 2 || !isHost(host) || !isSafeId(terminal) || !object(barrier) || !exact(barrier, ['pid', 'start']))
    return null;
  const { pid, start } = barrier;
  if (typeof pid !== 'number' || !Number.isSafeInteger(pid) || pid <= 0 || typeof start !== 'string' || !start)
    return null;
  // The daemon removes this folder, so it must be one start folder of the layout and nothing above it.
  if (
    typeof folder !== 'string' ||
    !folder.startsWith(layout.startPrefix) ||
    !/^[\w-]+$/.test(folder.slice(layout.startPrefix.length))
  )
    return null;
  if (typeof token !== 'string' || !uuid.test(token)) return null;
  if (session !== null && !isSessionId(host, session)) return null;
  if (typeof prompt !== 'string' || !prompt) return null;
  if (typeof startedAt !== 'number' || !Number.isSafeInteger(startedAt) || startedAt <= 0) return null;
  return { schema: 2, host, terminal, barrier: { pid, start }, folder, token, session, prompt, startedAt };
}

export function createCoordinator(
  place: Place,
  checkout: CheckoutIdentity,
  runs: () => readonly RunFacts[],
  exec: Exec = run,
): Coordinator {
  const { main, common, state, root } = place;
  const path = state.coordinator;
  let current: CoordinatorRecord | null = null;
  let forgetting: Promise<void> = Promise.resolve();
  let writing: Promise<unknown> = Promise.resolve();
  let claiming: Promise<void> | null = null;
  let unclaimable: CoordinatorRecord | null = null;
  let opening: Promise<unknown> = Promise.resolve();
  let watching: Promise<void> = Promise.resolve();
  const attentions = new Map<string, { key: string; value: Attention | null }>();
  const items = new Map<string, NoteItem>();
  const reported = new Set<string>();
  let failing = false;
  let acting = 0;
  const halt = new AbortController();
  const stopped = () => {
    if (halt.signal.aborted) throw new HostError(stopLine, exits.prerequisite);
  };

  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = writing.then(work);
    writing = next.catch(() => {});
    return next;
  };
  const holds = (record: CoordinatorRecord) => current?.token === record.token;
  const remove = (record: CoordinatorRecord) =>
    serial(async () => {
      await rm(path, { force: true });
      await rm(record.folder, { recursive: true, force: true });
    });
  const forget = (record: CoordinatorRecord): Promise<void> => {
    if (!holds(record)) return forgetting;
    current = null;
    items.clear();
    console.log(ended);
    forgetting = remove(record).catch((error: unknown) =>
      console.error(`daemon: coordinator: cannot remove ${path}: ${described(error)}`),
    );
    return forgetting;
  };

  const waitBarrier = async (folder: string, terminal: string): Promise<Identity> => {
    const began = performance.now();
    let checked = began;
    for (;;) {
      stopped();
      const source = await readFile(startFiles(folder).pid, 'utf8').catch(() => null);
      const read = source === null ? 'unknown' : await barrierOf(source);
      if (read !== 'unknown') {
        if (read === null) throw new HostError(silent, exits.blocked);
        return read;
      }
      const now = performance.now();
      if (now - checked >= 1000) {
        checked = now;
        if ((await terminalState(terminal, exec)) === 'ended')
          throw new HostError(
            `coordinator: the tab ${tab} ended before its start barrier reported; ${retry}`,
            exits.blocked,
          );
      }
      if (now - began >= 60_000) throw new HostError(silent, exits.blocked);
      await pause(250, undefined, { signal: halt.signal }).catch(() => {});
    }
  };

  const start = async (selection: Selection, quiet: boolean): Promise<Said> => {
    const operation = await createOperation(checkout, selection, 'main');
    const host = await interactiveHost(operation, 'coordinator', 'coordinator');
    const adapter = hostAdapter(host);
    await adapter.checkHome();
    await withPluginRead(host, () => requireUpdatePolicy(host, main));
    const availability = hostAvailability(host);
    if (!availability.available) throw new HostError(availability.cause, exits.prerequisite);
    const plugin = await requireContract(host, main);
    const skill = join(plugin, 'skills/coordinate/SKILL.md');
    if (!(await stat(skill).catch(() => null))?.isFile())
      throw new HostError(`coordinator: cannot read the coordinator skill: ${skill}`, exits.prerequisite);
    await requireSetup(false);
    stopped();
    const token = randomUUID();
    const folder = await mkdtemp(state.startPrefix);
    let terminal = '';
    let written = false;
    try {
      try {
        await writeSessionEnv(host, { plugin: async () => plugin, folder, stepText: null });
      } catch (error) {
        throw new HostError(
          `coordinator: cannot prepare the session environment: ${described(error)}`,
          error instanceof HostError ? error.code : exits.blocked,
        );
      }
      const session = adapter.startId();
      const startedAt = Math.floor(Date.now() / 1000);
      const args = [
        ...(session === null ? [] : adapter.sessionArguments(session)),
        ...adapter.interactiveArguments(tab, promptFor[host](skill), randomUUID()),
      ];
      const prompt = args.at(-1) ?? '';
      const argv = daemonArgv(root, [
        '--session-start',
        folder,
        String(process.pid),
        host,
        '-',
        '-',
        ...(await adapter.pin(main)),
        ...args,
      ]);
      const env = { BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', DO_NOT_TRACK: '1', CELETIS_COORDINATOR: token };
      try {
        terminal = await openTab(
          { repository: { main, common }, folder: main, name: tab, argv, env, focus: !quiet, keepShell: false },
          exec,
        );
      } catch (error) {
        if (!(error instanceof TerminalError)) throw error;
        throw new HostError(`coordinator: cannot open the tab ${tab}: ${error.message}`, error.code);
      }
      const record: CoordinatorRecord = {
        schema: 2,
        host,
        terminal,
        barrier: await waitBarrier(folder, terminal),
        folder,
        token,
        session,
        prompt,
        startedAt,
      };
      try {
        written = true;
        await serial(() => writeAtomic(path, `${JSON.stringify(record)}\n`));
        await writeFile(startFiles(folder).go, '');
      } catch (error) {
        throw new HostError(
          `coordinator: cannot write the coordinator record ${path}: ${described(error)}`,
          exits.blocked,
        );
      }
      current = record;
    } catch (error) {
      if (written) await serial(() => rm(path, { force: true }));
      if (terminal) await closeTerminal(terminal, exec);
      await rm(folder, { recursive: true, force: true });
      throw error;
    }
    console.log(`daemon: coordinator: opened a ${host} session in the tab ${tab}`);
    return { status: 200, answer: { accepted: true, opened: true } };
  };

  const openOnce = async (selection: Selection, quiet: boolean): Promise<Said> => {
    if (halt.signal.aborted) return refused(stopLine, exits.prerequisite);
    await forgetting;
    const record = current;
    if (record) {
      const seen = await processState(record.barrier.pid, record.barrier.start);
      if (seen === 'unknown') return refused(unreadable, exits.blocked);
      if (seen === 'runs') {
        if (!quiet)
          try {
            await focusTerminal(record.terminal, exec);
          } catch (error) {
            if (!(error instanceof TerminalError)) throw error;
            return refused(`coordinator: cannot bring the tab ${tab} to the front: ${error.message}`, exits.blocked);
          }
        return { status: 200, answer: { accepted: true, opened: false } };
      }
      await forget(record);
    }
    try {
      return await start(selection, quiet);
    } catch (error) {
      if (!(error instanceof HostError)) throw error;
      return refused(error.message, error.code);
    }
  };

  const observe = async () => {
    const facts = runs();
    const reads = await Promise.all(
      facts.map(async (fact) => {
        const { view, resume } = fact;
        const terminal = view.terminal === null ? null : await readTerminal(view.terminal, { exec }).catch(() => null);
        let found = attentionOf(view, resume, terminal);
        if (found === 'unknown' && view.terminal !== null && (await terminalState(view.terminal, exec)) === 'ended')
          found = null;
        return { fact, found };
      }),
    );
    const ids = new Set(facts.map(({ id }) => id));
    for (const id of [...attentions.keys(), ...reported])
      if (!ids.has(id)) {
        attentions.delete(id);
        reported.delete(id);
        items.delete(`attention:${id}`);
        items.delete(`ended:${id}`);
      }
    if (current === null) items.clear();
    for (const { fact, found } of reads) {
      const { id, view } = fact;
      if (found === 'unknown') continue;
      const key = found === null ? '' : `${found.state}:${found.kind}:${found.turn}`;
      if (attentions.get(id)?.key === key) continue;
      attentions.set(id, {
        key,
        value: found === null ? null : { state: found.state, kind: found.kind, changedMs: Date.now() },
      });
      items.delete(`attention:${id}`);
      if (found !== null && current !== null)
        items.set(`attention:${id}`, {
          kind: 'attention',
          issue: view.issue,
          step: view.step,
          state: found.state,
          dialog: found.kind,
        });
    }
    for (const { id, view, refused, outcome } of facts) {
      if (outcome === null || reported.has(id)) continue;
      reported.add(id);
      if (!refused && current !== null)
        items.set(`ended:${id}`, {
          kind: 'ended',
          issue: view.issue,
          step: view.step,
          outcome: outcome.kind,
          code: outcome.code,
        });
    }
  };
  const deliver = async () => {
    const record = current;
    // A note never waits behind an act in flight, so a stop of the daemon does not wait for that act.
    if (record === null || items.size === 0 || acting > 0) return;
    const due = [...items];
    await inSequence(record.terminal, async () => {
      const seen = await readTerminal(record.terminal, { exec }).catch(() => null);
      if (!seen?.status || !settled.has(seen.status)) return;
      const text = noteText(
        due.map(([, item]) => item),
        record.host,
      );
      const sent = await sendText(record.terminal, text, { exec }).catch(() => 'unknown' as const);
      if (sent === 'sent') {
        failing = false;
        for (const [key] of due) items.delete(key);
      } else if (!failing) {
        failing = true;
        console.error(noteFailed);
      }
    });
  };
  const identify = async (record: CoordinatorRecord) => {
    const adapter = hostAdapter(record.host);
    const claim = await adapter.claim(main, record.prompt, '', record.startedAt);
    if (claim.kind === 'many') {
      unclaimable = record;
      console.error(
        `daemon: coordinator: more than one ${record.host} session matches the prompt of the coordinator session; the daemon asks no more for its ID`,
      );
      return;
    }
    if (claim.kind === 'none' || !(await adapter.verifySession(main, claim.id, record.startedAt))) return;
    const next: CoordinatorRecord = { ...record, session: claim.id };
    const named = await serial(async () => {
      if (current !== record) return false;
      await writeAtomic(path, `${JSON.stringify(next)}\n`);
      if (current !== record) return false;
      current = next;
      return true;
    });
    if (named) console.log(`daemon: coordinator: the ${record.host} session has the ID ${claim.id}`);
  };
  const pass = async () => {
    const record = current;
    if (record && (await processState(record.barrier.pid, record.barrier.start)) === 'gone') await forget(record);
    await observe();
    await deliver();
    const unnamed = current;
    if (unnamed?.session === null && claiming === null && unclaimable !== unnamed)
      claiming = identify(unnamed)
        .catch((error: unknown) => console.error(`daemon: coordinator: ${described(error)}`))
        .finally(() => {
          claiming = null;
        });
  };
  const watch = async () => {
    while (!halt.signal.aborted) {
      await pass().catch((error: unknown) => console.error(`daemon: coordinator: ${described(error)}`));
      await pause(2000, undefined, { signal: halt.signal }).catch(() => {});
    }
  };

  const press = async (record: CoordinatorRecord, request: CoordinatorAct): Promise<Sent> => {
    switch (request.kind) {
      case 'say':
        return sendText(record.terminal, request.text, { exec, timeout: draftBound });
      case 'key':
        return pressKeys(record.terminal, [request.key], exec);
      case 'interrupt':
        return interruptTerminal(record.terminal, exec);
      case 'end':
        return (await requestExit(record.terminal, record.host, undefined, exec, draftBound)) ? 'sent' : 'unknown';
    }
  };
  const actOn = async (
    record: CoordinatorRecord,
    request: CoordinatorAct,
  ): Promise<{ status: number; answer: DaemonAnswer }> => {
    if (!holds(record)) return refused(noSession, exits.prerequisite);
    const barrier = await processState(record.barrier.pid, record.barrier.start);
    if (barrier === 'gone') return refused(noSession, exits.prerequisite);
    if (barrier === 'unknown') return refused(unreadable, exits.blocked);
    const seen = await readTerminal(record.terminal, { exec }).catch(() => null);
    if (seen === null) return refused(statusUnread, exits.blocked);
    const state = coordinatorStateOf(seen);
    if (!permittedActions[state].includes(request.kind))
      return refused(notIn(state, seen.kind, request.kind), exits.prerequisite);
    const what =
      request.kind === 'say'
        ? `say, ${request.text.length} characters`
        : request.kind === 'key'
          ? `key, ${request.key}`
          : request.kind;
    const sent = await press(record, request).catch(() => 'unknown' as const);
    if (sent === 'sent') {
      console.log(`daemon: coordinator: board: ${what}`);
      return { status: 200, answer: { accepted: true, run: null } };
    }
    if (sent === 'blocked') {
      const kind = (await readTerminal(record.terminal, { exec }).catch(() => null))?.kind ?? null;
      return refused(notIn('dialog', kind, request.kind), exits.prerequisite);
    }
    if (sent === 'gone') return refused(noSession, exits.prerequisite);
    console.log(`daemon: coordinator: board: ${what}; the outcome is unknown`);
    return refused(unknownOutcome[request.kind], exits.blocked);
  };

  return {
    open: (selection, quiet = false) => {
      const next = opening.then(() => openOnce(selection, quiet));
      opening = next.catch(() => {});
      return next;
    },
    facts: () =>
      current === null
        ? null
        : { host: current.host, terminal: current.terminal, session: current.session, prompt: current.prompt },
    act: async (request) => {
      const problem = actProblem(request);
      if (problem !== null) return { status: 400, answer: { accepted: false, line: problem, code: exits.usage } };
      const record = current;
      if (!record) return refused(noSession, exits.prerequisite);
      acting += 1;
      try {
        return await inSequence(record.terminal, () => actOn(record, request));
      } finally {
        acting -= 1;
      }
    },
    attention: (id) => attentions.get(id)?.value ?? null,
    read: async (number) => {
      const view = runs().find((each) => each.view.issue === number && each.view.terminal !== null)?.view;
      if (!view?.terminal) return refused(`coordinator: #${number} has no live run session`, exits.prerequisite);
      const screen = await readHistory(view.terminal, 200, exec);
      if (screen === null)
        return refused(`coordinator: cannot read the screen of ${whereOf(view, number)}`, exits.blocked);
      return { status: 200, answer: { accepted: true, ...screen } };
    },
    send: async ({ number, authority, text, token }) => {
      const record = current;
      if (!record || token !== record.token) return refused(notCoordinator, exits.prerequisite);
      if ((await processState(record.barrier.pid, record.barrier.start)) === 'gone')
        return refused(notCoordinator, exits.prerequisite);
      const problem = textProblem(text);
      if (problem !== null)
        return { status: 400, answer: { accepted: false, line: `coordinator: ${problem}`, code: exits.usage } };
      const facts = runs();
      const found =
        facts.find(({ view }) => view.issue === number && view.terminal !== null) ??
        facts.findLast(({ view }) => view.issue === number && view.state !== 'finished');
      if (!found) return refused(noRun(number), exits.prerequisite);
      const { terminal, state } = found.view;
      if (terminal === null)
        return refused(
          state === 'quota-wait'
            ? `coordinator: the run of #${number} waits for a usage limit; no session takes a text`
            : state === 'ending'
              ? `coordinator: the run of #${number} ends; no session takes a text`
              : `coordinator: the run of #${number} starts; no session takes a text`,
          exits.prerequisite,
        );
      return inSequence(terminal, async () => {
        const view = runs().find(({ id }) => id === found.id)?.view;
        if (view?.terminal !== terminal) return refused(noRun(number), exits.prerequisite);
        if (view.state === 'exiting')
          return refused(
            `coordinator: the daemon ends the session of #${number} with its exit request; no text is sent`,
            exits.prerequisite,
          );
        const dialog = (kind: DialogKind | null) =>
          refused(
            `coordinator: the session of #${number} shows a dialog (${kind ?? 'no kind'}); answer it in ${whereOf(view, number)}`,
            exits.prerequisite,
          );
        const seen = await readTerminal(terminal, { exec }).catch(() => null);
        if (!seen || seen.status === null)
          return refused(
            `coordinator: cannot read the hc status of ${whereOf(view, number)}; nothing was sent`,
            exits.blocked,
          );
        if (seen.status === 'blocked') return dialog(seen.kind);
        if (seen.host === null)
          return refused(
            `coordinator: the session of #${number} has no live host in ${whereOf(view, number)}; no text is sent`,
            exits.prerequisite,
          );
        const sent = await sendText(terminal, `${header(authority, new Date())}\n${text}`, { exec }).catch(
          () => 'unknown' as const,
        );
        const what = `#${number}${view.step === null ? '' : ` ${view.step}`} as ${authority}, ${text.length} characters`;
        if (sent === 'sent') {
          console.log(`daemon: coordinator: sent to ${what}`);
          return { status: 200, answer: { accepted: true, run: null } };
        }
        if (sent === 'blocked') return dialog((await readTerminal(terminal, { exec }).catch(() => null))?.kind ?? null);
        if (sent === 'gone') return refused(noRun(number), exits.prerequisite);
        console.log(`daemon: coordinator: the outcome of a send to ${what}, is unknown`);
        return refused(
          `coordinator: the outcome of the send to #${number} is unknown; read its screen before you send again: celetis --agent ${record.host} coordinator read ${number}`,
          exits.blocked,
        );
      });
    },
    live: () => current !== null,
    adopt: async () => {
      let text: string | null = null;
      try {
        text = await readFile(path, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          console.error(`daemon: coordinator: ${path} is no valid coordinator record: ${described(error)}`);
      }
      if (text !== null) {
        let value: unknown;
        let cause = 'its fields are not valid';
        try {
          value = JSON.parse(text);
        } catch {
          cause = 'it is no JSON';
        }
        const record = parseCoordinatorRecord(value, state);
        if (record === null) console.error(`daemon: coordinator: ${path} is no valid coordinator record: ${cause}`);
        else {
          const seen = await processState(record.barrier.pid, record.barrier.start);
          if (seen === 'gone') await remove(record);
          else {
            current = record;
            if (seen === 'runs')
              console.log(`daemon: coordinator: took over the ${record.host} session in the tab ${tab}`);
          }
        }
      }
    },
    watch: () => {
      watching = watch();
    },
    close: async () => {
      halt.abort();
      await watching;
      await opening;
      await claiming;
    },
  };
}
