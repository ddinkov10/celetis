import { realpath } from 'node:fs/promises';
import { readAgentOrder } from './agent-order.ts';
import { readConfigSource } from './config.ts';
import {
  type AgentChoice,
  type Config,
  ConfigError,
  formatConfigError,
  type Host,
  validateConfig,
} from './config-core.ts';
import { exits } from './contract.ts';
import { HostError } from './errors.ts';
import { commonDir, mainCheckout } from './git.ts';
import { selectHost } from './host.ts';
import { hosts } from './host-names.ts';
import { run } from './process.ts';

export type CheckoutIdentity = Readonly<{
  cwd: string;
  main: string | null;
  active: string | null;
  common: string | null;
}>;
export type HostSelection = Readonly<{
  explicit?: string;
  environment?: string;
  saved?: Host;
}>;
export type Operation = Readonly<{
  checkout: CheckoutIdentity;
  selection: HostSelection;
  choice: AgentChoice;
  host: Host;
  mainConfig: Config | null;
  activeConfig: Config | null;
}>;
type RequiredConfig = 'host' | 'main' | 'active';

export function commandInput(argv: string[]): { args: string[]; explicit?: string } {
  const args = [...argv];
  if (args[0] !== '--agent') return { args };
  if (args[1] === undefined) throw new HostError(`celetis: --agent needs ${hosts.join(' or ')}`, exits.usage);
  const explicit = args[1];
  selectHost(explicit);
  return { args: args.slice(2), explicit };
}

export async function locateCheckouts(cwd: string): Promise<CheckoutIdentity> {
  cwd = await realpath(cwd);
  const active = await run('git', ['rev-parse', '--show-toplevel'], { cwd });
  if (active.code !== 0) {
    if (active.code === 128 && active.stderr.startsWith('fatal: not a git repository'))
      return Object.freeze({ cwd, main: null, active: null, common: null });
    throw new HostError(active.stderr.trimEnd(), exits.blocked);
  }
  const common = await realpath(await commonDir(cwd));
  return Object.freeze({
    cwd,
    main: await mainCheckout(cwd),
    active: await realpath(active.stdout.replace(/\n$/, '')),
    common,
  });
}

export async function createOperation(
  checkout: CheckoutIdentity,
  selection: HostSelection,
  required: RequiredConfig | ((host: Host) => RequiredConfig),
): Promise<Operation> {
  checkout = Object.freeze({ ...checkout });
  selection = Object.freeze({ ...selection });
  const configured = <T>(path: string, read: () => T): T => {
    try {
      return read();
    } catch (error) {
      if (error instanceof ConfigError) throw new HostError(formatConfigError(path, error), exits.usage);
      throw error;
    }
  };
  const selected = selection.saved ?? selection.explicit ?? selection.environment;
  const choice: AgentChoice = Object.freeze(
    selected === undefined ? { kind: 'default' } : { kind: 'explicit', host: selectHost(selected) },
  );
  const host =
    choice.kind === 'explicit'
      ? choice.host
      : checkout.common === null
        ? 'claude'
        : ((await readAgentOrder(checkout.common)).order[0] as Host);
  const mode = typeof required === 'function' ? required(host) : required;
  let mainConfig: Config | null = null;
  let activeConfig: Config | null = null;
  if (mode !== 'host') {
    const main = checkout.main;
    if (main === null) throw new HostError('celetis: need a Git checkout', exits.usage);
    mainConfig = configured(main, () => validateConfig(readConfigSource(main)));
    if (mode === 'active') {
      const active = checkout.active;
      if (active === null) throw new HostError('celetis: need an active Git checkout', exits.usage);
      activeConfig = active === main ? mainConfig : configured(active, () => validateConfig(readConfigSource(active)));
    }
  }
  return Object.freeze({ checkout, selection, choice, host, mainConfig, activeConfig });
}
