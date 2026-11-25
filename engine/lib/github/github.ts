import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../process/process.ts';
import { parseKey } from '../tracker/key.ts';
import { writeRefreshHint } from '../tracker/refresh-hints.ts';

export class GitHubError extends Error {
  readonly notFound: boolean;

  constructor(
    readonly endpoint: string,
    readonly text: string,
    readonly stderr: string | null,
    message: string,
  ) {
    super(message);
    this.notFound = stderr !== null && /\bHTTP 404\b/.test(stderr);
  }
}

export class Refusal extends Error {}

export function malformed(): Error {
  return new Refusal('malformed GitHub data');
}

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw malformed();
  return value as Record<string, unknown>;
}

export function text(value: unknown): string {
  if (typeof value !== 'string') throw malformed();
  return value;
}

export function integer(value: unknown): number {
  if (!Number.isSafeInteger(value)) throw malformed();
  return value as number;
}

export function orNull<T>(value: unknown, parse: (value: unknown) => T): T | null {
  return value === null ? null : parse(value);
}

export async function loggedIn(host: string, cwd: string): Promise<boolean> {
  return (await run('gh', ['auth', 'status', '--hostname', host], { cwd })).code === 0;
}

export type Connection = Readonly<{ nodes: readonly unknown[]; next: string | null }>;

function connection(raw: unknown): Connection {
  const { nodes, pageInfo } = record(raw);
  const { hasNextPage, endCursor } = record(pageInfo);
  if (!Array.isArray(nodes) || typeof hasNextPage !== 'boolean') throw malformed();
  return { nodes, next: hasNextPage ? text(endCursor) : null };
}

export async function drain(first: Connection, more: (cursor: string) => Promise<Connection>): Promise<unknown[]> {
  const nodes = [...first.nodes];
  let page = first;
  while (page.next !== null) {
    page = await more(page.next);
    nodes.push(...page.nodes);
  }
  return nodes;
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

export function graphqlQuery(fields: string, ...variables: string[]): string {
  return `query(${['$owner: String!', '$name: String!', ...variables].join(', ')}) { repository(owner: $owner, name: $name) { ${fields} } }`;
}

export const select = (value: unknown, keys: readonly string[]) => keys.reduce((node, key) => record(node)[key], value);

export type Client = Readonly<{
  cwd: string;
  signal: AbortSignal | undefined;
  env: NodeJS.ProcessEnv | undefined;
  parsed<T>(endpoint: string, parse: () => T): T;
  json(value: string): unknown;
  get<T>(endpoint: string, parse: (raw: unknown) => T): Promise<T>;
  pages(endpoint: string, key?: string): Promise<unknown[]>;
  getAll<T>(endpoint: string, parse: (raw: unknown) => T, key?: string): Promise<T[]>;
  send(
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    options?: { fields?: object; silent?: boolean },
  ): Promise<string>;
  graphql(query: string, variables?: Readonly<Record<string, string | number>>): Promise<Record<string, unknown>>;
  connectionAt(value: unknown, ...keys: string[]): Connection;
  stderr(): string;
  appendStderr(text: string): void;
  login(): Promise<string>;
}>;

export function client(cwd: string, signal?: AbortSignal, env?: NodeJS.ProcessEnv): Client {
  let stderr = '';

  function parsed<T>(endpoint: string, parse: () => T): T {
    try {
      return parse();
    } catch (error) {
      if (!(error instanceof Refusal)) throw error;
      throw new GitHubError(endpoint, error.message, null, error.message);
    }
  }

  function json(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      throw malformed();
    }
  }

  async function call(
    endpoint: string,
    paginate: boolean,
    path = `repos/{owner}/{repo}${endpoint ? `/${endpoint}` : ''}`,
  ): Promise<unknown> {
    signal?.throwIfAborted();
    const result = await run('gh', ['api', ...(paginate ? ['--paginate', '--slurp'] : []), path], { cwd, signal, env });
    signal?.throwIfAborted();
    stderr += result.stderr;
    if (result.code !== 0)
      throw new GitHubError(
        endpoint,
        `${result.stdout}${result.stderr}`.trimEnd(),
        result.stderr,
        'GitHub read failed',
      );
    return parsed(endpoint, () => json(result.stdout));
  }

  async function get<T>(endpoint: string, parse: (raw: unknown) => T): Promise<T> {
    const raw = await call(endpoint, false);
    return parsed(endpoint, () => parse(raw));
  }

  async function pages(endpoint: string, key?: string): Promise<unknown[]> {
    const raw = await call(endpoint, true);
    return parsed(endpoint, () => {
      if (!Array.isArray(raw)) throw malformed();
      return raw.flatMap((page: unknown): unknown[] => {
        const items = key === undefined ? page : record(page)[key];
        if (!Array.isArray(items)) throw malformed();
        return items;
      });
    });
  }

  async function getAll<T>(endpoint: string, parse: (raw: unknown) => T, key?: string): Promise<T[]> {
    const items = await pages(endpoint, key);
    return parsed(endpoint, () => items.map(parse));
  }

  async function send(
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    options: { fields?: object; silent?: boolean } = {},
  ): Promise<string> {
    signal?.throwIfAborted();
    const folder = options.fields === undefined ? null : await mkdtemp(join(tmpdir(), 'celetis-gh.'));
    try {
      const input = folder === null ? [] : ['--input', join(folder, 'input.json')];
      if (folder !== null) await writeFile(join(folder, 'input.json'), JSON.stringify(options.fields), { mode: 0o600 });
      const result = await run(
        'gh',
        [
          'api',
          '-X',
          method,
          `repos/{owner}/{repo}/${endpoint}`,
          ...(options.silent === false ? [] : ['--silent']),
          ...input,
        ],
        { cwd, signal, env },
      );
      const issue = /^issues\/([1-9][0-9]*)(?:\/|$)/.exec(endpoint);
      const key = issue && parseKey(issue[1] as string);
      if (result.code === 0 && key) await writeRefreshHint(cwd, key);
      signal?.throwIfAborted();
      if (result.code !== 0) {
        const failure = `${result.stdout}${result.stderr}`.trimEnd();
        throw new GitHubError(endpoint, failure, result.stderr, failure);
      }
      stderr += result.stderr;
      return result.stdout;
    } finally {
      if (folder !== null) await rm(folder, { recursive: true, force: true });
    }
  }

  async function graphql(
    query: string,
    variables: Readonly<Record<string, string | number>> = {},
  ): Promise<Record<string, unknown>> {
    signal?.throwIfAborted();
    const result = await run(
      'gh',
      [
        'api',
        'graphql',
        '-F',
        'owner={owner}',
        '-F',
        'name={repo}',
        '-f',
        `query=${query}`,
        ...Object.entries(variables).flatMap(([key, value]) => [
          typeof value === 'number' ? '-F' : '-f',
          `${key}=${value}`,
        ]),
      ],
      { cwd, signal, env },
    );
    signal?.throwIfAborted();
    stderr += result.stderr;
    if (result.code !== 0)
      throw new GitHubError(
        'graphql',
        `${result.stdout}${result.stderr}`.trimEnd(),
        result.stderr,
        'GitHub read failed',
      );
    return parsed('graphql', () => {
      const answer = record(json(result.stdout));
      if (answer.errors !== undefined) throw malformed();
      return record(answer.data);
    });
  }

  let viewer: Promise<string> | undefined;
  const login = () => {
    viewer ??= call('user', false, 'user')
      .then((raw) =>
        parsed('user', () => {
          const name = text(record(raw).login);
          if (!name) throw malformed();
          return name;
        }),
      )
      .catch((error: unknown) => {
        viewer = undefined;
        throw error;
      });
    return viewer;
  };

  const connectionAt = (value: unknown, ...keys: string[]) => parsed('graphql', () => connection(select(value, keys)));

  return {
    cwd,
    signal,
    env,
    parsed,
    json,
    get,
    pages,
    getAll,
    send,
    graphql,
    connectionAt,
    stderr: () => stderr,
    appendStderr: (text: string) => {
      stderr += text;
    },
    login,
  };
}

export function converting<T extends object>(adapter: T, convert: (error: GitHubError) => Error): T {
  return Object.fromEntries(
    Object.entries(adapter).map(([name, member]) => [
      name,
      typeof member === 'function'
        ? (...args: unknown[]) => {
            const result: unknown = member(...args);
            if (!(result instanceof Promise)) return result;
            return result.catch((error: unknown) => {
              throw error instanceof GitHubError ? convert(error) : error;
            });
          }
        : member,
    ]),
  ) as T;
}
