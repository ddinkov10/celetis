import { dirname } from 'node:path';
import { HostError } from './lib/command/errors.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/command/operation.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { requireBun } from './lib/host/host.ts';
import { hostAdapter } from './lib/host/hosts.ts';
import { installRecorder } from './lib/state/events.ts';

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
    await hostAdapter(operation.host).checkHome();
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
