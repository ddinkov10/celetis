import { dirname } from 'node:path';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import { HostError } from './lib/errors.ts';
import { installRecorder } from './lib/events.ts';
import { codexHome } from './lib/homes.ts';
import { requireBun } from './lib/host.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    if (args.length) throw new HostError(usage('root'), exits.usage);
    const operation = await createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'host',
    );
    if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
    console.log(dirname(import.meta.dir));
    return exits.done;
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) {
  installRecorder('root');
  process.exitCode = await main(process.argv.slice(2));
}
