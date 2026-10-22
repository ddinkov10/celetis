import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isolatedArgs, root, withFixture } from './lib/fixture.ts';

const entry = join(root, 'scripts/install-tools.ts');
const archive = new TextEncoder().encode('verified actionlint archive');
const checksum = createHash('sha256').update(archive).digest('hex');

test(
  'installer pins package arguments and checks the native actionlint archive',
  withFixture(async (f) => {
    const { installTools } = await import(entry);
    const calls: { file: string; args: string[] }[] = [];
    const urls: string[] = [];
    const destination = join(f.dir, 'private tools');
    await installTools(destination, {
      platform: 'linux',
      arch: 'x64',
      hashes: { linux_amd64: checksum },
      download: async (url: string) => {
        urls.push(url);
        return archive;
      },
      execute: async (file: string, args: string[]) => {
        calls.push({ file, args });
        if (args[0] === 'add') {
          const stage = args[args.indexOf('--cwd') + 1] ?? '';
          for (const [packageName, binary] of [
            ['@biomejs/biome', 'bin/biome'],
            ['typescript', 'bin/tsc'],
          ]) {
            const path = join(stage, 'node_modules', packageName ?? '', binary ?? '');
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, 'tool');
          }
        } else {
          const stage = args[args.indexOf('-C') + 1] ?? '';
          await writeFile(join(stage, 'actionlint'), 'native actionlint');
        }
        return { code: 0, stdout: '', stderr: '' };
      },
    });
    expect(urls).toEqual([
      'https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz',
    ]);
    expect(calls[0]?.file).toBe(process.execPath);
    expect(calls[0]?.args.slice(0, 3)).toEqual(['add', '--exact', '--ignore-scripts']);
    expect(calls[0]?.args).toContain('@biomejs/biome@2.5.15');
    expect(calls[0]?.args).toContain('typescript@7.0.2');
    expect(calls[0]?.args).toContain('@types/bun@1.4.2');
    expect(calls[0]?.args).not.toContain('actionlint-py');
    expect(calls[1]?.file).toBe('tar');
    expect(calls[1]?.args.at(-1)).toBe('actionlint');
    expect(await readFile(join(destination, 'bin/actionlint'), 'utf8')).toBe('native actionlint');
    await expect(
      (await import('node:fs/promises')).stat(join(destination, 'bin/actionlint')).then((s) => s.mode & 0o777),
    ).resolves.toBe(0o755);
    expect(await readFile(join(destination, 'bin/tsc'), 'utf8')).toBe('tool');
    expect(await readdir(f.repo)).toEqual([]);
  }),
);

for (const failure of ['hash mismatch', 'download failure', 'package failure', 'extract failure'])
  test(
    `installer preserves an existing destination after ${failure}`,
    withFixture(async (f) => {
      const { installTools } = await import(entry);
      const destination = join(f.dir, 'tools');
      await mkdir(join(destination, 'bin'), { recursive: true });
      await writeFile(join(destination, 'bin/actionlint'), 'original');
      await chmod(join(destination, 'bin/actionlint'), 0o755);
      let calls = 0;
      await expect(
        installTools(destination, {
          platform: 'darwin',
          arch: 'arm64',
          hashes: { darwin_arm64: failure === 'hash mismatch' ? '0'.repeat(64) : checksum },
          download: async () => {
            if (failure === 'download failure') throw new Error('download failed');
            return archive;
          },
          execute: async (_file: string, args: string[]) => {
            calls++;
            if (failure === 'package failure' || (failure === 'extract failure' && args[0] !== 'add'))
              return { code: 7, stdout: '', stderr: 'failed' };
            return { code: 0, stdout: '', stderr: '' };
          },
        }),
      ).rejects.toThrow();
      expect(await readFile(join(destination, 'bin/actionlint'), 'utf8')).toBe('original');
      expect((await readdir(f.dir)).filter((name) => name.startsWith('.celetis-tools.'))).toEqual([]);
      if (failure === 'hash mismatch' || failure === 'download failure') expect(calls).toBe(0);
    }),
  );

test(
  'installer rejects unsupported platforms before download or processes',
  withFixture(async (f) => {
    const { installTools } = await import(entry);
    let calls = 0;
    await expect(
      installTools(join(f.dir, 'tools'), {
        platform: 'freebsd',
        arch: 'arm64',
        download: async () => {
          calls++;
          return archive;
        },
        execute: async () => {
          calls++;
          return { code: 0, stdout: '', stderr: '' };
        },
      }),
    ).rejects.toThrow('unsupported');
    expect(calls).toBe(0);
  }),
);

test(
  'tool lookup uses package metadata and runs JavaScript tools through selected Bun',
  withFixture(async (f) => {
    const { findTools } = await import(entry);
    for (const [name, version, bin] of [
      ['@biomejs/biome', '2.5.15', 'bin/biome'],
      ['typescript', '7.0.2', 'bin/tsc'],
      ['@types/bun', '1.4.2', ''],
    ]) {
      await f.write(
        `tools/node_modules/${name}/package.json`,
        JSON.stringify({ name, version, bin: bin ? { [name === 'typescript' ? 'tsc' : 'biome']: bin } : undefined }),
      );
      if (bin) await f.write(`tools/node_modules/${name}/${bin}`, 'console.log("tool");', 0o755);
    }
    const { symlink } = await import('node:fs/promises');
    await mkdir(join(f.dir, 'tools/bin'), { recursive: true });
    await symlink('../node_modules/typescript/bin/tsc', join(f.dir, 'tools/bin/tsc'));
    await symlink('../node_modules/@biomejs/biome/bin/biome', join(f.dir, 'tools/bin/biome'));
    await f.write('tools/bin/actionlint', 'native', 0o755);
    const tools = await findTools(join(f.dir, 'tools/bin'));
    expect(tools.tsc.file).toBe(process.execPath);
    expect(tools.tsc.args).toEqual([...isolatedArgs, join(f.dir, 'tools/node_modules/typescript/bin/tsc')]);
    expect(tools.biome.file).toBe(process.execPath);
    expect(tools.typeRoots).toBe(join(f.dir, 'tools/node_modules/@types'));
  }),
);
