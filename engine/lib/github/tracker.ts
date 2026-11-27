import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { githubForms, parseEpicAcceptance, parseEpicChildren } from '../epic/acceptance.ts';
import { run } from '../process/process.ts';
import { count, issueKey } from '../state/schemas.ts';
import { github } from '../tracker/grammar.ts';
import { type IssueKey, parseKey } from '../tracker/key.ts';
import { writeRefreshHint } from '../tracker/refresh-hints.ts';
import {
  type Authored,
  type Blocker,
  type Child,
  type Edit,
  type Issue,
  issueData,
  type NewIssue,
  type NewLabel,
  owned,
  type Parent,
  type Tracker,
  TrackerError,
} from '../tracker/tracker.ts';
import type { Entry } from '../workflow/workflow.ts';
import {
  type Client,
  chunks,
  converting,
  drain,
  GitHubError,
  graphqlQuery,
  malformed,
  parse,
  Refusal,
} from './github.ts';

const key = z
  .int()
  .transform((value) => String(value))
  .pipe(issueKey);
const state = z.enum(['open', 'closed']);
const labelName = z.object({ name: z.string() }).transform((label) => label.name);
const author = z
  .object({ login: z.string() })
  .nullable()
  .transform((user) => user?.login ?? null);
const withoutPull = z.custom<Record<string, unknown>>(
  (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value) && !Object.hasOwn(value, 'pull_request'),
);

function parseParent(raw: unknown): Parent {
  const number = z.object({ number: key }).safeParse(raw);
  if (!number.success) throw new Refusal('the parent response has no valid issue number');
  const url = z.object({ html_url: z.string().endsWith(`/issues/${number.data.number}`) }).safeParse(raw);
  if (!url.success) throw new Refusal('the parent response has no canonical issue URL that matches its number');
  return { key: number.data.number, url: url.data.html_url };
}

function parentKey(apiUrl: string, parentUrl: string | null): IssueKey | null {
  if (parentUrl === null) return null;
  const prefix = apiUrl.slice(0, apiUrl.lastIndexOf('/') + 1);
  return parentUrl.startsWith(prefix) ? parseKey(parentUrl.slice(prefix.length)) : null;
}

const blockerTotal = z
  .object({ total_blocked_by: z.int().nonnegative() })
  .transform((summary): number | null => summary.total_blocked_by)
  .catch(null);

const issue: z.ZodType<Issue> = z
  .object({
    number: key,
    title: z.string(),
    html_url: z.string(),
    url: z.string(),
    parent_issue_url: z.string().nullish(),
    state,
    labels: z.array(labelName),
    body: z.string().nullable(),
    comments: z.custom<number>((value) => typeof value === 'number'),
    created_at: z.string(),
    updated_at: z.string(),
    closed_at: z.string().nullable(),
    pull_request: z.custom<object | null>((value) => typeof value === 'object').optional(),
    issue_dependencies_summary: blockerTotal.optional(),
  })
  .transform((raw) => ({
    key: raw.number,
    title: raw.title,
    url: raw.html_url,
    parent: parentKey(raw.url, raw.parent_issue_url ?? null),
    state: raw.state,
    labels: raw.labels,
    body: raw.body,
    comments: raw.comments,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    closedAt: raw.closed_at,
    pull: Boolean(raw.pull_request),
    blockerCount: raw.issue_dependencies_summary ?? null,
  }));

export function parseIssue(raw: unknown): Issue {
  return parse(issue, raw);
}

const child: z.ZodType<Child> = withoutPull.pipe(
  z
    .object({ number: key, title: z.string(), html_url: z.string(), state })
    .transform((raw) => ({ key: raw.number, title: raw.title, url: raw.html_url, state: raw.state })),
);

const issueId = z.object({ id: z.int() }).transform((raw) => raw.id);
const blocked = z.object({
  id: z.int(),
  html_url: z.string(),
  number: z.int(),
  state,
  title: z.string(),
  author_association: z.unknown().optional(),
});
const foreignIssue = /^https:\/\/[^/]+\/([^/]+\/[^/]+)\/issues\/([1-9][0-9]*)$/;

function parseBlocker(raw: unknown, repository: string): { id: number; blocker: Blocker } {
  const { id, html_url: url, number, state, title, author_association } = parse(blocked, raw);
  const home = url.startsWith(`${repository}/issues/`) ? key.safeParse(number) : null;
  if (home?.success) {
    if (url !== githubForms.issueUrl(repository, home.data)) throw malformed();
    const ref = `#${home.data}`;
    return { id, blocker: { key: home.data, ref, title: trusted(author_association) ? title : '', url, state } };
  }
  const foreign = foreignIssue.exec(url);
  if (foreign === null || foreign[2] !== String(number)) throw malformed();
  // The association of a foreign issue is with its own repository, so its title is never read.
  return { id, blocker: { key: null, ref: `${foreign[1]}#${number}`, title: '', url, state } };
}

export function trusted(association: unknown): boolean {
  return association === 'OWNER' || association === 'MEMBER' || association === 'COLLABORATOR';
}

const association = z.object({ author_association: z.unknown().optional() });
const submitter = z.object({ author_association: z.unknown().optional(), user: z.unknown().optional() });
const repositoryReply = z.object({
  html_url: z.unknown().optional(),
  id: z.unknown().optional(),
  full_name: z.unknown().optional(),
});

function onlyTrusted<T>(schema: z.ZodType<T>): (raw: unknown) => T[] {
  return (raw) => {
    const value = parse(schema, raw);
    return trusted(parse(association, raw).author_association) ? [value] : [];
  };
}

const restKinds = ['commented', 'labeled', 'unlabeled'];
const restEntry: z.ZodType<Authored[]> = z.union([
  z
    .object({
      event: z.literal('commented'),
      id: z.int(),
      created_at: z.string(),
      user: author,
      body: z.string(),
      author_association: z.unknown().optional(),
    })
    .transform((raw): Authored[] =>
      trusted(raw.author_association)
        ? [{ kind: 'comment', id: String(raw.id), at: raw.created_at, author: raw.user, body: raw.body }]
        : [],
    ),
  z
    .object({ event: z.enum(['labeled', 'unlabeled']), label: labelName, created_at: z.string() })
    .transform((raw): Authored[] => [
      { kind: 'label', change: raw.event === 'labeled' ? 'added' : 'removed', name: raw.label, at: raw.created_at },
    ]),
  z
    .object({
      event: z
        .string()
        .regex(/^[^\s\0]+$/)
        .refine((event) => !restKinds.includes(event)),
    })
    .transform((): Authored[] => []),
]);

function parseHistory(entries: readonly unknown[]): Authored[] {
  return entries.flatMap((raw) => parse(restEntry, raw));
}

const timelineItems = (after: string) =>
  `timelineItems(first: 100${after}, itemTypes: [ISSUE_COMMENT, LABELED_EVENT, UNLABELED_EVENT]) { pageInfo { hasNextPage endCursor } nodes { __typename ... on IssueComment { databaseId createdAt body author { login } authorAssociation } ... on LabeledEvent { createdAt label { name } } ... on UnlabeledEvent { createdAt label { name } } } }`;

const graphqlEntry: z.ZodType<Authored[]> = z.union([
  z
    .object({
      __typename: z.literal('IssueComment'),
      databaseId: z.int(),
      createdAt: z.string(),
      author,
      body: z.string(),
      authorAssociation: z.unknown().optional(),
    })
    .transform((raw): Authored[] =>
      trusted(raw.authorAssociation)
        ? [{ kind: 'comment', id: String(raw.databaseId), at: raw.createdAt, author: raw.author, body: raw.body }]
        : [],
    ),
  z
    .object({ __typename: z.enum(['LabeledEvent', 'UnlabeledEvent']), label: labelName, createdAt: z.string() })
    .transform((raw): Authored[] => [
      {
        kind: 'label',
        change: raw.__typename === 'LabeledEvent' ? 'added' : 'removed',
        name: raw.label,
        at: raw.createdAt,
      },
    ]),
]);

function trackerError(error: GitHubError): TrackerError {
  const read = /^issues\/([^/?]+)$/.exec(error.endpoint);
  return new TrackerError(error.message, {
    text: error.text,
    stderr: error.stderr,
    notFound: error.notFound,
    refused: error.stderr !== null && /\bHTTP 4\d\d\b/.test(error.stderr),
    missing: error.notFound && read ? parseKey(read[1] as string) : null,
  });
}

export function githubTracker(client: Client): Tracker {
  const { cwd, signal, env, parsed, get, pages, getAll, send, json, graphql, connectionAt, appendStderr, login } =
    client;

  async function timelines(issues: readonly Issue[]): Promise<ReadonlyMap<IssueKey, readonly Entry[]>> {
    const result = new Map<IssueKey, readonly Entry[]>(issues.map((issue) => [issue.key, []]));
    for (const chunk of chunks(
      issues.filter((issue) => issue.comments > 0),
      50,
    )) {
      const self = await login();
      const data = await graphql(
        graphqlQuery(chunk.map(({ key }) => `i${key}: issue(number: ${key}) { ${timelineItems('')} }`).join(' ')),
      );
      for (const { key } of chunk) {
        const nodes = await drain(connectionAt(data, 'repository', `i${key}`, 'timelineItems'), async (cursor) =>
          connectionAt(
            await graphql(
              graphqlQuery(`issue(number: ${key}) { ${timelineItems(', after: $cursor')} }`, '$cursor: String!'),
              {
                cursor,
              },
            ),
            'repository',
            'issue',
            'timelineItems',
          ),
        );
        result.set(
          key,
          parsed('graphql', () =>
            owned(
              nodes.flatMap((node) => parse(graphqlEntry, node)),
              self,
            ),
          ),
        );
      }
    }
    return result;
  }

  function refuseUntrusted(n: IssueKey, raw: unknown): void {
    const { author_association, user } = parse(submitter, raw);
    if (trusted(author_association)) return;
    const line = `#${n} was opened by ${parse(author, user) ?? 'an unknown user'}, who is not the owner, a member, or a collaborator of the repository; Celetis does not read it`;
    appendStderr(`${line}\n`);
    throw new TrackerError(line, { text: line, stderr: `${line}\n`, notFound: true, refused: true, missing: n });
  }

  function readable(n: IssueKey, raw: unknown): Issue {
    const value = parse(issue, raw);
    refuseUntrusted(n, raw);
    return value;
  }

  async function timeline<T>(n: IssueKey, parse: (entries: readonly unknown[]) => T): Promise<T> {
    const endpoint = `issues/${n}/timeline?per_page=100`;
    const entries = await pages(endpoint);
    return parsed(endpoint, () => parse(entries));
  }

  let known: string | undefined;

  async function project(): Promise<string> {
    if (known !== undefined) return known;
    const raw = await get('', (value) => parse(repositoryReply, value));
    known = parsed('', () => {
      const url = githubForms.repository(raw.html_url);
      parse(z.object({ id: count, full_name: z.literal(new URL(url).pathname.slice(1)) }), raw);
      return url;
    });
    return known;
  }

  async function listBlockers(n: IssueKey) {
    const endpoint = `issues/${n}/dependencies/blocked_by?per_page=100`;
    const items = await pages(endpoint);
    const home = await project();
    return parsed(endpoint, () => items.map((raw) => parseBlocker(raw, home)));
  }

  const adapter: Tracker = {
    name: github.tracker,
    forms: githubForms,
    project,
    timelines,
    async read(n: IssueKey) {
      const issue = await get(`issues/${n}`, (raw) => readable(n, raw));
      const self = await login();
      return { issue, data: issueData(issue, await timeline(n, (entries) => owned(parseHistory(entries), self))) };
    },
    async epic(n: IssueKey) {
      const target = `issues/${n}`;
      const repository = await project();
      const url = githubForms.issueUrl(repository, n);
      const rawParent = await get(target, (raw) => parse(withoutPull, raw));
      const parent = parsed(target, () =>
        parse(
          issue.refine(
            (value) =>
              value.key === n && value.url === url && Number.isSafeInteger(value.comments) && value.comments >= 0,
          ),
          rawParent,
        ),
      );
      refuseUntrusted(n, rawParent);
      const self = await login();
      const timeline = `${target}/timeline?per_page=100`;
      const rawEntries = await pages(timeline);
      const entries = parsed(timeline, () => {
        const result = owned(parseHistory(rawEntries), self);
        const ids = new Set<string>();
        for (const entry of result) {
          if (entry.kind !== 'comment') continue;
          if (!/^[1-9]\d*$/.test(entry.id) || ids.has(entry.id)) throw malformed();
          ids.add(entry.id);
        }
        return result;
      });
      const sub = `${target}/sub_issues?per_page=100`;
      const rawChildren = await pages(sub);
      const children = parseEpicChildren(
        parsed(sub, () =>
          rawChildren.map((raw, index) => {
            const child = parse(withoutPull, raw);
            const number = key.safeParse(child.number);
            if (!number.success) throw new Error(`children[${index}].number: need a positive safe integer`);
            const id = count.safeParse(child.id);
            if (!id.success) throw new Error(`children[${index}].id: need a positive safe integer`);
            return {
              url: child.html_url,
              id: String(id.data),
              number: number.data,
              state: child.state,
              stateReason: child.state_reason,
              closedAt: child.closed_at,
            };
          }),
        ),
        githubForms,
      );
      return {
        repository,
        parent: parent.key,
        data: issueData(parent, entries),
        declaration: parseEpicAcceptance(parent.body, githubForms),
        children,
      };
    },
    history: (n: IssueKey) => timeline(n, parseHistory),
    files: async () => [],
    async children(n: IssueKey) {
      const endpoint = `issues/${n}/sub_issues?per_page=100`;
      const items = await pages(endpoint);
      return parsed(endpoint, () => items.flatMap(onlyTrusted(child)));
    },
    async link(epic: IssueKey, child: IssueKey) {
      const id = await get(`issues/${child}`, (raw) => parse(issueId, raw));
      await send('POST', `issues/${epic}/sub_issues`, { fields: { sub_issue_id: id } });
      await writeRefreshHint(cwd, child);
    },
    async blockers(n: IssueKey) {
      return (await listBlockers(n)).map(({ blocker }) => blocker);
    },
    async addBlocker(n: IssueKey, blocker: IssueKey) {
      if ((await listBlockers(n)).some((item) => item.blocker.key === blocker)) return;
      const id = await get(`issues/${blocker}`, (raw) => parse(issueId, raw));
      await send('POST', `issues/${n}/dependencies/blocked_by`, { fields: { issue_id: id } });
    },
    async removeBlocker(n: IssueKey, blocker: IssueKey) {
      const found = (await listBlockers(n)).find((item) => item.blocker.key === blocker);
      if (found === undefined) return;
      await send('DELETE', `issues/${n}/dependencies/blocked_by/${found.id}`).catch((error: unknown) => {
        if (!(error instanceof GitHubError && error.notFound)) throw error;
      });
    },
    issue: (n: IssueKey) => get(`issues/${n}`, (raw) => readable(n, raw)),
    issues: async (state: Issue['state'], label?: string) =>
      (
        await getAll(
          `issues?state=${state}${label === undefined ? '' : `&labels=${encodeURIComponent(label)}`}&per_page=100`,
          onlyTrusted(issue),
        )
      ).flat(),
    parent: (n: IssueKey) => get(`issues/${n}/parent`, parseParent),
    labels: () => getAll('labels?per_page=100', (raw) => parse(labelName, raw)),
    async createLabel(fields: NewLabel) {
      await send('POST', 'labels', { fields });
    },
    async createIssue(fields: NewIssue) {
      const raw = await send('POST', 'issues', { fields, silent: false });
      return parsed('issues', () => parseIssue(json(raw)));
    },
    async comment(n: IssueKey, text: string) {
      await send('POST', `issues/${n}/comments`, { fields: { body: text } });
    },
    async commentIssue(n: IssueKey, file: string, attachments: readonly string[]) {
      signal?.throwIfAborted();
      if (attachments.length === 0) {
        const endpoint = `issues/${n}/comments`;
        const raw = await send('POST', endpoint, { fields: { body: await readFile(file, 'utf8') }, silent: false });
        return `${parsed(endpoint, () => parse(z.object({ html_url: z.string() }), json(raw)).html_url)}\n`;
      }
      const result = await run(
        'gh',
        ['issue', 'comment', n, `--body-file=${file}`, ...attachments.map((value) => `--attach=${value}`)],
        { cwd, signal, env },
      );
      if (result.code !== 0) {
        const failure = `${result.stdout}${result.stderr}`.trimEnd();
        throw new GitHubError(`issues/${n}/comments`, failure, result.stderr, failure);
      }
      appendStderr(result.stderr);
      await writeRefreshHint(cwd, n);
      return result.stdout;
    },
    async addLabels(n: IssueKey, names: readonly string[]) {
      await send('POST', `issues/${n}/labels`, { fields: { labels: names } });
    },
    async removeLabel(n: IssueKey, name: string) {
      await send('DELETE', `issues/${n}/labels/${encodeURIComponent(name)}`).catch((error: unknown) => {
        if (!(error instanceof GitHubError && error.notFound)) throw error;
      });
    },
    async edit(n: IssueKey, fields: Edit) {
      await send('PATCH', `issues/${n}`, { fields });
    },
    pull: async () => {},
    synced: (_command, work) => work(),
    sync: async () => false,
    stderr: client.stderr,
  };
  return { ...converting(adapter, trackerError), synced: adapter.synced };
}
