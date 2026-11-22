import { type ChildProcessByStdio, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { classOf, exits, signalExit } from '../contract/contract.ts';
import { bunArgs, childEnv } from '../process/process.ts';

export type Outcome = Readonly<{ code: number; class: string | null; saved?: string }> &
  ({ readonly json: unknown } | { readonly stdout: string }) &
  Readonly<{ stderr: string }>;

const savedAbove = 10_000;

function jsonOf(stdout: string): { value: unknown } | null {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    return null;
  }
  const body = stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout;
  return body === JSON.stringify(value) || body === JSON.stringify(value, null, 2) ? { value } : null;
}

export function outcomeOf(code: number, stdout: string, stderr: string): Outcome {
  const parsed = jsonOf(stdout);
  const outcome: Outcome = {
    code,
    class: classOf(code),
    ...(parsed ? { json: parsed.value } : { stdout }),
    stderr,
  };
  if (code === 0 || JSON.stringify(outcome).length <= savedAbove) return outcome;
  let saved: string;
  try {
    saved = join(mkdtempSync(join(tmpdir(), 'celetis-mcp-')), 'result.json');
  } catch {
    return outcome;
  }
  const long: Outcome = {
    code,
    class: outcome.class,
    saved,
    ...('json' in outcome ? { json: outcome.json } : { stdout }),
    stderr,
  };
  try {
    writeFileSync(saved, JSON.stringify(long));
  } catch {
    return outcome;
  }
  return long;
}

export function runForm(root: string, host: string, argv: readonly string[], checkout: string): Promise<Outcome> {
  return new Promise((resolve) => {
    let child: ChildProcessByStdio<null, Readable, Readable>;
    try {
      child = spawn(process.execPath, bunArgs(join(root, 'engine', 'celetis'), ['--agent', host, ...argv]), {
        cwd: checkout,
        env: childEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });
    } catch (error) {
      resolve(outcomeOf(exits.blocked, '', `${(error as Error).message}\n`));
      return;
    }
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    let ended = false;
    let drain: ReturnType<typeof setTimeout> | undefined;
    const settle = (code: number, failure = '') => {
      if (ended) return;
      ended = true;
      clearTimeout(drain);
      child.stdout.destroy();
      child.stderr.destroy();
      resolve(outcomeOf(code, Buffer.concat(stdout).toString(), Buffer.concat(stderr).toString() + failure));
    };
    child.once('error', (error) => settle(exits.blocked, `${error.message}\n`));
    // A descendant of the form, for example the daemon of `daemon start`, can hold a pipe open after the form exits, and close waits for that descendant.
    child.once('exit', (code, signal) => {
      const status = code ?? (signal ? signalExit(constants.signals[signal]) : exits.internal);
      child.once('close', () => settle(status));
      drain = setTimeout(() => settle(status), 1_000);
    });
  });
}
