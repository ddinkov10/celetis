import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ConfigError, readConfig } from './lib/config.ts';
import { commonDir, HostError, mainCheckout, requireBun, selectHost } from './lib/host.ts';
import { codexHome } from './lib/plugin-metadata.ts';
import { requireUpdatePolicy } from './lib/plugin-policy.ts';
import { bunArgs, childEnv } from './lib/process.ts';
import { selectSavedSession, serializeSession } from './lib/session.ts';
import { execConsumer, withPluginRead } from './lib/update-lock.ts';
import { main as updatePlugin } from './plugin-update.ts';

async function resume(issue: string, explicit: string | undefined, cwd: string) {
  const n = issue.replace(/^#/, '');
  if (!/^[1-9][0-9]*$/.test(n)) throw new HostError('celetis: resume needs an issue number', 2);
  const common = await commonDir(cwd);
  const main = dirname(common);
  const record = await selectSavedSession(main, Number(n), explicit, common);
  return { host: record.host, record: serializeSession(record) };
}

export async function main(argv: string[]): Promise<number> {
  try {
    requireBun();
    const args = [...argv];
    let explicit: string | undefined;
    if (args[0] === '--agent') {
      if (args.length < 3)
        throw new HostError(
          'usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent claude|codex <script> [<argument>...]',
          2,
        );
      explicit = args[1] ?? '';
      selectHost(explicit, {}, null);
      args.splice(0, 2);
    } else if (args.length === 0)
      throw new HostError(
        'usage: BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> <script> [<argument>...], e.g. BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros <plugin>/bin/celetis.ts --agent <host> next-step --open',
        2,
      );
    const name = args.shift() ?? '';
    if (!/^[a-z][a-z-]*$/.test(name)) throw new HostError(`celetis: the plugin has no script ${name}`, 2);
    const cwd = process.cwd();
    const main = await mainCheckout(cwd).catch(() => null);
    const saved =
      name === 'celetis-flow' && args.length === 2 && args[0] === '--resume'
        ? await resume(args[1] ?? '', explicit, cwd)
        : undefined;
    const host = saved?.host ?? selectHost(explicit, process.env, main);
    if (host === 'codex') process.env.CODEX_HOME = await codexHome();
    if (name === 'plugin-update') return updatePlugin(args, host);
    if (['worktree', 'celetis-flow', 'next-step', 'land', 'board'].includes(name)) {
      const checkout = main ?? (await mainCheckout(cwd));
      try {
        readConfig(checkout);
      } catch (error) {
        if (!(error instanceof ConfigError)) throw error;
        throw new HostError(`celetis: ${checkout}/.celetis.yaml: ${error.field}: ${error.message}`, 2);
      }
    }
    if (['celetis-flow', 'board'].includes(name)) await withPluginRead(host, () => requireUpdatePolicy(host, cwd));
    const folder = ['build', 'verify', 'install-tools'].includes(name) ? '../scripts' : '.';
    const entry = join(import.meta.dir, folder, `${name}.ts`);
    if (!(await stat(entry).catch(() => null))?.isFile())
      throw new HostError(`celetis: the plugin has no script ${name}`, 2);
    const env = childEnv({ ...process.env, CELETIS_AGENT: host });
    delete env.CELETIS_RESUME_RECORD;
    if (saved) env.CELETIS_RESUME_RECORD = saved.record;
    if (!process.execve) throw new HostError('celetis: process replacement needs macOS or Linux');
    return execConsumer(process.execPath, [process.execPath, ...bunArgs(entry, args)], env);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
