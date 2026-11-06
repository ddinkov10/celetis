import { randomUUID } from 'node:crypto';
import { closeSync, constants, fstatSync, openSync } from 'node:fs';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { bindingMode, readBinding, resolvePair, ScoreError } from './lib/capability.ts';
import type { Host } from './lib/config-core.ts';
import {
  type Context,
  closeTask,
  convertDispatchRecord,
  type DispatchRecord,
  type ExecutionReport,
  emptyRecord,
  type Result,
  type Role,
  reportExecution,
  reportGate,
  reportReview,
  requestNext,
  validateExecutionReport,
  validateRecord,
} from './lib/dispatch-record.ts';
import { installRecorder, markDefect } from './lib/events.ts';
import { HostError, updateHint } from './lib/host.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { privateFolder, privateMode, privateRoot } from './lib/private-folder.ts';
import { commitMigration, readLocalRecord } from './lib/state-migration.ts';
import { tryFlock } from './lib/update-lock.ts';
import { openLockFile } from './lib/windows.ts';

const usage = `celetis --agent <host> dispatch next <n> <task> implementer|reviewer J V B N S X --bias N [--profile FILE] [--runtime-models FILE]
celetis --agent <host> dispatch gate <n> <task> pass|fail <gate> <report> [--profile FILE] [--runtime-models FILE]
celetis --agent <host> dispatch review <n> <task> findings|blocked [--profile FILE] [--runtime-models FILE]
celetis --agent <host> dispatch close <n> <task>
celetis --agent <host> dispatch show
celetis --agent <host> dispatch report <dispatch-id> <report-file>`;
class UsageError extends Error {}
class SetupError extends Error {}
type Input =
  | { act: 'next'; issue: number; task: string; role: Role; digits: number[]; bias: number }
  | { act: 'gate'; issue: number; task: string; result: 'pass' | 'fail'; name: string; report: string }
  | { act: 'review'; issue: number; task: string; result: 'findings' | 'blocked' }
  | { act: 'close'; issue: number; task: string }
  | { act: 'show' }
  | { act: 'report'; dispatch: string; file: string };
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('\0');
}
function integer(value: string, min: number): boolean {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= min;
}
function parse(args: string[]): { input: Input; profile?: string; runtimeFile?: string } {
  let profile: string | undefined;
  let runtimeFile: string | undefined;
  let bias: number | undefined;
  const values: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (['--profile', '--runtime-models', '--bias'].includes(arg)) {
      const value = args[++i];
      if (!text(value) || value.startsWith('--') || seen.has(arg)) throw new UsageError(`${arg} needs one value`);
      seen.add(arg);
      if (arg === '--profile') profile = value;
      else if (arg === '--runtime-models') runtimeFile = value;
      else {
        if (!integer(value, 0)) throw new UsageError('--bias needs a non-negative integer');
        bias = Number(value);
      }
    } else if (arg.startsWith('-')) throw new UsageError(`unknown flag: ${arg}`);
    else values.push(arg);
  }
  const [act, issueText = '', task = '', arg = ''] = values;
  if (act !== 'next' && bias !== undefined) throw new UsageError('--bias applies only to next');
  if (act !== 'next' && act !== 'gate' && act !== 'review' && seen.size)
    throw new UsageError(`${act ?? 'dispatch'} takes no flags`);
  if (act === 'show' && values.length === 1) return { input: { act } };
  if (act === 'report' && values.length === 3) return { input: { act, dispatch: issueText, file: task } };
  if (!integer(issueText, 1)) throw new UsageError('need a positive issue number');
  if (!/^(?:[1-9]\d*|final|verify-[1-9]\d*|land-[1-9]\d*)$/.test(task) || task.endsWith('\n'))
    throw new UsageError('need a task number, final, verify-<n>, or land-<n>');
  const issue = Number(issueText);
  let input: Input;
  if (act === 'next' && values.length === 10) {
    if (arg !== 'implementer' && arg !== 'reviewer') throw new UsageError('need implementer or reviewer');
    if (bias === undefined) throw new UsageError('next requires --bias N');
    const digits = values.slice(4);
    if (digits.some((digit) => !/^[0-2]$/.test(digit))) throw new UsageError('need six digits J V B N S X from 0 to 2');
    input = { act, issue, task, role: arg, digits: digits.map(Number), bias };
  } else if (act === 'gate' && values.length === 6 && (arg === 'pass' || arg === 'fail')) {
    const name = values[4] as string;
    const report = values[5] as string;
    if (!text(name) || !text(report)) throw new UsageError('gate needs a name and report');
    input = { act, issue, task, result: arg, name, report };
  } else if (act === 'review' && values.length === 4 && (arg === 'findings' || arg === 'blocked'))
    input = { act, issue, task, result: arg };
  else if (act === 'close' && values.length === 3) input = { act, issue, task };
  else throw new UsageError(usage);
  return { input, profile, runtimeFile };
}
function sessionOf(host: Host, session: unknown): string {
  const variable = host === 'claude' ? 'CLAUDE_CODE_SESSION_ID' : 'CODEX_SESSION_ID';
  if (typeof session !== 'string' || !/^[A-Za-z0-9-]{1,128}$/.test(session) || session.endsWith('\n'))
    throw new SetupError(`need a valid ${variable}`);
  return session;
}
function setupFailure(path: string, reason: string): SetupError {
  return new SetupError(`${path}: ${reason}`);
}
async function folders(root: string, dir: string): Promise<void> {
  await privateFolder(root, setupFailure);
  await privateFolder(dir, setupFailure);
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
async function withRecord<T>(
  host: Host,
  session: string,
  act: (record: DispatchRecord | null) => Promise<{ value: T; record?: DispatchRecord }>,
): Promise<T> {
  const root = privateRoot;
  const dir = join(root, 'dispatch');
  const file = join(dir, `${host}-${session}.json`);
  const lock = `${file}.lock`;
  let sourceSchema: unknown;
  const failure = (error: unknown) =>
    new SetupError(
      `${file}: ${sourceSchema === undefined ? 'target schema 2' : `schema ${String(sourceSchema)} to 2`}: ${message(error)}`,
    );
  try {
    await folders(root, dir);
  } catch (error) {
    throw failure(error);
  }
  let fd: number;
  try {
    fd =
      process.platform === 'win32'
        ? openLockFile(lock)
        : openSync(lock, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  } catch (error) {
    throw failure(new Error(`${lock}: ${message(error)}`));
  }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || !privateMode(stat)) throw new SetupError(`${lock}: need a private regular lock file`);
    const deadline = performance.now() + 10_000;
    while (!tryFlock(fd)) {
      if (performance.now() >= deadline) throw new SetupError(`${lock}: timed out waiting for the dispatch lock`);
      await Bun.sleep(25);
    }
    await folders(root, dir);
    let record: DispatchRecord | null = null;
    const source = await readLocalRecord(file, [root, dir], 'private');
    if (source) {
      const value = source.value;
      if (value !== null && typeof value === 'object' && !Array.isArray(value))
        sourceSchema = (value as Record<string, unknown>).schema;
      if (sourceSchema === 1) {
        record = convertDispatchRecord(value, host, session);
        await commitMigration(source, 1, `${JSON.stringify(record)}\n`);
      } else {
        if (sourceSchema !== undefined && sourceSchema !== 2) throw new SetupError('unsupported schema');
        record = validateRecord(value, host, session);
      }
    }
    const result = await act(record);
    if (result.record !== undefined) {
      await folders(root, dir);
      validateRecord(result.record, host, session);
      const temp = join(dir, `.${host}-${session}.${randomUUID()}`);
      try {
        await writeFile(temp, `${JSON.stringify(result.record)}\n`, { flag: 'wx', mode: 0o600 });
        await folders(root, dir);
        await rename(temp, file);
      } finally {
        await rm(temp, { force: true });
      }
    }
    return result.value;
  } catch (error) {
    if (error instanceof ScoreError) throw error;
    throw failure(error);
  } finally {
    closeSync(fd);
  }
}
function printResult(result: Result): number {
  if (result.status === 'ready') {
    const d = result.dispatch;
    console.log(
      JSON.stringify({
        schema: 1,
        status: result.status,
        issue: d.issue,
        task: d.task,
        role: d.role,
        attempt: d.attempt,
        round: d.round,
        action: d.action,
        child: d.child,
        dispatch: d.id,
        line: d.line,
        pair: d.pair,
        voided: result.voided,
      }),
    );
    return 0;
  }
  console.log(JSON.stringify({ schema: 1, ...result }));
  if (result.status === 'closed' || result.status === 'reported') return 0;
  console.error(`dispatch: ${result.status}: ${result.reason}`);
  return { refused: 3, stop: 4, setup: 5 }[result.status];
}
export async function main(argv: string[]): Promise<number> {
  let input: Input | undefined;
  try {
    const selected = commandInput(argv);
    const parsed = parse(selected.args);
    input = parsed.input;
    let report: ExecutionReport | undefined;
    if (input.act === 'report') {
      try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(input.dispatch))
          throw new Error('invalid dispatch ID');
        report = validateExecutionReport(JSON.parse(await readFile(input.file, 'utf8')));
      } catch (error) {
        throw new UsageError(message(error));
      }
    }
    const scoring = input.act === 'next' || input.act === 'gate' || input.act === 'review';
    const cwd = process.cwd();
    const profileText = parsed.profile ?? process.env.CAP_MODEL_PROFILE;
    const runtimeText = parsed.runtimeFile ?? process.env.CAP_RUNTIME_MODELS;
    const profile = profileText ? resolve(cwd, profileText) : undefined;
    const runtimeFile = runtimeText ? resolve(cwd, runtimeText) : '';
    const checkout = await locateCheckouts(cwd);
    const operation = await createOperation(
      checkout,
      { explicit: selected.explicit, environment: process.env.CELETIS_AGENT },
      (host) => (scoring ? bindingMode(host, profile, checkout.main) : 'main'),
    );
    const host = operation.host;
    const session = sessionOf(host, process.env[host === 'claude' ? 'CLAUDE_CODE_SESSION_ID' : 'CODEX_SESSION_ID']);
    const binding = scoring
      ? await readBinding(host, { profile, runtimeFile, opencode: false }, checkout.main, operation.mainConfig)
      : null;
    const context: Context = {
      id: randomUUID,
      now: () => new Date().toISOString(),
      resolve: (score, level, reviewer) =>
        binding ? resolvePair(score.digits, score.bias, level, reviewer, binding) : null,
    };
    const act = input;
    if (act.act === 'show') {
      const record = await withRecord(host, session, async (record) => ({ value: record }));
      console.log(JSON.stringify(record));
      return 0;
    }
    const result = await withRecord(host, session, async (saved) => {
      const record = saved ?? emptyRecord(host, session);
      const changed =
        act.act === 'next'
          ? requestNext(record, { ...act, score: { digits: act.digits, bias: act.bias } }, context)
          : act.act === 'gate'
            ? reportGate(record, act, context)
            : act.act === 'review'
              ? reportReview(record, act, context)
              : act.act === 'report'
                ? reportExecution(record, { dispatch: act.dispatch, report: report as ExecutionReport }, context)
                : closeTask(record, act, context);
      return {
        value: changed.result,
        ...(JSON.stringify(changed.record) === JSON.stringify(record) ? {} : { record: changed.record }),
      };
    });
    return printResult(result);
  } catch (error) {
    if (error instanceof UsageError || (error instanceof HostError && input === undefined)) {
      console.error(`dispatch: usage: ${message(error)}\n${updateHint}`);
      return 2;
    }
    if (error instanceof SetupError || error instanceof ScoreError || error instanceof HostError) {
      console.log(
        JSON.stringify({
          schema: 1,
          status: 'setup',
          issue: input && 'issue' in input ? input.issue : null,
          task: input && 'task' in input ? input.task : null,
          reason: message(error),
          trail: null,
        }),
      );
      console.error(`dispatch: setup: ${message(error)}`);
      return 5;
    }
    markDefect(error);
    console.error(`dispatch: ${message(error)}`);
    return 1;
  }
}

if (import.meta.main) {
  installRecorder('dispatch');
  process.exitCode = await main(process.argv.slice(2));
}
