import { dirname } from 'node:path';
import { installRecorder } from './lib/events.ts';
import { HostError, requireBun } from './lib/host.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { codexHome } from './lib/plugin-metadata.ts';

export async function main(argv: string[]): Promise<number> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    if (args.length) throw new HostError('celetis: root takes no arguments', 2);
    const operation = await createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'host',
    );
    if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
    console.log(dirname(import.meta.dir));
    return 0;
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
