import { AgentOrderConflict, readAgentOrder, replaceAgentOrder } from './lib/agent/order.ts';
import { HostError } from './lib/command/errors.ts';
import { commandInput, locateCheckouts } from './lib/command/operation.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { installRecorder } from './lib/state/events.ts';

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const { args } = commandInput(argv);
    const [command, source] = args;
    if (!((command === 'read' && args.length === 1) || (command === 'replace' && args.length === 2)))
      throw new HostError(usage('agents'), exits.usage);
    let replacement: { order: unknown; expectedVersion: string } | undefined;
    if (command === 'replace') {
      let value: unknown;
      try {
        value = JSON.parse(source as string);
      } catch (error) {
        throw new HostError((error as Error).message, exits.usage);
      }
      if (
        value === null ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== 'expectedVersion,order' ||
        !('order' in value) ||
        !('expectedVersion' in value) ||
        typeof value.expectedVersion !== 'string'
      )
        throw new HostError('agents: replacement needs exactly order and expectedVersion', exits.usage);
      replacement = { order: value.order, expectedVersion: value.expectedVersion };
    }
    const { common } = await locateCheckouts(process.cwd());
    if (common === null) throw new HostError('agents: need a Git checkout', exits.usage);
    console.log(
      JSON.stringify(
        replacement
          ? await replaceAgentOrder(common, replacement.order, replacement.expectedVersion)
          : await readAgentOrder(common),
      ),
    );
    return exits.done;
  } catch (error) {
    if (error instanceof AgentOrderConflict) {
      console.log(JSON.stringify({ kind: 'conflict', latest: error.latest }));
      return exits.prerequisite;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('agents');
  process.exitCode = await main(process.argv.slice(2));
}
