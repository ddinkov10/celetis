import { AgentOrderConflict, validateAgentOrder } from '../lib/agent-order.ts';
import type { AgentChoice, AgentOrder, Host } from '../lib/config-core.ts';
import type { Level } from '../lib/effort.ts';
import { bunArgs, run } from '../lib/process.ts';
import { type Program, readProgram } from '../lib/program.ts';
import { parseQueueAction, parseQueueReceipt } from '../lib/queue.ts';
import type { QueueAction, QueueReceipt, QueueWake } from '../lib/queue-types.ts';
import { selectSavedSession } from '../lib/session.ts';
import { isCommit } from '../lib/visual.ts';

export type Adapter = Readonly<{
  intake(choice: AgentChoice): Promise<string[]>;
  assist(number: number, choice: AgentChoice): Promise<string[]>;
  visual(number: number, sha: string, choice: AgentChoice): Promise<string[]>;
  run(number: number, choice: AgentChoice, effort?: Level): Promise<string[]>;
  resume(number: number): Promise<string[]>;
  queue(action: QueueAction, choice: AgentChoice): Promise<QueueReceipt>;
  queueRun(wake: QueueWake): Promise<string[]>;
  replaceAgentOrder(order: readonly Host[], expectedVersion: string): Promise<AgentOrder>;
  retryQuota(number: number, waitId: string): Promise<void>;
}>;

const CONTROL = /[\u0000-\u001f\u007f]/;
const VERSION = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const agentFlag = (choice: AgentChoice) => {
  if (choice.kind === 'default') return [];
  if (choice.host !== 'claude' && choice.host !== 'codex') throw new Error('invalid host');
  return ['--agent', choice.host];
};

const parseOrder = (value: unknown): AgentOrder => {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'order,schema,version' ||
    !('schema' in value) ||
    value.schema !== 1 ||
    !('version' in value) ||
    typeof value.version !== 'string' ||
    !VERSION.test(value.version) ||
    !('order' in value)
  )
    throw new Error('agents: the order outcome is uncertain; refresh before another change');
  return Object.freeze({ schema: 1, order: validateAgentOrder(value.order), version: value.version });
};

export async function celetisAdapter(
  main: string,
  read: () => Promise<Program | null> = readProgram,
): Promise<Adapter> {
  const program = async () => {
    const found = await read();
    if (!found)
      throw new Error('the celetis program is not installed; run the first install of README.md, "First install"');
    if (CONTROL.test(found.command)) throw new Error('the celetis program path has a control character');
    return found;
  };
  const argv = async (args: (string | number)[]) => [(await program()).command, ...args.map(String)];
  const control = async (args: string[]) => {
    const { CELETIS_AGENT: _agent, CELETIS_SESSION_AGENT: _session, ...env } = process.env;
    return run(process.execPath, bunArgs((await program()).entry, args), { cwd: main, timeout: 30_000, env });
  };
  return {
    intake: (choice) => argv([...agentFlag(choice), 'intake']),
    assist: (number, choice) => argv([...agentFlag(choice), 'assist', number]),
    visual: async (number, sha, choice) => {
      if (!isCommit(sha)) throw new Error('the commit of the visual is not 40 lowercase hex digits');
      return argv([...agentFlag(choice), 'visual', number, sha]);
    },
    run: (number, choice, effort) =>
      argv([...agentFlag(choice), 'celetis-flow', number, ...(effort ? ['--effort', effort] : []), '--quiet']),
    resume: async (number) => {
      await selectSavedSession(main, number);
      return argv(['celetis-flow', '--resume', number]);
    },
    queue: async (input, choice) => {
      const action = parseQueueAction(input);
      const result = await control([
        ...agentFlag(choice),
        'celetis-flow',
        '--queue',
        'admit',
        JSON.stringify(action),
      ]).catch(() => {
        throw new Error('queue: the celetis program is not installed');
      });
      if (result.code !== 0)
        throw new Error(result.stderr || 'queue: admission outcome is uncertain; refresh before another attempt');
      try {
        return parseQueueReceipt(JSON.parse(result.stdout));
      } catch {
        throw new Error('queue: admission outcome is uncertain; refresh before another attempt');
      }
    },
    queueRun: (wake) =>
      argv([...agentFlag(wake.choice), 'celetis-flow', '--queue', 'run', wake.id, wake.token, '--quiet']),
    replaceAgentOrder: async (order, expectedVersion) => {
      const replacement = { order: validateAgentOrder(order), expectedVersion };
      if (!VERSION.test(expectedVersion)) throw new Error('agents: expectedVersion must be an order version');
      const result = await control(['agents', 'replace', JSON.stringify(replacement)]);
      let value: unknown;
      try {
        value = JSON.parse(result.stdout);
      } catch {
        value = undefined;
      }
      if (result.code === 3 && value !== null && typeof value === 'object' && 'latest' in value)
        throw new AgentOrderConflict(parseOrder(value.latest));
      if (result.code !== 0)
        throw new Error(
          result.stderr.trim() || 'agents: the order outcome is uncertain; refresh before another change',
        );
      return parseOrder(value);
    },
    retryQuota: async (number, waitId) => {
      if (!Number.isSafeInteger(number) || number < 1 || !UUID.test(waitId))
        throw new Error('recovery: invalid issue number or wait ID');
      const result = await control(['celetis-flow', '--retry', String(number), waitId]);
      if (result.code !== 0) throw new Error(result.stderr.trim() || 'recovery: the Retry outcome is uncertain');
    },
  };
}
