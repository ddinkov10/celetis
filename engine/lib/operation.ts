import { realpath } from 'node:fs/promises';
import {
  type Config,
  ConfigError,
  type ConfigSource,
  configHost,
  formatConfigError,
  readConfigSource,
  validateConfig,
} from './config.ts';
import { type Host, HostError, mainCheckout, selectHost } from './host.ts';
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
  host: Host;
  mainConfig: Config | null;
  activeConfig: Config | null;
}>;
type RequiredConfig = 'host' | 'main' | 'active';

export function commandInput(argv: string[]): { args: string[]; explicit?: string } {
  const args = [...argv];
  if (args[0] !== '--agent') return { args };
  if (args[1] === undefined) throw new HostError('celetis: --agent needs claude or codex', 2);
  const explicit = args[1];
  selectHost(explicit, undefined, undefined);
  return { args: args.slice(2), explicit };
}

export async function locateCheckouts(cwd: string): Promise<CheckoutIdentity> {
  cwd = await realpath(cwd);
  const active = await run('git', ['rev-parse', '--show-toplevel'], { cwd });
  if (active.code !== 0) {
    if (active.code === 128 && active.stderr.startsWith('fatal: not a git repository'))
      return Object.freeze({ cwd, main: null, active: null, common: null });
    throw new HostError(active.stderr.trimEnd(), active.code);
  }
  const result = await run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd });
  if (result.code !== 0) throw new HostError(result.stderr.trimEnd(), result.code);
  const path = (output: string) => output.replace(/\n$/, '');
  const common = await realpath(path(result.stdout));
  return Object.freeze({
    cwd,
    main: await mainCheckout(cwd),
    active: await realpath(path(active.stdout)),
    common,
  });
}

export function createOperation(
  checkout: CheckoutIdentity,
  selection: HostSelection,
  required: RequiredConfig | ((host: Host) => RequiredConfig),
): Operation {
  checkout = Object.freeze({ ...checkout });
  selection = Object.freeze({ ...selection });
  const configured = <T>(path: string, read: () => T): T => {
    try {
      return read();
    } catch (error) {
      if (error instanceof ConfigError) throw new HostError(formatConfigError(path, error), 2);
      throw error;
    }
  };
  let source: ConfigSource | undefined;
  let hint: Host | undefined;
  if (
    selection.saved === undefined &&
    selection.explicit === undefined &&
    selection.environment === undefined &&
    checkout.main !== null
  ) {
    const main = checkout.main;
    const parsed = configured(main, () => readConfigSource(main));
    source = parsed;
    hint = configured(main, () => configHost(parsed));
  }
  const host = selection.saved ?? selectHost(selection.explicit, selection.environment, hint);
  const mode = typeof required === 'function' ? required(host) : required;
  let mainConfig: Config | null = null;
  let activeConfig: Config | null = null;
  if (mode !== 'host') {
    const main = checkout.main;
    if (main === null) throw new HostError('celetis: need a Git checkout', 2);
    mainConfig = configured(main, () => validateConfig(source ?? readConfigSource(main)));
    if (mode === 'active') {
      const active = checkout.active;
      if (active === null) throw new HostError('celetis: need an active Git checkout', 2);
      activeConfig = active === main ? mainConfig : configured(active, () => validateConfig(readConfigSource(active)));
    }
  }
  return Object.freeze({ checkout, selection, host, mainConfig, activeConfig });
}
