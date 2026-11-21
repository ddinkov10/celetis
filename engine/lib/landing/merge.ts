import { join } from 'node:path';
import { HostError } from '../command/errors.ts';
import { exits } from '../contract/contract.ts';
import { streamBun } from '../process/process.ts';
import { services } from '../services/services.ts';
import type { IssueKey } from '../tracker/key.ts';
import { keyedSubject } from '../workflow/workflow.ts';
import type { LandingContext, Mechanism } from './landing.ts';

export function mergeMechanism(context: LandingContext, suite: string): Mechanism {
  const { n, subject, main, trunk, branch, tip, base, checkout, stale, signal } = context;
  const { git, gitRaw, tracked, die, interrupted, preflight, setCleanup } = context;
  const closeIssue = async (issue: IssueKey, body: string) => {
    const gh = services(main, signal).tracker;
    await gh.comment(issue, body);
    await gh.edit(issue, { state: 'closed', state_reason: 'completed' });
    process.stderr.write(gh.stderr());
  };
  let offTrunk = false;
  return {
    async check() {
      offTrunk = (await git(['branch', '--show-current'], undefined, main)) !== trunk;
      if (!offTrunk) {
        const [firstChange, ...otherChanges] = (await git(['status', '--porcelain'], undefined, main))
          .split('\n')
          .filter(Boolean);
        if (firstChange !== undefined)
          die(
            'blocked',
            `the main checkout has uncommitted changes, your work: ${main}: ${firstChange.slice(3)}${otherChanges.length ? ` and ${otherChanges.length} more` : ''}; commit or stash them there, then land again`,
          );
        const head = await git(['rev-parse', 'HEAD'], undefined, main);
        if (head !== base) {
          const ancestry = await gitRaw(['merge-base', '--is-ancestor', 'HEAD', base], main);
          process.stderr.write(ancestry.stderr);
          if (ancestry.code === 0)
            await git(
              ['merge', '-q', '--ff-only', base],
              ['blocked', `cannot fast-forward the main checkout to origin/${trunk}: ${main}`],
              main,
            );
          else if (ancestry.code === 1) {
            const ahead = (await git(['log', '--format=%h %s', `${base}..HEAD`], undefined, main)).split('\n');
            die(
              'blocked',
              `the main checkout has ${ahead.length} commit(s) that origin/${trunk} does not have, your work: ${main}: ${ahead[0]}; push them, or move them to a branch there, then land again`,
            );
          } else throw new HostError(ancestry.stderr.trimEnd(), exits.blocked);
        }
      }
      const ancestor = await gitRaw(['merge-base', '--is-ancestor', base, tip]);
      process.stderr.write(ancestor.stderr);
      if (ancestor.code !== 0) die('repair', `${branch} does not contain the head of ${trunk}; ${stale}`);
    },
    async land() {
      const merge = await gitRaw(['merge-tree', '--write-tree', base, tip]);
      const tree = merge.code === 0 ? merge.stdout.trimEnd() : '';
      const open = `the change is on ${trunk}, but #${n} is open; run celetis --agent <host> land again`;
      let commit: string;
      if (tree === (await git(['rev-parse', `${base}^{tree}`]))) {
        setCleanup(open);
        commit = await git([
          'log',
          '-n',
          '1',
          '--format=%H',
          '--fixed-strings',
          `--grep=${keyedSubject('', n).trimStart()}`,
          `origin/${trunk}`,
        ]);
      } else {
        await preflight();
        if (!checkout) die('repair', `the lane worktree of ${branch} is missing`);
        const status = await streamBun(join(checkout, suite), [], checkout, signal);
        interrupted();
        if (status !== 0) die('checks', `the suite ${suite} failed with status ${status} at ${tip}`);
        commit = await git(['commit-tree', `${tip}^{tree}`, '-p', base, '-m', keyedSubject(subject, n)]);
        await preflight();
        await git(
          ['push', '-q', 'origin', `${commit}:refs/heads/${trunk}`],
          ['blocked', `cannot push ${trunk} to origin; ${trunk} is as it was`],
        );
        if (!offTrunk) {
          setCleanup(
            `the change is on origin/${trunk}, but the main checkout did not move; run git pull there, then run celetis --agent <host> land again`,
          );
          await git(['merge', '-q', '--ff-only', commit], undefined, main);
        }
        setCleanup(open);
      }
      const issue = await tracked(({ tracker }) => tracker.issue(n));
      if (issue.state !== 'closed') await closeIssue(n, `Landed on ${trunk}${commit ? ` in ${commit}` : ''}.`);
    },
    async after() {
      const current = await gitRaw(['branch', '--show-current'], main);
      process.stderr.write(current.stderr);
      if (offTrunk || current.code !== 0 || current.stdout.trimEnd() !== trunk)
        console.log(`land: the main checkout did not move to origin/${trunk}; run git pull on ${trunk} there`);
    },
  };
}
