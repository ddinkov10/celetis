import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Host } from './lib/config-core.ts';
import { installRecorder, markDefect, passOn } from './lib/events.ts';
import { HostError, requireBun, updateHint } from './lib/host.ts';
import { runInteractive } from './lib/interactive.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { childEnv } from './lib/process.ts';

export function intakeArguments(host: Host, root: string): string[] {
  const prompt =
    'Say exactly "What would you like to work on?", then end your turn and wait for the user. ' +
    'These launcher instructions are not a work request. Do not invoke intake, create an issue, or start a run yet. ' +
    'Only after the user supplies a nonempty request, use that answer as the input to celetis:intake. ' +
    'Complete its normal Celetis entry before any next response, including commentary. ' +
    (host === 'claude'
      ? 'Invoke the Skill tool with celetis:intake and the user request as its arguments.'
      : `Read and follow the intake skill from ${JSON.stringify(join(root, 'skills/intake/SKILL.md'))} with the user request.`);
  return host === 'claude' ? ['--plugin-dir', root, '-n', 'Intake', prompt] : ['--no-daemon', prompt];
}

export async function main(argv: string[]): Promise<number> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    if (args.length !== 0) throw new HostError(`usage: celetis --agent <host> intake\n${updateHint}`, 2);
    process.env.PATH = childEnv().PATH;
    const operation = await createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    const main = operation.checkout.main as string;
    const root = dirname(import.meta.dir);
    const skill = join(root, 'skills/intake/SKILL.md');
    if (!(await stat(skill).catch(() => null))?.isFile())
      throw new HostError(`celetis-intake: cannot read the intake skill: ${skill}`);
    process.chdir(main);
    return passOn(await runInteractive(operation, async (host) => intakeArguments(host, root)));
  } catch (error) {
    markDefect(error);
    console.error(error instanceof HostError ? error.message : `celetis-intake: ${(error as Error).message}`);
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) {
  installRecorder('intake');
  process.exitCode = await main(process.argv.slice(2));
}
