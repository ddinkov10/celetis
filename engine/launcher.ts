import { dirname, join } from 'node:path';
import { HostError } from './lib/command/errors.ts';
import { commandInput } from './lib/command/operation.ts';
import { commands, type ExitCode, exits, helpText, launcherForms, updateHint } from './lib/contract/contract.ts';
import { requireBun } from './lib/host/host.ts';
import { engineRevision } from './lib/process/git.ts';
import { bunArgs, childEnv } from './lib/process/process.ts';
import { installRecorder, passOn } from './lib/state/events.ts';
import { execConsumer } from './lib/update/lock.ts';

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
      console.log(await engineRevision(dirname(import.meta.dir)));
      return exits.done;
    }
    if (args.length === 0) {
      console.log(helpText);
      return exits.usage;
    }
    const name = args.shift() ?? '';
    const missing = new HostError(
      `celetis: the engine has no command ${name}\nceletis: celetis help lists the commands\n${updateHint}`,
      exits.usage,
    );
    if (!commands.some(({ command }) => command === name)) throw missing;
    const entry = join(import.meta.dir, `${name}.ts`);
    const forwarded = explicit === undefined ? args : ['--agent', explicit, ...args];
    return passOn(await execConsumer(process.execPath, [process.execPath, ...bunArgs(entry, forwarded)], childEnv()));
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
