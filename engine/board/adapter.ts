import { access, constants, lstat } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { bunArgs } from '../lib/process.ts';
import { worktrees } from '../lib/worktree.ts';
import { AGENT, ConfigError, NUMBER } from './config.ts';
import { realpath } from './realpath.ts';
import type { Command, Config } from './types.ts';

const CONTROL = /[\u0000-\u001f\u007f]/;
const isInside = (folder: string, path: string) => path === folder || path.startsWith(`${folder}${sep}`);

async function checkedFile(path: string, subject: string, permission: number): Promise<string> {
  if (CONTROL.test(path)) throw new ConfigError(`${subject} path has a control character`);
  const real = await realpath(path).catch((error: NodeJS.ErrnoException) => {
    if (!error.code) throw error;
    throw new ConfigError(`${subject} does not exist: ${path}`);
  });
  if (CONTROL.test(real)) throw new ConfigError(`${subject} path has a control character`);
  if (!(await lstat(real)).isFile()) throw new ConfigError(`${subject} is not a regular file: ${path}`);
  await access(real, permission).catch(() => {
    throw new ConfigError(`${subject} is not ${permission === constants.R_OK ? 'readable' : 'executable'}: ${path}`);
  });
  return real;
}

export async function celetisConfig(main: string, port: number): Promise<Config> {
  const entry = await checkedFile(
    join(dirname(dirname(import.meta.dir)), 'bin/celetis.ts'),
    'package entrypoint',
    constants.R_OK,
  );
  if (isInside(await realpath(main), entry)) throw new ConfigError('package entrypoint is inside the main checkout');
  for (const tree of await worktrees(main))
    if (isInside(await realpath(tree.path), entry))
      throw new ConfigError('package entrypoint is inside a lane worktree');
  await checkedFile(process.execPath, 'runtime', constants.X_OK);
  const command = (args: string[]): Command => [process.execPath, ...bunArgs(entry, args)];
  return {
    data: command(['celetis-flow', '--board']),
    run: command(['--agent', AGENT, 'celetis-flow', NUMBER]),
    resume: command(['celetis-flow', '--resume', NUMBER]),
    port,
  };
}
