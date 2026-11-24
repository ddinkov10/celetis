import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import { git } from '../process/git.ts';
import { run } from '../process/process.ts';
import { newestRelease, type Ref, releaseParts } from '../release/release.ts';
import { revision } from '../state/fields.ts';

export type Resolved = Readonly<{ ref: Ref; full: string; target: string }>;

export const fullRef = (ref: Ref) => `refs/${ref.kind === 'branch' ? 'heads' : 'tags'}/${ref.name}`;

function records(remote: string, invalid: string): string[][] {
  const lines = remote
    .split('\n')
    .filter((line) => line && !line.startsWith('ref: '))
    .map((line) => line.split('\t'));
  if (lines.some(([sha, name]) => !sha || !revision.test(sha) || !name)) throw new HostError(invalid, exits.blocked);
  return lines;
}

const peeled = (lines: string[][], full: string) =>
  lines.find(([, name]) => name === `${full}^{}`)?.[0] ?? lines.find(([, name]) => name === full)?.[0];

const shortRef = (name: string) =>
  releaseParts(name) === null ? [`refs/heads/${name}`, `refs/tags/${name}`] : [`refs/tags/${name}`];

// `git ls-remote` matches a pattern at the end of a ref name, so `exact` names the refs that count.
export async function resolveRef(
  source: string,
  name: string,
  cwd: string,
  exact: readonly string[] | null = name.startsWith('refs/') ? [name] : name === 'HEAD' ? null : shortRef(name),
  execute: typeof run = run,
): Promise<Resolved> {
  let remote: string;
  try {
    remote = await git(['ls-remote', '--symref', '--', source, name, `${name}^{}`], cwd, execute);
  } catch (error) {
    throw new HostError(
      `update: cannot resolve configured Git ref ${name}: ${(error as Error).message}`,
      exits.blocked,
    );
  }
  const names = new Map<string, string>();
  for (const line of remote.split('\n'))
    if (line.startsWith('ref: ')) {
      const [symref = '', base = ''] = line.slice(5).split('\t');
      names.set(base, symref);
    }
  const lines = records(remote, `update: invalid remote revision for configured ref ${name}`);
  const base = lines.filter(([, ref = '']) => !ref.endsWith('^{}') && (exact === null || exact.includes(ref)));
  if (base.length !== 1)
    throw new HostError(
      `update: configured ref ${name} is missing or ambiguous; choose one native Git ref`,
      exits.prerequisite,
    );
  const selected = base[0]?.[1] ?? '';
  const target = peeled(lines, selected);
  if (!target) throw new HostError(`update: no full revision for configured ref ${name}`, exits.blocked);
  const full = names.get(selected) || selected;
  if (full.startsWith('refs/heads/')) return { ref: { kind: 'branch', name: full.slice(11) }, full, target };
  if (full.startsWith('refs/tags/')) {
    const tag = full.slice(10);
    if (releaseParts(tag) === null)
      throw new HostError(
        `update: ${name} is a tag of ${source} but no release tag of the form vX.Y.Z`,
        exits.prerequisite,
      );
    return { ref: { kind: 'release', name: tag }, full, target };
  }
  throw new HostError(`update: ${name} of ${source} is no branch and no release tag`, exits.prerequisite);
}

export async function requestTarget(source: string, request: string, cwd: string): Promise<Resolved> {
  const resolved = await resolveRef(source, request, cwd, shortRef(request));
  if (resolved.ref.kind === 'branch' && releaseParts(request) !== null)
    throw new HostError(`update: ${request} is a branch of ${source} but no release tag`, exits.prerequisite);
  return resolved;
}

export async function newestTarget(source: string, cwd: string): Promise<Resolved> {
  let remote: string;
  try {
    remote = await git(['ls-remote', '--tags', '--', source, 'refs/tags/v*'], cwd);
  } catch (error) {
    throw new HostError(
      `update: cannot list the release tags of ${source}: ${(error as Error).message}`,
      exits.blocked,
    );
  }
  const lines = records(remote, `update: invalid remote revision for a release tag of ${source}`);
  const tags = lines.flatMap(([, ref]) =>
    ref?.startsWith('refs/tags/') && !ref.endsWith('^{}') ? [ref.slice(10)] : [],
  );
  const newest = newestRelease(tags);
  const full = `refs/tags/${newest}`;
  const target = newest === null ? undefined : peeled(lines, full);
  if (newest === null || !target)
    throw new HostError(`update: ${source} has no release tag vX.Y.Z; nothing changed`, exits.prerequisite);
  return { ref: { kind: 'release', name: newest }, full, target };
}

export function followTarget(source: string, current: Ref, cwd: string): Promise<Resolved> {
  return current.kind === 'branch' ? resolveRef(source, fullRef(current), cwd) : newestTarget(source, cwd);
}
