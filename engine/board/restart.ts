import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute } from 'node:path';
import { HostError } from '../lib/host.ts';
import { installedRevision, revision } from '../lib/plugin-metadata.ts';
import { bunArgs, childEnv } from '../lib/process.ts';
import { programPaths, programSource, readProgram } from '../lib/program.ts';
import { execConsumer } from '../lib/update-lock.ts';
import type { BoardStart } from './start.ts';

export async function installedBoard(target: string, env: NodeJS.ProcessEnv) {
  if (env.CELETIS_HOME && !isAbsolute(env.CELETIS_HOME))
    throw new HostError(`celetis: CELETIS_HOME must be an absolute path: ${env.CELETIS_HOME}`, 2);
  const program = await readProgram(programPaths(env.CELETIS_HOME || homedir()));
  if (!revision.test(target) || !program || program.revision !== target)
    throw new HostError('update: the installed program is not the approved target; check again');
  const source = await programSource(program.root);
  if (source.revision !== target || (await installedRevision('program', program.root, source.source)) !== target)
    throw new HostError('update: the installed program identity differs from the approved target; check again');
  return program;
}

export async function restartBoard(main: string, port: number, context: BoardStart, target: string): Promise<number> {
  const program = await installedBoard(target, context.env);
  process.chdir(await realpath(main));
  const env = childEnv({ ...context.env, PORT: String(port) });
  return execConsumer(
    process.execPath,
    [process.execPath, ...bunArgs(program.entry, ['--agent', context.host, 'board'])],
    env,
  );
}
