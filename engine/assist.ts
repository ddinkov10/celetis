import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import { requireContract } from './lib/contract-check.ts';
import { HostError } from './lib/errors.ts';
import { installRecorder, markDefect, passOn } from './lib/events.ts';
import { requireBun } from './lib/host.ts';
import type { Host } from './lib/host-names.ts';
import { runInteractive } from './lib/interactive.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { childEnv } from './lib/process.ts';

const promptFor: Record<Host, (issue: number, plugin: string) => string> = {
  claude: (issue) => `/celetis:assist #${issue}`,
  codex: (issue, plugin) =>
    `Use the celetis:assist skill for #${issue}. Complete its Celetis entry before any response, including commentary.\n` +
    `Read the skill from ${JSON.stringify(join(plugin, 'skills/assist/SKILL.md'))}.`,
};

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    const issue = Number(args[0]?.replace(/^#/, ''));
    if (args.length !== 1 || !/^#?[0-9]+$/.test(args[0] ?? '') || !Number.isSafeInteger(issue) || issue < 1)
      throw new HostError(usage('assist'), exits.usage);
    process.env.PATH = childEnv().PATH;
    const operation = await createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    const main = operation.checkout.main as string;
    process.chdir(main);
    return passOn(
      await runInteractive(operation, async (host) => {
        const plugin = await requireContract(host, main);
        const skill = join(plugin, 'skills/assist/SKILL.md');
        if (!(await stat(skill).catch(() => null))?.isFile())
          throw new HostError(`celetis-assist: cannot read the assistance skill: ${skill}`, exits.prerequisite);
        return { title: `#${issue} assist`, prompt: promptFor[host](issue, plugin) };
      }),
    );
  } catch (error) {
    markDefect(error);
    console.error(error instanceof HostError ? error.message : `celetis-assist: ${(error as Error).message}`);
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('assist');
  process.exitCode = await main(process.argv.slice(2));
}
