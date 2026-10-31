import type { Host } from '../lib/config-core.ts';
import { bunArgs, run } from '../lib/process.ts';
import { type Program, readProgram } from '../lib/program.ts';
import { parseQueueAction, parseQueueReceipt } from '../lib/queue.ts';
import type { QueueAction, QueueReceipt, QueueWake } from '../lib/queue-types.ts';
import { selectSavedSession } from '../lib/session.ts';

export type Adapter = Readonly<{
  intake(agent: Host): Promise<string>;
  assist(number: number, agent: Host): Promise<string>;
  run(number: number, agent: Host): Promise<string>;
  resume(number: number): Promise<string>;
  queue(action: QueueAction, agent: Host): Promise<QueueReceipt>;
  queueRun(wake: QueueWake): Promise<string>;
}>;

const CONTROL = /[\u0000-\u001f\u007f]/;
// PowerShell also reads U+2018 to U+201B as single quotes.
const quote = (text: string) =>
  process.platform === 'win32'
    ? `'${text.replace(/['\u2018-\u201b]/g, (mark) => mark + mark)}'`
    : `'${text.replaceAll("'", "'\\''")}'`;

export async function celetisAdapter(
  main: string,
  read: () => Promise<Program | null> = readProgram,
): Promise<Adapter> {
  const line = async (args: (string | number)[]) => {
    const program = await read();
    if (!program)
      throw new Error('the celetis program is not installed; run the first install of README.md, "First install"');
    if (CONTROL.test(program.command)) throw new Error('the celetis program path has a control character');
    const words = [program.command, ...args]
      .map((word) => (typeof word === 'number' ? String(word) : quote(word)))
      .join(' ');
    return process.platform === 'win32' ? `& ${words}; if ($?) { exit }` : `${words} && exit`;
  };
  return {
    intake: (agent) => line(['--agent', agent, 'intake']),
    assist: (number, agent) => line(['--agent', agent, 'assist', number]),
    run: (number, agent) => line(['--agent', agent, 'celetis-flow', number]),
    resume: async (number) => {
      await selectSavedSession(main, number);
      return line(['celetis-flow', '--resume', number]);
    },
    queue: async (input, agent) => {
      const action = parseQueueAction(input);
      if (agent !== 'claude' && agent !== 'codex') throw new Error('queue: invalid host');
      const program = await read();
      if (!program) throw new Error('queue: the celetis program is not installed');
      const result = await run(
        process.execPath,
        bunArgs(program.entry, ['--agent', agent, 'celetis-flow', '--queue', 'admit', JSON.stringify(action)]),
        { cwd: main, timeout: 30_000 },
      );
      if (result.code !== 0)
        throw new Error(result.stderr || 'queue: admission outcome is uncertain; refresh before another attempt');
      try {
        return parseQueueReceipt(JSON.parse(result.stdout));
      } catch {
        throw new Error('queue: admission outcome is uncertain; refresh before another attempt');
      }
    },
    queueRun: (wake) => line(['--agent', wake.host, 'celetis-flow', '--queue', 'run', wake.id, wake.token]),
  };
}
