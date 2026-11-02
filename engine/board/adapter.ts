import type { Host } from '../lib/config-core.ts';
import type { Level } from '../lib/effort.ts';
import { bunArgs, run } from '../lib/process.ts';
import { type Program, readProgram } from '../lib/program.ts';
import { parseQueueAction, parseQueueReceipt } from '../lib/queue.ts';
import type { QueueAction, QueueReceipt, QueueWake } from '../lib/queue-types.ts';
import { selectSavedSession } from '../lib/session.ts';

export type Adapter = Readonly<{
  intake(agent: Host): Promise<string[]>;
  assist(number: number, agent: Host): Promise<string[]>;
  run(number: number, agent: Host, effort?: Level): Promise<string[]>;
  resume(number: number): Promise<string[]>;
  queue(action: QueueAction, agent: Host): Promise<QueueReceipt>;
  queueRun(wake: QueueWake): Promise<string[]>;
}>;

const CONTROL = /[\u0000-\u001f\u007f]/;

export async function celetisAdapter(
  main: string,
  read: () => Promise<Program | null> = readProgram,
): Promise<Adapter> {
  const argv = async (args: (string | number)[]) => {
    const program = await read();
    if (!program)
      throw new Error('the celetis program is not installed; run the first install of README.md, "First install"');
    if (CONTROL.test(program.command)) throw new Error('the celetis program path has a control character');
    return [program.command, ...args.map(String)];
  };
  return {
    intake: (agent) => argv(['--agent', agent, 'intake']),
    assist: (number, agent) => argv(['--agent', agent, 'assist', number]),
    run: (number, agent, effort) =>
      argv(['--agent', agent, 'celetis-flow', number, ...(effort ? ['--effort', effort] : []), '--quiet']),
    resume: async (number) => {
      await selectSavedSession(main, number);
      return argv(['celetis-flow', '--resume', number]);
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
    queueRun: (wake) => argv(['--agent', wake.host, 'celetis-flow', '--queue', 'run', wake.id, wake.token, '--quiet']),
  };
}
