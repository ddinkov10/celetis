import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import { engineRevision } from '../process/git.ts';

export type Ref = Readonly<{ kind: 'branch' | 'release'; name: string }>;

export const releaseTag = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

type Parts = readonly [number, number, number];

export function releaseParts(tag: string): Parts | null {
  const match = releaseTag.exec(tag);
  if (match === null) return null;
  const parts = match.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? (parts as unknown as Parts) : null;
}

function greater(a: Parts, b: Parts): boolean {
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return (a[index] as number) > (b[index] as number);
  }
  return false;
}

export function newestRelease(tags: readonly string[]): string | null {
  let newest: string | null = null;
  let best: Parts | null = null;
  for (const tag of tags) {
    const parts = releaseParts(tag);
    if (parts === null || (best !== null && !greater(parts, best))) continue;
    newest = tag;
    best = parts;
  }
  return newest;
}

export async function manifestVersion(root: string): Promise<string | null> {
  const file = join(root, 'plugins/celetis/.claude-plugin/plugin.json');
  let manifest: { version?: unknown };
  try {
    manifest = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new HostError(`celetis: cannot read the plugin manifest ${file}`, exits.prerequisite, { cause: error });
  }
  if (!('version' in manifest)) return null;
  if (typeof manifest.version !== 'string' || releaseParts(`v${manifest.version}`) === null)
    throw new HostError(`celetis: the plugin manifest ${file} has a version that is not X.Y.Z`, exits.prerequisite);
  return manifest.version;
}

export async function engineRelease(root: string): Promise<string> {
  return (await manifestVersion(root)) ?? (await engineRevision(root));
}
