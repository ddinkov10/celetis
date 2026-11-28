import { randomBytes } from 'node:crypto';
import type { ExitCode } from '../contract/contract.ts';
import type { Host } from '../host/names.ts';
import type { ProcessState } from '../process/identity.ts';
import type { RunEnd, RunInput, RunState } from '../run/engine.ts';
import type { Event, Kind } from '../run/machine.ts';
import { appendLine, type LineLog, lineLimit, shorten } from '../state/lines.ts';
import type { IssueKey } from '../tracker/key.ts';
import type { SessionWork } from '../workflow/workflow.ts';
import type { DaemonStatus } from './types.ts';

export type LifecycleData = {
  'daemon.started': { successor: boolean };
  'daemon.ended': { code: ExitCode; restart: boolean };
  'auto.status': { from: DaemonStatus['auto']; to: DaemonStatus['auto']; code: ExitCode | null };
  'run.started': { kind: RunInput['kind']; numbers: readonly IssueKey[] | null; adopted: boolean };
  'run.transition': { from: Kind; event: Event['kind']; to: Kind; dropped?: Event['kind'] };
  'run.status': { from: RunState; to: RunState };
  'step.started': { step: SessionWork; host: Host; tab: string; attempt: string | null };
  'step.ended': { step: SessionWork; host: Host; event: Event['kind']; code: number | null };
  'run.ended': { end: RunEnd['kind'] | 'failed'; code: ExitCode; reason: string };
  'run.refused': { reason: string; moved: string | null; session: ProcessState | null };
  'landing.waits': { ahead: IssueKey };
  'landing.started': Record<never, never>;
  'landing.ended': { code: ExitCode };
};

export type LifecycleNote = {
  [T in keyof LifecycleData]: Readonly<{ type: T; data: LifecycleData[T] }>;
}[keyof LifecycleData];

type Cut = 'data.reason' | 'data.numbers';
type Site = Readonly<{ run: string | null; issue: IssueKey | null }>;
type Daemon = Readonly<{ pid: number; revision: string }>;
type Head = Readonly<{ schema: 1; id: string; time: string; seq: number; daemon: Daemon }>;

export type LifecycleEntry = LifecycleNote &
  Readonly<{
    schema: 1;
    id: string;
    time: string;
    seq: number;
    daemon: Daemon;
    run: string | null;
    issue: IssueKey | null;
    truncated?: Cut[];
  }>;

export type Lifecycle = Readonly<{ record(at: Site, notes: () => readonly LifecycleNote[]): void }>;

function serialize(note: LifecycleNote, head: Head, at: Site): string {
  const truncated: Cut[] = [];
  let data: Record<string, unknown> = { ...note.data };
  const render = () =>
    JSON.stringify({
      ...head,
      type: note.type,
      run: at.run,
      issue: at.issue,
      data,
      ...(truncated.length ? { truncated } : {}),
    });
  const excess = () => Buffer.byteLength(render()) + 1 - lineLimit;
  const cut = (field: Cut) => {
    truncated.push(field);
    return excess();
  };
  if (excess() > 0 && typeof data.reason === 'string') data.reason = shorten(data.reason, cut('data.reason'));
  if (excess() > 0 && Array.isArray(data.numbers) && data.numbers.length) {
    const numbers = [...data.numbers];
    data = { ...data, numbers };
    let over = cut('data.numbers');
    while (over > 0 && numbers.length) over -= Buffer.byteLength(JSON.stringify(numbers.pop() ?? '')) + 1;
  }
  return `${render()}\n`;
}

export function createLifecycle(log: LineLog, daemon: Daemon, print: (line: string) => void): Lifecycle {
  let seq = 0;
  const printed = new Set<string>();
  const fail = (error: unknown) => {
    const reason = (error instanceof Error ? error.message : String(error)).replace(/^daemon: /, '');
    if (printed.has(reason)) return;
    printed.add(reason);
    try {
      print(`daemon: cannot record the lifecycle event: ${reason}`);
    } catch {}
  };
  return {
    record(at, notes) {
      let list: readonly LifecycleNote[];
      try {
        list = notes();
      } catch (error) {
        fail(error);
        return;
      }
      for (const note of list) {
        try {
          const head: Head = {
            schema: 1,
            id: `${Date.now()}-${process.pid}-${randomBytes(4).toString('hex')}`,
            time: new Date().toISOString(),
            seq: ++seq,
            daemon,
          };
          appendLine(log, serialize(note, head, at));
          printed.clear();
        } catch (error) {
          fail(error);
        }
      }
    },
  };
}
