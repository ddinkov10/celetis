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
import { bunArgs, run } from '../engine/lib/process.ts';

const actionlintVersion = '1.7.12';
const hashes: Record<string, string> = {
  darwin_amd64: '5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644',
  darwin_arm64: 'aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f',
  linux_amd64: '8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8',
  linux_arm64: '325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6',
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
  { name: '@types/bun', version: '1.4.2', installer: 'bun', package: '@types/bun@1.4.2' },
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
  const find = (name: string) => {
    const file = Bun.which(name, { PATH: path });
    if (!file)
      throw new Error(
        `verify: ${name} is missing: install the pinned tools with scripts/install-tools.ts (AGENTS.md, "Verify gate")`,
      );
    return file;
  };
  const actionlint = find('actionlint');
  const tsc = await realpath(find('tsc'));
  const biome = await realpath(find('biome'));
  const typescript = await packageOf(tsc, 'typescript');
  const biomePackage = await packageOf(biome, '@biomejs/biome');
  const packages = dirname(typescript.path);
  const typesSource = await readFile(join(packages, '@types/bun/package.json'), 'utf8').catch(() => null);
  if (!typesSource)
    throw new Error(
      `verify: @types/bun is missing from ${packages}: install @types/bun@1.4.2 with scripts/install-tools.ts (AGENTS.md, "Verify gate")`,
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
  const target = `${platform}_${arch === 'x64' ? 'amd64' : arch}`;
  const hash = (options.hashes ?? hashes)[target];
  if (!hash) throw new Error(`install-tools: unsupported platform ${platform}/${arch}`);
  const url = `https://github.com/rhysd/actionlint/releases/download/v${actionlintVersion}/actionlint_${actionlintVersion}_${target}.tar.gz`;
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
    const archivePath = join(stage, 'actionlint.tar.gz');
    await writeFile(archivePath, archive);
    const extracted = await execute('tar', ['-xzf', archivePath, '-C', stage, 'actionlint'], { timeout: 30_000 });
    if (extracted.code)
      throw new Error(`install-tools: extraction failed (exit ${extracted.code})\n${extracted.stderr}`);
    await mkdir(join(stage, 'bin'));
    await rename(join(stage, 'actionlint'), join(stage, 'bin/actionlint'));
    await chmod(join(stage, 'bin/actionlint'), 0o755);
    for (const [name, entry] of [
      ['biome', '@biomejs/biome/bin/biome'],
      ['tsc', 'typescript/bin/tsc'],
      ...(options.claude ? [['claude', '.bin/claude']] : []),
    ])
      await symlink(`../node_modules/${entry}`, join(stage, 'bin', name as string));
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

export async function main(args: string[]): Promise<number> {
  if (!args[0] || args.length > 2 || (args[1] !== undefined && args[1] !== '--claude')) {
    console.error('usage: scripts/install-tools.ts DESTINATION [--claude]');
    return 2;
  }
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
