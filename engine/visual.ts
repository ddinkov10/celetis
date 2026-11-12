import { mkdir, rm } from 'node:fs/promises';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import { HostError, unsupported } from './lib/errors.ts';
import { installRecorder, markDefect, passOn } from './lib/events.ts';
import { isCommit, isIssueNumber } from './lib/fields.ts';
import { requireBun } from './lib/host.ts';
import type { Host } from './lib/host-names.ts';
import { type Need, requireCan } from './lib/hosts.ts';
import { interactiveHost, runInteractive } from './lib/interactive.ts';
import { commandInput, createOperation, locateCheckouts } from './lib/operation.ts';
import { childEnv, run } from './lib/process.ts';
import { hasPage, partialPage, visualFolder, visualLink, visualPage } from './lib/visual.ts';

const claudeInstall =
  '/plugin marketplace add nicobailon/visual-explainer, then /plugin install visual-explainer@visual-explainer-marketplace';
const codexInstall =
  'copy the skill to ~/.codex/skills/visual-explainer from https://github.com/nicobailon/visual-explainer';

const skillSentence: Record<Host, (sha: string) => string> = {
  claude: (sha) => `Invoke the Skill tool with visual-explainer:diff-review and the argument ${sha}. `,
  codex: (sha) => `Use the visual-explainer skill and make its diff review of the commit ${sha}. `,
  opencode: () => unsupported('opencode', 'visual session'),
};
const installPath: Record<Host, () => string> = {
  claude: () => claudeInstall,
  codex: () => codexInstall,
  opencode: () => unsupported('opencode', 'visual session'),
};
const need: Need = { kind: 'interactive', command: 'visual' };

function visualText(host: Host, issue: number, sha: string, main: string): { title: string; prompt: string } {
  const partial = JSON.stringify(partialPage(main, sha));
  const page = JSON.stringify(visualPage(main, sha));
  const prompt =
    `These launcher instructions are the whole request: make the visual-explainer diff review of the commit ${sha}, the landed change of issue #${issue}, in this checkout. ` +
    skillSentence[host](sha) +
    'Use the skill only when this session lists it as an available skill. Do not read a copy of it from the folders of another host. ' +
    `Write the page to ${partial} and to no other path. When the page is complete, rename that file to ${page}. ` +
    `Then open ${page} in the default browser of the OS, as the delivery of the skill does. ` +
    'Change no other file, make no commit, and push nothing. ' +
    'When this session has no visual-explainer skill, say exactly "visual-explainer is not available in this session.", ' +
    `then the install path of this host: ${installPath[host]()}. ` +
    'Write no file, make no page of your own, and end the turn.';
  return { title: visualLink(issue), prompt };
}

function firstLine(text: string): string {
  return text.split('\n')[0] ?? '';
}

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    const [number, sha] = args;
    const issue = Number(number);
    if (args.length !== 2 || !isIssueNumber(number ?? '') || !isCommit(sha))
      throw new HostError(usage('visual'), exits.usage);
    process.env.PATH = childEnv().PATH;
    const operation = await createOperation(
      await locateCheckouts(process.cwd()),
      { explicit, environment: process.env.CELETIS_AGENT },
      'main',
    );
    if (operation.choice.kind === 'explicit') requireCan(operation.choice.host, need, 'celetis');
    const main = operation.checkout.main as string;
    process.chdir(main);
    const remote = await run('git', ['ls-remote', '--symref', 'origin', 'HEAD'], { cwd: main });
    const trunk = /^ref: refs\/heads\/(\S+)\tHEAD$/.exec(firstLine(remote.stdout))?.[1];
    if (remote.code !== 0 || !trunk)
      throw new HostError(
        `celetis-visual: cannot read the default branch of origin: ${firstLine(remote.stderr)}`,
        exits.blocked,
      );
    const fetched = await run('git', ['fetch', '-q', 'origin', `+refs/heads/${trunk}:refs/remotes/origin/${trunk}`], {
      cwd: main,
    });
    if (fetched.code !== 0)
      throw new HostError(
        `celetis-visual: cannot fetch ${trunk} from origin: ${firstLine(fetched.stderr)}`,
        exits.blocked,
      );
    const ancestor = await run('git', ['merge-base', '--is-ancestor', sha, `refs/remotes/origin/${trunk}`], {
      cwd: main,
    });
    if (ancestor.code === 1) throw new HostError(`celetis-visual: ${sha} is not on origin/${trunk}`, exits.usage);
    if (ancestor.code !== 0)
      throw new HostError(
        `celetis-visual: ${sha} is not on origin/${trunk}: ${firstLine(ancestor.stderr)}`,
        exits.blocked,
      );
    if (await hasPage(main, sha))
      throw new HostError(
        `celetis-visual: the page exists: ${visualPage(main, sha)}; open it from History`,
        exits.prerequisite,
      );
    await mkdir(visualFolder(main), { recursive: true });
    await rm(partialPage(main, sha), { force: true });
    const host = await interactiveHost(operation, 'visual', 'celetis');
    return passOn(await runInteractive(operation, host, async (host) => visualText(host, issue, sha, main)));
  } catch (error) {
    markDefect(error);
    console.error(error instanceof HostError ? error.message : `celetis-visual: ${(error as Error).message}`);
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('visual');
  process.exitCode = await main(process.argv.slice(2));
}
