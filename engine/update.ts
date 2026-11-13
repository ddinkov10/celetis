import { styleText } from 'node:util';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import { HostError } from './lib/errors.ts';
import { installRecorder, markDefect } from './lib/events.ts';
import { requireBun } from './lib/host.ts';
import { commandInput } from './lib/operation.ts';
import { executeUpdate, inspectUpdate, line, short, type UpdateCheck } from './lib/updater.ts';

async function check(cwd: string): Promise<ExitCode> {
  const checked = await inspectUpdate(cwd);
  console.log(JSON.stringify(checked.parts, null, 2));
  if (checked.error !== null) console.error(checked.error);
  return checked.parts.some((part) => 'error' in part) ? exits.blocked : exits.done;
}

export async function update(checked: UpdateCheck): Promise<ExitCode> {
  if (checked.error) {
    console.log(checked.parts.map(line).join('\n'));
    throw new HostError(
      checked.error,
      checked.parts.some((part) => 'error' in part) ? exits.blocked : exits.prerequisite,
    );
  }
  const engine = checked.parts.find((part) => part.part === 'engine');
  if (!engine || !('installed' in engine))
    throw new HostError('update: no installed engine was inspected', exits.blocked);
  const offer = checked.offer;
  if (!offer) {
    console.log(`${styleText('green', '✓')} Celetis is up to date (${short(engine.target)}).`);
    return exits.done;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new HostError(
      'update: run celetis update in an interactive terminal to review and confirm the update',
      exits.prerequisite,
    );
  process.stdout.write(`Update Celetis to ${styleText('bold', short(offer.target))}? Sessions keep running. [Y/n] `);
  // Bun's prompt() returns null for an empty line, the same as EOF, so Enter could not take the default.
  const lines = console[Symbol.asyncIterator]();
  const answer = await lines.next();
  await lines.return?.();
  if (answer.done || !/^(y|yes)?$/i.test(answer.value.trim())) {
    console.log(styleText('dim', 'Nothing changed.'));
    return exits.done;
  }
  const row = { started: false, open: '' };
  const result = await executeUpdate(
    offer,
    ({ part, state }) => {
      if (state === 'started') {
        if (!row.started) process.stdout.write('Updating');
        row.started = true;
        row.open = part;
        return;
      }
      process.stdout.write(` ${styleText('green', '✓')} ${part}`);
      row.open = '';
    },
    process.pid,
  );
  if (row.open) process.stdout.write(` ${styleText('red', '✗')} ${row.open}`);
  if (row.started) process.stdout.write('\n');
  if (!result.ok) {
    process.stderr.write(
      `${[
        styleText('red', result.error ?? '', { stream: process.stderr }),
        `update: completed: ${result.completed.join(', ') || 'none'}`,
        `update: incomplete: ${result.incomplete.join(', ') || 'none'}`,
      ].join('\n')}\n`,
    );
    return exits.blocked;
  }
  console.log(`${styleText('green', 'Updated.')} Open a fresh session to use the new skills.`);
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
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('update');
  process.exitCode = await main(process.argv.slice(2));
}
