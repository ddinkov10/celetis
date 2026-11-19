import { dirname } from 'node:path';
import { type ExitCode, exits, usage, usageLine } from './lib/contract/contract.ts';
import { versionFolderGone } from './lib/install/version-folder.ts';
import type { Level, Model } from './lib/workflow/effort.ts';

const removed = 'the engine version of this command was removed after an update; run the command again';

export async function main(argv: string[]): Promise<ExitCode> {
  const unavailable = await versionFolderGone(dirname(import.meta.dir));
  if (!unavailable) (await import('./lib/state/events.ts')).installRecorder('run');
  let explicit: string | undefined;
  if (!unavailable) {
    try {
      const input = (await import('./lib/command/operation.ts')).commandInput(argv);
      argv = input.args;
      explicit = input.explicit;
    } catch (error) {
      const { HostError } = await import('./lib/command/errors.ts');
      if (!(error instanceof HostError)) throw error;
      if (error.message) console.error(error.message);
      return error.code;
    }
  } else if (argv[0] === '--agent') argv = argv.slice(2);
  let mode: 'number' | 'resume' | 'retry' = 'number';
  let numbers: string[];
  let waitId = '';
  let override: Level | undefined;
  let model: Model | undefined;
  if (argv.length === 3 && argv[0] === 'retry') {
    mode = 'retry';
    numbers = [(argv[1] ?? '').replace(/^#/, '')];
    waitId = argv[2] as string;
  } else if (argv.length === 2 && argv[0] === 'resume') {
    mode = 'resume';
    numbers = [(argv[1] ?? '').replace(/^#/, '')];
  } else {
    const effort = unavailable ? null : await import('./lib/workflow/effort.ts');
    const take = <T>(flag: string, valid: ((value: unknown) => value is T) | undefined): T | undefined => {
      const at = argv.indexOf(flag);
      const value = argv[at + 1];
      if (at === -1 || !(unavailable || valid?.(value))) return undefined;
      argv = argv.toSpliced(at, 2);
      return unavailable ? undefined : (value as T);
    };
    override = take('--effort', effort?.isLevel);
    model = take('--model', effort?.isModel);
    numbers = argv.map((arg) => arg.replace(/^#/, ''));
  }
  if (numbers.length !== 1 || !/^[1-9][0-9]*$/.test(numbers[0] as string)) {
    console.error(unavailable ? `usage: ${usageLine('run')}` : usage('run'));
    return exits.usage;
  }
  const number = Number(numbers[0]);
  if (unavailable) {
    console.error(mode === 'number' ? `run: #${numbers[0]}: ${removed}` : `run: ${removed}`);
    return exits.prerequisite;
  }
  const { HostError } = await import('./lib/command/errors.ts');
  const { requireBun } = await import('./lib/host/host.ts');
  const { askDaemon, requestSelection, sendRun } = await import('./lib/daemon/client.ts');
  const { locateCheckouts } = await import('./lib/command/operation.ts');
  try {
    requireBun();
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null)
      throw new HostError('celetis: need a Git checkout', exits.usage);
    const { common } = checkout;
    const subject = `#${number}`;
    if (mode === 'retry') {
      const { answer } = await askDaemon(common, { kind: 'retry', number, waitId }, 'run');
      if (!answer.accepted) {
        (answer.code === exits.done ? console.log : console.error)(answer.line);
        return answer.code;
      }
      console.log(`run: ${subject}: Retry requested; the waiting run starts one bounded attempt cycle`);
      return exits.done;
    }
    const selection = requestSelection(explicit);
    if (mode === 'resume') return await sendRun(common, { kind: 'resume', number, selection }, 'run', subject);
    return await sendRun(
      common,
      { kind: 'run', number, selection, effort: override ?? null, model: model ?? null },
      'run',
      subject,
    );
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
