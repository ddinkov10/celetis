import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { HostError } from '../command/errors.ts';
import { exits, servedContractsFile } from '../contract/contract.ts';
import type { EngineSource } from '../install/installation.ts';
import { unattended } from '../process/git.ts';
import {
  manifests,
  parseStamp,
  type ReleaseStamp,
  releaseParts,
  releaseSource,
  releaseVersion,
} from '../release/release.ts';
import { revision } from '../state/fields.ts';
import { followTarget, type Resolved, requestTarget, resolveRef } from '../update/target.ts';
import { type PackageFile, readArchive, recordFile } from './archive.ts';
import { download, integrityForm, latestTarget, type PackageTarget, versionTarget } from './registry.ts';

export { recordFile };

const manifestShape = z.looseObject({ version: z.unknown().optional() });

const recordShape = z.strictObject({
  version: releaseVersion,
  revision: z.string().regex(revision),
  integrity: z.string().regex(integrityForm),
});

export type PackageRecord = Readonly<z.output<typeof recordShape>>;

export async function readRecord(root: string): Promise<PackageRecord> {
  const file = join(root, recordFile);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new HostError(`celetis: cannot read the package record ${file}`, exits.prerequisite, { cause: error });
  }
  const record = recordShape.safeParse(value);
  if (!record.success) throw new HostError(`celetis: the package record ${file} is not valid`, exits.prerequisite);
  return record.data;
}

export async function writeRecord(root: string, record: PackageRecord): Promise<void> {
  await writeFile(join(root, recordFile), `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o644 });
}

export async function checkReleaseTag(stamp: ReleaseStamp, cwd: string): Promise<void> {
  const tag = `refs/tags/v${stamp.version}`;
  const { target } = await resolveRef(releaseSource, tag, cwd, undefined, unattended);
  if (target !== stamp.revision)
    throw new HostError(
      `celetis: ${tag} of ${releaseSource} is at ${target}, and the package names ${stamp.revision}; nothing changed`,
      exits.prerequisite,
    );
}

function manifestIn(files: PackageFile[], path: string): unknown {
  const file = files.find((entry) => entry.path === path);
  try {
    const manifest = file && manifestShape.safeParse(JSON.parse(new TextDecoder().decode(file.data)));
    return manifest?.success ? manifest.data.version : undefined;
  } catch {
    return undefined;
  }
}

export async function readTarget(
  target: PackageTarget,
  cwd: string,
): Promise<{ stamp: ReleaseStamp; files: PackageFile[] }> {
  const files = readArchive(await download(target));
  const stampFile = files.find(({ path }) => path === 'engine/release.json');
  if (stampFile === undefined)
    throw new HostError(`celetis: the package ${target.version} has no release stamp`, exits.prerequisite);
  const stamp = parseStamp(new TextDecoder().decode(stampFile.data));
  if (stamp.version !== target.version)
    throw new HostError(
      `celetis: the package ${target.version} holds a stamp of version ${stamp.version}`,
      exits.prerequisite,
    );
  for (const manifest of manifests)
    if (manifestIn(files, manifest) !== stamp.version)
      throw new HostError(
        `celetis: the package ${target.version} holds ${manifest} of another version`,
        exits.prerequisite,
      );
  await checkReleaseTag(stamp, cwd);
  return { stamp, files };
}

type EngineTarget = Readonly<{ to: EngineSource; full: string; contract: string | null }>;

async function packageTarget(source: EngineSource, target: PackageTarget, cwd: string): Promise<EngineTarget> {
  const full = `refs/tags/v${target.version}`;
  if (source.kind === 'package' && source.version === target.version) {
    if (source.integrity !== target.integrity)
      throw new HostError(
        `update: the registry integrity of ${target.version} differs from the installed package; nothing changed`,
        exits.prerequisite,
      );
    return { to: source, full, contract: null };
  }
  const { stamp, files } = await readTarget(target, cwd);
  const contract = files.find(({ path }) => path === servedContractsFile);
  return {
    to: {
      kind: 'package',
      source: stamp.source,
      version: stamp.version,
      revision: stamp.revision,
      integrity: target.integrity,
    },
    full,
    contract: contract === undefined ? null : new TextDecoder().decode(contract.data),
  };
}

function branchTarget(source: string, resolved: Resolved): EngineTarget {
  if (resolved.ref.kind !== 'branch')
    throw new HostError(
      `update: ${resolved.full} is a release; install it with bunx celetis@latest install`,
      exits.prerequisite,
    );
  return {
    to: { kind: 'git', source, ref: { kind: 'branch', name: resolved.ref.name }, revision: resolved.target },
    full: resolved.full,
    contract: null,
  };
}

export async function engineTarget(source: EngineSource, request: string | null, cwd: string): Promise<EngineTarget> {
  if (request === null)
    return source.kind === 'package'
      ? packageTarget(source, await latestTarget(), cwd)
      : branchTarget(source.source, await followTarget(source.source, source.ref, cwd));
  if (releaseParts(request) !== null) return packageTarget(source, await versionTarget(request.slice(1)), cwd);
  return branchTarget(source.source, await requestTarget(source.source, request, cwd));
}
