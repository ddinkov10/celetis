import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ConfigError, readConfig } from './lib/config.ts';
import { commonDir, HostError, installedRoot, mainCheckout, requireBun, selectHost } from './lib/host.ts';
import { bunArgs, childEnv } from './lib/process.ts';
import { selectSavedSession, serializeSession } from './lib/session.ts';

async function resume(issue: string, explicit: string | undefined, cwd: string) {
  const n = issue.replace(/^#/, '');
  if (!/^[1-9][0-9]*$/.test(n)) throw new HostError('celetis: resume needs an issue number', 2);
  const common = await commonDir(cwd);
  const main = dirname(common);
  const record = await selectSavedSession(main, Number(n), explicit);
  return { host: record.host, record: serializeSession(record) };
}

export async function main(argv: string[]): Promise<number> {
  try {
    requireBun();
    const args = [...argv];
    let explicit: string | undefined;
    if (args[0] === '--agent') {
      if (args.length < 3)
        throw new HostError('usage: scripts/celetis --agent claude|codex <script> [<argument>...]', 2);
      explicit = args[1] ?? '';
      selectHost(explicit, {}, null);
      args.splice(0, 2);
    } else if (args.length === 0)
      throw new HostError('usage: scripts/celetis <script> [<argument>...], e.g. scripts/celetis next-step --open', 2);
    const name = args.shift() ?? '';
    if (!/^[a-z][a-z-]*$/.test(name)) throw new HostError(`celetis: the plugin has no script ${name}`, 2);
    const cwd = process.cwd();
    const main = await mainCheckout(cwd).catch(() => null);
    const saved =
      name === 'celetis-flow' && args.length === 2 && args[0] === '--resume'
        ? await resume(args[1] ?? '', explicit, cwd)
        : undefined;
    const host = saved?.host ?? selectHost(explicit, process.env, main);
    const root = await installedRoot(host, cwd);
    if (['worktree', 'celetis-flow', 'next-step', 'land', 'board'].includes(name)) {
      const checkout = main ?? (await mainCheckout(cwd));
      try {
        readConfig(checkout);
      } catch (error) {
        if (!(error instanceof ConfigError)) throw error;
        throw new HostError(`celetis: ${checkout}/.celetis.yaml: ${error.field}: ${error.message}`, 2);
      }
    }
    const entry = join(root, 'scripts', `${name}.ts`);
    if (!(await stat(entry).catch(() => null))?.isFile())
      throw new HostError(`celetis: the plugin has no script ${name}`, 2);
    const env = childEnv({ ...process.env, CELETIS_AGENT: host });
    delete env.CELETIS_RESUME_RECORD;
    if (saved) env.CELETIS_RESUME_RECORD = saved.record;
    if (!process.execve) throw new HostError('celetis: process replacement needs macOS or Linux');
    return process.execve(process.execPath, [process.execPath, ...bunArgs(entry, args)], env);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
