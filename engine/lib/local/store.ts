import { constants } from 'node:buffer';
import { devNull } from 'node:os';
import { run } from '../process/process.ts';
import {
  type Bug,
  bugVersion,
  checkBug,
  checkIdentity,
  type Entry,
  encodeIdentity,
  encodeOp,
  encodePack,
  FormatError,
  type Identity,
  type IdentityCommit,
  type RawCommit,
  sha256,
} from './format.ts';

export class StoreError extends Error {
  constructor(
    readonly kind: 'prerequisite' | 'blocked' | 'missing' | 'unsettled',
    message: string,
    readonly ambiguous: readonly string[] = [],
  ) {
    super(message);
  }
}

export type NewOp = Readonly<{
  type: number;
  fields: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, string>>;
}>;

export type Store = Readonly<{
  bugIds(): Promise<ReadonlyMap<string, string>>;
  resolve(key: string): Promise<string>;
  bug(id: string): Promise<Bug>;
  bugs(): Promise<Readonly<{ bugs: readonly Bug[]; refused: readonly Readonly<{ ref: string; rule: string }>[] }>>;
  identities(): Promise<ReadonlyMap<string, Identity>>;
  writable(): Promise<string | null>;
  author(): Promise<string>;
  create(first: NewOp, next: readonly NewOp[]): Promise<Readonly<{ id: string; opIds: readonly string[] }>>;
  append(id: string, ops: readonly NewOp[], files?: readonly Uint8Array[]): Promise<readonly string[]>;
  merge(id: string, remote: string): Promise<void>;
  mergeIdentity(id: string, remote: string): Promise<void>;
}>;

const bugRefs = 'refs/bugs/';
const identityRefs = 'refs/identities/';
const zero = '0000000000000000000000000000000000000000';
const maxJump = 1_000_000;
// A root clock has no parent to bound it, so a forged clock near 2^53 would make each next clock unsafe.
const maxFollowed = 2 ** 52;
const attempts = 5;

type Ref = Readonly<{ id: string; tip: string; commit: boolean }>;
type Objects = Readonly<{
  parents: ReadonlyMap<string, readonly string[]>;
  entries: ReadonlyMap<string, readonly Entry[]>;
  ops: ReadonlyMap<string, Uint8Array>;
  versions: ReadonlyMap<string, Uint8Array>;
}>;
type State = {
  readonly bugRefs: readonly Ref[];
  readonly raw: Map<string, RawCommit[]>;
  readonly bugs: Map<string, Bug>;
  readonly refused: Map<string, FormatError>;
  readonly identities: Map<string, Identity>;
  readonly identityRefusals: Map<string, string>;
  readonly objects: Objects;
  createClock: number;
  editClock: number;
};

function parseTree(content: Buffer, hashBytes: number): Entry[] {
  const entries: Entry[] = [];
  let at = 0;
  while (at < content.length) {
    const space = content.indexOf(0x20, at);
    const nul = content.indexOf(0x00, space);
    if (space < 0 || nul < 0) break;
    const mode = content.toString('latin1', at, space);
    entries.push({
      name: content.toString('utf8', space + 1, nul),
      type: mode === '40000' ? 'tree' : 'blob',
      hash: content.toString('hex', nul + 1, nul + 1 + hashBytes),
    });
    at = nul + 1 + hashBytes;
  }
  return entries;
}

function reachable(tip: string, parents: ReadonlyMap<string, readonly string[]>): string[] {
  const seen = new Set<string>();
  const stack = [tip];
  for (let c = stack.pop(); c !== undefined; c = stack.pop()) {
    if (seen.has(c)) continue;
    seen.add(c);
    stack.push(...(parents.get(c) ?? []));
  }
  return [...seen];
}

// Git for Windows reads a leading / as its install prefix and warns about /dev/null.
const base = ['--no-optional-locks', '-c', `core.hooksPath=${devNull}`];

export function openStore(main: string, signal?: AbortSignal): Store {
  async function git(args: string[], input?: string | Uint8Array, bytes = false) {
    return run('git', [...base, ...args], {
      cwd: main,
      signal,
      input,
      bytes,
      // Over this bound the decode of the output throws inside run() and its promise never settles.
      maxBuffer: constants.MAX_STRING_LENGTH,
    });
  }
  async function must(args: string[], input?: string | Uint8Array, bytes = false): Promise<string> {
    const result = await git(args, input, bytes);
    if (result.code !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.trim()}`);
    return result.stdout;
  }

  async function refs(): Promise<Readonly<{ bugs: Ref[]; identities: Ref[] }>> {
    const out = await must(['for-each-ref', '--format=%(objectname) %(objecttype) %(refname)', bugRefs, identityRefs]);
    const bugs: Ref[] = [];
    const identities: Ref[] = [];
    for (const line of out.split('\n')) {
      const [tip = '', type = '', ...name] = line.split(' ');
      const ref = name.join(' ');
      if (ref.startsWith(bugRefs)) bugs.push({ id: ref.slice(bugRefs.length), tip, commit: type === 'commit' });
      else if (ref.startsWith(identityRefs))
        identities.push({ id: ref.slice(identityRefs.length), tip, commit: type === 'commit' });
    }
    return { bugs, identities };
  }

  async function load(tips: readonly string[]): Promise<Objects> {
    const parents = new Map<string, readonly string[]>();
    const entries = new Map<string, readonly Entry[]>();
    const ops = new Map<string, Uint8Array>();
    const versions = new Map<string, Uint8Array>();
    if (tips.length === 0) return { parents, entries, ops, versions };
    const list = await must(['rev-list', '--parents', '--topo-order', '--stdin'], `${[...new Set(tips)].join('\n')}\n`);
    for (const line of list.split('\n')) {
      const [commit, ...rest] = line.split(' ');
      if (commit) parents.set(commit, rest);
    }
    const commits = [...parents.keys()];
    const batch = Buffer.from(
      await must(['cat-file', '--batch'], commits.map((c) => `${c}^{tree}\n${c}:ops\n${c}:version\n`).join(''), true),
      'latin1',
    );
    let at = 0;
    const next = (): Readonly<{ type: string; content: Buffer; hash: string }> | null => {
      const end = batch.indexOf(0x0a, at);
      const [hash = '', type = '', size = ''] = batch.toString('latin1', at, end).split(' ');
      at = end + 1;
      if (type === 'missing' || type === 'ambiguous' || size === '') return null;
      const content = batch.subarray(at, at + Number(size));
      at += Number(size) + 1;
      return { type, content, hash };
    };
    for (const c of commits) {
      const tree = next();
      const op = next();
      const version = next();
      if (tree?.type === 'tree') entries.set(c, parseTree(tree.content, tree.hash.length / 2));
      if (op?.type === 'blob') ops.set(c, new Uint8Array(op.content));
      if (version?.type === 'blob') versions.set(c, new Uint8Array(version.content));
    }
    return { parents, entries, ops, versions };
  }

  const rawOf = (objects: Objects, tip: string): RawCommit[] =>
    reachable(tip, objects.parents).map((commit) => ({
      commit,
      parents: objects.parents.get(commit) ?? [],
      entries: objects.entries.get(commit) ?? [],
      ops: objects.ops.get(commit) ?? null,
    }));
  const chainOf = (objects: Objects, tip: string): IdentityCommit[] =>
    reachable(tip, objects.parents).map((commit) => ({
      commit,
      parents: objects.parents.get(commit) ?? [],
      entries: objects.entries.get(commit) ?? [],
      version: objects.versions.get(commit) ?? null,
    }));

  async function read(scope: 'all' | 'none' | string, extra: readonly string[] = []): Promise<State> {
    const all = await refs();
    const chosen = scope === 'all' ? all.bugs : scope === 'none' ? [] : all.bugs.filter((r) => r.id === scope);
    const tips = [...chosen, ...all.identities].filter((r) => r.commit).map((r) => r.tip);
    const own = await load(tips);
    const fetched =
      extra.length === 0
        ? null
        : await load(extra).catch((error: unknown) => {
            if (signal?.aborted || !(error instanceof Error)) throw error;
            throw new FormatError('the history cannot be read', error.message);
          });
    const objects: Objects =
      fetched === null
        ? own
        : {
            parents: new Map([...own.parents, ...fetched.parents]),
            entries: new Map([...own.entries, ...fetched.entries]),
            ops: new Map([...own.ops, ...fetched.ops]),
            versions: new Map([...own.versions, ...fetched.versions]),
          };
    const identities = new Map<string, Identity>();
    const identityRefusals = new Map<string, string>();
    for (const ref of all.identities) {
      try {
        if (!ref.commit) throw new FormatError('the ref does not name a commit', ref.id);
        identities.set(ref.id, checkIdentity(ref.id, chainOf(objects, ref.tip)));
      } catch (error) {
        if (!(error instanceof FormatError)) throw error;
        identityRefusals.set(ref.id, error.message);
      }
    }
    const state: State = {
      bugRefs: all.bugs,
      raw: new Map(),
      bugs: new Map(),
      refused: new Map(),
      identities,
      identityRefusals,
      objects,
      createClock: 0,
      editClock: 0,
    };
    for (const ref of chosen) {
      try {
        if (!ref.commit) throw new FormatError('the ref does not name a commit', ref.id);
        const raw = rawOf(objects, ref.tip);
        state.raw.set(ref.id, raw);
        const bug = checkBug(ref.id, raw, identities);
        state.bugs.set(ref.id, bug);
        state.createClock = Math.max(state.createClock, Math.min(bug.createClock, maxFollowed));
        state.editClock = Math.max(state.editClock, Math.min(bug.editClock, maxFollowed));
      } catch (error) {
        if (!(error instanceof FormatError)) throw error;
        state.refused.set(ref.id, error);
      }
    }
    return state;
  }

  const notFound = (key: string) => new StoreError('missing', `no local issue matches ${key}`);

  function valid(state: State, id: string): Bug {
    const bug = state.bugs.get(id);
    if (bug) return bug;
    throw state.refused.get(id) ?? notFound(id);
  }

  async function config(key: string, local = false): Promise<string> {
    const result = await git(['config', ...(local ? ['--local'] : []), '--get', key]);
    return result.code === 0 ? result.stdout.trim() : '';
  }

  async function writable(): Promise<string | null> {
    if ((await git(['show-ref', '--verify', '--quiet', 'refs/config/config'])).code === 0)
      return 'refs/config/config exists: the local tracker does not read the git-bug config entity; remove the ref or use the git-bug tools';
    if (!(await config('user.email')))
      return 'git config user.email is not set: run git config user.email <address> in the main checkout';
    return null;
  }

  async function prerequisite(): Promise<void> {
    const line = await writable();
    if (line !== null) throw new StoreError('prerequisite', line);
  }

  const blob = async (data: string | Uint8Array) => (await must(['hash-object', '-w', '--stdin'], data)).trim();
  const tree = async (entries: readonly Entry[]) =>
    (
      await must(
        ['mktree'],
        entries.map((e) => `${e.type === 'tree' ? '040000' : '100644'} ${e.type} ${e.hash}\t${e.name}\n`).join(''),
      )
    ).trim();
  const commit = async (treeHash: string, parents: readonly string[]) =>
    (await must(['commit-tree', '--no-gpg-sign', treeHash, ...parents.flatMap((p) => ['-p', p])], '')).trim();

  async function move(ref: string, next: string, old: string): Promise<boolean> {
    const result = await git(['update-ref', ref, next, old]);
    if (result.code === 0) return true;
    // No signal: after an abort the ref must still be read to know whether the move happened.
    const read = await run('git', [...base, 'rev-parse', '--verify', '--quiet', ref], { cwd: main });
    const at = read.code === 0 ? read.stdout.trim() : read.code === 1 && read.stderr === '' ? zero : null;
    if (at === next) return true;
    if (at !== null && at !== old) return false;
    const line =
      result.stderr
        .trim()
        .split('\n')
        .find((l) => !l.startsWith('warning:')) || `git update-ref of ${ref} failed`;
    if (at === null)
      throw new StoreError('unsettled', `${line}; ${ref} can hold the write: read the issue before you write again`);
    throw new StoreError('blocked', `${line}; nothing was written`);
  }

  async function identify(state: State): Promise<string> {
    const configured = await config('git-bug.identity', true);
    if (configured) {
      if (state.identities.has(configured)) return configured;
      throw new StoreError(
        'prerequisite',
        `git config git-bug.identity names ${configured}: ${state.identityRefusals.get(configured) ?? 'no local identity has this ID'}`,
      );
    }
    const email = await config('user.email');
    const [known] = [...state.identities.values()]
      .filter((i) => i.email === email)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (known) return known.id;
    const name = await config('user.name');
    if (!name)
      throw new StoreError(
        'prerequisite',
        'git config user.name is not set: run git config user.name <name> in the main checkout',
      );
    const version = encodeIdentity(
      name,
      email,
      { create: state.createClock, edit: state.editClock },
      Math.floor(Date.now() / 1000),
    );
    const id = sha256(version);
    const tip = await commit(await tree([{ name: 'version', type: 'blob', hash: await blob(version) }]), []);
    if (!(await move(`${identityRefs}${id}`, tip, zero)))
      throw new StoreError('blocked', `${identityRefs}${id} exists already; nothing was written`);
    await must(['config', '--local', 'git-bug.identity', id]);
    state.identities.set(id, { id, tip, name, email, keys: false });
    return id;
  }

  async function writePack(
    packBlob: string,
    empty: string,
    clocks: Readonly<{ edit: number; create: number | null }>,
    parents: readonly string[],
    extra: string | null = null,
  ): Promise<RawCommit> {
    const entries: Entry[] = [
      { name: `version-${bugVersion}`, type: 'blob', hash: empty },
      { name: 'ops', type: 'blob', hash: packBlob },
      { name: `edit-clock-${clocks.edit}`, type: 'blob', hash: empty },
      ...(clocks.create === null
        ? []
        : [{ name: `create-clock-${clocks.create}`, type: 'blob' as const, hash: empty }]),
      ...(extra === null ? [] : [{ name: 'extra', type: 'tree' as const, hash: extra }]),
    ];
    return { commit: await commit(await tree(entries), parents), parents, entries, ops: null };
  }

  const editClock = (highest: number, parent: number) => Math.min(Math.max(highest, parent) + 1, parent + maxJump);
  const now = () => Math.floor(Date.now() / 1000);
  const encode = (op: NewOp, at: number) => encodeOp(op.type, op.fields, at, op.metadata);

  return {
    async bugIds() {
      return new Map((await refs()).bugs.map((r) => [r.id, r.tip]));
    },

    async resolve(key) {
      const ids = key === '' ? [] : (await refs()).bugs.map((r) => r.id).filter((id) => id.startsWith(key));
      const [id] = ids;
      if (ids.length === 1 && id !== undefined) return id;
      if (ids.length === 0) throw notFound(key);
      throw new StoreError('blocked', `${key} matches several local issues: ${ids.join(', ')}`, ids);
    },

    async bug(id) {
      return valid(await read(id), id);
    },

    async bugs() {
      const state = await read('all');
      return {
        bugs: [...state.bugs.values()],
        refused: [...state.refused].map(([id, error]) => ({ ref: `${bugRefs}${id}`, rule: error.message })),
      };
    },

    async identities() {
      return (await read('none')).identities;
    },

    writable,

    async author() {
      await prerequisite();
      return identify(await read('all'));
    },

    async create(first, next) {
      await prerequisite();
      const state = await read('all');
      const author = await identify(state);
      const at = now();
      const prefixes = new Set(state.bugRefs.map((r) => r.id.slice(0, 7)));
      let firstOp = encode(first, at);
      while (prefixes.has(sha256(firstOp).slice(0, 7))) firstOp = encode(first, at);
      const id = sha256(firstOp);
      const nextOps = next.map((op) => encode(op, at));
      const empty = await blob('');
      const createClock = state.createClock + 1;
      const rootClock = state.editClock + 1;
      const firstPack = encodePack(author, [firstOp]);
      const root = await writePack(await blob(firstPack), empty, { edit: rootClock, create: createClock }, []);
      const commits: RawCommit[] = [{ ...root, ops: new TextEncoder().encode(firstPack) }];
      if (nextOps.length > 0) {
        const nextPack = encodePack(author, nextOps);
        const second = await writePack(await blob(nextPack), empty, { edit: rootClock + 1, create: null }, [
          root.commit,
        ]);
        commits.push({ ...second, ops: new TextEncoder().encode(nextPack) });
      }
      const bug = checkBug(id, commits, state.identities);
      if (!(await move(`${bugRefs}${id}`, bug.tip, zero)))
        throw new StoreError('blocked', `${bugRefs}${id} exists already; nothing was written`);
      return { id, opIds: [id, ...nextOps.map((op) => sha256(op))] };
    },

    async append(id, ops, files = []) {
      await prerequisite();
      let state = await read('all');
      valid(state, id);
      const author = await identify(state);
      const at = now();
      const encoded = ops.map((op) => encode(op, at));
      const pack = encodePack(author, encoded);
      const packBytes = new TextEncoder().encode(pack);
      const packBlob = await blob(pack);
      const empty = await blob('');
      const hashes: string[] = [];
      for (const file of files) hashes.push(await blob(file));
      const extra =
        hashes.length === 0
          ? null
          : await tree(hashes.map((hash, i) => ({ name: `file${i}`, type: 'blob' as const, hash })));
      for (let attempt = 1; attempt <= attempts; attempt++) {
        if (attempt > 1) state = await read('all');
        const bug = valid(state, id);
        const written = await writePack(
          packBlob,
          empty,
          { edit: editClock(state.editClock, bug.editClock), create: null },
          [bug.tip],
          extra,
        );
        checkBug(id, [...(state.raw.get(id) ?? []), { ...written, ops: packBytes }], state.identities);
        if (await move(`${bugRefs}${id}`, written.commit, bug.tip)) return encoded.map((op) => sha256(op));
      }
      throw new StoreError('blocked', 'the issue changed during the write five times; nothing was written');
    },

    async merge(id, remote) {
      await prerequisite();
      for (let attempt = 1; attempt <= attempts; attempt++) {
        const state = await read('all', [remote]);
        const remoteRaw = rawOf(state.objects, remote);
        const theirs = checkBug(id, remoteRaw, state.identities);
        const ref = `${bugRefs}${id}`;
        if (!state.bugRefs.some((r) => r.id === id)) {
          if (await move(ref, theirs.tip, zero)) return;
          continue;
        }
        const ours = valid(state, id);
        const local = state.raw.get(id) ?? [];
        if (local.some((c) => c.commit === theirs.tip)) return;
        const rootOf = (commits: readonly RawCommit[]) => commits.find((c) => c.parents.length === 0)?.commit;
        if (rootOf(local) !== rootOf(remoteRaw))
          throw new FormatError('the remote history has another root commit', id);
        if (remoteRaw.some((c) => c.commit === ours.tip)) {
          if (await move(ref, theirs.tip, ours.tip)) return;
          continue;
        }
        const author = await identify(state);
        const pack = encodePack(author, []);
        const highest = Math.max(state.editClock, ours.editClock, theirs.editClock);
        const written = await writePack(await blob(pack), await blob(''), { edit: highest + 1, create: null }, [
          ours.tip,
          theirs.tip,
        ]);
        const union = new Map([...local, ...remoteRaw].map((c) => [c.commit, c]));
        checkBug(id, [...union.values(), { ...written, ops: new TextEncoder().encode(pack) }], state.identities);
        if (await move(ref, written.commit, ours.tip)) return;
      }
      throw new StoreError('blocked', 'the issue changed during the write five times; nothing was written');
    },

    async mergeIdentity(id, remote) {
      const ref = `${identityRefs}${id}`;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        const state = await read('none', [remote]);
        const chain = chainOf(state.objects, remote);
        checkIdentity(id, chain);
        const refusal = state.identityRefusals.get(id);
        if (refusal !== undefined) throw new FormatError(`the local identity is not valid: ${refusal}`, id);
        const ours = state.identities.get(id);
        if (ours === undefined) {
          if (await move(ref, remote, zero)) return;
          continue;
        }
        if (reachable(ours.tip, state.objects.parents).includes(remote)) return;
        if (!chain.some((c) => c.commit === ours.tip))
          throw new FormatError('the remote identity has diverged from the local identity', id);
        if (await move(ref, remote, ours.tip)) return;
      }
      throw new StoreError('blocked', 'the identity changed during the write five times; nothing was written');
    },
  };
}
