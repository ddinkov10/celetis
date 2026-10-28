import { type GitHub, type Issue, parseIssue } from '../lib/tracker.ts';
import type { History, LandedIssue } from './types.ts';

function malformed(): never {
  throw new Error('malformed GitHub history');
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) malformed();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string') malformed();
  return value;
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) malformed();
  return value;
}

function identity(value: unknown): string {
  const sha = text(value);
  if (!/^[a-f0-9]{40}$/.test(sha)) malformed();
  return sha;
}

function date(value: unknown): string {
  const at = text(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(at) ||
    !Number.isFinite(Date.parse(at))
  )
    malformed();
  return at;
}

function link(value: unknown): string {
  const href = text(value);
  if (/[\u0000-\u0020\u007f-\u009f]/.test(href)) malformed();
  const url = new URL(href);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) malformed();
  return url.href;
}

export async function readHistory(gh: Pick<GitHub, 'api' | 'list'>): Promise<History> {
  const repo = record(await gh.api(''));
  const trunk = text(repo.default_branch);
  const name = text(repo.full_name);
  if (!trunk || !/^[^/\s]+\/[^/\s]+$/.test(name)) malformed();
  const url = `${link(repo.html_url).replace(/\/$/, '')}/commits/${encodeURIComponent(trunk)}`;
  const heads = array(await gh.api(`commits?sha=${encodeURIComponent(trunk)}&per_page=1`));
  const head = identity(record(heads[0]).sha);
  const entries: LandedIssue[] = [];
  const seen = new Set<number>();
  const issues = new Map<number, Issue>();

  async function issueOf(n: number): Promise<Issue | null> {
    if (!Number.isSafeInteger(n) || n < 1) return null;
    let issue = issues.get(n);
    if (!issue) {
      issue = parseIssue(await gh.api(`issues/${n}`));
      link(issue.url);
      issues.set(n, issue);
    }
    return !issue.pull && issue.number === n ? issue : null;
  }

  for (let page = 1; ; page++) {
    const commits = array(await gh.api(`commits?sha=${head}&per_page=100&page=${page}`));
    for (const raw of commits) {
      const row = record(raw);
      const sha = identity(row.sha);
      const commitUrl = link(row.html_url);
      const commit = record(row.commit);
      const subject = text(commit.message).split('\n')[0] as string;
      const committedAt = date(record(commit.committer).date);
      const pulls = array(await gh.list(`commits/${sha}/pulls?per_page=100`));
      let n: number | null = null;
      if (pulls.length === 0) {
        const direct = /^[a-z]+(?:\([^()\r\n]+\))?!?: [^ ].* \(#([1-9][0-9]*)\)$/.exec(subject);
        if (direct) n = Number(direct[1]);
      } else {
        const candidates = new Set<number>();
        for (const raw of pulls) {
          const pull = record(raw);
          const base = record(pull.base);
          const head = record(pull.head);
          const baseRepo = text(record(base.repo).full_name);
          const headRepo = head.repo === null ? null : text(record(head.repo).full_name);
          const baseRef = text(base.ref);
          const headRef = text(head.ref);
          const body = pull.body === null ? '' : text(pull.body);
          const merged = pull.merged_at === null ? null : date(pull.merged_at);
          const mergeSha = pull.merge_commit_sha === null ? null : identity(pull.merge_commit_sha);
          const lane = /^(?:feat|fix|hotfix|chore)\/([1-9][0-9]*)-[a-z0-9][a-z0-9-]*$/.exec(headRef);
          const closes = [...body.matchAll(/\bCloses\s+#([1-9][0-9]*)\b/gi)].map((match) => Number(match[1]));
          if (
            merged &&
            mergeSha === sha &&
            baseRef === trunk &&
            baseRepo === name &&
            headRepo === name &&
            lane &&
            closes.length > 0 &&
            closes.every((number) => number === Number(lane[1]))
          )
            candidates.add(Number(lane[1]));
        }
        if (candidates.size === 1) n = [...candidates][0] as number;
      }
      if (n === null || seen.has(n)) continue;
      const issue = await issueOf(n);
      if (!issue) continue;
      entries.push({ number: n, title: issue.title, url: issue.url, sha, commitUrl, committedAt });
      seen.add(n);
      if (entries.length === 20) return { trunk, url, head, entries };
    }
    if (commits.length < 100) return { trunk, url, head, entries };
  }
}
