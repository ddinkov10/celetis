import { HostError } from './lib/command/errors.ts';
import { commandInput, createOperation, locateCheckouts, type Operation } from './lib/command/operation.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { hostAdapter } from './lib/host/hosts.ts';
import { lineOf } from './lib/resolver/lines.ts';
import { nextIssue, nextOpen } from './lib/resolver/resolver.ts';
import { installRecorder } from './lib/state/events.ts';
import { type IssueKey, parseHandle } from './lib/tracker/key.ts';

type Request = { kind: 'open' } | { kind: 'issue'; key: IssueKey };

function request(args: string[]): Request | null {
  if (args.length !== 1) return null;
  if (args[0] === '--open') return { kind: 'open' };
  const key = parseHandle(args[0] as string);
  return key === null ? null : { kind: 'issue', key };
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const { args, explicit } = commandInput(argv);
    const input = request(args);
    if (!input) {
      console.error(usage('next-step'));
      return exits.usage;
    }
    const operation = await createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    await hostAdapter(operation.host).checkHome();
    const result = await resolveNext(input, operation);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    return result.code;
  } catch (error) {
    if (error instanceof HostError) {
      if (error.message) console.error(error.message);
      return error.code;
    }
    throw error;
  }
}

async function resolveNext(
  input: Request,
  operation: Operation,
): Promise<{ code: ExitCode; stdout: string; stderr: string }> {
  if (input.kind === 'open') {
    const { rows, stderr } = await nextOpen(operation);
    if (!rows) return { code: exits.blocked, stdout: 'stop cannot read the open issues from GitHub\n', stderr };
    const stdout = rows.map((row) => `${row.number}\t${lineOf(row.number, row.next)}\n`).join('');
    return { code: exits.done, stdout, stderr };
  }
  const { next, stderr } = await nextIssue(input.key, operation);
  const failed = next.kind === 'observed' && next.reason === 'unreadable';
  return { code: failed ? exits.blocked : exits.done, stdout: `${lineOf(input.key, next)}\n`, stderr };
}

if (import.meta.main) {
  installRecorder('next-step');
  process.exitCode = await main(process.argv.slice(2));
}
