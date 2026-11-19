import { HostError } from '../command/errors.ts';
import { type CommandName, exits } from '../contract/contract.ts';
import { startFiles, writeAtomic } from '../state/state.ts';
import type { Step } from '../workflow/workflow.ts';
import { claude } from './claude/adapter.ts';
import { codex } from './codex/adapter.ts';
import { type Host, hosts, registry } from './names.ts';
import { opencode } from './opencode/adapter.ts';
import type { HostAdapter, SessionStart } from './types.ts';

const adapters = { claude, codex, opencode } satisfies Record<Host, HostAdapter>;

export type Need =
  | Readonly<{ kind: 'step'; step: Step }>
  | Readonly<{ kind: 'interactive' | 'dispatch' | 'landing' | 'setup'; command: CommandName }>;

export function hostAdapter(host: Host): HostAdapter {
  return adapters[host];
}

export async function writeSessionEnv(host: Host, session: SessionStart): Promise<void> {
  const env = await adapters[host].sessionEnv(session);
  await writeAtomic(startFiles(session.folder).env, `${JSON.stringify(env)}\n`, { mode: 0o600 });
}

export function canRun(host: Host, need: Need): boolean {
  const { capability } = adapters[host];
  if (need.kind !== 'step') return capability[need.kind];
  return capability.steps === 'all' || capability.steps.includes(need.step);
}

export function requireCan(host: Host, need: Need, prefix: 'celetis' | 'daemon'): void {
  if (canRun(host, need)) return;
  const able = hosts.filter((each) => canRun(each, need));
  const steps = adapters[host].capability.steps;
  const runs = steps === 'all' ? 'every step' : `only the step${steps.length === 1 ? '' : 's'} ${steps.join(', ')}`;
  const others = able.map((each) => `--agent ${each}`).join(' or ');
  throw new HostError(
    need.kind === 'step'
      ? `${prefix}: ${host} cannot run the step ${need.step}; in this version ${registry[host].short} runs ${runs}. Start the step with ${others}.`
      : `${prefix}: ${host} cannot run ${need.command}; in this version ${registry[host].short} runs ${runs}. Use ${others}.`,
    exits.prerequisite,
  );
}

export function capableOrder(order: readonly Host[], need: Need, preferred?: Host): readonly Host[] {
  const capable = order.filter((host) => host === preferred || canRun(host, need));
  return capable.length ? capable : order;
}
