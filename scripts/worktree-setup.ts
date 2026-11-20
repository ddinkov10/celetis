import { dirname, join } from 'node:path';
import { installArgs, installDependencies } from '../engine/lib/install/dependencies.ts';

const engine = join(dirname(import.meta.dir), 'engine');
const result = await installDependencies(dirname(import.meta.dir), 'development');
if (result.kind === 'no-lock') {
  console.error(`worktree-setup: ${engine} has no bun.lock file`);
  process.exitCode = 3;
} else if (result.kind === 'failed') {
  process.stderr.write(result.output);
  console.error(
    `worktree-setup: bun ${installArgs.development.join(' ')} failed in ${engine} with status ${result.status}`,
  );
  process.exitCode = 6;
}
