import { CodeHostError } from '../code-host/code-host.ts';
import { HostError } from '../command/errors.ts';
import type { Config } from '../config/core.ts';
import { type ExitCode, exits, headings } from '../contract/contract.ts';
import { landingSubject, parseLandingRecord } from '../daemon/types.ts';
import { run } from '../process/process.ts';
import { services } from '../services/services.ts';
import { type LockOwner, landLock } from '../state/locks.ts';
import type { IssueKey } from '../tracker/key.ts';
import { type Tracker, TrackerError } from '../tracker/tracker.ts';
import { holdOf, releasedComment } from '../workflow/hold.ts';
import { branchGlobs, decide, prototypeGlob } from '../workflow/workflow.ts';
import { checkoutOf, refusedDeletion, removeLane } from '../workflow/worktree.ts';
import { carriesRelease, patchId } from './hold.ts';

export type HeldPress = Readonly<{ number: IssueKey; head: string; patch: string }>;
export type PressAnswer = Readonly<{ ok: true } | { ok: false; line: string; code: ExitCode }>;
export type PressIo = Readonly<{
  main: string;
  config: Config;
  owner: LockOwner;
  busy(number: IssueKey): string | null;
  land(request: { number: IssueKey; subject: string }): Promise<{ code: ExitCode; line: string }>;
}>;
type Refusal = Extract<PressAnswer, { ok: false }>;

const refuse = (line: string, code: ExitCode = exits.prerequisite): Refusal => ({ ok: false, line, code });

function refusalOf(error: unknown): Refusal {
  if (error instanceof HostError) return refuse(error.message, error.code);
  if (error instanceof TrackerError || error instanceof CodeHostError)
    return refuse(`press: ${error.text}`, exits.blocked);
  throw error;
}

async function unattended(main: string): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'false',
    GIT_ASKPASS: '',
    SSH_ASKPASS_REQUIRE: 'never',
  };
  if (env.GIT_SSH_COMMAND) return env;
  const configured = await run('git', ['config', '--get', 'core.sshCommand'], { cwd: main });
  if (configured.code > 1) throw new HostError(`press: ${configured.stderr.trimEnd()}`, exits.blocked);
  const command = configured.stdout.trim();
  if (command) return { ...env, GIT_SSH_COMMAND: `${command} -o BatchMode=yes` };
  return env.GIT_SSH ? env : { ...env, GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' };
}

const clients = ({ config, main }: PressIo, env: NodeJS.ProcessEnv) => services(config, main, undefined, env);

async function git(cwd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  const result = await run('git', args, { cwd, env });
  if (result.code !== 0) throw new HostError(`press: ${result.stderr.trimEnd()}`, exits.blocked);
  return result.stdout.trimEnd();
}

async function laneBranches(n: IssueKey, main: string): Promise<string[]> {
  const listed = await git(main, ['branch', '--list', '--format=%(refname:lstrip=2)', ...branchGlobs(n)]);
  return listed.split('\n').filter(Boolean);
}

function oneBranch(n: IssueKey, found: readonly string[]): string | Refusal {
  const [branch, ...others] = found;
  if (branch === undefined) return refuse(`press: no lane branch matches #${n}`);
  return others.length ? refuse(`press: several branches match #${n}: ${found.join(' ')}; keep one`) : branch;
}

async function record(tracker: Tracker, n: IssueKey, text: string, what: string): Promise<void> {
  try {
    await tracker.comment(n, text);
  } catch (error) {
    if (!(error instanceof TrackerError)) throw error;
    throw new HostError(
      error.refused
        ? `press: the tracker refused ${what} of #${n}, so nothing was written: ${error.text}`
        : `press: ${what} of #${n} can exist after this failure: ${error.text}; read the issue, then press again`,
      exits.blocked,
    );
  }
}

async function locked<T>(n: IssueKey, io: PressIo, work: () => Promise<T | Refusal>): Promise<T | Refusal> {
  const busy = io.busy(n);
  if (busy !== null) return refuse(busy);
  const name = landLock(n);
  let answer: T | Refusal;
  let cause: string | null = null;
  try {
    const holder = await io.owner.take(name);
    answer =
      holder === null
        ? await work()
        : refuse(`press: the lock ${name} has the owner PID ${holder}; wait until that landing ends, then press again`);
  } catch (error) {
    answer = refusalOf(error);
  } finally {
    cause = (await io.owner.release(name)) === null ? null : await io.owner.release(name);
  }
  return cause === null
    ? answer
    : refuse(
        `press: cannot release the lock ${name}: ${cause}; restart the daemon: celetis daemon stop, then celetis daemon start`,
        exits.blocked,
      );
}

async function release(
  { number: n, head, patch }: HeldPress,
  io: PressIo,
  env: NodeJS.ProcessEnv,
): Promise<string | Refusal> {
  const { main } = io;
  const { tracker, codeHost } = clients(io, env);
  const { data } = await tracker.read(n);
  const decision = decide(data);
  const { latest, held } = holdOf(data);
  if (
    decision.kind !== 'stop' ||
    (decision.reason !== 'held' && decision.reason !== 'released') ||
    latest === null ||
    latest.kind === 'refused'
  )
    return refuse(`press: #${n} is not held for a landing; read the board again`);
  const branch = oneBranch(n, await laneBranches(n, main));
  if (typeof branch !== 'string') return branch;
  const trunk = (await codeHost.repository()).defaultBranch;
  await git(main, ['fetch', '-q', 'origin', trunk], env);
  const base = await git(main, ['rev-parse', `origin/${trunk}`]);
  const tip = await git(main, ['rev-parse', `refs/heads/${branch}`]);
  const current = await patchId(await git(main, ['merge-base', base, tip]), tip, main);
  const differs = `press: the change of #${n} differs from the card; read the board, then press again`;
  if (head !== latest.head || patch !== latest.patch) return refuse(differs);
  if (latest.kind === 'held') {
    if (tip !== head || current !== patch) return refuse(differs);
  } else if (current !== patch || (await carriesRelease(head, base, tip, main)) === 'other')
    return refuse(
      `press: the content of ${branch} changed after the release of #${n}; run celetis --agent <host> land ${n} '<subject>' to hold the current content, then press Land again`,
    );
  if (held === null || !landingSubject(n, held.subject))
    return refuse(`press: the latest ${headings.held} of #${n} has no valid landing subject`);
  if (latest.kind === 'held') await record(tracker, n, releasedComment({ head, patch }), 'the release record');
  return held.subject;
}

export async function pressLand(press: HeldPress, io: PressIo): Promise<PressAnswer> {
  const { number: n } = press;
  const env = await unattended(io.main);
  const { tracker } = clients(io, env);
  const subject = await locked(n, io, () => tracker.synced('press', () => release(press, io, env)));
  if (typeof subject !== 'string') return subject;
  const landed = await io.land({ number: n, subject });
  if (landed.code === exits.done) return { ok: true };
  if (landed.code !== exits.repair && landed.code !== exits.checks) return refuse(landed.line, landed.code);
  try {
    await tracker.synced('press', async () => {
      await tracker.addLabels(n, ['ready-for-human']);
      await record(tracker, n, `${headings.landingRefused}\n${landed.line}`, 'the refusal record');
    });
  } catch (error) {
    return refuse(`${landed.line}; ${refusalOf(error).line}`, landed.code);
  }
  return refuse(landed.line, landed.code);
}

async function discard(n: IssueKey, io: PressIo, env: NodeJS.ProcessEnv): Promise<PressAnswer> {
  const { main } = io;
  const { tracker } = clients(io, env);
  const { data } = await tracker.read(n);
  const decision = decide(data);
  const reason = decision.kind === 'stop' ? decision.reason : null;
  if (reason !== 'held' && reason !== 'released' && reason !== 'wontfix')
    return refuse(`press: #${n} is not held; nothing was discarded`);
  const found = await laneBranches(n, main);
  if (reason === 'wontfix' && found.length === 0) return { ok: true };
  const branch = oneBranch(n, found);
  if (typeof branch !== 'string') return branch;
  const checkout = await checkoutOf(branch, main);
  if (checkout === main) return refuse(`press: switch the main checkout off ${branch} first`);
  if (checkout && (await git(checkout, ['status', '--porcelain'])))
    return refuse(`press: the lane worktree is dirty: ${checkout}; commit first`);
  if (data.state === 'open') {
    const head = await git(main, ['rev-parse', `refs/heads/${branch}`]);
    await git(main, ['push', 'origin', `refs/heads/${branch}:refs/heads/${branch}`], env);
    const text = `Discarded. The commits stay on the origin branch ${branch} at ${head}.`;
    if (!data.history.some((entry) => entry.kind === 'comment' && entry.body === text))
      await record(tracker, n, text, 'the discard comment');
    if (!data.labels.includes('wontfix')) await tracker.addLabels(n, ['wontfix']);
    await tracker.edit(n, { state: 'closed', state_reason: 'not_planned' });
  }
  const again = `run celetis --agent <host> worktree --remove ${n}`;
  try {
    const unpushed = await git(main, [
      'rev-list',
      '-n',
      '1',
      `refs/heads/${branch}`,
      '--not',
      `--exclude=origin/${prototypeGlob(n)}`,
      '--remotes=origin',
    ]);
    if (unpushed) return refuse(`press: ${branch} has commits that no origin branch contains; push it, then ${again}`);
    const refused = await removeLane(n, branch, checkout, main, undefined, env);
    if (refused.length > 0) return refuse(`press: ${refused.map(refusedDeletion).join('; ')}`, exits.blocked);
  } catch (error) {
    return refuse(
      `press: #${n} is closed, and the removal of ${branch} stopped: ${refusalOf(error).line}; ${again}`,
      exits.blocked,
    );
  }
  return { ok: true };
}

export async function pressDiscard(number: IssueKey, io: PressIo): Promise<PressAnswer> {
  const env = await unattended(io.main);
  return locked(number, io, () => clients(io, env).tracker.synced('press', () => discard(number, io, env)));
}

export async function landingResult(response: Response): Promise<{ code: ExitCode; line: string }> {
  const lost = (why: string) => ({
    code: exits.blocked,
    line: `land: blocked: the landing gave no status: ${why}; read the board, then press again`,
  });
  const reader = response.body?.getReader();
  if (!reader) return lost('the answer has no body');
  const decoder = new TextDecoder();
  let rest = '';
  let last = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return lost('the answer ended');
      rest += decoder.decode(value, { stream: true });
      const lines = rest.split('\n');
      rest = lines.pop() ?? '';
      for (const text of lines) {
        if (!text) continue;
        const entry = parseLandingRecord(text);
        if (entry === null) return lost('the daemon sent an invalid record');
        if ('code' in entry)
          return {
            code: entry.code,
            line: Buffer.from(last, 'latin1').toString('utf8') || `land: the landing ended with exit ${entry.code}`,
          };
        for (const line of ('out' in entry ? entry.out : entry.err).split('\n'))
          if (line.startsWith('land: ')) last = line;
      }
    }
  } catch (error) {
    return lost(error instanceof Error ? error.message : String(error));
  } finally {
    await reader.cancel().catch(() => {});
  }
}
