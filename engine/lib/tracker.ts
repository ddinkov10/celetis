import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEpicAcceptance, parseEpicChildren, parseEpicRepository } from './epic-acceptance.ts';
import { run } from './process.ts';
import type { Entry, EpicSnapshot, IssueData } from './workflow.ts';

export type Issue = Readonly<{
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  labels: readonly string[];
  body: string | null;
  comments: number;
  updatedAt: string;
  closedAt: string | null;
  pull: boolean;
}>;

export type Edit = Readonly<{
  body?: string;
  state?: 'closed';
  state_reason?: 'completed' | 'not_planned';
}>;

export type GitHub = Readonly<{
  api<T = unknown>(endpoint: string): Promise<T>;
  list(endpoint: string): Promise<unknown[]>;
  history(issue: Issue): Promise<readonly Entry[]>;
  read(n: string): Promise<Readonly<{ issue: Issue; data: IssueData }>>;
  epic(n: string): Promise<EpicSnapshot>;
  comment(n: string, text: string): Promise<void>;
  addLabels(n: string, names: readonly string[]): Promise<void>;
  removeLabel(n: string, name: string): Promise<void>;
  edit(n: string, fields: Edit): Promise<void>;
  stderr(): string;
}>;

function malformed(): Error {
  return new Error('malformed GitHub data');
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw malformed();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw malformed();
  return value;
}

export function parseIssue(raw: unknown): Issue {
  const issue = record(raw);
  const { number, state, labels, body, comments, closed_at: closedAt, pull_request: pull } = issue;
  if (
    typeof number !== 'number' ||
    (state !== 'open' && state !== 'closed') ||
    !Array.isArray(labels) ||
    typeof comments !== 'number' ||
    (pull !== undefined && pull !== null && typeof pull !== 'object')
  )
    throw malformed();
  return {
    number,
    title: text(issue.title),
    url: text(issue.html_url),
    state,
    labels: labels.map((label) => text(record(label).name)),
    body: body === null ? null : text(body),
    comments,
    updatedAt: text(issue.updated_at),
    closedAt: closedAt === null ? null : text(closedAt),
    pull: Boolean(pull),
  };
}

export function parseTimeline(entries: readonly unknown[]): Entry[] {
  return entries.flatMap((raw): Entry[] => {
    const entry = record(raw);
    const event = text(entry.event);
    if (!event || /[\s\0]/.test(event)) throw malformed();
    switch (event) {
      case 'commented':
        if (typeof entry.id !== 'number') throw malformed();
        return [{ kind: 'comment', id: entry.id, at: text(entry.created_at), body: text(entry.body) }];
      case 'labeled':
      case 'unlabeled':
        return [
          {
            kind: 'label',
            change: event === 'labeled' ? 'added' : 'removed',
            name: text(record(entry.label).name),
            at: text(entry.created_at),
          },
        ];
      default:
        return [];
    }
  });
}

export function issueData(issue: Issue, history: readonly Entry[]): IssueData {
  return { state: issue.state, labels: issue.labels, body: issue.body, history };
}

export function github(cwd: string, signal?: AbortSignal): GitHub {
  let stderr = '';

  async function call(endpoint: string, paginate: boolean): Promise<unknown> {
    signal?.throwIfAborted();
    const result = await run(
      'gh',
      ['api', ...(paginate ? ['--paginate', '--slurp'] : []), `repos/{owner}/{repo}${endpoint ? `/${endpoint}` : ''}`],
      { cwd, signal },
    );
    signal?.throwIfAborted();
    stderr += result.stderr;
    if (result.code !== 0) throw new Error('GitHub read failed');
    return JSON.parse(result.stdout);
  }

  async function list(endpoint: string): Promise<unknown[]> {
    const pages = await call(endpoint, true);
    if (!Array.isArray(pages) || !pages.every(Array.isArray)) throw malformed();
    return pages.flat();
  }

  async function send(method: 'POST' | 'PATCH' | 'DELETE', endpoint: string, fields?: object): Promise<void> {
    signal?.throwIfAborted();
    const folder = fields === undefined ? null : await mkdtemp(join(tmpdir(), 'celetis-gh.'));
    try {
      const input = folder === null ? [] : ['--input', join(folder, 'input.json')];
      if (folder !== null) await writeFile(join(folder, 'input.json'), JSON.stringify(fields), { mode: 0o600 });
      const result = await run('gh', ['api', '-X', method, `repos/{owner}/{repo}/${endpoint}`, '--silent', ...input], {
        cwd,
        signal,
      });
      signal?.throwIfAborted();
      if (result.code !== 0) throw new Error(`${result.stdout}${result.stderr}`.trimEnd());
      stderr += result.stderr;
    } finally {
      if (folder !== null) await rm(folder, { recursive: true, force: true });
    }
  }

  async function history(issue: Issue): Promise<readonly Entry[]> {
    return issue.comments === 0 ? [] : parseTimeline(await list(`issues/${issue.number}/timeline?per_page=100`));
  }

  return {
    api: async <T = unknown>(endpoint: string) => (await call(endpoint, false)) as T,
    list,
    history,
    async read(n: string) {
      const issue = parseIssue(await call(`issues/${n}`, false));
      return { issue, data: issueData(issue, await history(issue)) };
    },
    async epic(n: string) {
      if (!/^[1-9][0-9]*$/.test(n) || !Number.isSafeInteger(Number(n))) throw malformed();
      const rawRepository = record(await call('', false));
      const repository = parseEpicRepository(rawRepository.html_url);
      if (
        !Number.isSafeInteger(rawRepository.id) ||
        Number(rawRepository.id) <= 0 ||
        rawRepository.full_name !== new URL(repository).pathname.slice(1)
      )
        throw malformed();
      const rawParent = record(await call(`issues/${n}`, false));
      const issue = parseIssue(rawParent);
      if (
        Object.hasOwn(rawParent, 'pull_request') ||
        issue.number !== Number(n) ||
        issue.url !== `${repository}/issues/${n}` ||
        !Number.isSafeInteger(issue.comments) ||
        issue.comments < 0
      )
        throw malformed();
      const entries = parseTimeline(await list(`issues/${n}/timeline?per_page=100`));
      const ids = new Set<number>();
      for (const entry of entries) {
        if (entry.kind !== 'comment') continue;
        if (!Number.isSafeInteger(entry.id) || entry.id <= 0 || ids.has(entry.id)) throw malformed();
        ids.add(entry.id);
      }
      const children = parseEpicChildren(
        (await list(`issues/${n}/sub_issues?per_page=100`)).map((raw) => {
          const child = record(raw);
          if (Object.hasOwn(child, 'pull_request')) throw malformed();
          return {
            url: child.html_url,
            id: child.id,
            number: child.number,
            state: child.state,
            stateReason: child.state_reason,
            closedAt: child.closed_at,
          };
        }),
      );
      return {
        repository,
        parent: issue.number,
        data: issueData(issue, entries),
        declaration: parseEpicAcceptance(issue.body),
        children,
      };
    },
    comment: (n: string, text: string) => send('POST', `issues/${n}/comments`, { body: text }),
    addLabels: (n: string, names: readonly string[]) => send('POST', `issues/${n}/labels`, { labels: names }),
    removeLabel: (n: string, name: string) =>
      send('DELETE', `issues/${n}/labels/${encodeURIComponent(name)}`).catch((error: Error) => {
        if (!error.message.includes('HTTP 404')) throw error;
      }),
    edit: (n: string, fields: Edit) => send('PATCH', `issues/${n}`, fields),
    stderr: () => stderr,
  };
}
