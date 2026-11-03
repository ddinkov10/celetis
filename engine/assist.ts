import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Host } from './lib/config-core.ts';
import { installRecorder, markDefect, passOn } from './lib/events.ts';
import { HostError, requireBun, updateHint } from './lib/host.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { codexHome, codexSessionPin } from './lib/plugin-metadata.ts';
import { requireUpdatePolicy } from './lib/plugin-policy.ts';
import { childEnv } from './lib/process.ts';
import { execConsumer, withPluginRead } from './lib/update-lock.ts';

export function assistArguments(host: Host, issue: number, root: string): string[] {
  return host === 'claude'
    ? ['--plugin-dir', root, '-n', `#${issue} assist`, `/celetis:assist #${issue}`]
    : [
        '--no-daemon',
        `Use the celetis:assist skill for #${issue}. Complete its Celetis entry before any response, including commentary.\n` +
          `Read the skill from ${JSON.stringify(join(root, 'skills/assist/SKILL.md'))}.`,
      ];
}

export async function main(argv: string[]): Promise<number> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    const issue = Number(args[0]?.replace(/^#/, ''));
    if (args.length !== 1 || !/^#?[0-9]+$/.test(args[0] ?? '') || !Number.isSafeInteger(issue) || issue < 1)
      throw new HostError(`usage: celetis --agent <host> assist <n>\n${updateHint}`, 2);
    process.env.PATH = childEnv().PATH;
    const operation = createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    const main = operation.checkout.main as string;
    const host = operation.host;
    const executable = Bun.which(host, { PATH: childEnv().PATH });
    if (!executable) throw new HostError(`celetis-assist: ${host} is not on PATH`);
    const root = dirname(import.meta.dir);
    const skill = join(root, 'skills/assist/SKILL.md');
    if (!(await stat(skill).catch(() => null))?.isFile())
      throw new HostError(`celetis-assist: cannot read the assistance skill: ${skill}`);
    if (host === 'codex') process.env.CODEX_HOME = await codexHome();
    process.chdir(main);
    const pin = await withPluginRead(host, async () => {
      await requireUpdatePolicy(host, operation.checkout.cwd);
      if (operation.checkout.cwd !== main) await requireUpdatePolicy(host, main);
      return host === 'codex' ? codexSessionPin(main) : [];
    });
    return passOn(
      await execConsumer(executable, [executable, ...pin, ...assistArguments(host, issue, root)], childEnv()),
    );
  } catch (error) {
    markDefect(error);
    console.error(error instanceof HostError ? error.message : `celetis-assist: ${(error as Error).message}`);
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) {
  installRecorder('assist');
  process.exitCode = await main(process.argv.slice(2));
}
