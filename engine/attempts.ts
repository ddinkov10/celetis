import { join } from 'node:path';
import { type AttemptEntry, readAttempts } from './lib/attempt/attempt.ts';
import { HostError } from './lib/command/errors.ts';
import { commandInput, locateCheckouts } from './lib/command/operation.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { requireBun } from './lib/host/host.ts';
import { repositoryLayout } from './lib/state/state.ts';
import { parseHandle } from './lib/tracker/key.ts';

const header = ['started', 'ended', 'work', 'start', 'host', 'model', 'effort', 'outcome', 'code'];

function table(entries: readonly AttemptEntry[]): string[] {
  const rows = entries.map((entry) => [
    entry.startedAt,
    entry.end?.at ?? '-',
    entry.work,
    entry.start,
    entry.host,
    entry.model ?? '-',
    entry.effort ?? '-',
    entry.end?.outcome ?? 'open',
    String(entry.end?.code ?? '-'),
  ]);
  const widths = header.map((name, column) =>
    Math.max(name.length, ...rows.map((row) => (row[column] as string).length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((cell, column) => cell.padEnd(widths[column] as number))
      .join('  ')
      .trimEnd();
  return [
    line(header),
    ...entries.flatMap((entry, index) => [
      line(rows[index] as string[]),
      ...(entry.end?.reason != null ? [`  reason: ${entry.end.reason}`] : []),
    ]),
  ];
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args } = commandInput(argv);
    const issue = args.length === 1 ? parseHandle(args[0] as string) : null;
    if (issue === null) throw new HostError(usage('attempts'), exits.usage);
    const { common } = await locateCheckouts(process.cwd());
    if (common === null) throw new HostError('attempts: need a Git checkout', exits.usage);
    const { entries, invalid } = await readAttempts(common, issue);
    const folder = repositoryLayout(common).attemptFolder(issue).path;
    for (const name of invalid) console.error(`attempts: ${join(folder, name)}: not a valid entry; the read continues`);
    console.log(entries.length === 0 ? `#${issue}: no attempts recorded` : table(entries).join('\n'));
    return exits.done;
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
