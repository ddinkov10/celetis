import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { HostError } from '../command/errors.ts';
import { type ExitCode, exits } from '../contract/contract.ts';
import { selectHost } from '../host/host.ts';
import { daemonScript, processScript, processState } from '../process/identity.ts';
import { privateFolderProblem } from '../process/windows.ts';
import { engineRevision } from '../release/release.ts';
import { daemonSockets } from '../state/state.ts';
import {
  type DaemonAnswer,
  type DaemonIdentity,
  type DaemonRequest,
  type DaemonStatus,
  daemonPaths,
  daemonSocket,
  parseAnswer,
  parseIdentity,
  parseStatus,
  requestPaths,
  type Selection,
} from './types.ts';

export type Found =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'runs'; identity: DaemonIdentity }>
  | Readonly<{ kind: 'unknown'; reason: string }>;

const none: Found = { kind: 'none' };
const unreadable = (reason: string): Found => ({ kind: 'unknown', reason });

export async function findDaemon(common: string): Promise<Found> {
  const { identity: file } = await daemonPaths(common);
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? none : unreadable(String(error));
  }
  let identity: DaemonIdentity;
  try {
    identity = parseIdentity(JSON.parse(text));
  } catch {
    return none;
  }
  const state = await processState(identity.pid, identity.start);
  if (state === 'gone') return none;
  if (state === 'unknown') return unreadable(`the process table does not show PID ${identity.pid}`);
  const script = await processScript(identity.pid, daemonScript);
  if (script === 'gone') return none;
  if (script === 'unknown') return unreadable(`the command of PID ${identity.pid} cannot be read`);
  if (process.platform === 'win32') {
    const refusal = socketFolderRefusal(privateFolderProblem(daemonSockets.path));
    if (refusal) throw refusal;
  }
  return { kind: 'runs', identity };
}

export async function liveRevisions(): Promise<ReadonlySet<string> | null> {
  let names: string[];
  try {
    names = await readdir(daemonSockets.path);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? new Set() : null;
  }
  const revisions = await Promise.all(
    names
      .filter((name) => name.endsWith('.sock'))
      .map(async (name) => {
        try {
          const response = await fetch('http://daemon/status', {
            unix: join(daemonSockets.path, name),
            signal: AbortSignal.timeout(5000),
          });
          return parseStatus(await response.json()).daemon.revision;
        } catch (error) {
          const code = (error as { code?: unknown }).code;
          return code === 'ENOENT' || code === 'ECONNREFUSED' ? '' : null;
        }
      }),
  );
  const live = new Set<string>();
  for (const revision of revisions) {
    if (revision === null) return null;
    if (revision) live.add(revision);
  }
  return live;
}

export function socketFolderRefusal(reason: string | null): HostError | null {
  return reason === null
    ? null
    : new HostError(
        `daemon: ${daemonSockets.path}: another user can reach this folder (${reason}); only the current user, SYSTEM, and the administrators may have access`,
        exits.prerequisite,
      );
}

async function call(common: string, path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(`http://daemon${path}`, { ...init, signal, unix: daemonSocket(common) });
  } catch (error) {
    throw new HostError(
      `daemon: the daemon of this repository does not answer: ${error instanceof Error ? error.message : String(error)}`,
      exits.blocked,
    );
  }
}

async function json(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new HostError(`daemon: the daemon sent an invalid answer (status ${response.status})`, exits.blocked);
  }
}

export async function sendRequest(
  common: string,
  request: Exclude<
    DaemonRequest,
    {
      kind:
        | 'status'
        | 'queue-action'
        | 'queue-reconcile'
        | 'land'
        | 'coordinator-open'
        | 'coordinator-read'
        | 'coordinator-send'
        | 'coordinator-end-assist';
    }
  >,
  signal?: AbortSignal,
): Promise<DaemonAnswer> {
  const { kind, ...fields } = request;
  const response = await call(
    common,
    requestPaths[kind],
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fields) },
    signal,
  );
  return parseAnswer(await json(response));
}

export async function readStatus(common: string, signal?: AbortSignal): Promise<DaemonStatus> {
  const response = await call(common, '/status', { method: 'GET' }, signal);
  const value = await json(response);
  if (response.status !== 200)
    throw new HostError(`daemon: the daemon answered status ${response.status} to the status request`, exits.blocked);
  return parseStatus(value);
}

export const shortRevision = (revision: string) => revision.slice(0, 12);

export function requestSelection(explicit: string | undefined): Selection {
  const environment = process.env.CELETIS_AGENT;
  return {
    ...(explicit === undefined ? {} : { explicit: selectHost(explicit) }),
    ...(environment === undefined ? {} : { environment }),
  };
}

type Prefix = 'run' | 'queue' | 'daemon' | 'land' | 'land: blocked' | 'coordinator';

export const unanswered = (prefix: Prefix, reason: string) =>
  `${prefix}: the daemon of this repository does not answer: ${reason}; read celetis daemon status`;
export const unknownOutcome = (prefix: Prefix, cause: string) =>
  new HostError(
    `${prefix}: the outcome of the request is unknown: ${cause}; read celetis daemon status`,
    exits.blocked,
  );

export async function requireDaemon(common: string, prefix: Prefix): Promise<DaemonIdentity> {
  const found = await findDaemon(common);
  if (found.kind === 'none')
    throw new HostError(
      `${prefix}: no daemon runs for this repository; start it: celetis daemon start`,
      exits.prerequisite,
    );
  if (found.kind === 'unknown') throw new HostError(unanswered(prefix, found.reason), exits.blocked);
  const restart = await revisionRefusal(found.identity, prefix);
  if (restart !== null) throw new HostError(restart, exits.prerequisite);
  return found.identity;
}

export async function revisionRefusal(identity: DaemonIdentity, prefix: Prefix): Promise<string | null> {
  const own = await engineRevision(resolve(import.meta.dir, '../../..'));
  return own === identity.revision
    ? null
    : `${prefix}: the daemon runs the engine at ${shortRevision(identity.revision)} and this engine is at ${shortRevision(own)}; restart it: celetis daemon stop, then celetis daemon start`;
}

export async function askDaemon(
  common: string,
  request: Exclude<
    DaemonRequest,
    {
      kind:
        | 'status'
        | 'stop'
        | 'queue-action'
        | 'queue-reconcile'
        | 'land'
        | 'coordinator-open'
        | 'coordinator-read'
        | 'coordinator-send'
        | 'coordinator-end-assist';
    }
  >,
  prefix: Prefix,
): Promise<Readonly<{ identity: DaemonIdentity; answer: DaemonAnswer }>> {
  const identity = await requireDaemon(common, prefix);
  try {
    return { identity, answer: await sendRequest(common, request, AbortSignal.timeout(120_000)) };
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    throw unknownOutcome(prefix, error.message);
  }
}

export async function askCoordinator<T>(
  common: string,
  request: Extract<
    DaemonRequest,
    { kind: 'coordinator-open' | 'coordinator-read' | 'coordinator-send' | 'coordinator-end-assist' }
  >,
  parse: (value: unknown) => T,
): Promise<Readonly<{ identity: DaemonIdentity; answer: T }>> {
  const identity = await requireDaemon(common, 'coordinator');
  const { kind, ...fields } = request;
  try {
    const response = await call(
      common,
      requestPaths[kind],
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fields) },
      AbortSignal.timeout(120_000),
    );
    return { identity, answer: parse(await json(response)) };
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    throw unknownOutcome('coordinator', error.message);
  }
}

export async function sendRun(
  common: string,
  request: Extract<DaemonRequest, { kind: 'run' | 'resume' | 'assist' | 'queue' }>,
  prefix: 'run' | 'queue',
  subject: string,
): Promise<ExitCode> {
  const { identity, answer } = await askDaemon(common, request, prefix);
  if (!answer.accepted) {
    (answer.code === exits.done ? console.log : console.error)(answer.line);
    return answer.code;
  }
  if (answer.run === null) throw unknownOutcome(prefix, 'daemon: the daemon sent no run ID');
  console.log(
    `${prefix}: ${subject}: accepted as run ${answer.run.slice(0, 8)} of the daemon PID ${identity.pid}; read its progress: celetis daemon status`,
  );
  return exits.done;
}
