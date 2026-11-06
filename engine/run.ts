import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Level } from './lib/effort.ts';

const usage =
  'usage: celetis --agent <host> run <issue number> [--effort low|medium|high|xhigh|max] [--quiet] | run resume <issue number> | run retry <issue number> <wait id>; each form sends one request to the master daemon of this repository and returns; --quiet opens each session tab of the start in the background; auto mode: celetis daemon auto on|off';
const removed = 'the program version of this command was removed after an update; run the command again';
const here = import.meta.dir;
async function gone(files: string[]) {
  for (const file of files) if (!(await stat(join(here, file)).catch(() => null))?.isFile()) return true;
  return false;
}

export async function main(argv: string[]): Promise<number> {
  const unavailable = await gone([
    'lib/agent-order.ts',
    'lib/config-core.ts',
    'lib/config.ts',
    'lib/daemon-client.ts',
    'lib/daemon-types.ts',
    'lib/effort.ts',
    'lib/events.ts',
    'lib/host.ts',
    'lib/operation.ts',
    'lib/plugin-metadata.ts',
    'lib/private-folder.ts',
    'lib/process-identity.ts',
    'lib/process.ts',
    'lib/program.ts',
    'lib/state-folder.ts',
    'lib/state-move.ts',
    'lib/update-lock.ts',
    'lib/vendor/yaml.mjs',
    'lib/windows.ts',
    'lib/workflow.ts',
  ]);
  if (!unavailable) (await import('./lib/events.ts')).installRecorder('run');
  let explicit: string | undefined;
  if (!unavailable) {
    try {
      const input = (await import('./lib/operation.ts')).commandInput(argv);
      argv = input.args;
      explicit = input.explicit;
    } catch (error) {
      const { HostError } = await import('./lib/host.ts');
      if (!(error instanceof HostError)) throw error;
      if (error.message) console.error(error.message);
      return error.code;
    }
  } else if (argv[0] === '--agent') argv = argv.slice(2);
  const quiet = argv.includes('--quiet');
  if (quiet) argv = argv.toSpliced(argv.indexOf('--quiet'), 1);
  let mode: 'number' | 'resume' | 'retry' = 'number';
  let numbers: string[];
  let waitId = '';
  let override: Level | undefined;
  if (argv.length === 3 && argv[0] === 'retry') {
    mode = 'retry';
    numbers = [(argv[1] ?? '').replace(/^#/, '')];
    waitId = argv[2] as string;
  } else if (argv.length === 2 && argv[0] === 'resume') {
    mode = 'resume';
    numbers = [(argv[1] ?? '').replace(/^#/, '')];
  } else {
    const at = argv.indexOf('--effort');
    if (at !== -1) {
      const level = argv[at + 1];
      if (unavailable) argv = argv.toSpliced(at, 2);
      else if ((await import('./lib/effort.ts')).isLevel(level)) {
        override = level;
        argv = argv.toSpliced(at, 2);
      }
    }
    numbers = argv.map((arg) => arg.replace(/^#/, ''));
  }
  if (numbers.length !== 1 || !/^[1-9][0-9]*$/.test(numbers[0] as string)) {
    console.error(usage);
    if (!unavailable) console.error((await import('./lib/host.ts')).updateHint);
    return 2;
  }
  const number = Number(numbers[0]);
  if (unavailable) {
    if (mode === 'number') {
      console.log(`run: #${numbers[0]}: ${removed}`);
      return 0;
    }
    console.error(`run: ${removed}`);
    return 1;
  }
  const { HostError, requireBun } = await import('./lib/host.ts');
  const { askDaemon, requestSelection, sendRun } = await import('./lib/daemon-client.ts');
  const { locateCheckouts } = await import('./lib/operation.ts');
  try {
    requireBun();
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null) throw new HostError('celetis: need a Git checkout', 2);
    const { common } = checkout;
    const subject = `#${number}`;
    if (mode === 'retry') {
      const { answer } = await askDaemon(common, { kind: 'retry', number, waitId }, 'run');
      if (!answer.accepted) {
        (answer.code === 0 ? console.log : console.error)(answer.line);
        return answer.code;
      }
      console.log(`run: ${subject}: Retry requested; the waiting run starts one bounded attempt cycle`);
      return 0;
    }
    const selection = requestSelection(explicit);
    if (mode === 'resume') return await sendRun(common, { kind: 'resume', number, selection }, 'run', subject);
    return await sendRun(common, { kind: 'run', number, selection, effort: override ?? null, quiet }, 'run', subject);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
