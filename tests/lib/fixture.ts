import { type ExecFileOptions, execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const root = dirname(dirname(import.meta.dir));
export const reader = join(root, 'scripts/lib/config.ts');
export const isolatedArgs = ['--no-env-file', '--no-install', '--config=/dev/null', '--no-macros'];

export function command(file: string, args: string[], options: ExecFileOptions = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(
      file,
      args,
      {
        timeout: 5_000,
        maxBuffer: 64 * 1024 * 1024,
        ...options,
        encoding: 'utf8',
        env: {
          ...process.env,
          ...options.env,
          BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0',
          DO_NOT_TRACK: '1',
        },
        shell: false,
      },
      (error, stdout, stderr) => {
        resolve({ code: typeof error?.code === 'number' ? error.code : error ? 1 : 0, stdout, stderr });
      },
    );
  });
}

export async function fixture() {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'celetis-runtime.')));
  const repo = join(dir, 'repo dir');
  const home = join(dir, 'home');
  await mkdir(repo);
  await mkdir(home);
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, XDG_CONFIG_HOME: home, XDG_CACHE_HOME: home };
  const write = async (path: string, source: string | Uint8Array, mode?: number) => {
    const file = join(dir, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, source);
    if (mode !== undefined) await chmod(file, mode);
    return file;
  };
  return {
    dir,
    repo,
    home,
    env,
    write,
    config: (source: string | Uint8Array) => write('repo dir/.celetis.yaml', source),
    read: (path: string) => readFile(join(dir, path), 'utf8'),
    stub: (name: string, source: string) =>
      write(
        `bin/${name}`,
        `#!/usr/bin/env -S "${process.execPath.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll(' ', '\\_')}" ${isolatedArgs.join(' ')}\n${source}\n`,
        0o755,
      ),
    bun: (entry: string, args: string[] = [], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) =>
      command(process.execPath, [...isolatedArgs, entry, ...args], {
        cwd: dir,
        ...options,
        env: { ...env, ...options.env },
      }),
    async repository() {
      for (const args of [
        ['init', '-q'],
        [
          '-c',
          'user.name=Fixture',
          '-c',
          'user.email=fixture@example.test',
          'commit',
          '--allow-empty',
          '-qm',
          'fixture',
        ],
      ]) {
        const result = await command('git', args, { cwd: repo, env });
        if (result.code !== 0) throw new Error(result.stderr);
      }
      return repo;
    },
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

export type Fixture = Awaited<ReturnType<typeof fixture>>;

export function withFixture(body: (fixture: Fixture) => Promise<void>) {
  return async () => {
    const scratch = await fixture();
    try {
      await body(scratch);
    } finally {
      await scratch.cleanup();
    }
  };
}
