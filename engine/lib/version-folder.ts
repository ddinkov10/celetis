import { stat } from 'node:fs/promises';
import { join } from 'node:path';

export async function versionFolderGone(root: string): Promise<boolean> {
  try {
    return !(await stat(join(root, 'engine', 'celetis'))).isFile();
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    return code === 'ENOENT' || code === 'ENOTDIR';
  }
}
