import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HostError, unsupported } from './lib/command/errors.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/command/operation.ts';
import { requireContract } from './lib/contract/check.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { requireBun } from './lib/host/host.ts';
import { interactiveHost, runInteractive } from './lib/host/interactive.ts';
import type { Host } from './lib/host/names.ts';
import { childEnv } from './lib/process/process.ts';
import { installRecorder, markDefect, passOn } from './lib/state/events.ts';

const skillSentence: Record<Host, (plugin: string) => string> = {
  claude: () => 'Invoke the Skill tool with celetis:intake and the user request as its arguments.',
  codex: (plugin) =>
    `Read and follow the intake skill from ${JSON.stringify(join(plugin, 'skills/intake/SKILL.md'))} with the user request.`,
  opencode: () => unsupported('opencode', 'intake session'),
};

function intakeText(host: Host, plugin: string): { title: string; prompt: string } {
  const prompt =
    'Say exactly "What would you like to work on?", then end your turn and wait for the user. ' +
    'These launcher instructions are not a work request. Do not invoke intake, create an issue, or start a run yet. ' +
    'Only after the user supplies a nonempty request, use that answer as the input to celetis:intake. ' +
    'Complete its normal Celetis entry before any next response, including commentary. ' +
    skillSentence[host](plugin);
  return { title: 'Intake', prompt };
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    if (args.length !== 0) throw new HostError(usage('intake'), exits.usage);
    process.env.PATH = childEnv().PATH;
    const operation = await createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    const host = await interactiveHost(operation, 'intake', 'celetis');
    const main = operation.checkout.main as string;
    process.chdir(main);
    return passOn(
      await runInteractive(operation, host, async (host) => {
        const plugin = await requireContract(host, main);
        const skill = join(plugin, 'skills/intake/SKILL.md');
        if (!(await stat(skill).catch(() => null))?.isFile())
          throw new HostError(`celetis-intake: cannot read the intake skill: ${skill}`, exits.prerequisite);
        return intakeText(host, plugin);
      }),
    );
  } catch (error) {
    markDefect(error);
    console.error(error instanceof HostError ? error.message : `celetis-intake: ${(error as Error).message}`);
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('intake');
  process.exitCode = await main(process.argv.slice(2));
}
