import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import { devNull } from 'node:os';
import { basename } from 'node:path';
import { HostError } from '../command/errors.ts';
import { exits, labels } from '../contract/contract.ts';
import { type EpicForms, parseEpicAcceptance, parseEpicChildren } from '../epic/acceptance.ts';
import { run } from '../process/process.ts';
import { local } from '../tracker/grammar.ts';
import type { IssueKey } from '../tracker/key.ts';
import { writeRefreshHint } from '../tracker/refresh-hints.ts';
import {
  type Authored,
  type Child,
  type Issue,
  issueData,
  owned,
  type Tracker,
  TrackerError,
} from '../tracker/tracker.ts';
import type { Entry } from '../workflow/workflow.ts';
import {
  addComment,
  type Bug,
  create,
  editComment,
  FormatError,
  labelChange,
  type Snapshot,
  setMetadata,
  setStatus,
  snapshot,
} from './format.ts';
import { type NewOp, openStore, StoreError } from './store.ts';
import { localTips, pullIssues, pushIssues, SyncError } from './sync.ts';

const repository = 'local';
const bugRefs = 'refs/bugs/';
const parentKey = 'celetis-parent';
const reasonKey = 'celetis-state-reason';

// A local ID is 64 hexadecimal characters (checkBug), so its first 7 are a key of the local grammar.
const keyOf = (id: string) => id.slice(0, 7) as IssueKey;
const urlOf = (key: IssueKey) => `local:${key}`;
const time = (seconds: number) => new Date(seconds * 1000).toISOString();
const syncing = new AsyncLocalStorage<true>();
const textOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const outOfSync = (command: string, line: string) =>
  `${command}: the local issues are not in sync with origin: ${line}; run celetis --agent <host> issue sync later\n`;

export const localForms: EpicForms = {
  repository(value) {
    if (value !== repository) throw new Error(`repository: need ${repository}`);
    return repository;
  },
  issueUrl: (_repository, key) => urlOf(key),
  issueKey(url) {
    const match = /^local:([0-9a-f]{7})$/.exec(url);
    return match ? { repository, key: match[1] as IssueKey } : null;
  },
};

function failure(error: unknown, n: IssueKey | null = null, id: string | null = null): TrackerError {
  if (error instanceof TrackerError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const text =
    error instanceof FormatError && id !== null
      ? `${bugRefs}${id}: ${message}`
      : error instanceof StoreError && error.ambiguous.length > 0
        ? `#${message}`
        : message;
  const missing = error instanceof StoreError && error.kind === 'missing';
  return new TrackerError(text, {
    text,
    stderr: null,
    notFound: missing,
    refused: !(error instanceof StoreError && error.kind === 'unsettled'),
    missing: missing ? n : null,
  });
}

function guard<A extends unknown[], R>(act: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  return async (...args) => {
    try {
      return await act(...args);
    } catch (error) {
      throw failure(error);
    }
  };
}

function parentOf(bug: Bug, shot: Snapshot): string | null {
  const parent = shot.metadata.get(bug.id)?.[parentKey];
  if (parent === undefined) return null;
  if (!/^[0-9a-f]{64}$/.test(parent))
    throw new FormatError(`the ${parentKey} metadata is not a local issue ID`, bug.id);
  return parent;
}

function issueOf(bug: Bug, shot: Snapshot): Issue {
  const parent = parentOf(bug, shot);
  const key = keyOf(bug.id);
  return {
    key,
    title: shot.title,
    url: urlOf(key),
    parent: parent === null ? null : keyOf(parent),
    state: shot.state,
    labels: shot.labels,
    body: shot.body,
    comments: shot.comments.length,
    updatedAt: time(shot.updatedAt),
    closedAt: shot.closedAt === null ? null : time(shot.closedAt),
    pull: false,
  };
}

function authored(shot: Snapshot, author: (identity: string) => string | null): Authored[] {
  return shot.events.map(
    (event): Authored =>
      event.kind === 'comment'
        ? { kind: 'comment', id: event.id, at: time(event.at), body: event.body, author: author(event.author) }
        : { kind: 'label', change: event.change, name: event.name, at: time(event.at) },
  );
}

function entriesOf(shot: Snapshot, self: string | null): Entry[] {
  return owned(
    authored(shot, (identity) => identity),
    self,
  );
}

function reasonOf(shot: Snapshot): 'completed' | 'not_planned' | null {
  if (shot.state === 'open') return null;
  const close = shot.closeOp === null ? undefined : shot.metadata.get(shot.closeOp);
  return close?.[reasonKey] === 'not_planned' ? 'not_planned' : 'completed';
}

function attachment(value: string): Readonly<{ file: string; alt: string }> {
  const at = value.lastIndexOf('#');
  return at < 0 ? { file: value, alt: basename(value) } : { file: value.slice(0, at), alt: value.slice(at + 1) };
}

export function localTracker(main: string, signal?: AbortSignal): Tracker {
  const store = openStore(main, signal);
  let stderr = '';

  type Read = Readonly<{ bug: Bug; shot: Snapshot; issue: Issue }>;

  async function load(n: IssueKey): Promise<Read> {
    let id: string | null = null;
    try {
      id = await store.resolve(n);
      const bug = await store.bug(id);
      const shot = snapshot(bug);
      return { bug, shot, issue: issueOf(bug, shot) };
    } catch (error) {
      throw failure(error, n, id);
    }
  }

  // As with a gh failure, the line is in both error.stderr and stderr(), so each caller prints it once.
  function reported<A extends unknown[], R>(act: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
    return async (...args) => {
      try {
        return await act(...args);
      } catch (error) {
        const { text, notFound, refused, missing } = failure(error);
        stderr += `${text}\n`;
        throw new TrackerError(text, { text, stderr: `${text}\n`, notFound, refused, missing });
      }
    };
  }

  async function write(n: IssueKey, id: string, ops: readonly NewOp[], files?: readonly Uint8Array[]) {
    try {
      return await store.append(id, ops, files);
    } catch (error) {
      throw failure(error, n, id);
    }
  }

  type Refusal = Readonly<{ ref: string; rule: string }>;

  async function scan(): Promise<Readonly<{ reads: readonly Read[]; refused: readonly Refusal[] }>> {
    const { bugs, refused } = await store.bugs();
    const reads: Read[] = [];
    const skipped: Refusal[] = [...refused];
    for (const bug of [...bugs].sort((a, b) => a.createClock - b.createClock || (a.id < b.id ? -1 : 1))) {
      try {
        const shot = snapshot(bug);
        reads.push({ bug, shot, issue: issueOf(bug, shot) });
      } catch (error) {
        if (!(error instanceof FormatError)) throw error;
        skipped.push({ ref: `${bugRefs}${bug.id}`, rule: error.message });
      }
    }
    return { reads, refused: skipped };
  }

  async function all(): Promise<readonly Read[]> {
    const { reads, refused } = await scan();
    for (const { ref, rule } of refused)
      stderr += `issue: warning: ${ref} is not a valid local issue: ${rule}; it is skipped\n`;
    return reads;
  }

  const childrenOf = (reads: readonly Read[], epic: string) =>
    reads.filter(({ bug, shot }) => shot.metadata.get(bug.id)?.[parentKey] === epic);

  async function names(): Promise<(identity: string) => string | null> {
    const identities = await store.identities();
    return (identity) => {
      const found = identities.get(identity);
      return found?.name || found?.email || null;
    };
  }

  async function blobHash(bytes: Uint8Array): Promise<string> {
    const result = await run(
      'git',
      ['--no-optional-locks', '-c', `core.hooksPath=${devNull}`, 'hash-object', '--stdin'],
      {
        cwd: main,
        signal,
        input: bytes,
      },
    );
    if (result.code !== 0) throw new Error(`git hash-object failed: ${result.stderr.trim()}`);
    return result.stdout.trim();
  }

  return {
    name: local.tracker,
    forms: localForms,
    project: async () => repository,
    read: reported(async (n: IssueKey) => {
      const { shot, issue } = await load(n);
      return { issue, data: issueData(issue, entriesOf(shot, await store.self())) };
    }),
    issue: reported(async (n: IssueKey) => (await load(n)).issue),
    issues: guard(async (state: Issue['state'], label?: string) =>
      (await all())
        .map(({ issue }) => issue)
        .filter((issue) => issue.state === state && (label === undefined || issue.labels.includes(label)))
        .reverse(),
    ),
    history: reported(async (n: IssueKey) => {
      const { shot } = await load(n);
      return authored(shot, await names());
    }),
    children: reported(async (n: IssueKey) => {
      const { bug } = await load(n);
      return childrenOf(await all(), bug.id).map(
        ({ issue }): Child => ({ key: issue.key, title: issue.title, url: issue.url, state: issue.state }),
      );
    }),
    link: guard(async (epic: IssueKey, child: IssueKey) => {
      const parent = (await load(epic)).bug.id;
      const { bug, shot } = await load(child);
      const current = parentOf(bug, shot);
      if (current === parent) return;
      if (current !== null) throw failure(new Error(`#${child} is a sub-issue of ${urlOf(keyOf(current))} already`));
      await write(child, bug.id, [
        { type: setMetadata, fields: { target: bug.id, new_metadata: { [parentKey]: parent } } },
      ]);
      await writeRefreshHint(main, child);
    }),
    timelines: guard(async (issues: readonly Issue[]) => {
      const self = await store.self();
      const entries = new Map((await all()).map(({ issue, shot }) => [issue.key, entriesOf(shot, self)]));
      return new Map(
        issues.map(({ key }) => {
          const found = entries.get(key);
          if (found === undefined) throw failure(new StoreError('missing', `no local issue matches ${key}`), key);
          return [key, found];
        }),
      );
    }),
    epic: guard(async (n: IssueKey) => {
      const { bug, shot, issue } = await load(n);
      const { reads, refused } = await scan();
      const [first] = refused;
      if (first !== undefined)
        throw failure(
          new Error(`${first.ref} is not a valid local issue: ${first.rule}; the children of #${n} are not known`),
        );
      const kids = childrenOf(reads, bug.id).map(({ bug: child, shot: kid, issue: one }) => ({
        url: one.url,
        id: child.id,
        number: one.key,
        state: one.state,
        stateReason: reasonOf(kid),
        closedAt: one.closedAt,
      }));
      return {
        repository,
        parent: issue.key,
        data: issueData(issue, entriesOf(shot, await store.self())),
        declaration: parseEpicAcceptance(shot.body, localForms),
        children: parseEpicChildren(kids, localForms),
      };
    }),
    parent: guard(async (n: IssueKey) => {
      const { bug, shot } = await load(n);
      const parent = parentOf(bug, shot);
      if (parent === null)
        throw new TrackerError(`#${n} has no parent`, {
          text: `#${n} has no parent`,
          stderr: null,
          notFound: true,
          refused: true,
          missing: null,
        });
      return { key: keyOf(parent), url: urlOf(keyOf(parent)) };
    }),
    labels: async () => [...labels],
    createLabel: async () => {},
    createIssue: guard(async ({ title, body, labels: names }) => {
      const at = time(Math.floor(Date.now() / 1000));
      const { id } = await store.create(
        { type: create, fields: { title, message: body, files: [] } },
        names.length === 0 ? [] : [{ type: labelChange, fields: { added: [...names], removed: [] } }],
      );
      const key = keyOf(id);
      return {
        key,
        title,
        url: urlOf(key),
        parent: null,
        state: 'open',
        labels: [...new Set(names)].sort(),
        body,
        comments: 0,
        updatedAt: at,
        closedAt: null,
        pull: false,
      };
    }),
    comment: guard(async (n: IssueKey, text: string) => {
      const { bug } = await load(n);
      await write(n, bug.id, [{ type: addComment, fields: { message: text, files: [] } }]);
    }),
    commentIssue: guard(async (n: IssueKey, file: string, attachments: readonly string[]) => {
      const { bug } = await load(n);
      const text = await readFile(file, 'utf8');
      const files: Uint8Array[] = [];
      const hashes: string[] = [];
      const lines: string[] = [];
      for (const value of attachments) {
        const { file: path, alt } = attachment(value);
        const bytes = new Uint8Array(await readFile(path));
        const hash = await blobHash(bytes);
        files.push(bytes);
        hashes.push(hash);
        lines.push(`![${alt}](${hash})`);
      }
      const message = lines.length === 0 ? text : `${text.trimEnd()}\n\n${lines.join('\n')}`;
      const [op] = await write(n, bug.id, [{ type: addComment, fields: { message, files: hashes } }], files);
      await writeRefreshHint(main, n);
      return `${urlOf(keyOf(bug.id))}#${op}\n`;
    }),
    addLabels: guard(async (n: IssueKey, added: readonly string[]) => {
      const { bug, shot } = await load(n);
      const fresh = [...new Set(added)].filter((name) => !shot.labels.includes(name));
      if (fresh.length > 0) await write(n, bug.id, [{ type: labelChange, fields: { added: fresh, removed: [] } }]);
    }),
    removeLabel: guard(async (n: IssueKey, name: string) => {
      const { bug, shot } = await load(n);
      if (shot.labels.includes(name))
        await write(n, bug.id, [{ type: labelChange, fields: { added: [], removed: [name] } }]);
    }),
    edit: guard(async (n: IssueKey, fields) => {
      const { bug, shot } = await load(n);
      const ops: NewOp[] = [];
      if (fields.body !== undefined && fields.body !== shot.body)
        ops.push({ type: editComment, fields: { target: bug.id, message: fields.body, files: [] } });
      if (fields.state === 'closed' && shot.state !== 'closed')
        ops.push({
          type: setStatus,
          fields: { status: 2 },
          ...(fields.state_reason === 'not_planned' ? { metadata: { [reasonKey]: 'not_planned' } } : {}),
        });
      if (ops.length > 0) await write(n, bug.id, ops);
    }),
    async pull(command) {
      try {
        await pullIssues(
          main,
          (line) => {
            stderr += `${command}: warning: ${line}\n`;
          },
          signal,
        );
      } catch (error) {
        stderr += outOfSync(command, textOf(error));
      }
    },
    async synced(command, work) {
      if (syncing.getStore()) return work();
      const refused = await store.writable();
      if (refused !== null) throw new HostError(refused, exits.prerequisite);
      return syncing.run(true, async () => {
        const warn = (line: string) => process.stderr.write(`${command}: warning: ${line}\n`);
        let missed: string | null = null;
        try {
          await pullIssues(main, warn, signal);
        } catch (error) {
          missed = textOf(error);
        }
        const before = await localTips(main, signal).catch(() => null);
        try {
          return await work();
        } finally {
          try {
            if ((await localTips(main, signal)) !== before) await pushIssues(main, warn, signal);
          } catch (error) {
            missed ??= textOf(error);
          }
          if (missed !== null) process.stderr.write(outOfSync(command, missed));
        }
      });
    },
    async sync() {
      const refused = await store.writable();
      if (refused !== null) throw new HostError(refused, exits.prerequisite);
      const warn = (line: string) => {
        stderr += `issue: warning: ${line}\n`;
      };
      try {
        await pullIssues(main, warn, signal);
        await pushIssues(main, warn, signal);
      } catch (error) {
        if (error instanceof SyncError) throw failure(new Error(error.line));
        throw error;
      }
      return true;
    },
    stderr: () => stderr,
  };
}
