import { constants } from 'node:os';
import { HostError } from '../command/errors.ts';
import { createOperation, type HostSelection, locateCheckouts } from '../command/operation.ts';
import type { Config } from '../config/core.ts';
import { type ExitClass, type ExitCode, exits, signalExit } from '../contract/contract.ts';
import { parseEpicRepository } from '../epic/acceptance.ts';
import { completeEpic } from '../epic/epic.ts';
import { hostAdapter, requireCan } from '../host/hosts.ts';
import { LessonError } from '../lesson/record.ts';
import { readLessons } from '../lesson/store.ts';
import { run } from '../process/process.ts';
import { lineOf } from '../resolver/lines.ts';
import type { IssueKey } from '../tracker/key.ts';
import { writeRefreshHint } from '../tracker/refresh-hints.ts';
import { type GitHub, GitHubError, github } from '../tracker/tracker.ts';
import { branchGlobs, decide, landable } from '../workflow/workflow.ts';
import { checkoutOf, removeLane } from '../workflow/worktree.ts';
import { mergeMechanism } from './merge.ts';
import { prMechanism } from './pr.ts';

export type Landing = Readonly<{ number: IssueKey; subject: string; selection: HostSelection; from: string }>;
export type LandingEnd = Readonly<{ status: ExitCode; defect: Readonly<{ error: unknown }> | null }>;

export type Mechanism = Readonly<{ check(): Promise<void>; land(): Promise<void>; after(): Promise<void> }>;
export type LandingContext = Readonly<{
  n: IssueKey;
  subject: string;
  main: string;
  trunk: string;
  branch: string;
  tip: string;
  base: string;
  checkout: string;
  stale: string;
  signal: AbortSignal;
  git(args: string[], refusal?: readonly [ExitClass, string], at?: string): Promise<string>;
  gitRaw(args: string[], at?: string): Promise<{ code: number; stdout: string; stderr: string }>;
  tracked<T>(call: (gh: GitHub) => Promise<T>, quiet?: boolean): Promise<T>;
  checked<T>(call: (gh: GitHub) => Promise<T>, message: string): Promise<T>;
  die(outcome: ExitClass, message: string): never;
  interrupted(): void;
  stopped(): ExitCode;
  emitError(error: unknown): void;
  preflight(): Promise<void>;
  setCleanup(text: string): void;
}>;
class Classified extends HostError {}
const suiteOf = (config: Config | undefined) => (config?.landing === 'merge' ? config.suite : undefined);

function select(config: Config, context: LandingContext): Mechanism {
  switch (config.landing) {
    case 'merge':
      return mergeMechanism(context, config.suite);
    case 'pr':
      return prMechanism(context);
    default: {
      const unknown: never = config;
      return unknown;
    }
  }
}

export async function runLanding(landing: Landing, main: string, signal: AbortSignal): Promise<LandingEnd> {
  const n = landing.number;
  const subject = landing.subject;
  let branch = '',
    trunk = '',
    cleanup = '';
  const stopped = () =>
    signal.reason instanceof HostError ? signal.reason.code : signalExit(constants.signals.SIGTERM);
  const die = (outcome: ExitClass, message: string): never => {
    throw new Classified(`land: ${outcome}: ${message}`, exits[outcome]);
  };
  const interrupted = () => {
    if (signal.aborted) throw new HostError('', stopped());
  };
  const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
  const emitError = (error: unknown) => {
    const text = errorText(error);
    if (text) process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
  };
  try {
    const operation = await createOperation(await locateCheckouts(main), landing.selection, 'main');
    try {
      requireCan(operation.host, { kind: 'landing', command: 'land' }, 'celetis');
    } catch (error) {
      throw new Classified((error as HostError).message, exits.prerequisite);
    }
    const common = operation.checkout.common as string;
    const config = operation.mainConfig as Config;
    await hostAdapter(operation.host).checkHome();
    const gitRaw = async (args: string[], at = main) => {
      interrupted();
      return run('git', args, { cwd: at, signal });
    };
    const git = async (args: string[], refusal?: readonly [ExitClass, string], at = main) => {
      const result = await gitRaw(args, at);
      if (result.code !== 0) {
        if (refusal) {
          emitError(result.stderr);
          die(...refusal);
        }
        throw new HostError(result.stderr.trimEnd(), exits.blocked);
      }
      process.stderr.write(result.stderr);
      return result.stdout.trimEnd();
    };
    const tracked = async <T>(call: (gh: GitHub) => Promise<T>, quiet = false): Promise<T> => {
      interrupted();
      const gh = github(main, signal);
      let result: T;
      try {
        result = await call(gh);
      } catch (error) {
        interrupted();
        if (!(error instanceof GitHubError)) throw error;
        if (!quiet && error.stderr === null) process.stderr.write(gh.stderr());
        throw new HostError(error.text, exits.blocked);
      }
      if (!quiet) process.stderr.write(gh.stderr());
      return result;
    };
    const checked = async <T>(call: (gh: GitHub) => Promise<T>, message: string): Promise<T> => {
      try {
        return await tracked(call);
      } catch (error) {
        interrupted();
        emitError(error);
        return die('blocked', message);
      }
    };
    const repo = await checked((gh) => gh.repository(), 'cannot read the default branch from GitHub');
    trunk = repo.defaultBranch;
    branch = await git(['branch', '--list', '--format=%(refname:lstrip=2)', ...branchGlobs(n)]);
    if (!branch) die('usage', `no lane branch matches #${n}; nothing to land`);
    if (branch.includes('\n'))
      die('blocked', `several branches match #${n}: ${branch.replaceAll('\n', ' ')}; keep one`);
    const checkout = await checkoutOf(branch, main, signal);
    if (checkout === main) die('blocked', `switch the main checkout off ${branch} first`);
    if (checkout) {
      if (landing.from === checkout)
        die('usage', `leave ${checkout} first: run celetis --agent <host> land from the main checkout`);
      try {
        await readLessons(checkout, 'active');
      } catch (error) {
        if (!(error instanceof LessonError)) throw error;
        if (error.code === exits.usage)
          die('repair', `the lessons of ${branch} do not validate: ${error.message}; repair them, then land again`);
        die(error.code === exits.prerequisite ? 'prerequisite' : 'blocked', error.message);
      }
      if (await git(['status', '--porcelain'], undefined, checkout))
        die('usage', `the lane worktree is dirty: ${checkout}; commit first`);
    }
    await git(['fetch', '-q', 'origin', trunk], ['blocked', `cannot fetch ${trunk} from origin`]);
    const tip = await git(['rev-parse', `refs/heads/${branch}`]);
    const base = await git(['rev-parse', `origin/${trunk}`]);
    if (!(await git(['rev-list', '-n', '1', `origin/${trunk}..${branch}`])))
      die('usage', `${branch} has no commit that ${trunk} lacks; nothing to land`);
    const stale = `merge origin/${trunk} into ${branch}, run the verify gate of the project again, then land again`;
    const preflight = async () => {
      const fresh = await createOperation(await locateCheckouts(main), operation.selection, 'main');
      if (fresh.mainConfig?.landing !== config.landing || suiteOf(fresh.mainConfig) !== suiteOf(config))
        die('blocked', 'the landing mechanism changed; invoke landing again');
      if (fresh.checkout.main !== operation.checkout.main || fresh.checkout.common !== common)
        die('blocked', 'the checkout changed; invoke landing again');
      const gh = github(main, signal);
      const read = await gh.read(n).catch(() => null);
      process.stderr.write(gh.stderr());
      interrupted();
      const decision = read ? decide(read.data) : die('blocked', `cannot read #${n} from GitHub`);
      if (!landable(decision)) die('prerequisite', `#${n} is not ready to land: ${lineOf(n, decision)}`);
      if (
        (await checked((gh) => gh.repository(), 'cannot read the default branch from GitHub')).defaultBranch !== trunk
      )
        die('blocked', `the default branch changed from ${trunk}; invoke landing again`);
      await git(['fetch', '-q', 'origin', trunk], ['blocked', `cannot fetch ${trunk} from origin`]);
      if ((await git(['rev-parse', `origin/${trunk}`])) !== base)
        die('repair', `the head of ${trunk} changed; ${stale}`);
      const current = await git(['branch', '--list', '--format=%(refname:lstrip=2)', ...branchGlobs(n)]);
      if (current !== branch || (await git(['rev-parse', `refs/heads/${branch}`])) !== tip)
        die('repair', `the lane branch or its tip changed; ${stale}`);
      if ((await checkoutOf(branch, main, signal)) !== checkout) die('repair', `the lane checkout changed; ${stale}`);
      if (checkout && (await git(['status', '--porcelain'], undefined, checkout)))
        die('usage', `the lane worktree is dirty: ${checkout}; commit first`);
      await mechanism.check();
      const currentPolicy = await createOperation(fresh.checkout, operation.selection, 'main');
      if (currentPolicy.mainConfig?.landing !== config.landing || suiteOf(currentPolicy.mainConfig) !== suiteOf(config))
        die('blocked', 'the landing mechanism changed; invoke landing again');
    };
    const context: LandingContext = {
      n,
      subject,
      main,
      trunk,
      branch,
      tip,
      base,
      checkout,
      stale,
      signal,
      git,
      gitRaw,
      tracked,
      checked,
      die,
      interrupted,
      stopped,
      emitError,
      preflight,
      setCleanup: (text) => {
        cleanup = text;
      },
    };
    const mechanism = select(config, context);
    const completeParent = async () => {
      let parent: IssueKey;
      try {
        interrupted();
        const found = await github(main, signal).parent(n);
        parent = found.key;
        const repository = parseEpicRepository(found.url.slice(0, -`/issues/${parent}`.length));
        if (repository !== parseEpicRepository(repo.url)) {
          console.log(
            `land: parent ${found.url} is in another repository; run /celetis:accept-epic #${parent} in that repository's main checkout`,
          );
          return;
        }
      } catch (error) {
        if (!(error instanceof GitHubError && error.notFound))
          console.log(
            `land: warning: cannot read the parent of #${n}: ${error instanceof GitHubError ? error.text : errorText(error)}`,
          );
        return;
      }
      try {
        const result = await completeEpic(main, common, parent, undefined, signal);
        if (result.kind === 'pending')
          console.log(`land: parent #${parent} remains open: ${result.reason}; run ${result.nextAction}`);
      } catch (error) {
        console.log(
          `land: warning: cannot complete parent #${parent}; run /celetis:accept-epic #${parent}: ${errorText(error)}`,
        );
      }
    };
    await mechanism.land();
    cleanup = `the change is on ${trunk}, but the removal of ${branch} stopped; run celetis --agent <host> land again`;
    console.log(`land: #${n} is on ${trunk}`);
    await mechanism.after();
    await completeParent();
    interrupted();
    const deletion = await gitRaw(['push', '-q', 'origin', '--delete', branch]);
    if (deletion.code !== 0) {
      const left = await gitRaw(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
      process.stderr.write(left.stderr);
      if (left.code !== 0 || left.stdout.trimEnd()) {
        throw new HostError(`${deletion.stdout}${deletion.stderr}`.trimEnd(), exits.blocked);
      }
    }
    interrupted();
    await removeLane(n, branch, checkout, main, signal);
    interrupted();
    console.log(`land: ${branch} and its worktree are gone`);
    await writeRefreshHint(main, n);
    return { status: exits.done, defect: null };
  } catch (error) {
    const defect = error instanceof HostError || signal.aborted ? null : { error };
    if (cleanup) {
      if (!signal.aborted) emitError(error);
      console.error(`land: cleanup: ${cleanup}`);
      return { status: exits.cleanup, defect };
    }
    if (signal.aborted) return { status: stopped(), defect };
    if (error instanceof Classified || !(error instanceof HostError)) {
      emitError(error);
      return { status: error instanceof HostError ? error.code : exits.internal, defect };
    }
    const outcome: ExitClass = error.code === exits.usage ? 'usage' : 'blocked';
    emitError(`land: ${outcome}: ${error.message}`);
    return { status: exits[outcome], defect };
  }
}
