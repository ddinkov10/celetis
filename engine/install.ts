import { delimiter, dirname, resolve } from 'node:path';
import { HostError } from './lib/command/errors.ts';
import { commandInput } from './lib/command/operation.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { requireBun } from './lib/host/host.ts';
import { enginePaths, engineSource, installEngine, type PackageEngine } from './lib/install/installation.ts';
import { versionTarget } from './lib/package/registry.ts';
import { childEnv } from './lib/process/process.ts';
import { hasGitEntry, readStamp } from './lib/release/release.ts';
import { installRecorder } from './lib/state/events.ts';

async function runningPackage(root: string): Promise<PackageEngine> {
  const { version, revision, source } = await readStamp(root);
  const { integrity } = await versionTarget(version);
  return { kind: 'package', source, version, revision, integrity };
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args } = commandInput(argv);
    if (args.length) throw new HostError(usage('install'), exits.usage);
    const paths = enginePaths();
    const root = dirname(import.meta.dir);
    const wanted = (await hasGitEntry(root)) ? await engineSource(root) : await runningPackage(root);
    const engine = await installEngine(root, wanted, paths);
    console.log(`install: ${engine.command} -> ${engine.entry}`);
    const key = (path: string) => (process.platform === 'win32' ? path.toLowerCase() : path);
    const items = (childEnv().PATH ?? '').split(delimiter).filter(Boolean);
    if (!items.some((item) => key(resolve(item)) === key(paths.bin)))
      console.log(`install: ${paths.bin} is not on PATH; add it as plugins/celetis/README.md, "First install", says`);
    return exits.done;
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

if (import.meta.main) {
  installRecorder('install');
  process.exitCode = await main(process.argv.slice(2));
}
