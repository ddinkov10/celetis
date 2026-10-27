import { access, constants, realpath, stat } from 'node:fs/promises';
import { join, sep } from 'node:path';
import type { Host } from '../lib/config.ts';
import { installedRoot } from '../lib/host.ts';
import { bunArgs, childEnv } from '../lib/process.ts';
import { selectSavedSession } from '../lib/session.ts';
import { worktrees } from '../lib/worktree.ts';

export type Adapter = Readonly<{
  run(number: number, agent: Host): Promise<string>;
  resume(number: number): Promise<string>;
}>;

const CONTROL = /[\u0000-\u001f\u007f]/;
const isInside = (folder: string, path: string) => path === folder || path.startsWith(`${folder}${sep}`);
// PowerShell also reads U+2018 to U+201B as single quotes.
const quote = (text: string) =>
  process.platform === 'win32'
    ? `'${text.replace(/['\u2018-\u201b]/g, (mark) => mark + mark)}'`
    : `'${text.replaceAll("'", "'\\''")}'`;

function refuse(message: string): never {
  throw new Error(message);
}

async function checkFile(path: string, subject: string, permission: number): Promise<void> {
  if (CONTROL.test(path)) refuse(`${subject} path has a control character`);
  const file = await stat(path).catch((error: NodeJS.ErrnoException) => {
    if (!error.code) throw error;
    return refuse(`${subject} does not exist: ${path}`);
  });
  if (!file.isFile()) refuse(`${subject} is not a regular file: ${path}`);
  await access(path, permission).catch(() =>
    refuse(`${subject} is not ${permission === constants.R_OK ? 'readable' : 'executable'}: ${path}`),
  );
}

export async function celetisAdapter(
  main: string,
  find: (host: Host, cwd: string) => Promise<string> = installedRoot,
): Promise<Adapter> {
  await checkFile(process.execPath, 'runtime', constants.X_OK);
  const entryOf = async (host: Host) => {
    const path = join(await find(host, main), 'bin/celetis.ts');
    await checkFile(path, 'package entrypoint', constants.R_OK);
    // Bun's realpath needs read permission on macOS, so it runs after the read check and never on the runtime.
    const entry = await realpath(path);
    if (CONTROL.test(entry)) refuse('package entrypoint path has a control character');
    if (isInside(await realpath(main), entry)) refuse('package entrypoint is inside the main checkout');
    for (const tree of await worktrees(main))
      if (isInside(await realpath(tree.path), entry)) refuse('package entrypoint is inside a lane worktree');
    return entry;
  };
  const env = Object.entries(childEnv({}));
  const words = (items: string[]) => items.map(quote).join(' ');
  const line = (entry: string, args: string[], number: number) => {
    const command = [process.execPath, ...bunArgs(entry, args)];
    if (process.platform === 'win32')
      return `${env.map(([name, value]) => `$env:${name}=${quote(value as string)}; `).join('')}& ${words(command)} ${number}; if ($?) { exit }`;
    return `${words(['/usr/bin/env', ...env.map(([name, value]) => `${name}=${value}`), ...command])} ${number} && exit`;
  };
  return {
    run: async (number, agent) => line(await entryOf(agent), ['--agent', agent, 'celetis-flow'], number),
    resume: async (number) => {
      const record = await selectSavedSession(main, number);
      return line(await entryOf(record.host), ['celetis-flow', '--resume'], number);
    },
  };
}
