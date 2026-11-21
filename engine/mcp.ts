import { dirname } from 'node:path';
import { HostError } from './lib/command/errors.ts';
import { commandInput } from './lib/command/operation.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { hostChoices } from './lib/host/names.ts';
import { serve } from './lib/mcp/mcp.ts';
import { installRecorder } from './lib/state/events.ts';

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const { args, explicit } = commandInput(argv);
    if (explicit === undefined)
      throw new HostError(usage('mcp', `celetis: mcp needs an explicit --agent ${hostChoices}`), exits.usage);
    if (args.length) throw new HostError(usage('mcp'), exits.usage);
    await serve(dirname(import.meta.dir), explicit);
    return exits.done;
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) {
  installRecorder('mcp');
  process.exitCode = await main(process.argv.slice(2));
}
