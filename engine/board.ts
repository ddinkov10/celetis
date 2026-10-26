import { celetisAdapter } from './board/adapter.ts';
import { startBoard } from './board/start.ts';
import { HostError, requireBun } from './lib/host.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { codexHome } from './lib/plugin-metadata.ts';
import { requireUpdatePolicy } from './lib/plugin-policy.ts';
import { childEnv } from './lib/process.ts';
import { withPluginRead } from './lib/update-lock.ts';

export async function main(argv: string[]): Promise<number> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    if (args.length)
      throw new HostError(
        'usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> board',
        2,
      );
    const env = childEnv();
    process.env.PATH = env.PATH;
    const operation = createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    const main = operation.checkout.main as string;
    const config = operation.mainConfig;
    if (operation.host === 'codex') process.env.CODEX_HOME = await codexHome();
    if (operation.checkout.active !== main)
      throw new HostError(`celetis-board: start the board in the main checkout: ${main}`);
    await withPluginRead(operation.host, async () => {
      await requireUpdatePolicy(operation.host, operation.checkout.cwd);
      if (operation.checkout.cwd !== main) await requireUpdatePolicy(operation.host, main);
    });
    const adapter = await celetisAdapter(main);
    return await startBoard(main, config?.board?.port ?? 4403, adapter);
  } catch (error) {
    console.error(error instanceof HostError ? error.message : `celetis-board: ${(error as Error).message}`);
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
