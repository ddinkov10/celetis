import { realpath } from 'node:fs/promises';
import { AgentOrderConflict, validateAgentOrder } from '../lib/agent-order.ts';
import type { AgentChoice, AgentOrder, Host } from '../lib/config-core.ts';
import { exits } from '../lib/contract.ts';
import {
  type DaemonRequest,
  type DaemonStatus,
  parseAnswer,
  parseQueueAnswer,
  type Selection,
} from '../lib/daemon-types.ts';
import type { Level } from '../lib/effort.ts';
import { commonDir } from '../lib/git.ts';
import { bunArgs, run } from '../lib/process.ts';
import { type Program, readProgram } from '../lib/program.ts';
import { parseQueueAction } from '../lib/queue.ts';
import type { QueueAction, QueueView } from '../lib/queue-types.ts';
import { fromChild, repositoryLayout } from '../lib/state.ts';
import { isCommit } from '../lib/visual.ts';

export type BoardDaemon = Readonly<{
  send(request: Exclude<DaemonRequest, { kind: 'status' | 'land' }>): Promise<unknown>;
  status(): Promise<DaemonStatus>;
}>;
export type Adapter = Readonly<{
  intake(choice: AgentChoice): Promise<string[]>;
  assist(number: number, choice: AgentChoice): Promise<string[]>;
  visual(number: number, sha: string, choice: AgentChoice): Promise<string[]>;
  run(number: number, choice: AgentChoice, effort?: Level): Promise<string>;
  resume(number: number): Promise<string>;
  queue(action: QueueAction, choice: AgentChoice): Promise<QueueView>;
  replaceAgentOrder(order: readonly Host[], expectedVersion: string): Promise<AgentOrder>;
  retryQuota(number: number, waitId: string): Promise<void>;
  status(): Promise<DaemonStatus>;
  reconcileQueue(): Promise<QueueView>;
}>;

const CONTROL = /[\u0000-\u001f\u007f]/;
const VERSION = /^[a-f0-9]{64}$/;

const agentFlag = (choice: AgentChoice) => {
  if (choice.kind === 'default') return [];
  if (choice.host !== 'claude' && choice.host !== 'codex') throw new Error('invalid host');
  return ['--agent', choice.host];
};

const selectionOf = (choice: AgentChoice): Selection => {
  if (choice.kind === 'default') return {};
  if (choice.host !== 'claude' && choice.host !== 'codex') throw new Error('invalid host');
  return { explicit: choice.host };
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
  daemon: BoardDaemon,
  read: () => Promise<Program | null> = readProgram,
): Promise<Adapter> {
  const program = async () => {
    const found = await read();
    if (!found)
      throw new Error(
        'the celetis program is not installed; run the first install of plugins/celetis/README.md, "First install"',
      );
    if (CONTROL.test(found.command)) throw new Error('the celetis program path has a control character');
    return found;
  };
  const start = async (request: Extract<DaemonRequest, { kind: 'run' | 'resume' }>) => {
    const answer = parseAnswer(await daemon.send(request));
    if (!answer.accepted) throw new Error(answer.line);
    if (answer.run === null) throw new Error('daemon: the daemon sent no run ID');
    return answer.run;
  };
  const changeQueue = async (request: Extract<DaemonRequest, { kind: 'queue-action' | 'queue-reconcile' }>) => {
    const answer = parseQueueAnswer(await daemon.send(request));
    if (!answer.accepted) throw new Error(answer.line);
    return answer.view;
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
      start({ kind: 'run', number, selection: selectionOf(choice), effort: effort ?? null, quiet: true }),
    resume: (number) => start({ kind: 'resume', number, selection: {} }),
    queue: (input, choice) =>
      changeQueue({
        kind: 'queue-action',
        action: parseQueueAction(input),
        selection: selectionOf(choice),
        quiet: true,
      }),
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
      if (result.code === exits.prerequisite && value !== null && typeof value === 'object' && 'latest' in value)
        throw new AgentOrderConflict(parseOrder(value.latest));
      if (result.code !== exits.done) {
        const line = result.stderr.split('\n').find((each) => each.trim() !== '') ?? '';
        const failure = new Error(
          result.stderr.trim() || 'agents: the order outcome is uncertain; refresh before another change',
        );
        const common = await commonDir(main)
          .then((path) => realpath(path))
          .catch(() => null);
        throw (common !== null && fromChild(result.code, line, repositoryLayout(common).agentsLock)) || failure;
      }
      return parseOrder(value);
    },
    retryQuota: async (number, waitId) => {
      const answer = parseAnswer(await daemon.send({ kind: 'retry', number, waitId }));
      if (!answer.accepted) throw new Error(answer.line);
    },
    status: () => daemon.status(),
    reconcileQueue: () => changeQueue({ kind: 'queue-reconcile' }),
  };
}
