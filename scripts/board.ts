import { spawn } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, join } from 'node:path';
import { ConfigError, readConfig } from './lib/config.ts';
import { HostError, mainCheckout, requireBun } from './lib/host.ts';
import { bunArgs, childEnv, run } from './lib/process.ts';

export async function main(args: string[]): Promise<number> {
  try {
    requireBun();
    if (args.length) throw new HostError('usage: scripts/celetis board', 2);
    const plugin = dirname(import.meta.dir);
    const entry = join(plugin, 'board/cli.ts');
    const env = childEnv();
    process.env.PATH = env.PATH;
    if (!(await stat(entry).catch(() => null))?.isFile())
      throw new HostError(`celetis-board: the plugin has no board/cli.ts: ${plugin}; reinstall the plugin`);
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
    const input = {
      data: ['scripts/celetis', 'celetis-flow', '--board'],
      run: ['scripts/celetis', '--agent', '{agent}', 'celetis-flow', '{n}'],
      resume: ['scripts/celetis', 'celetis-flow', '--resume', '{n}'],
      port: config.board?.port ?? 4403,
    };
    return await new Promise<number>((done, fail) => {
      const child = spawn(process.execPath, bunArgs(entry, ['--config-stdin']), {
        cwd: main,
        env,
        stdio: ['pipe', 'inherit', 'inherit'],
      });
      const interrupt = () => child.kill('SIGINT');
      const terminate = () => child.kill('SIGTERM');
      process.on('SIGINT', interrupt);
      process.on('SIGTERM', terminate);
      child.once('error', fail);
      child.once('close', (code, signal) => {
        process.off('SIGINT', interrupt);
        process.off('SIGTERM', terminate);
        done(code ?? (signal ? 128 + constants.signals[signal] : 1));
      });
      child.stdin.on('error', () => {});
      child.stdin.end(`${JSON.stringify(input)}\n`);
    });
  } catch (error) {
    console.error(error instanceof HostError ? error.message : `celetis-board: ${(error as Error).message}`);
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
