import { constants } from 'node:os';
import { requestSelection, requireDaemon, unanswered } from './lib/daemon-client.ts';
import { daemonSocket, landingSubject, parseAnswer, parseLandingRecord } from './lib/daemon-types.ts';
import { installRecorder, markDefect, passOn, writeUnrecorded } from './lib/events.ts';
import { HostError, updateHint } from './lib/host.ts';
import { commandInput, locateCheckouts } from './lib/operation.ts';
import { run } from './lib/process.ts';

const usage = `usage: celetis --agent <host> land <issue number> '<type>(<area>): <what>', e.g. celetis --agent <host> land 415 'feat(agent-harness): the build step lands the change'\n${updateHint}`;

export async function main(argv: string[]): Promise<number> {
  try {
    const { args, explicit } = commandInput(argv);
    return await execute(args, explicit);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

async function execute(argv: string[], explicit: string | undefined): Promise<number> {
  const n = argv[0]?.replace(/^#/, '') ?? '';
  const number = Number(n);
  const subject = argv[1] ?? '';
  if (
    argv.length !== 2 ||
    !/^[1-9][0-9]*$/.test(n) ||
    !Number.isSafeInteger(number) ||
    !landingSubject(number, subject)
  ) {
    console.error(usage);
    return 2;
  }
  if (process.platform === 'win32') {
    console.error('land: usage: Windows is not a support target');
    return 2;
  }
  let common: string;
  let from: string;
  try {
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null) throw new HostError('celetis: need a Git checkout', 2);
    common = checkout.common;
    const top = await run('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
    if (top.code !== 0) throw new HostError(top.stderr.trimEnd(), top.code);
    from = top.stdout.trimEnd();
  } catch (error) {
    markDefect(error);
    if (!(error instanceof HostError)) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
    console.error(`land: ${error.code === 2 ? 'usage' : 'blocked'}: ${error.message}`);
    return error.code === 2 ? 2 : 6;
  }
  try {
    await requireDaemon(common, 'land: blocked');
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    console.error(error.message);
    return 6;
  }
  const abort = new AbortController();
  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      abort.abort();
      process.exit(128 + constants.signals[signal]);
    });
  let response: Response;
  try {
    response = await fetch('http://daemon/land', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ number, subject, selection: requestSelection(explicit), from }),
      signal: abort.signal,
      unix: daemonSocket(common),
    });
  } catch (error) {
    console.error(unanswered('land: blocked', error instanceof Error ? error.message : String(error)));
    return 6;
  }
  if (response.status !== 200) {
    const answer = await response
      .json()
      .then(parseAnswer)
      .catch(() => null);
    if (answer === null || answer.accepted) {
      console.error(`land: blocked: daemon: the daemon sent an invalid answer (status ${response.status})`);
      return 6;
    }
    console.error(response.status === 503 ? `land: blocked: ${answer.line}` : answer.line);
    return response.status === 503 ? 6 : 1;
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
    return 6;
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
          return passOn(record.code);
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
