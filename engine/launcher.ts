import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { helpText } from './lib/help.ts';
import { HostError, requireBun, updateHint } from './lib/host.ts';
import { commandInput } from './lib/operation.ts';
import { bunArgs, childEnv } from './lib/process.ts';
import { programRevision } from './lib/program.ts';
import { execConsumer } from './lib/update-lock.ts';

export const commandName = /^[a-z][a-z-]*$/;

export async function main(argv: string[]): Promise<number> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    if (['help', '--help', '-h'].includes(args[0] ?? '')) {
      console.log(helpText);
      return 0;
    }
    if (args.length === 1 && args[0] === '--version') {
      console.log(await programRevision(dirname(import.meta.dir)));
      return 0;
    }
    if (args.length === 0) {
      console.log(helpText);
      return 2;
    }
    const name = args.shift() ?? '';
    const missing = new HostError(
      `celetis: the program has no command ${name}\nceletis: celetis help lists the commands\n${updateHint}`,
      2,
    );
    if (!commandName.test(name)) throw missing;
    const folder = ['build', 'verify', 'install-tools'].includes(name) ? '../scripts' : '.';
    const entry = join(import.meta.dir, folder, `${name}.ts`);
    if (!(await stat(entry).catch(() => null))?.isFile()) throw missing;
    const forwarded = explicit === undefined ? args : ['--agent', explicit, ...args];
    return await execConsumer(process.execPath, [process.execPath, ...bunArgs(entry, forwarded)], childEnv());
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
