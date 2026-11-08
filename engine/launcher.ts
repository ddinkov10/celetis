import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type ExitCode, exits, helpText, launcherForms, updateHint } from './lib/contract.ts';
import { installRecorder, passOn } from './lib/events.ts';
import { HostError, requireBun } from './lib/host.ts';
import { commandInput } from './lib/operation.ts';
import { bunArgs, childEnv } from './lib/process.ts';
import { programRevision } from './lib/program.ts';
import { execConsumer } from './lib/update-lock.ts';

export const commandName = /^[a-z][a-z-]*$/;

const helpWords = launcherForms.flatMap(({ words: [word] }) => (word && word !== '--version' ? [word] : []));

export async function main(argv: string[]): Promise<ExitCode> {
  installRecorder('launcher');
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    if (helpWords.includes(args[0] ?? '')) {
      console.log(helpText);
      return exits.done;
    }
    if (args.length === 1 && args[0] === '--version') {
      console.log(await programRevision(dirname(import.meta.dir)));
      return exits.done;
    }
    if (args.length === 0) {
      console.log(helpText);
      return exits.usage;
    }
    const name = args.shift() ?? '';
    const missing = new HostError(
      `celetis: the program has no command ${name}\nceletis: celetis help lists the commands\n${updateHint}`,
      exits.usage,
    );
    if (!commandName.test(name)) throw missing;
    const folder = ['build', 'verify', 'install-tools'].includes(name) ? '../scripts' : '.';
    const entry = join(import.meta.dir, folder, `${name}.ts`);
    if (!(await stat(entry).catch(() => null))?.isFile()) throw missing;
    const forwarded = explicit === undefined ? args : ['--agent', explicit, ...args];
    return passOn(await execConsumer(process.execPath, [process.execPath, ...bunArgs(entry, forwarded)], childEnv()));
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
