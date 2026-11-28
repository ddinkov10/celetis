import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import { run } from '../process/process.ts';
import { revision } from '../state/fields.ts';
import { fits } from '../state/schemas.ts';

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
  if (!fits(releaseVersion, manifest.version))
    throw new HostError(`celetis: the plugin manifest ${file} has a version that is not X.Y.Z`, exits.prerequisite);
  return manifest.version;
}

export const releaseSource = 'https://github.com/ddinkov10/celetis.git';

export const manifests = ['plugins/celetis/.claude-plugin/plugin.json', 'plugins/celetis/.codex-plugin/plugin.json'];

export const releaseVersion = z.string().refine((value) => releaseParts(`v${value}`) !== null);

const stampShape = z.strictObject({
  version: releaseVersion,
  revision: z.string().regex(revision),
  source: z.literal(releaseSource),
});

export type ReleaseStamp = Readonly<z.output<typeof stampShape>>;

export function parseStamp(text: string): ReleaseStamp {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new HostError('celetis: the release stamp is not JSON', exits.prerequisite, { cause: error });
  }
  const stamp = stampShape.safeParse(value);
  if (!stamp.success) throw new HostError('celetis: the release stamp is not valid', exits.prerequisite);
  return stamp.data;
}

export async function readStamp(root: string): Promise<ReleaseStamp> {
  const file = join(root, 'engine/release.json');
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    throw new HostError(`celetis: cannot read the release stamp ${file}`, exits.prerequisite, { cause: error });
  }
  return parseStamp(text);
}

export async function hasGitEntry(root: string): Promise<boolean> {
  const entry = join(root, '.git');
  try {
    await lstat(entry);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw new HostError(`celetis: cannot read ${entry}`, exits.blocked, { cause: error });
  }
}

export async function engineRevision(root: string): Promise<string> {
  if (!(await hasGitEntry(root))) return (await readStamp(root)).revision;
  const result = await run('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root });
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), exits.blocked);
  return result.stdout.trimEnd();
}

export async function engineRelease(root: string): Promise<string> {
  return (await manifestVersion(root)) ?? (await engineRevision(root));
}
