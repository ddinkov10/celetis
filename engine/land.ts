import { constants } from 'node:os';
import { format } from 'node:util';
import { HostError } from './lib/command/errors.ts';
import { commandInput, locateCheckouts } from './lib/command/operation.ts';
import { classOf, type ExitClass, type ExitCode, exits, signalExit, usage } from './lib/contract/contract.ts';
import { type Found, findDaemon, requestSelection, revisionRefusal, unanswered } from './lib/daemon/client.ts';
import { daemonSocket, landingSubject, parseAnswer, parseLandingRecord } from './lib/daemon/types.ts';
import { requireCan } from './lib/host/hosts.ts';
import { isHost } from './lib/host/names.ts';
import { described, type Landing, lockedLanding } from './lib/landing/landing.ts';
import { run } from './lib/process/process.ts';
import { installRecorder, markDefect, recordEvent, recordedElsewhere, writeUnrecorded } from './lib/state/events.ts';
import { createLockOwner } from './lib/state/locks.ts';
import { parseHandle } from './lib/tracker/key.ts';

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const { args, explicit } = commandInput(argv);
    return await execute(args, explicit);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

async function execute(argv: string[], explicit: string | undefined): Promise<ExitCode> {
  const key = parseHandle(argv[0] ?? '');
  const subject = argv[1] ?? '';
  if (argv.length !== 2 || key === null || !landingSubject(key, subject)) {
    console.error(usage('land'));
    return exits.usage;
  }
  let main: string;
  let common: string;
  let from: string;
  try {
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null)
      throw new HostError('celetis: need a Git checkout', exits.usage);
    main = checkout.main;
    common = checkout.common;
    const top = await run('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
    if (top.code !== 0) throw new HostError(top.stderr.trimEnd(), exits.blocked);
    from = top.stdout.trimEnd();
  } catch (error) {
    markDefect(error);
    if (!(error instanceof HostError)) {
      console.error(error instanceof Error ? error.message : String(error));
      return exits.internal;
    }
    const outcome: ExitClass = error.code === exits.usage ? 'usage' : 'blocked';
    console.error(`land: ${outcome}: ${error.message}`);
    return exits[outcome];
  }
  const selection = requestSelection(explicit);
  const chosen = selection.explicit ?? selection.environment;
  if (isHost(chosen)) requireCan(chosen, { kind: 'landing', command: 'land' }, 'celetis');
  let found: Found;
  try {
    found = await findDaemon(common);
    if (found.kind === 'unknown') throw new HostError(unanswered('land', found.reason), exits.blocked);
    const restart = found.kind === 'runs' ? await revisionRefusal(found.identity, 'land') : null;
    if (restart !== null) throw new HostError(restart, exits.prerequisite);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    console.error(`land: ${classOf(error.code)}: ${error.message.replace(/^land: /, '')}`);
    return error.code;
  }
  if (found.kind === 'none') return await landDirectly({ number: key, subject, selection, from }, main);
  const abort = new AbortController();
  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      abort.abort();
      process.exit(signalExit(constants.signals[signal]));
    });
  let response: Response;
  try {
    response = await fetch('http://daemon/land', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ number: key, subject, selection, from }),
      signal: abort.signal,
      unix: daemonSocket(common),
    });
  } catch (error) {
    console.error(unanswered('land: blocked', error instanceof Error ? error.message : String(error)));
    return exits.blocked;
  }
  if (response.status !== 200) {
    const answer = await response
      .json()
      .then(parseAnswer)
      .catch(() => null);
    if (answer === null || answer.accepted) {
      console.error(`land: blocked: daemon: the daemon sent an invalid answer (status ${response.status})`);
      return exits.blocked;
    }
    console.error(response.status === 503 ? `land: blocked: ${answer.line}` : answer.line);
    return response.status === 503 ? exits.blocked : answer.code;
  }
  // Bun's console.log and console.error do not wait behind a queued write, so each write goes through the stream.
  const written = { out: Promise.resolve(), err: Promise.resolve() };
  // The daemon records the landing, so the event of the client holds only its own lines.
  const forward = (name: 'out' | 'err', data: Buffer) => {
    written[name] = new Promise((done) =>
      name === 'out' ? process.stdout.write(data, () => done()) : writeUnrecorded(data, () => done()),
    );
  };
  const flushed = () => Promise.all([written.out, written.err]);
  const lost = async (cause: string) => {
    written.err = new Promise((done) =>
      process.stderr.write(
        `land: blocked: the daemon ended the landing of #${key} with no status: ${cause}; read celetis daemon status, then run celetis --agent <host> land ${key} again\n`,
        () => done(),
      ),
    );
    await flushed();
    return exits.blocked;
  };
  const decoder = new TextDecoder();
  let rest = '';
  try {
    for await (const chunk of response.body ?? []) {
      rest += decoder.decode(chunk, { stream: true });
      let start = 0;
      for (let end = rest.indexOf('\n'); end !== -1; end = rest.indexOf('\n', start)) {
        const line = rest.slice(start, end);
        start = end + 1;
        if (!line) continue;
        const record = parseLandingRecord(line);
        if (record === null) return await lost('the daemon sent an invalid record');
        if ('out' in record) forward('out', Buffer.from(record.out, 'latin1'));
        else if ('err' in record) forward('err', Buffer.from(record.err, 'latin1'));
        else {
          await flushed();
          return recordedElsewhere(record.code);
        }
      }
      rest = rest.slice(start);
    }
  } catch (error) {
    return await lost(error instanceof Error ? error.message : String(error));
  }
  return await lost('the answer ended before its status');
}

async function landDirectly(landing: Landing, main: string): Promise<ExitCode> {
  let last = '';
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write;
    stream.write = function (this: unknown, chunk: unknown, ...rest: unknown[]): boolean {
      if (typeof chunk === 'string') for (const line of chunk.split('\n')) if (line.startsWith('land: ')) last = line;
      return Reflect.apply(write, this, [chunk, ...rest]);
    };
  }
  // Bun's console does not wait behind a queued write of the forwarded suite output.
  console.log = (...args: unknown[]) => process.stdout.write(`${format(...args)}\n`);
  console.error = (...args: unknown[]) => process.stderr.write(`${format(...args)}\n`);
  const exited = (code: ExitCode) => recordEvent({ name: 'land-exit', message: last, issue: landing.number, code });
  const abort = new AbortController();
  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      const code = signalExit(constants.signals[signal]);
      if (abort.signal.aborted) {
        exited(code);
        // The owner record names this process, so the lock reads as free once it ends.
        process.exit(code);
      }
      abort.abort(new HostError('', code));
    });
  const end = await lockedLanding(landing, main, createLockOwner(main, undefined, 'session'), abort.signal);
  if (end.defect)
    recordEvent({
      name: 'land-defect',
      message: described(end.defect.error),
      issue: landing.number,
      code: end.status,
      error: end.defect.error,
    });
  else if (end.status !== exits.done) exited(end.status);
  return recordedElsewhere(end.status);
}

if (import.meta.main) {
  installRecorder('land');
  process.exitCode = await main(process.argv.slice(2));
}
