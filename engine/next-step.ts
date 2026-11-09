import { type ExitCode, exits, usage } from './lib/contract.ts';
import { HostError } from './lib/errors.ts';
import { installRecorder } from './lib/events.ts';
import { hostAdapter } from './lib/hosts.ts';
import { lineOf } from './lib/lines.ts';
import { commandInput, createOperation, locateCheckouts, type Operation } from './lib/operation.ts';
import { nextIssue, nextOpen } from './lib/resolver.ts';

function request(args: string[]): { arg: string; n: string } | null {
  const arg = args[0] ?? '';
  const n = arg.replace(/^#/, '');
  return args.length === 1 && (arg === '--open' || /^\d+$/.test(n)) ? { arg, n } : null;
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
  { arg, n }: { arg: string; n: string },
  operation: Operation,
): Promise<{ code: ExitCode; stdout: string; stderr: string }> {
  if (arg === '--open') {
    const { rows, stderr } = await nextOpen(operation);
    if (!rows) return { code: exits.blocked, stdout: 'stop cannot read the open issues from GitHub\n', stderr };
    const stdout = rows.map((row) => `${row.number}\t${lineOf(String(row.number), row.next)}\n`).join('');
    return { code: exits.done, stdout, stderr };
  }
  const { next, stderr } = await nextIssue(n, operation);
  const failed = next.kind === 'observed' && next.reason === 'unreadable';
  return { code: failed ? exits.blocked : exits.done, stdout: `${lineOf(n, next)}\n`, stderr };
}

if (import.meta.main) {
  installRecorder('next-step');
  process.exitCode = await main(process.argv.slice(2));
}
