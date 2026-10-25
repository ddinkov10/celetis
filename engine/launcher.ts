import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HostError, requireBun } from './lib/host.ts';
import { commandInput } from './lib/operation.ts';
import { bunArgs, childEnv } from './lib/process.ts';
import { execConsumer } from './lib/update-lock.ts';

export async function main(argv: string[]): Promise<number> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    if (args.length === 0)
      throw new HostError(
        'usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> <script> [<argument>...], e.g. BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> next-step --open',
        2,
      );
    const name = args.shift() ?? '';
    if (!/^[a-z][a-z-]*$/.test(name)) throw new HostError(`celetis: the plugin has no script ${name}`, 2);
    const folder = ['build', 'verify', 'install-tools'].includes(name) ? '../scripts' : '.';
    const entry = join(import.meta.dir, folder, `${name}.ts`);
    if (!(await stat(entry).catch(() => null))?.isFile())
      throw new HostError(`celetis: the plugin has no script ${name}`, 2);
    const forwarded = explicit === undefined ? args : ['--agent', explicit, ...args];
    return await execConsumer(process.execPath, [process.execPath, ...bunArgs(entry, forwarded)], childEnv());
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
