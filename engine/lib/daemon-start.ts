import { join } from 'node:path';
import { bunArgs } from './process.ts';

export type DaemonForm =
  | readonly ['--prepare-state', 'queue']
  | readonly ['--prepare-state', 'session', string]
  | readonly ['--daemon', ...string[]]
  | readonly ['--session-start', ...string[]];

export function daemonArgv(root: string, form: DaemonForm): [string, ...string[]] {
  return [process.execPath, ...bunArgs(join(root, 'engine', 'celetis'), ['daemon', ...form])];
}
