import { readFile } from 'node:fs/promises';
import {
  type DaemonAnswer,
  type DaemonIdentity,
  type DaemonRequest,
  type DaemonStatus,
  daemonPaths,
  parseAnswer,
  parseIdentity,
  parseStatus,
} from './daemon-types.ts';
import { HostError } from './host.ts';
import { processScript, processState } from './process-identity.ts';

export type Found =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'runs'; identity: DaemonIdentity }>
  | Readonly<{ kind: 'unknown'; reason: string }>;

const none: Found = { kind: 'none' };
const unreadable = (reason: string): Found => ({ kind: 'unknown', reason });

export async function findDaemon(common: string): Promise<Found> {
  let text: string;
  try {
    text = await readFile(daemonPaths(common).identity, 'utf8');
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
  const script = await processScript(identity.pid, 'celetis-flow.ts');
  if (script === 'gone') return none;
  if (script === 'unknown') return unreadable(`the command of PID ${identity.pid} cannot be read`);
  return { kind: 'runs', identity };
}

async function call(common: string, path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(`http://daemon${path}`, { ...init, signal, unix: daemonPaths(common).socket });
  } catch (error) {
    throw new HostError(
      `daemon: the daemon of this repository does not answer: ${error instanceof Error ? error.message : String(error)}`,
      6,
    );
  }
}

async function json(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new HostError(`daemon: the daemon sent an invalid answer (status ${response.status})`, 6);
  }
}

export async function sendRequest(
  common: string,
  request: Exclude<DaemonRequest, { kind: 'status' }>,
  signal?: AbortSignal,
): Promise<DaemonAnswer> {
  const { kind, ...fields } = request;
  const response = await call(
    common,
    `/${kind}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fields) },
    signal,
  );
  return parseAnswer(await json(response));
}

export async function readStatus(common: string, signal?: AbortSignal): Promise<DaemonStatus> {
  const response = await call(common, '/status', { method: 'GET' }, signal);
  const value = await json(response);
  if (response.status !== 200)
    throw new HostError(`daemon: the daemon answered status ${response.status} to the status request`, 6);
  return parseStatus(value);
}
