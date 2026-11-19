import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readBinding } from './lib/capability/binding.ts';
import { bindingMode, resolvePair, ScoreError } from './lib/capability/capability.ts';
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
} from './lib/capability/dispatch-record.ts';
import { HostError } from './lib/command/errors.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/command/operation.ts';
import type { Host } from './lib/config/core.ts';
import { type ExitCode, exits, updateHint, usageLine } from './lib/contract/contract.ts';
import { hostAdapter, requireCan } from './lib/host/hosts.ts';
import { installRecorder, markDefect } from './lib/state/events.ts';
import { commitMigration, readLocalRecord } from './lib/state/migration.ts';
import { dispatchRecord, ensureFolder, privateState, stateOutcome, withLock, writeAtomic } from './lib/state/state.ts';

class UsageError extends Error {}
class SetupError extends Error {
  constructor(
    message: string,
    readonly code: ExitCode = exits.blocked,
  ) {
    super(message);
  }
}
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
  else throw new UsageError(usageLine('dispatch'));
  return { input, profile, runtimeFile };
}
function sessionOf(host: Host, session: unknown): string {
  const variable = hostAdapter(host).sessionVariable;
  if (typeof session !== 'string' || !/^[A-Za-z0-9-]{1,128}$/.test(session) || session.endsWith('\n'))
    throw new SetupError(`need a valid ${variable}`);
  return session;
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
async function withRecord<T>(
  host: Host,
  session: string,
  act: (record: DispatchRecord | null) => Promise<{ value: T; record?: DispatchRecord }>,
): Promise<T> {
  const { folder, file, lock } = dispatchRecord(host, session);
  const folders = () => {
    ensureFolder(privateState);
    ensureFolder(folder);
  };
  let sourceSchema: unknown;
  const failure = (error: unknown) =>
    new SetupError(
      `${file}: ${sourceSchema === undefined ? 'target schema 2' : `schema ${String(sourceSchema)} to 2`}: ${message(error)}`,
      error instanceof SetupError ? error.code : (stateOutcome(error)?.code ?? exits.blocked),
    );
  try {
    folders();
    return await withLock(
      lock,
      async () => {
        let record: DispatchRecord | null = null;
        const source = await readLocalRecord(file, [privateState.path, folder.path], 'private');
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
          folders();
          validateRecord(result.record, host, session);
          await writeAtomic(file, `${JSON.stringify(result.record)}\n`, { check: folders });
        }
        return result.value;
      },
      {
        check: (stage) => {
          if (stage === 'locked') folders();
        },
      },
    );
  } catch (error) {
    if (error instanceof ScoreError) throw error;
    throw failure(error);
  }
}
const statusClasses = { refused: exits.prerequisite, stop: exits.stop, setup: exits.blocked } as const;

function printResult(result: Result): ExitCode {
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
    return exits.done;
  }
  console.log(JSON.stringify({ schema: 1, ...result }));
  if (result.status === 'closed' || result.status === 'reported') return exits.done;
  console.error(`dispatch: ${result.status}: ${result.reason}`);
  return statusClasses[result.status];
}
export async function main(argv: string[]): Promise<ExitCode> {
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
    requireCan(host, { kind: 'dispatch', command: 'dispatch' }, 'celetis');
    const session = sessionOf(host, process.env[hostAdapter(host).sessionVariable]);
    const binding = scoring
      ? await readBinding(host, { profile, runtimeFile }, checkout.main, operation.mainConfig)
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
      return exits.done;
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
      return exits.usage;
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
      return error instanceof SetupError || error instanceof HostError ? error.code : exits.usage;
    }
    markDefect(error);
    console.error(`dispatch: ${message(error)}`);
    return exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('dispatch');
  process.exitCode = await main(process.argv.slice(2));
}
