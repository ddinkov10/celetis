import { lstat, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { type ProcessState, processState } from '../process/identity.ts';
import { ensureFolder, type Folder } from '../state/state.ts';
import type { Barrier } from './record.ts';

export type Disposal = Readonly<{ target: string } & ({ moved: true } | { moved: false; cause: string })>;

const described = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function disposeRunRecord(path: string, folder: Folder, id: string, at: Date): Promise<Disposal> {
  // Windows refuses ':' in a file name.
  const target = join(folder.path, `${id}@${at.toISOString().replace(/[-:]/g, '')}.json`);
  try {
    ensureFolder(folder);
  } catch (error) {
    return { target, moved: false, cause: described(error) };
  }
  // Only the master daemon, which holds `daemon`, writes the folder, so no file appears between the check and the rename.
  try {
    await lstat(target);
    return { target, moved: false, cause: 'a file of that name exists' };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return { target, moved: false, cause: described(error) };
  }
  try {
    await rename(path, target);
  } catch (error) {
    return { target, moved: false, cause: described(error) };
  }
  return { target, moved: true };
}

export async function refusalSession(
  barrier: Barrier | null,
  read: (pid: number, start: string) => Promise<ProcessState> = processState,
): Promise<ProcessState | null> {
  if (barrier === null) return null;
  try {
    return await read(barrier.pid, barrier.start);
  } catch {
    return 'unknown';
  }
}
