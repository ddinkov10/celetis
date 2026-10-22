import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isolatedArgs } from './lib/fixture.ts';
import { customManualFixture } from './lib/manual-fixture.ts';

for (const program of ['step', 'custom'] as const)
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    test(`${program} preserves ${signal} status and removes active host processes`, async () => {
      const f = await customManualFixture();
      const pids = join(f.dir, 'pids');
      try {
        await f.stub(
          'claude',
          `if(process.argv[2]==='--version'){console.log('cleanup fixture');process.exit(0);}const {appendFileSync}=await import('node:fs');appendFileSync(process.env.MANUAL_PIDS!,String(process.pid)+'\\n');setInterval(()=>{},1000);`,
        );
        const child = spawn(
          process.execPath,
          [
            ...isolatedArgs,
            program === 'step' ? f.step : f.custom,
            ...(program === 'step' ? ['--agent', 'claude', '--only', '1:step'] : []),
          ],
          {
            cwd: f.repo,
            env: { ...f.env, MANUAL_PIDS: pids, CUSTOM_PART_CASES: 'no-shell' },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        let stderr = '';
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
        child.stdout.resume();
        const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
          child.once('close', (code, signal) => resolve({ code, signal })),
        );
        const deadline = Date.now() + 3000;
        while (!(await Bun.file(pids).exists())) {
          if (Date.now() > deadline) {
            child.kill('SIGKILL');
            throw new Error(`host did not start: ${stderr}`);
          }
          await Bun.sleep(10);
        }
        child.kill(signal);
        const actual = await closed;
        expect(actual).toEqual({ code: signal === 'SIGINT' ? 130 : 143, signal: null });
        const started = (await readFile(pids, 'utf8')).trim().split('\n').map(Number);
        for (const pid of started) {
          let alive = true;
          try {
            process.kill(pid, 0);
          } catch {
            alive = false;
          }
          expect(alive).toBe(false);
        }
      } finally {
        await f.cleanup();
      }
    });
