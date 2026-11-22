import { devNull } from 'node:os';
import { run } from '../process/process.ts';
import type { IssueKey } from '../tracker/key.ts';
import { writeRefreshHint } from '../tracker/refresh-hints.ts';
import { FormatError } from './format.ts';
import { openStore, StoreError } from './store.ts';

export class SyncError extends Error {
  constructor(readonly line: string) {
    super(line);
  }
}

const base = ['--no-optional-locks', '-c', `core.hooksPath=${devNull}`];
const bugs = 'refs/bugs/';
const identities = 'refs/identities/';
const fetched = { bugs: 'refs/remotes/origin/bugs/', identities: 'refs/remotes/origin/identities/' };

const lineOf = (text: string, fallback: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.startsWith('warning:') && !line.startsWith('hint:')) ?? fallback;

async function tips(main: string, prefix: string, signal?: AbortSignal): Promise<Map<string, string>> {
  const result = await run(
    'git',
    [...base, 'for-each-ref', '--format=%(objectname) %(objecttype) %(refname)', prefix],
    {
      cwd: main,
      signal,
    },
  );
  if (result.code !== 0) throw new SyncError(lineOf(result.stderr, `git for-each-ref ${prefix} failed`));
  const found = new Map<string, string>();
  for (const line of result.stdout.split('\n')) {
    const [tip = '', type = '', ref = ''] = line.split(' ');
    if (ref.startsWith(prefix)) found.set(ref.slice(prefix.length), type === 'commit' ? tip : `${type}:${tip}`);
  }
  return found;
}

export async function localTips(main: string, signal?: AbortSignal): Promise<string> {
  const listed = [...(await tips(main, bugs, signal)), ...(await tips(main, identities, signal))];
  return listed.map(([id, tip]) => `${id} ${tip}`).join('\n');
}

const refusal = (error: unknown) =>
  error instanceof FormatError || (error instanceof StoreError && error.kind !== 'prerequisite') ? error.message : null;

export async function pullIssues(
  main: string,
  warn: (line: string) => void,
  signal?: AbortSignal,
): Promise<readonly IssueKey[]> {
  const fetch = await run(
    'git',
    [
      ...base,
      'fetch',
      '--quiet',
      '--no-write-fetch-head',
      '--',
      'origin',
      `+${bugs}*:${fetched.bugs}*`,
      `+${identities}*:${fetched.identities}*`,
    ],
    { cwd: main, signal },
  );
  if (fetch.code !== 0) throw new SyncError(lineOf(fetch.stderr, 'git fetch of origin failed'));
  const store = openStore(main, signal);
  const merged = async (ref: string, tip: string, merge: () => Promise<void>) => {
    try {
      if (tip.includes(':')) throw new FormatError('the ref does not name a commit', ref);
      await merge();
    } catch (error) {
      const line = refusal(error);
      if (line === null) throw error instanceof StoreError ? new SyncError(error.message) : error;
      warn(`${ref} of origin is not merged: ${line}`);
    }
  };
  for (const [id, tip] of await tips(main, fetched.identities, signal))
    await merged(`${identities}${id}`, tip, () => store.mergeIdentity(id, tip));
  const before = await tips(main, bugs, signal);
  for (const [id, tip] of await tips(main, fetched.bugs, signal))
    if (before.get(id) !== tip) await merged(`${bugs}${id}`, tip, () => store.merge(id, tip));
  const after = await tips(main, bugs, signal);
  const changed = [...after].filter(([id, tip]) => before.get(id) !== tip).map(([id]) => id.slice(0, 7) as IssueKey);
  for (const key of changed) await writeRefreshHint(main, key);
  return changed;
}

export async function pushIssues(main: string, warn: (line: string) => void, signal?: AbortSignal): Promise<void> {
  const specs = [
    ...((await tips(main, bugs, signal)).size > 0 ? [`${bugs}*:${bugs}*`] : []),
    ...((await tips(main, identities, signal)).size > 0 ? [`${identities}*:${identities}*`] : []),
  ];
  // A glob push that matches no local ref fails with "No refs in common".
  if (specs.length === 0) return;
  const push = () => run('git', [...base, 'push', '--porcelain', '--', 'origin', ...specs], { cwd: main, signal });
  let result = await push();
  const rejected = () => result.stdout.split('\n').find((line) => line.startsWith('!'));
  if (result.code !== 0 && rejected() !== undefined) {
    await pullIssues(main, warn, signal);
    result = await push();
  }
  if (result.code !== 0)
    throw new SyncError(rejected()?.replaceAll('\t', ' ') ?? lineOf(result.stderr, 'git push to origin failed'));
}
