import { constants } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import { type RepositoryLayout, repositoryLayout, withLock, writeAtomic } from '../state/state.ts';
import { commitLine, issueLine, sample } from './trend-lines.ts';
import type { CacheLine, DeliveryWindow, Sample } from './types.ts';

const hour = 3_600_000;
const day = 24 * hour;
const week = 7 * day;
const sampleKeep = week;
const cacheKeep = 56 * day;

type Parsed = Record<string, unknown>;
type CommitLine = Extract<CacheLine, { sha: string }>;

async function readLines(path: string): Promise<Parsed[] | null> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const lines: Parsed[] = [];
  for (const line of source.split('\n')) {
    try {
      const value: unknown = JSON.parse(line);
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) lines.push(value as Parsed);
    } catch {}
  }
  return lines;
}

function sampleOf(line: Parsed): Sample | null {
  const found = sample.safeParse(line);
  return found.success ? { at: found.data.at, needs: found.data.needs, working: found.data.working } : null;
}

function cacheOf(line: Parsed): CacheLine | null {
  if ('sha' in line) {
    const found = commitLine.safeParse(line);
    return found.success ? { sha: found.data.sha, issue: found.data.issue, at: found.data.at } : null;
  }
  const found = issueLine.safeParse(line);
  return found.success ? { issue: found.data.issue, createdAt: found.data.createdAt } : null;
}

const present = <T>(value: T | null): value is T => value !== null;
const serialized = (values: readonly unknown[]) => values.map((value) => `${JSON.stringify(value)}\n`).join('');

export async function readSamples(common: string): Promise<Sample[]> {
  return ((await readLines(repositoryLayout(common).trendSamples)) ?? []).map(sampleOf).filter(present);
}

export async function readCache(common: string): Promise<CacheLine[]> {
  return ((await readLines(repositoryLayout(common).trendCache)) ?? []).map(cacheOf).filter(present);
}

async function append(common: string, file: (layout: RepositoryLayout) => string, data: string): Promise<void> {
  const layout = repositoryLayout(common);
  await withLock(layout.trendsLock, async () => {
    const handle = await open(
      file(layout),
      constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.write(data);
    } finally {
      await handle.close();
    }
  });
}

export async function appendSample(common: string, sample: Sample): Promise<void> {
  await append(common, (layout) => layout.trendSamples, serialized([sample]));
}

export async function appendCache(common: string, lines: readonly CacheLine[]): Promise<void> {
  if (lines.length > 0) await append(common, (layout) => layout.trendCache, serialized(lines));
}

export async function pruneTrends(common: string, now: number): Promise<void> {
  const layout = repositoryLayout(common);
  await withLock(layout.trendsLock, async () => {
    if (await readLines(layout.trendSamples)) {
      const kept = (await readSamples(common)).filter((sample) => Date.parse(sample.at) >= now - sampleKeep);
      await writeAtomic(layout.trendSamples, serialized(kept));
    }
    if (await readLines(layout.trendCache)) {
      const lines = await readCache(common);
      const commits = lines.filter(
        (line): line is CommitLine => 'sha' in line && Date.parse(line.at) >= now - cacheKeep,
      );
      const named = new Set(commits.map((line) => line.issue));
      const issues = lines.filter((line) => !('sha' in line) && named.has(line.issue));
      await writeAtomic(layout.trendCache, serialized([...commits, ...issues]));
    }
  });
}

export function hourlySeries(samples: readonly Sample[], now: number, key: 'needs' | 'working'): (number | null)[] {
  const current = new Date(now);
  const starts = Array.from({ length: 25 }, (_, i) =>
    new Date(current.getFullYear(), current.getMonth(), current.getDate(), current.getHours() - 23 + i).getTime(),
  );
  const series: (number | null)[] = Array.from({ length: 24 }, () => null);
  for (const sample of samples) {
    const value = sample[key];
    const at = Date.parse(sample.at);
    const index = starts.findIndex((start, i) => i < 24 && at >= start && at < (starts[i + 1] ?? 0));
    if (value !== null && index >= 0 && value > (series[index] ?? -1)) series[index] = value;
  }
  return series;
}

export function deliveryWindows(landings: readonly { at: number; createdAt: number }[], now: number): DeliveryWindow[] {
  return Array.from({ length: 8 }, (_, k) => {
    const days = landings
      .filter(({ at }) => at > now - (8 - k) * week && at <= now - (7 - k) * week)
      .map(({ at, createdAt }) => (at - createdAt) / day)
      .sort((a, b) => a - b);
    const middle = days.length >> 1;
    const medianDays =
      days.length === 0 ? null : days.length % 2 ? days[middle] : ((days[middle - 1] ?? 0) + (days[middle] ?? 0)) / 2;
    return { landed: days.length, medianDays: medianDays ?? null };
  });
}
