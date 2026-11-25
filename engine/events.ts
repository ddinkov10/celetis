import { HostError } from './lib/command/errors.ts';
import { commandInput } from './lib/command/operation.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { requireBun } from './lib/host/host.ts';
import { linesAfter, readLines } from './lib/state/lines.ts';
import { checkFolder, eventLayout, stateOutcome, withLockSync } from './lib/state/state.ts';

function parse(argv: string[]): string | null {
  const { args } = commandInput(argv);
  if (args.length === 0) return null;
  if (args.length === 2 && args[0] === '--after' && args[1] !== undefined) return args[1];
  throw new HostError(usage('events'), exits.usage);
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const after = parse(argv);
    const layout = eventLayout();
    if (!checkFolder(layout.folder)) return exits.done;
    const kept = withLockSync(layout.lock, 'shared', () => readLines(layout, 'events'));
    const shown = linesAfter(kept, after, 'events');
    if (shown.length) console.log(shown.map((item) => item.line).join('\n'));
    return exits.done;
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    const message =
      stateOutcome(error)?.kind === 'busy'
        ? 'events: the record lock is busy after 2 seconds; try again'
        : error.message;
    if (message) console.error(message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
