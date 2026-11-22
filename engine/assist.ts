import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { HostError } from './lib/command/errors.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/command/operation.ts';
import { requireContract } from './lib/contract/check.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { requireBun } from './lib/host/host.ts';
import { assistPrompt, interactiveHost, runInteractive } from './lib/host/interactive.ts';
import { childEnv } from './lib/process/process.ts';
import { installRecorder, markDefect, passOn } from './lib/state/events.ts';
import { parseHandle } from './lib/tracker/key.ts';
import { tabLabel } from './lib/workflow/workflow.ts';

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    const issue = args.length === 1 ? parseHandle(args[0] as string) : null;
    if (issue === null) throw new HostError(usage('assist'), exits.usage);
    process.env.PATH = childEnv().PATH;
    const operation = await createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    const host = await interactiveHost(operation, 'assist', 'celetis');
    const main = operation.checkout.main as string;
    process.chdir(main);
    return passOn(
      await runInteractive(operation, host, async (host) => {
        const plugin = await requireContract(host, main);
        const skill = join(plugin, 'skills/assist/SKILL.md');
        if (!(await stat(skill).catch(() => null))?.isFile())
          throw new HostError(`celetis-assist: cannot read the assistance skill: ${skill}`, exits.prerequisite);
        return { title: tabLabel(issue, 'assist'), prompt: assistPrompt(host, issue, plugin, false) };
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
