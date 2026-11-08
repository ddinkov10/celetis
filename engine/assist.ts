import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Host } from './lib/config-core.ts';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import { HostError } from './lib/errors.ts';
import { installRecorder, markDefect, passOn } from './lib/events.ts';
import { requireBun } from './lib/host.ts';
import { runInteractive } from './lib/interactive.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { childEnv } from './lib/process.ts';

export function assistArguments(host: Host, issue: number, root: string): string[] {
  return host === 'claude'
    ? ['--plugin-dir', root, '-n', `#${issue} assist`, `/celetis:assist #${issue}`]
    : [
        '--no-daemon',
        `Use the celetis:assist skill for #${issue}. Complete its Celetis entry before any response, including commentary.\n` +
          `Read the skill from ${JSON.stringify(join(root, 'skills/assist/SKILL.md'))}.`,
      ];
}

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
    const root = dirname(import.meta.dir);
    const skill = join(root, 'skills/assist/SKILL.md');
    if (!(await stat(skill).catch(() => null))?.isFile())
      throw new HostError(`celetis-assist: cannot read the assistance skill: ${skill}`, exits.prerequisite);
    process.chdir(main);
    return passOn(await runInteractive(operation, async (host) => assistArguments(host, issue, root)));
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
