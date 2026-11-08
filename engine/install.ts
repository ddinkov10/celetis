import { delimiter, dirname, resolve } from 'node:path';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import { installRecorder } from './lib/events.ts';
import { HostError, requireBun } from './lib/host.ts';
import { commandInput } from './lib/operation.ts';
import { childEnv } from './lib/process.ts';
import { installProgram, programPaths, programSource } from './lib/program.ts';

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args } = commandInput(argv);
    if (args.length) throw new HostError(usage('install'), exits.usage);
    const paths = programPaths();
    const root = dirname(import.meta.dir);
    const program = await installProgram(root, await programSource(root), paths);
    console.log(`install: ${program.command} -> ${program.entry}`);
    const key = (path: string) => (process.platform === 'win32' ? path.toLowerCase() : path);
    const items = (childEnv().PATH ?? '').split(delimiter).filter(Boolean);
    if (!items.some((item) => key(resolve(item)) === key(paths.bin)))
      console.log(`install: ${paths.bin} is not on PATH; add it as README.md, "First install", says`);
    return exits.done;
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) {
  installRecorder('install');
  process.exitCode = await main(process.argv.slice(2));
}
