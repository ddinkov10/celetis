import { constants } from 'node:os';
import { classOf, type ExitClass, type ExitCode, exits, signalExit, usage } from './lib/contract.ts';
import { requestSelection, requireDaemon, unanswered } from './lib/daemon-client.ts';
import { daemonSocket, landingSubject, parseAnswer, parseLandingRecord } from './lib/daemon-types.ts';
import { HostError } from './lib/errors.ts';
import { installRecorder, markDefect, recordedElsewhere, writeUnrecorded } from './lib/events.ts';
import { isIssueNumber } from './lib/fields.ts';
import { isHost } from './lib/host-names.ts';
import { requireCan } from './lib/hosts.ts';
import { commandInput, locateCheckouts } from './lib/operation.ts';
import { run } from './lib/process.ts';

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
  const n = argv[0]?.replace(/^#/, '') ?? '';
  const number = Number(n);
  const subject = argv[1] ?? '';
  if (argv.length !== 2 || !isIssueNumber(n) || !landingSubject(number, subject)) {
    console.error(usage('land'));
    return exits.usage;
  }
  if (process.platform === 'win32') {
    console.error('land: prerequisite: Windows is not a support target');
    return exits.prerequisite;
  }
  let common: string;
  let from: string;
  try {
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null)
      throw new HostError('celetis: need a Git checkout', exits.usage);
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
  try {
    await requireDaemon(common, 'land');
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    console.error(`land: ${classOf(error.code)}: ${error.message.replace(/^land: /, '')}`);
    return error.code;
  }
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
      body: JSON.stringify({ number, subject, selection, from }),
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
        `land: blocked: the daemon ended the landing of #${number} with no status: ${cause}; read celetis daemon status, then run celetis --agent <host> land ${number} again\n`,
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

if (import.meta.main) {
  installRecorder('land');
  process.exitCode = await main(process.argv.slice(2));
}
