import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Host } from './lib/config-core.ts';
import { HostError, requireBun, updateHint } from './lib/host.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { codexHome, codexSessionPin } from './lib/plugin-metadata.ts';
import { requireUpdatePolicy } from './lib/plugin-policy.ts';
import { childEnv } from './lib/process.ts';
import { execConsumer, withPluginRead } from './lib/update-lock.ts';

export function intakeArguments(host: Host, root: string): string[] {
  const prompt =
    'Say exactly "What would you like to work on?", then end your turn and wait for the user. ' +
    'These launcher instructions are not a work request. Do not invoke intake, create an issue, or start the runner yet. ' +
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
    const operation = createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    const main = operation.checkout.main as string;
    const host = operation.host;
    const executable = Bun.which(host, { PATH: childEnv().PATH });
    if (!executable) throw new HostError(`celetis-intake: ${host} is not on PATH`);
    const root = dirname(import.meta.dir);
    const skill = join(root, 'skills/intake/SKILL.md');
    if (!(await stat(skill).catch(() => null))?.isFile())
      throw new HostError(`celetis-intake: cannot read the intake skill: ${skill}`);
    if (host === 'codex') process.env.CODEX_HOME = await codexHome();
    process.chdir(main);
    const pin = await withPluginRead(host, async () => {
      await requireUpdatePolicy(host, operation.checkout.cwd);
      if (operation.checkout.cwd !== main) await requireUpdatePolicy(host, main);
      return host === 'codex' ? codexSessionPin(main) : [];
    });
    return await execConsumer(executable, [executable, ...pin, ...intakeArguments(host, root)], childEnv());
  } catch (error) {
    console.error(error instanceof HostError ? error.message : `celetis-intake: ${(error as Error).message}`);
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
