import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { HostError } from '../command/errors.ts';
import { contractVersions } from '../contract/contract.ts';
import { readEngine } from '../install/installation.ts';
import { versionFolderGone } from '../install/version-folder.ts';

export type Served = Readonly<{ contract: number; digest: string }>;
export type StartEngine = Readonly<{ root: string; served: Served }>;
export type Pick = Readonly<{ kind: 'run'; root: string }> | Readonly<{ kind: 'refused'; line: string }>;

const versionsSchema = z.object({ serves: z.array(z.object({ contract: z.number().int(), digest: z.string() })) });

export function startEngine(root: string): StartEngine {
  const served = contractVersions.serves.reduce((top, entry) => (entry.contract > top.contract ? entry : top));
  return { root, served: { contract: served.contract, digest: served.digest } };
}

async function serves(root: string, { contract, digest }: Served): Promise<boolean> {
  try {
    const read = versionsSchema.safeParse(
      JSON.parse(await readFile(join(root, 'engine', 'lib', 'contract', 'versions.json'), 'utf8')),
    );
    return read.success && read.data.serves.some((entry) => entry.contract === contract && entry.digest === digest);
  } catch {
    return false;
  }
}

export async function pickEngine(start: StartEngine): Promise<Pick> {
  let failure: string | null = null;
  try {
    const engine = await readEngine();
    if (!engine) {
      if (!(await versionFolderGone(start.root))) return { kind: 'run', root: start.root };
      return {
        kind: 'refused',
        line: 'celetis: an update removed the engine version of this session; start a fresh session',
      };
    }
    if (engine.root === start.root || (await serves(engine.root, start.served)))
      return { kind: 'run', root: engine.root };
  } catch (error) {
    failure =
      error instanceof HostError
        ? error.message
        : `celetis: the installed engine cannot be read: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (!(await versionFolderGone(start.root))) return { kind: 'run', root: start.root };
  return {
    kind: 'refused',
    line:
      failure ??
      `celetis: the installed engine does not serve contract ${start.served.contract} of the tools of this session; start a fresh session`,
  };
}
