import { mkdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type Host, HostError, installedRoot } from './lib/host.ts';
import { bunArgs } from './lib/process.ts';
import { UpdateLock } from './lib/update-lock.ts';

export async function updatePlugin(runnerPid: number, host: Host): Promise<string> {
  const config =
    host === 'claude'
      ? process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
      : process.env.CODEX_HOME || join(homedir(), '.codex');
  await mkdir(config, { recursive: true });
  const lock = await UpdateLock.acquire(join(config, 'celetis-update.lock'), runnerPid);
  try {
    if (host === 'claude') {
      await lock.run('claude', ['plugin', 'marketplace', 'update', 'celetis']);
      await lock.run('claude', ['plugin', 'update', 'celetis@celetis', '--scope', 'user']);
    } else await lock.run('codex', ['plugin', 'marketplace', 'upgrade', 'celetis']);
    const output = await lock.run(process.execPath, bunArgs(import.meta.path, ['--root', host]));
    const root = output.replace(/\n$/, '');
    if (!root) throw new HostError('plugin-update: the installed-root lookup returned no path');
    if (!(await stat(join(root, 'step-prompt.md')).catch(() => null))?.isFile())
      throw new HostError(`plugin-update: the installed folder has no step-prompt.md: ${root}`);
    return root;
  } finally {
    await lock.close();
  }
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--root' && args.length === 2 && (args[1] === 'claude' || args[1] === 'codex'))
      console.log(await installedRoot(args[1], process.cwd(), 3));
    else if (args.length === 2 && /^[1-9][0-9]*$/.test(args[0] ?? '') && (args[1] === 'claude' || args[1] === 'codex'))
      console.log(await updatePlugin(Number(args[0]), args[1]));
    else throw new HostError('plugin-update: expected the runner PID and host (claude or codex)');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = error instanceof HostError ? error.code : 1;
  }
}
