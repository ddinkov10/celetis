import { access, constants, realpath, stat } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { bunArgs, childEnv } from '../lib/process.ts';
import { worktrees } from '../lib/worktree.ts';

export type Adapter = Readonly<{
  run(number: number, agent: string): string;
  resume(number: number): string;
  hasEntry(): Promise<boolean>;
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

export async function celetisAdapter(main: string): Promise<Adapter> {
  const path = join(dirname(dirname(import.meta.dir)), 'bin/celetis.ts');
  await checkFile(path, 'package entrypoint', constants.R_OK);
  // Bun's realpath needs read permission on macOS, so it runs after the read check and never on the runtime.
  const entry = await realpath(path);
  if (CONTROL.test(entry)) refuse('package entrypoint path has a control character');
  if (isInside(await realpath(main), entry)) refuse('package entrypoint is inside the main checkout');
  for (const tree of await worktrees(main))
    if (isInside(await realpath(tree.path), entry)) refuse('package entrypoint is inside a lane worktree');
  await checkFile(process.execPath, 'runtime', constants.X_OK);
  const env = Object.entries(childEnv({}));
  const words = (items: string[]) => items.map(quote).join(' ');
  const line = (args: string[], number: number) => {
    const command = [process.execPath, ...bunArgs(entry, args)];
    if (process.platform === 'win32')
      return `${env.map(([name, value]) => `$env:${name}=${quote(value as string)}; `).join('')}& ${words(command)} ${number}; if ($?) { exit }`;
    return `${words(['/usr/bin/env', ...env.map(([name, value]) => `${name}=${value}`), ...command])} ${number} && exit`;
  };
  return {
    run: (number, agent) => line(['--agent', agent, 'celetis-flow'], number),
    resume: (number) => line(['celetis-flow', '--resume'], number),
    hasEntry: () =>
      stat(entry).then(
        (file) => file.isFile(),
        () => false,
      ),
  };
}
