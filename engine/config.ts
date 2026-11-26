import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { HostError } from './lib/command/errors.ts';
import { commandInput } from './lib/command/operation.ts';
import { engineReader, readConfig } from './lib/config/config.ts';
import { ConfigError, checkSkills, formatConfigError, validateHost } from './lib/config/core.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { jsonFile } from './lib/plugin/metadata.ts';
import { installRecorder } from './lib/state/events.ts';

const isFile = (path: string) =>
  lstat(path).then(
    (stat) => stat.isFile(),
    () => false,
  );

async function read(checkout: string, plugin: string, explicit?: string): Promise<ExitCode> {
  const manifest = await jsonFile(join(plugin, '.claude-plugin/plugin.json')).catch(() => null);
  if (manifest?.name !== 'celetis') throw new HostError(`config: ${plugin} is not a celetis plugin`, exits.usage);
  try {
    const config = readConfig(checkout);
    await checkSkills(config, plugin, isFile);
    console.log(JSON.stringify(config));
    return exits.done;
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    console.error(
      formatConfigError(
        checkout,
        error,
        await engineReader(explicit === undefined ? undefined : validateHost(explicit)),
      ),
    );
    return exits.usage;
  }
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    const { args, explicit } = commandInput(argv);
    const [checkout, plugin] = args;
    if (args.length !== 2 || !checkout || !plugin) throw new HostError(usage('config'), exits.usage);
    return await read(checkout, plugin, explicit);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) {
  installRecorder('config');
  process.exitCode = await main(process.argv.slice(2));
}
