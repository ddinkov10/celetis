import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import { eventFile, eventFolder, withEventLock } from './lib/events.ts';
import { HostError, requireBun } from './lib/host.ts';
import { commandInput } from './lib/operation.ts';
import { privateMode } from './lib/private-folder.ts';

const busy = 'celetis: the record lock is busy after 2 seconds';

function parse(argv: string[]): string | null {
  const { args } = commandInput(argv);
  if (args.length === 0) return null;
  if (args.length === 2 && args[0] === '--after' && args[1] !== undefined) return args[1];
  throw new HostError(usage('events'), exits.usage);
}

function readFile(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

function entries(folder: string): { id: string; line: string }[] {
  const kept: { id: string; line: string }[] = [];
  for (const name of [eventFile.rotated, eventFile.current]) {
    const path = join(folder, name);
    const lines = readFile(path).split('\n');
    lines.pop();
    lines.forEach((text, index) => {
      try {
        const value: unknown = JSON.parse(text);
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new SyntaxError();
        const id: unknown = Reflect.get(value, 'id');
        if (typeof id !== 'string') throw new SyntaxError();
        kept.push({ id, line: JSON.stringify(value) });
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        console.error(`events: ${path}:${index + 1}: not a valid entry; the read continues`);
      }
    });
  }
  return kept;
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const after = parse(argv);
    const folder = eventFolder();
    const stat = lstatSync(folder, { throwIfNoEntry: false });
    if (!stat) return exits.done;
    if (!stat.isDirectory() || stat.isSymbolicLink() || !privateMode(stat))
      throw new HostError(
        `events: ${folder}: need a private directory owned by the current user (mode 0700)`,
        exits.blocked,
      );
    let kept = withEventLock(folder, true, () => entries(folder));
    if (after !== null) {
      const index = kept.findLastIndex((item) => item.id === after);
      if (index >= 0) kept = kept.slice(index + 1);
      else console.error(`events: no kept entry has the id ${after}; the output starts at the oldest kept entry`);
    }
    if (kept.length) console.log(kept.map((item) => item.line).join('\n'));
    return exits.done;
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    const message =
      error.message === busy ? 'events: the record lock is busy after 2 seconds; try again' : error.message;
    if (message) console.error(message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
