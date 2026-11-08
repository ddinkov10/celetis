import type { Stats } from 'node:fs';
import { lstat, rename } from 'node:fs/promises';
import { type ExitCode, exits } from './contract.ts';
import { HostError } from './host.ts';
import { childEnv, run } from './process.ts';
import { processState } from './process-identity.ts';

type Identity = Readonly<{ pid: number; start: string }>;
type Listed = Readonly<{ oid: string; ref: string }>;

function identity(row: unknown): Identity | null {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) return null;
  const { pid, start } = row as Record<string, unknown>;
  return Number.isInteger(pid) && Number(pid) > 0 && typeof start === 'string' && start
    ? { pid: Number(pid), start }
    : null;
}

function record(source: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(source);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const described = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function moveState(
  common: string,
  { old, next, oldRefs: locks }: Readonly<{ old: string; next: string; oldRefs: string }>,
): Promise<void> {
  const refuse = (line: string, code: ExitCode = exits.prerequisite): never => {
    throw new HostError(`state: ${line}`, code);
  };
  const held = `${old} does not move`;
  const both = `${old} and ${next} both exist; nothing moves; keep one of them by hand, then run the command again`;
  const git = (args: string[], input?: string) =>
    run('git', ['--git-dir', common, ...args], { env: childEnv(), input });
  const entry = async (path: string): Promise<Stats | null> => {
    try {
      return await lstat(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      return refuse(`cannot read ${path}: ${described(error)}`, exits.blocked);
    }
  };
  const collided = async () => {
    if (await entry(old)) refuse(both);
  };
  const listing = async (): Promise<string> => {
    const result = await git(['for-each-ref', '--format=%(objectname) %(refname)', locks]);
    if (result.code !== 0) refuse(`cannot read ${locks}: ${result.stderr.trim()}`, exits.blocked);
    return result.stdout;
  };
  for (let round = 0; round < 3; round++) {
    const seen = await listing();
    const listed: Listed[] = seen
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const at = line.indexOf(' ');
        return { oid: line.slice(0, at), ref: line.slice(at + 1) };
      });
    const folder = await entry(old);
    if (!folder && !listed.length) return;
    if (folder && !folder.isDirectory())
      refuse(`${old} is not a folder; nothing moves; remove it by hand, then run the command again`);
    const lines: string[] = [];
    for (const { oid, ref } of listed) {
      const name = ref.slice(locks.length);
      const issue = /^issue-([1-9][0-9]*)$/.exec(name);
      const subject = issue ? `#${issue[1]}` : name;
      const blob = await git(['cat-file', 'blob', oid]);
      if (blob.code !== 0) {
        lines.push(`state: ${held}: the owner record of ${subject} cannot be read; run the command again`);
        continue;
      }
      const owner = record(blob.stdout);
      for (const field of ['runner', 'session'] as const) {
        const found = identity(owner?.[field]);
        if (!found) continue;
        const state = await processState(found.pid, found.start);
        if (state === 'unknown')
          lines.push(
            `state: ${held}: the process PID ${found.pid} of ${subject} cannot be read; run the command again`,
          );
        else if (state === 'runs')
          lines.push(
            field === 'runner'
              ? `state: ${held}: the old daemon PID ${found.pid} holds ${subject}; end PID ${found.pid}, then run the command again`
              : `state: ${held}: the old session PID ${found.pid} of ${subject} still runs; let it finish or end it in its tab, then run the command again`,
          );
      }
    }
    if (lines.length) throw new HostError(lines.join('\n'), exits.prerequisite);
    if (folder && (await entry(next))) {
      await collided();
      continue;
    }
    if (listed.length) {
      if ((await listing()) !== seen) continue;
      const removed = await git(
        ['update-ref', '--no-deref', '--stdin'],
        listed.map(({ oid, ref }) => `delete ${ref} ${oid}\n`).join(''),
      );
      if (removed.code !== 0) continue;
    }
    if (await listing()) continue;
    if (!folder) return;
    try {
      await rename(old, next);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') continue;
      if (code === 'ENOTEMPTY' || code === 'EEXIST') {
        await collided();
        continue;
      }
      refuse(`cannot move ${old} to ${next}: ${described(error)}`, exits.blocked);
    }
    return;
  }
  refuse(`${old} changed during the move; run the command again`);
}
