import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { daemonSockets } from '../state/state.ts';
import { parseStatus } from './types.ts';

export async function liveRevisions(): Promise<ReadonlySet<string> | null> {
  let names: string[];
  try {
    names = await readdir(daemonSockets.path);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT' ? new Set() : null;
  }
  const revisions = await Promise.all(
    names
      .filter((name) => name.endsWith('.sock'))
      .map(async (name) => {
        try {
          const response = await fetch('http://daemon/status', {
            unix: join(daemonSockets.path, name),
            signal: AbortSignal.timeout(5000),
          });
          return parseStatus(await response.json()).daemon.revision;
        } catch (error) {
          const code = (error as { code?: unknown }).code;
          return code === 'ENOENT' || code === 'ECONNREFUSED' ? '' : null;
        }
      }),
  );
  const live = new Set<string>();
  for (const revision of revisions) {
    if (revision === null) return null;
    if (revision) live.add(revision);
  }
  return live;
}
