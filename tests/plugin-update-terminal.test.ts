import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import { join } from 'node:path';
import { type Fixture, fixture, isolatedArgs, root } from './lib/fixture.ts';
import { updateFixture } from './lib/plugin-update-fixture.ts';

let build: Fixture;
let launcher: string;
setDefaultTimeout(15_000);

beforeAll(async () => {
  build = await fixture();
  const result = await build.bun(join(root, 'scripts/build.ts'), ['--outdir', build.dir]);
  expect(result.code, result.stderr).toBe(0);
  launcher = join(build.dir, 'scripts/celetis');
});

afterAll(async () => build?.cleanup());

async function terminal(f: Awaited<ReturnType<typeof updateFixture>>, answer: string) {
  let output = '';
  let answered = false;
  const ended = Promise.withResolvers<void>();
  const child = Bun.spawn(
    [process.execPath, ...isolatedArgs, launcher, '--agent', f.env.CELETIS_AGENT, 'plugin-update'],
    {
      cwd: f.repo,
      env: f.env,
      terminal: {
        data(terminal, bytes) {
          output += Buffer.from(bytes).toString('utf8');
          if (!answered && output.includes('Update Celetis now? [y/N]')) {
            answered = true;
            terminal.write(`${answer}\n`);
          }
        },
        exit: () => ended.resolve(),
      },
    },
  );
  const timeout = setTimeout(() => child.kill(), 10_000);
  try {
    const code = await child.exited;
    await ended.promise;
    return { code, output: output.replaceAll('\r\n', '\n') };
  } finally {
    clearTimeout(timeout);
    child.terminal?.close();
  }
}

for (const host of ['claude', 'codex'] as const) {
  test(`${host} one command discovers and confirms the exact update in a terminal`, async () => {
    const f = await updateFixture(host);
    try {
      const result = await terminal(f, 'yes');
      expect(result.code, result.output).toBe(0);
      expect(result.output).toContain('Update Celetis now? [y/N]');
      expect(result.output).toContain(f.target);
      expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.target);
      expect(await f.mutations()).not.toBe('');
    } finally {
      await f.cleanup();
    }
  });

  for (const answer of ['n', '', '\x04'])
    test(`${host} terminal answer ${JSON.stringify(answer)} leaves the installation unchanged`, async () => {
      const f = await updateFixture(host);
      try {
        const result = await terminal(f, answer);
        expect(result.code, result.output).toBe(0);
        expect(result.output).toContain('Update Celetis now? [y/N]');
        expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.installed);
        expect(await f.mutations()).toBe('');
      } finally {
        await f.cleanup();
      }
    });

  test(`${host} a noninteractive update cannot approve itself`, async () => {
    const f = await updateFixture(host);
    try {
      const result = await f.bun(launcher, ['--agent', host, 'plugin-update'], { cwd: f.repo, env: f.env });
      expect(result.code).toBe(2);
      expect(result.stderr).toContain('interactive terminal');
      expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.installed);
      expect(await f.mutations()).toBe('');
    } finally {
      await f.cleanup();
    }
  });

  test(`${host} an already-current update needs no confirmation`, async () => {
    const f = await updateFixture(host);
    try {
      await f.git(['push', '-q', '--force', f.source, 'HEAD:main']);
      const result = await f.bun(launcher, ['--agent', host, 'plugin-update'], { cwd: f.repo, env: f.env });
      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout).toContain('up to date');
      expect(await f.mutations()).toBe('');
    } finally {
      await f.cleanup();
    }
  });

  test(`${host} the standalone command can replace an obsolete installed updater`, async () => {
    const f = await updateFixture(host);
    try {
      await f.write(
        'config/plugins/cache/celetis/celetis/local/scripts/plugin-update.ts',
        'throw new Error("obsolete installed updater must not run");',
      );
      await f.git(['add', 'scripts/plugin-update.ts']);
      await f.git(['commit', '-qm', 'obsolete updater']);
      const installed = await f.git(['rev-parse', 'HEAD']);
      const registry = JSON.parse(await f.read('config/plugins/installed_plugins.json'));
      registry.plugins['celetis@celetis'][0].gitCommitSha = installed;
      await f.write('config/plugins/installed_plugins.json', JSON.stringify(registry));
      if (host === 'codex') {
        const marker = JSON.parse(
          await f.read('config/plugins/cache/celetis/celetis/local/.codex-marketplace-install.json'),
        );
        marker.revision = installed;
        await f.write(
          'config/plugins/cache/celetis/celetis/local/.codex-marketplace-install.json',
          JSON.stringify(marker),
        );
      }
      const result = await terminal(f, 'y');
      expect(result.code, result.output).toBe(0);
      expect(await f.git(['rev-parse', 'HEAD'])).toBe(f.target);
    } finally {
      await f.cleanup();
    }
  });
}
