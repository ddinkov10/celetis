import { AgentOrderConflict, readAgentOrder, replaceAgentOrder } from './lib/agent-order.ts';
import { installRecorder } from './lib/events.ts';
import { HostError } from './lib/host.ts';
import { commandInput, locateCheckouts } from './lib/operation.ts';

export async function main(argv: string[]): Promise<number> {
  try {
    const { args } = commandInput(argv);
    const [command, source] = args;
    if (!((command === 'read' && args.length === 1) || (command === 'replace' && args.length === 2)))
      throw new HostError("usage: celetis agents read | replace '<JSON with order and expectedVersion>'", 2);
    let replacement: { order: unknown; expectedVersion: string } | undefined;
    if (command === 'replace') {
      const value: unknown = JSON.parse(source as string);
      if (
        value === null ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== 'expectedVersion,order' ||
        !('order' in value) ||
        !('expectedVersion' in value) ||
        typeof value.expectedVersion !== 'string'
      )
        throw new HostError('agents: replacement needs exactly order and expectedVersion', 2);
      replacement = { order: value.order, expectedVersion: value.expectedVersion };
    }
    const { common } = await locateCheckouts(process.cwd());
    if (common === null) throw new HostError('agents: need a Git checkout', 2);
    console.log(
      JSON.stringify(
        replacement
          ? await replaceAgentOrder(common, replacement.order, replacement.expectedVersion)
          : readAgentOrder(common),
      ),
    );
    return 0;
  } catch (error) {
    if (error instanceof AgentOrderConflict) {
      console.log(JSON.stringify({ kind: 'conflict', latest: error.latest }));
      return 3;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) {
  installRecorder('agents');
  process.exitCode = await main(process.argv.slice(2));
}
