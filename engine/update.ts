import { type ExitCode, exits, usage } from './lib/contract.ts';
import { HostError } from './lib/errors.ts';
import { installRecorder, markDefect } from './lib/events.ts';
import { requireBun } from './lib/host.ts';
import { commandInput } from './lib/operation.ts';
import { executeUpdate, inspectUpdate, line, parts, short, type UpdateCheck } from './lib/updater.ts';

async function check(cwd: string): Promise<ExitCode> {
  const found = await parts(cwd);
  console.log(JSON.stringify(found, null, 2));
  const [program, ...hosts] = found;
  if (program && 'installed' in program)
    for (const host of hosts)
      if ('installed' in host && host.installed !== program.installed)
        console.error(
          `update: the program is at ${program.installed.slice(0, 12)} and the ${host.part} plugin is at ${host.installed.slice(0, 12)}; run celetis update in a terminal`,
        );
  return found.some((part) => 'error' in part) ? exits.blocked : exits.done;
}

export async function update(checked: UpdateCheck): Promise<ExitCode> {
  const summary = checked.parts.map(line).join('\n');
  if (checked.error) {
    console.log(summary);
    throw new HostError(
      checked.error,
      checked.parts.some((part) => 'error' in part) ? exits.blocked : exits.prerequisite,
    );
  }
  const program = checked.parts.find((part) => part.part === 'program');
  if (!program || !('installed' in program))
    throw new HostError('update: no installed program was inspected', exits.blocked);
  const offer = checked.offer;
  if (!offer) {
    console.log(`${summary}\nupdate: Celetis is up to date at ${short(program.target)}`);
    return exits.done;
  }
  console.log(`Celetis update from ${program.source} ${program.ref}\n${summary}`);
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new HostError(
      'update: run celetis update in an interactive terminal to review and confirm the update',
      exits.prerequisite,
    );
  console.log('Open sessions stay running; the host may replace cached files they still use.');
  if (!/^(y|yes)?$/i.test((prompt('Update Celetis now? [Y/n] ') ?? 'n').trim())) {
    console.log('update: cancelled; nothing changed');
    return exits.done;
  }
  const result = await executeUpdate(
    offer,
    ({ part, state }) => {
      if (state === 'completed') console.log(`  ${part}  updated  ${short(offer.target)}`);
    },
    process.pid,
  );
  if (!result.ok) {
    console.error(
      [
        result.error,
        `update: completed: ${result.completed.join(', ') || 'none'}`,
        `update: incomplete: ${result.incomplete.join(', ') || 'none'}`,
      ].join('\n'),
    );
    return exits.blocked;
  }
  console.log('update: open a fresh session to use the updated skills');
  return exits.done;
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args } = commandInput(argv);
    if (args.length === 1 && args[0] === 'check') return await check(process.cwd());
    if (args.length) throw new HostError(usage('update'), exits.usage);
    return await update(await inspectUpdate(process.cwd()));
  } catch (error) {
    markDefect(error);
    console.error(error instanceof Error ? error.message : String(error));
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('update');
  process.exitCode = await main(process.argv.slice(2));
}
