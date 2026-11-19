import { createHash } from 'node:crypto';
import {
  appendFile,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { HostError } from '../engine/lib/command/errors.ts';
import { commandInput, createOperation, locateCheckouts } from '../engine/lib/command/operation.ts';
import { bunFloor } from '../engine/lib/config/core.ts';
import { hostAdapter } from '../engine/lib/host/hosts.ts';
import { bunArgs, run } from '../engine/lib/process/process.ts';

const actionlintVersion = '1.7.12';
const hashes: Record<string, string> = {
  darwin_amd64: '5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644',
  darwin_arm64: 'aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f',
  linux_amd64: '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8',
  linux_arm64: '325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6',
  windows_amd64: '6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9',
};

export interface ToolPin {
  name: string;
  version: string;
  installer: string;
  package: string;
}
const pins: ToolPin[] = [
  {
    name: 'actionlint',
    version: actionlintVersion,
    installer: 'native',
    package: `rhysd/actionlint@v${actionlintVersion}`,
  },
  { name: 'biome', version: '2.5.15', installer: 'bun', package: '@biomejs/biome@2.5.15' },
  { name: 'tsc', version: '7.0.2', installer: 'bun', package: 'typescript@7.0.2' },
  { name: '@types/bun', version: bunFloor, installer: 'bun', package: `@types/bun@${bunFloor}` },
];
export async function toolPins(): Promise<ToolPin[]> {
  return pins;
}

async function packageOf(file: string, name: string): Promise<{ path: string; version: string }> {
  let path = dirname(await realpath(file));
  for (;;) {
    const source = await readFile(join(path, 'package.json'), 'utf8').catch(() => null);
    if (source) {
      const value = JSON.parse(source) as { name?: string; version?: string };
      if (value.name === name && value.version) return { path, version: value.version };
    }
    const parent = dirname(path);
    if (parent === path) throw new Error(`verify: ${file} has no package metadata for ${name}`);
    path = parent;
  }
}

export async function findTools(path = process.env.PATH) {
  const missing = (name: string) =>
    new Error(
      `verify: ${name} is missing: install the pinned tools with scripts/install-tools.ts (AGENTS.md, "Verify gate")`,
    );
  const actionlint = Bun.which('actionlint', { PATH: path });
  if (!actionlint) throw missing('actionlint');
  const packageEntry = (name: string, entry: string) =>
    realpath(join(dirname(actionlint), '..', 'node_modules', entry)).catch(() => {
      throw missing(name);
    });
  const tsc = await packageEntry('tsc', 'typescript/bin/tsc');
  const biome = await packageEntry('biome', '@biomejs/biome/bin/biome');
  const typescript = await packageOf(tsc, 'typescript');
  const biomePackage = await packageOf(biome, '@biomejs/biome');
  const packages = dirname(typescript.path);
  const typesSource = await readFile(join(packages, '@types/bun/package.json'), 'utf8').catch(() => null);
  if (!typesSource)
    throw new Error(
      `verify: @types/bun is missing from ${packages}: install @types/bun@${bunFloor} with scripts/install-tools.ts (AGENTS.md, "Verify gate")`,
    );
  const types = JSON.parse(typesSource) as { version: string };
  return {
    actionlint: { file: actionlint, args: [], version: '' },
    tsc: { file: process.execPath, args: bunArgs(tsc, []), version: typescript.version },
    biome: { file: process.execPath, args: bunArgs(biome, []), version: biomePackage.version },
    typeRoots: join(packages, '@types'),
    bunTypesVersion: types.version,
  };
}

interface InstallOptions {
  platform?: string;
  arch?: string;
  hashes?: Record<string, string>;
  download?: (url: string) => Promise<Uint8Array>;
  execute?: typeof run;
  claude?: boolean;
}

export async function installTools(destination: string, options: InstallOptions = {}): Promise<void> {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const windows = platform === 'win32';
  const target = `${windows ? 'windows' : platform}_${arch === 'x64' ? 'amd64' : arch}`;
  const hash = (options.hashes ?? hashes)[target];
  if (!hash) throw new Error(`install-tools: unsupported platform ${platform}/${arch}`);
  const extension = windows ? 'zip' : 'tar.gz';
  const binary = windows ? 'actionlint.exe' : 'actionlint';
  const url = `https://github.com/rhysd/actionlint/releases/download/v${actionlintVersion}/actionlint_${actionlintVersion}_${target}.${extension}`;
  const download =
    options.download ??
    (async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`install-tools: download failed (${response.status}): ${url}`);
      return new Uint8Array(await response.arrayBuffer());
    });
  const archive = await download(url);
  if (createHash('sha256').update(archive).digest('hex') !== hash)
    throw new Error(`install-tools: hash mismatch: ${url}`);
  destination = resolve(destination);
  await mkdir(dirname(destination), { recursive: true });
  const stage = await mkdtemp(join(dirname(destination), '.celetis-tools.'));
  const execute = options.execute ?? run;
  const backup = `${stage}.previous`;
  let moved = false;
  try {
    await writeFile(join(stage, 'package.json'), '{"private":true}\n');
    const packages = (await toolPins()).filter((pin) => pin.installer === 'bun').map((pin) => pin.package);
    if (options.claude) packages.push('@anthropic-ai/claude-code@2.1.302');
    const installed = await execute(
      process.execPath,
      ['add', '--exact', '--ignore-scripts', '--no-progress', '--cwd', stage, ...packages],
      { timeout: 120_000 },
    );
    if (installed.code)
      throw new Error(`install-tools: package installation failed (exit ${installed.code})\n${installed.stderr}`);
    const archivePath = join(stage, `actionlint.${extension}`);
    await writeFile(archivePath, archive);
    const systemRoot = process.env.SystemRoot;
    if (windows && !systemRoot) throw new Error('install-tools: SystemRoot is not set');
    const extracted = windows
      ? await execute(join(systemRoot as string, 'System32', 'tar.exe'), ['-xf', archivePath, '-C', stage, binary], {
          timeout: 30_000,
        })
      : await execute('tar', ['-xzf', archivePath, '-C', stage, binary], { timeout: 30_000 });
    if (extracted.code)
      throw new Error(`install-tools: extraction failed (exit ${extracted.code})\n${extracted.stderr}`);
    await mkdir(join(stage, 'bin'));
    await rename(join(stage, binary), join(stage, 'bin', binary));
    await chmod(join(stage, 'bin', binary), 0o755);
    if (options.claude) await symlink('../node_modules/.bin/claude', join(stage, 'bin/claude'));
    await rm(archivePath);
    if (await lstat(destination).catch(() => null)) {
      await rename(destination, backup);
      moved = true;
    }
    try {
      await rename(stage, destination);
    } catch (error) {
      if (moved) await rename(backup, destination);
      throw error;
    }
    if (moved) await rm(backup, { recursive: true, force: true });
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { args, explicit } = commandInput(argv);
    return await execute(args, explicit);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

async function execute(args: string[], explicit: string | undefined): Promise<number> {
  if (!args[0] || args.length > 2 || (args[1] !== undefined && args[1] !== '--claude')) {
    console.error('usage: scripts/install-tools.ts DESTINATION [--claude]');
    return 2;
  }
  if (args[1] === '--claude' && process.platform === 'win32') {
    console.error('install-tools: --claude is not supported on Windows; use the existing claude installation');
    return 2;
  }
  const operation = await createOperation(
    await locateCheckouts(process.cwd()),
    { explicit: explicit ?? process.env.CELETIS_AGENT ?? 'claude' },
    'host',
  );
  await hostAdapter(operation.host).checkHome();
  try {
    await installTools(args[0], { claude: args[1] === '--claude' });
    const bin = join(resolve(args[0]), 'bin');
    if (process.env.GITHUB_PATH) await appendFile(process.env.GITHUB_PATH, `${bin}\n`);
    console.log(`install-tools: ${bin}`);
    return 0;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
