import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type ExitCode, exits, usage, usageLine } from './lib/contract.ts';
import type { Level } from './lib/effort.ts';

const removed = 'the engine version of this command was removed after an update; run the command again';
const here = import.meta.dir;
async function gone(files: string[]) {
  for (const file of files) if (!(await stat(join(here, file)).catch(() => null))?.isFile()) return true;
  return false;
}

export async function main(argv: string[]): Promise<ExitCode> {
  const unavailable = await gone([
    'celetis',
    'daemon.ts',
    'launcher.ts',
    'lib/agent-order.ts',
    'lib/codex-app-server.ts',
    'lib/config-core.ts',
    'lib/config.ts',
    'lib/daemon-client.ts',
    'lib/daemon-start.ts',
    'lib/daemon-types.ts',
    'lib/effort.ts',
    'lib/epic-acceptance.ts',
    'lib/errors.ts',
    'lib/events.ts',
    'lib/fields.ts',
    'lib/git.ts',
    'lib/homes.ts',
    'lib/host-claude.ts',
    'lib/host-codex.ts',
    'lib/host-names.ts',
    'lib/host.ts',
    'lib/hosts.ts',
    'lib/installation.ts',
    'lib/lines.ts',
    'lib/locks.ts',
    'lib/operation.ts',
    'lib/plugin-metadata.ts',
    'lib/process-identity.ts',
    'lib/process.ts',
    'lib/queue.ts',
    'lib/quota-recovery.ts',
    'lib/refresh-hints.ts',
    'lib/resolver.ts',
    'lib/session.ts',
    'lib/state-migration.ts',
    'lib/state-move.ts',
    'lib/state-preparation.ts',
    'lib/state.ts',
    'lib/terminal.ts',
    'lib/tracker.ts',
    'lib/update-lock.ts',
    'lib/usage-claude.ts',
    'lib/usage-codex.ts',
    'lib/usage-types.ts',
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
      const { HostError } = await import('./lib/errors.ts');
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
    console.error(unavailable ? `usage: ${usageLine('run')}` : usage('run'));
    return exits.usage;
  }
  const number = Number(numbers[0]);
  if (unavailable) {
    console.error(mode === 'number' ? `run: #${numbers[0]}: ${removed}` : `run: ${removed}`);
    return exits.prerequisite;
  }
  const { HostError } = await import('./lib/errors.ts');
  const { requireBun } = await import('./lib/host.ts');
  const { askDaemon, requestSelection, sendRun } = await import('./lib/daemon-client.ts');
  const { locateCheckouts } = await import('./lib/operation.ts');
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
    return await sendRun(common, { kind: 'run', number, selection, effort: override ?? null, quiet }, 'run', subject);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
