import { realpath } from 'node:fs/promises';
import { celetisConfig } from './board/adapter.ts';
import { startBoard } from './board/start.ts';
import { ConfigError, readConfig } from './lib/config.ts';
import { HostError, mainCheckout, requireBun, selectHost } from './lib/host.ts';
import { requireUpdatePolicy } from './lib/plugin-policy.ts';
import { childEnv, run } from './lib/process.ts';

export async function main(args: string[]): Promise<number> {
  try {
    requireBun();
    if (args.length)
      throw new HostError(
        'usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> board',
        2,
      );
    const env = childEnv();
    process.env.PATH = env.PATH;
    const main = await realpath(await mainCheckout(process.cwd()));
    let config: ReturnType<typeof readConfig>;
    try {
      config = readConfig(main);
    } catch (error) {
      if (!(error instanceof ConfigError)) throw error;
      throw new HostError(`celetis: ${main}/.celetis.yaml: ${error.field}: ${error.message}`, 2);
    }
    const checkout = await run('git', ['rev-parse', '--show-toplevel']);
    if (checkout.code) throw new HostError(checkout.stderr.trimEnd(), checkout.code);
    if ((await realpath(checkout.stdout.trimEnd())) !== main)
      throw new HostError(`celetis-board: start the board in the main checkout: ${main}`);
    const host = selectHost(undefined, process.env, main);
    await requireUpdatePolicy(host, main);
    const board = await celetisConfig(main, config.board?.port ?? 4403);
    process.chdir(main);
    return await startBoard(main, board);
  } catch (error) {
    console.error(error instanceof HostError ? error.message : `celetis-board: ${(error as Error).message}`);
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
