export const BUN_NEEDED = 'Bun 1.4.2 or later is necessary';

export const isBunOk = (version: string): boolean => Bun.semver.order(version, '1.4.2') >= 0;

export const cleanPath = (value: string, delimiter = ':'): string =>
  value
    .split(delimiter)
    .filter((item) => !/node_modules\/\.bin\/*$/.test(item))
    .join(delimiter);

import { open } from 'node:fs/promises';
import { bunArgs, bunShebang, childEnv } from '../scripts/lib/process.ts';
import type { Command } from './types.ts';

export async function bindRuntime(command: Command): Promise<Command> {
  const [real, ...args] = command;
  const file = await open(real, 'r').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'EACCES' || error.code === 'EPERM') return null;
    throw error;
  });
  if (!file) return command;
  try {
    const prefix = Buffer.alloc(512);
    const { bytesRead } = await file.read(prefix, 0, prefix.length, 0);
    if (prefix.toString('utf8', 0, bytesRead).split('\n')[0] === bunShebang)
      return [
        '/usr/bin/env',
        ...Object.entries(childEnv({})).map(([name, value]) => `${name}=${value}`),
        process.execPath,
        ...bunArgs(real, args),
      ];
  } finally {
    await file.close();
  }
  return command;
}
