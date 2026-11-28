import { createHash } from 'node:crypto';
import { z } from 'zod';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import { releaseVersion } from '../release/release.ts';
import { tarballLimit } from './archive.ts';

export const integrityForm = /^sha512-[A-Za-z0-9+/]{85}[AQgw]==$/;
const packageName = 'celetis';
const defaultRegistry = 'https://registry.npmjs.org';
const documentLimit = 16 * 1024 * 1024;
const requestTimeout = 60_000;
const urlCharacters = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/;

const versionShape = z.looseObject({
  name: z.literal(packageName),
  version: releaseVersion,
  dist: z.looseObject({ integrity: z.string().regex(integrityForm), tarball: z.string() }),
});

// z.record drops a __proto__ key, so the entries are read from the parsed JSON object.
const documentShape = z.looseObject({
  name: z.literal(packageName),
  'dist-tags': z.looseObject({ latest: releaseVersion }),
  versions: z.custom<Record<string, unknown>>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  ),
});

type VersionEntry = z.output<typeof versionShape>;
export type PackageTarget = Readonly<
  Pick<VersionEntry, 'version'> & Pick<VersionEntry['dist'], 'integrity' | 'tarball'>
>;
export type PackageDocument = Readonly<{
  latest: z.output<typeof documentShape>['dist-tags']['latest'];
  versions: ReadonlyMap<string, PackageTarget>;
}>;

const refuse = (detail: string, cause?: unknown) =>
  new HostError(`celetis: the registry answer is not valid: ${detail}`, exits.prerequisite, { cause });

const unavailable = (url: string, detail: unknown) =>
  new HostError(
    `celetis: cannot read ${url}: ${detail instanceof Error ? detail.message : String(detail)}`,
    exits.blocked,
  );

export function registryBase(): string {
  const invalid = new HostError('celetis: BUN_CONFIG_REGISTRY must be an http or https URL', exits.usage);
  let url: URL;
  try {
    url = new URL(process.env.BUN_CONFIG_REGISTRY || defaultRegistry);
  } catch {
    throw invalid;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw invalid;
  return url.href.replace(/\/+$/, '');
}

function tarballUrl(value: string, registryOrigin: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw refuse('a tarball URL does not parse', error);
  }
  const trusted = url.protocol === 'https:' || (url.protocol === 'http:' && url.origin === registryOrigin);
  if (!trusted || url.username || url.password || url.href !== value || !urlCharacters.test(value))
    throw refuse('a tarball URL is not allowed');
  return value;
}

export function parseDocument(value: unknown, base: string): PackageDocument {
  const document = documentShape.safeParse(value);
  if (!document.success) throw refuse('the package document has another shape');
  const registryOrigin = new URL(base).origin;
  const versions = new Map<string, PackageTarget>();
  for (const [version, raw] of Object.entries(document.data.versions)) {
    const entry = versionShape.safeParse(raw);
    if (!entry.success || entry.data.version !== version) throw refuse('a version entry has another shape');
    const { integrity, tarball } = entry.data.dist;
    versions.set(version, { version, integrity, tarball: tarballUrl(tarball, registryOrigin) });
  }
  const latest = document.data['dist-tags'].latest;
  if (!versions.has(latest)) throw refuse('dist-tags.latest names no version');
  return { latest, versions };
}

async function readBody(url: string, accept: string, limit: number): Promise<Uint8Array | null> {
  let response: Response;
  try {
    // With no decompression, the limit counts the bytes on the wire, so a compressed body cannot expand past it.
    response = await fetch(url, {
      redirect: 'error',
      decompress: false,
      signal: AbortSignal.timeout(requestTimeout),
      headers: { accept, 'accept-encoding': 'identity' },
    });
  } catch (error) {
    throw unavailable(url, error);
  }
  if (response.status !== 200) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 404) return null;
    throw unavailable(url, `HTTP ${response.status}`);
  }
  if ((response.headers.get('content-encoding') ?? 'identity') !== 'identity') {
    await response.body?.cancel().catch(() => undefined);
    throw refuse('the body has a content encoding');
  }
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read().catch((error: unknown) => {
      throw unavailable(url, error);
    });
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      throw refuse('the body is over its size limit');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function readDocument(): Promise<PackageDocument | null> {
  const base = registryBase();
  const body = await readBody(
    `${base}/${packageName}`,
    'application/vnd.npm.install-v1+json, application/json',
    documentLimit,
  );
  if (body === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(body));
  } catch (error) {
    throw refuse('the package document is not JSON', error);
  }
  return parseDocument(value, base);
}

async function publishedDocument(): Promise<PackageDocument> {
  const document = await readDocument();
  if (document === null) throw new HostError(`celetis: the registry has no package ${packageName}`, exits.prerequisite);
  return document;
}

function targetOf(document: PackageDocument, version: string): PackageTarget {
  const target = document.versions.get(version);
  if (target === undefined)
    throw new HostError(`celetis: the registry has no ${packageName} ${version}`, exits.prerequisite);
  return target;
}

export async function latestTarget(): Promise<PackageTarget> {
  const document = await publishedDocument();
  return targetOf(document, document.latest);
}

export async function versionTarget(version: string): Promise<PackageTarget> {
  return targetOf(await publishedDocument(), version);
}

export async function download(target: PackageTarget): Promise<Uint8Array> {
  const body = await readBody(target.tarball, 'application/octet-stream', tarballLimit);
  if (body === null) throw unavailable(target.tarball, 'HTTP 404');
  if (`sha512-${createHash('sha512').update(body).digest('base64')}` !== target.integrity)
    throw refuse(`the tarball of ${packageName} ${target.version} does not match its integrity`);
  return body;
}
