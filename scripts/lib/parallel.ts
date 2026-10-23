import { spawn } from 'node:child_process';
import { availableParallelism, constants } from 'node:os';
import { childEnv } from './process.ts';

export interface Job {
  label: string;
  file: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface JobResult {
  label: string;
  code: number;
  output: string;
  elapsedMs: number;
  timedOut: boolean;
}

export async function runJobs(
  jobs: Job[],
  { workers = Math.min(4, availableParallelism()), timeoutMs = 30_000 } = {},
): Promise<JobResult[]> {
  if (!Number.isSafeInteger(workers) || workers < 1) throw new Error('workers must be a positive safe integer');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('timeout must be a positive safe integer');
  let index = 0;
  let interrupted = 0;
  const results: JobResult[] = new Array(jobs.length);
  const active = new Set<(code: number) => void>();
  const handlers = new Map<NodeJS.Signals, () => void>();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    const handler = () => {
      interrupted = 128 + constants.signals[signal];
      for (const stop of active) stop(interrupted);
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }
  const execute = async (job: Job): Promise<JobResult> => {
    const start = performance.now();
    let code = 0;
    let timedOut = false;
    let output = '';
    const child = spawn(job.file, job.args, {
      cwd: job.cwd,
      env: childEnv(job.env),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const killGroup = (signal: NodeJS.Signals) => {
      if (child.pid) {
        try {
          process.kill(-child.pid, signal);
        } catch {}
      }
    };
    const stop = (status: number) => {
      code ||= status;
      killGroup('SIGTERM');
    };
    active.add(stop);
    const closed = new Promise<void>((done) => child.once('close', () => done()));
    const exited = new Promise<void>((done) => {
      child.once('error', (error) => {
        code ||= 127;
        output += `${error.message}\n`;
        done();
      });
      child.once('exit', (status, signal) => {
        code ||= status ?? (signal ? 128 + constants.signals[signal] : 1);
        done();
      });
    });
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        if (Buffer.byteLength(output) + Buffer.byteLength(chunk) > 64 * 1024 * 1024) stop(1);
        else output += chunk;
      });
    }
    const deadline = setTimeout(() => {
      timedOut = true;
      stop(124);
    }, timeoutMs);
    const force = setInterval(() => {
      if (code) killGroup('SIGKILL');
    }, 100);
    try {
      await exited;
      killGroup('SIGTERM');
      await Bun.sleep(100);
      killGroup('SIGKILL');
      await closed;
      return { label: job.label, code, output, elapsedMs: performance.now() - start, timedOut };
    } finally {
      clearTimeout(deadline);
      clearInterval(force);
      active.delete(stop);
    }
  };
  try {
    await Promise.all(
      Array.from({ length: Math.min(workers, jobs.length) }, async () => {
        for (;;) {
          const current = index++;
          const job = jobs[current];
          if (!job) break;
          results[current] = interrupted
            ? { label: job.label, code: interrupted, output: '', elapsedMs: 0, timedOut: false }
            : await execute(job);
        }
      }),
    );
    return results;
  } finally {
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
}

export function printJobs(
  results: JobResult[],
  output: (text: string) => void = (text) => process.stdout.write(text),
): number {
  for (const result of results) {
    output(result.output);
    if (result.code) output(`FAIL: ${result.label} (exit ${result.code})\n`);
  }
  return Number(results.some((result) => result.code !== 0));
}
