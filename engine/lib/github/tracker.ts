import { readFile } from 'node:fs/promises';
import { githubForms, parseEpicAcceptance, parseEpicChildren } from '../epic/acceptance.ts';
import { run } from '../process/process.ts';
import { github } from '../tracker/grammar.ts';
import { type IssueKey, parseKey } from '../tracker/key.ts';
import { writeRefreshHint } from '../tracker/refresh-hints.ts';
import {
  type Authored,
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
  integer,
  malformed,
  Refusal,
  record,
  text,
} from './github.ts';

function issueKey(value: unknown): IssueKey | null {
  return Number.isSafeInteger(value) ? parseKey(String(value)) : null;
}

function parseParent(raw: unknown): Parent {
  const parent = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const key = issueKey(parent.number);
  const url = parent.html_url;
  if (key === null) throw new Refusal('the parent response has no valid issue number');
  if (typeof url !== 'string' || !url.endsWith(`/issues/${key}`))
    throw new Refusal('the parent response has no canonical issue URL that matches its number');
  return { key, url };
}

function parseLabelName(raw: unknown): string {
  return text(record(raw).name);
}

function parentKey(apiUrl: string, parentUrl: string | null): IssueKey | null {
  if (parentUrl === null) return null;
  const prefix = apiUrl.slice(0, apiUrl.lastIndexOf('/') + 1);
  return parentUrl.startsWith(prefix) ? parseKey(parentUrl.slice(prefix.length)) : null;
}

export function parseIssue(raw: unknown): Issue {
  const issue = record(raw);
  const { state, labels, body, comments, closed_at: closedAt, pull_request: pull } = issue;
  const key = issueKey(issue.number);
  if (
    key === null ||
    (state !== 'open' && state !== 'closed') ||
    !Array.isArray(labels) ||
    typeof comments !== 'number' ||
    (pull !== undefined && pull !== null && typeof pull !== 'object')
  )
    throw malformed();
  const parent = issue.parent_issue_url;
  if (parent !== undefined && parent !== null && typeof parent !== 'string') throw malformed();
  return {
    key,
    title: text(issue.title),
    url: text(issue.html_url),
    parent: parentKey(text(issue.url), parent ?? null),
    state,
    labels: labels.map((label) => text(record(label).name)),
    body: body === null ? null : text(body),
    comments,
    updatedAt: text(issue.updated_at),
    closedAt: closedAt === null ? null : text(closedAt),
    pull: Boolean(pull),
  };
}

function parseChild(raw: unknown): Child {
  const child = record(raw);
  const key = issueKey(child.number);
  const { state } = child;
  if (key === null || Object.hasOwn(child, 'pull_request') || (state !== 'open' && state !== 'closed'))
    throw malformed();
  return { key, title: text(child.title), url: text(child.html_url), state };
}

function author(user: unknown): string | null {
  return user === null ? null : text(record(user).login);
}

export function trusted(association: unknown): boolean {
  return association === 'OWNER' || association === 'MEMBER' || association === 'COLLABORATOR';
}

function onlyTrusted<T>(parse: (raw: unknown) => T): (raw: unknown) => T[] {
  return (raw) => {
    const value = parse(raw);
    return trusted(record(raw).author_association) ? [value] : [];
  };
}

function parseHistory(entries: readonly unknown[]): Authored[] {
  return entries.flatMap((raw): Authored[] => {
    const entry = record(raw);
    const event = text(entry.event);
    if (!event || /[\s\0]/.test(event)) throw malformed();
    switch (event) {
      case 'commented': {
        const comment: Authored = {
          kind: 'comment',
          id: String(integer(entry.id)),
          at: text(entry.created_at),
          author: author(entry.user),
          body: text(entry.body),
        };
        return trusted(entry.author_association) ? [comment] : [];
      }
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

const timelineItems = (after: string) =>
  `timelineItems(first: 100${after}, itemTypes: [ISSUE_COMMENT, LABELED_EVENT, UNLABELED_EVENT]) { pageInfo { hasNextPage endCursor } nodes { __typename ... on IssueComment { databaseId createdAt body author { login } authorAssociation } ... on LabeledEvent { createdAt label { name } } ... on UnlabeledEvent { createdAt label { name } } } }`;

function timelineEntry(raw: unknown): Authored[] {
  const node = record(raw);
  switch (node.__typename) {
    case 'IssueComment': {
      const comment: Authored = {
        kind: 'comment',
        id: String(integer(node.databaseId)),
        at: text(node.createdAt),
        author: author(node.author),
        body: text(node.body),
      };
      return trusted(node.authorAssociation) ? [comment] : [];
    }
    case 'LabeledEvent':
    case 'UnlabeledEvent':
      return [
        {
          kind: 'label',
          change: node.__typename === 'LabeledEvent' ? 'added' : 'removed',
          name: text(record(node.label).name),
          at: text(node.createdAt),
        },
      ];
    default:
      throw malformed();
  }
}

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
          parsed('graphql', () => owned(nodes.flatMap(timelineEntry), self)),
        );
      }
    }
    return result;
  }

  function refuseUntrusted(n: IssueKey, raw: Record<string, unknown>): void {
    if (trusted(raw.author_association)) return;
    const line = `#${n} was opened by ${author(raw.user) ?? 'an unknown user'}, who is not the owner, a member, or a collaborator of the repository; Celetis does not read it`;
    appendStderr(`${line}\n`);
    throw new TrackerError(line, { text: line, stderr: `${line}\n`, notFound: true, refused: true, missing: n });
  }

  function readable(n: IssueKey, raw: unknown): Issue {
    const issue = parseIssue(raw);
    refuseUntrusted(n, record(raw));
    return issue;
  }

  async function timeline<T>(n: IssueKey, parse: (entries: readonly unknown[]) => T): Promise<T> {
    const endpoint = `issues/${n}/timeline?per_page=100`;
    const entries = await pages(endpoint);
    return parsed(endpoint, () => parse(entries));
  }

  async function project(): Promise<string> {
    const raw = await get('', record);
    return parsed('', () => {
      const url = githubForms.repository(raw.html_url);
      if (!Number.isSafeInteger(raw.id) || Number(raw.id) <= 0 || raw.full_name !== new URL(url).pathname.slice(1))
        throw malformed();
      return url;
    });
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
      const rawParent = await get(target, record);
      const issue = parsed(target, () => {
        const parent = parseIssue(rawParent);
        if (
          Object.hasOwn(rawParent, 'pull_request') ||
          parent.key !== n ||
          parent.url !== githubForms.issueUrl(repository, n) ||
          !Number.isSafeInteger(parent.comments) ||
          parent.comments < 0
        )
          throw malformed();
        return parent;
      });
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
            const child = record(raw);
            if (Object.hasOwn(child, 'pull_request')) throw malformed();
            const number = issueKey(child.number);
            if (number === null) throw new Error(`children[${index}].number: need a positive safe integer`);
            if (!Number.isSafeInteger(child.id) || Number(child.id) <= 0)
              throw new Error(`children[${index}].id: need a positive safe integer`);
            return {
              url: child.html_url,
              id: String(child.id),
              number,
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
        parent: issue.key,
        data: issueData(issue, entries),
        declaration: parseEpicAcceptance(issue.body, githubForms),
        children,
      };
    },
    history: (n: IssueKey) => timeline(n, parseHistory),
    async children(n: IssueKey) {
      const endpoint = `issues/${n}/sub_issues?per_page=100`;
      const items = await pages(endpoint);
      return parsed(endpoint, () => items.flatMap(onlyTrusted(parseChild)));
    },
    async link(epic: IssueKey, child: IssueKey) {
      const id = await get(`issues/${child}`, (raw) => integer(record(raw).id));
      await send('POST', `issues/${epic}/sub_issues`, { fields: { sub_issue_id: id } });
      await writeRefreshHint(cwd, child);
    },
    issue: (n: IssueKey) => get(`issues/${n}`, (raw) => readable(n, raw)),
    issues: async (state: Issue['state'], label?: string) =>
      (
        await getAll(
          `issues?state=${state}${label === undefined ? '' : `&labels=${encodeURIComponent(label)}`}&per_page=100`,
          onlyTrusted(parseIssue),
        )
      ).flat(),
    parent: (n: IssueKey) => get(`issues/${n}/parent`, parseParent),
    labels: () => getAll('labels?per_page=100', parseLabelName),
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
        return `${parsed(endpoint, () => text(record(json(raw)).html_url))}\n`;
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
