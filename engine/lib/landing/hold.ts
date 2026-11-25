import { HostError } from '../command/errors.ts';
import { type ExitClass, exits } from '../contract/contract.ts';
import { run } from '../process/process.ts';
import type { Services } from '../services/services.ts';
import { ensureLabel } from '../setup/labels.ts';
import type { IssueKey } from '../tracker/key.ts';
import { heldComment, holdApplies, holdOf } from '../workflow/hold.ts';
import { decide, keyedSubject, laneOf, subjectKey } from '../workflow/workflow.ts';
import { updateLane } from '../workflow/worktree.ts';

export type HoldGate = Readonly<{ kind: 'free' } | { kind: 'held' } | { kind: 'released'; patch: string }>;
export type ReleaseContent = 'same' | 'other' | 'conflict';
export type HoldContext = Readonly<{
  n: IssueKey;
  subject: string;
  main: string;
  trunk: string;
  branch: string;
  checkout: string;
  base: string;
  setting: boolean;
  signal: AbortSignal;
  git(args: string[], refusal?: readonly [ExitClass, string], at?: string): Promise<string>;
  gitRaw(args: string[], at?: string): Promise<{ code: number; stdout: string; stderr: string }>;
  tracked<T>(call: (services: Services) => Promise<T>, quiet?: boolean): Promise<T>;
  die(outcome: ExitClass, message: string): never;
}>;

const diffForm = [
  '--no-ext-diff',
  '--no-textconv',
  '--no-color',
  '--no-renames',
  '--full-index',
  '--unified=3',
  '--inter-hunk-context=0',
  '--diff-algorithm=myers',
  '--indent-heuristic',
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '--submodule=short',
  '--ignore-submodules=none',
  '--no-relative',
];

export async function patchId(base: string, target: string, cwd: string, signal?: AbortSignal): Promise<string> {
  const diff = await run('git', ['diff', ...diffForm, base, target], { cwd, signal, bytes: true });
  if (diff.code !== 0) throw new HostError(diff.stderr.trimEnd(), exits.blocked);
  // git patch-id ignores the rest of a line after a NUL, so the bytes reach it in an injective form with no NUL.
  const encoded = diff.stdout.replaceAll('\x01', '\x01\x02').replaceAll('\x00', '\x01\x03');
  const id = await run('git', ['patch-id', '--verbatim'], { cwd, signal, input: Buffer.from(encoded, 'latin1') });
  if (id.code !== 0) throw new HostError(id.stderr.trimEnd(), exits.blocked);
  const patch = id.stdout.split(' ', 1)[0]?.trim();
  if (!patch) throw new HostError(`git patch-id gave no id for ${base}..${target}`, exits.blocked);
  return patch;
}

async function mergedTree(base: string, target: string, cwd: string, signal?: AbortSignal): Promise<string | null> {
  const merge = await run('git', ['merge-tree', '--write-tree', base, target], { cwd, signal });
  if (merge.code > 1) throw new HostError(merge.stderr.trimEnd(), exits.blocked);
  return merge.code === 0 ? merge.stdout.trimEnd() : null;
}

export async function carriesRelease(
  head: string,
  base: string,
  tip: string,
  cwd: string,
  signal?: AbortSignal,
): Promise<ReleaseContent> {
  if (tip === head) return 'same';
  const known = await run('git', ['rev-parse', '--verify', '-q', `${head}^{commit}`], { cwd, signal });
  if (known.code === 1) return 'other';
  if (known.code !== 0) throw new HostError(known.stderr.trimEnd(), exits.blocked);
  const released = await mergedTree(base, head, cwd, signal);
  const current = await mergedTree(base, tip, cwd, signal);
  if (released === null || current === null) return 'conflict';
  return released === current ? 'same' : 'other';
}

export async function holdGate(context: HoldContext): Promise<HoldGate> {
  const { n, subject, main, trunk, branch, checkout, base, setting, signal, git, gitRaw, tracked, die } = context;
  const { data } = await tracked(({ tracker }) => tracker.read(n));
  const decision = decide(data);
  const gated =
    decision.kind === 'run'
      ? decision.step === 'implement' && decision.state === 'built'
      : decision.reason === 'held' || decision.reason === 'released';
  const found = laneOf(data.labels);
  if (!gated || found.kind !== 'lane' || !holdApplies(data, found.lane, setting)) return { kind: 'free' };

  const tip = await git(['rev-parse', `refs/heads/${branch}`]);
  const merged = await mergedTree(base, tip, main, signal);
  if (merged === (await git(['rev-parse', `${base}^{tree}`]))) {
    const key = keyedSubject('', n).trimStart();
    const subjects = await git(['log', '--format=%s', '--fixed-strings', `--grep=${key}`, `origin/${trunk}`]);
    if (subjects.split('\n').some((line) => subjectKey(line) === n)) return { kind: 'free' };
    return die('repair', `${branch} has no net change against ${trunk}; commit the change or discard #${n}`);
  }

  const patch = await patchId(await git(['merge-base', base, tip]), tip, main, signal);
  const { latest } = holdOf(data);
  const content: ReleaseContent =
    latest?.kind === 'released' && latest.patch === patch
      ? await carriesRelease(latest.head, base, tip, main, signal)
      : 'other';
  const refusal = `merge origin/${trunk} into ${branch}, run the verify gate of the project again, then land again`;
  if (content === 'conflict') return die('repair', `the released change of #${n} conflicts with ${trunk}; ${refusal}`);
  if (content === 'other') {
    await tracked(async ({ tracker }) => {
      if (!data.labels.includes('hold-landing')) {
        await ensureLabel(tracker, 'hold-landing');
        await tracker.addLabels(n, ['hold-landing']);
      }
      if (latest?.kind !== 'held' || latest.head !== tip || latest.patch !== patch)
        await tracker.comment(n, heldComment({ head: tip, patch, subject }));
    });
    console.log(`land: #${n} is held; nothing landed`);
    return { kind: 'held' };
  }

  const contained = await gitRaw(['merge-base', '--is-ancestor', base, tip]);
  if (contained.code > 1) throw new HostError(contained.stderr.trimEnd(), exits.blocked);
  if (contained.code === 0) return { kind: 'released', patch };

  if (merged === null) return die('repair', `the released change of #${n} conflicts with ${trunk}; ${refusal}`);
  if ((await patchId(base, merged, main, signal)) !== patch)
    return die('repair', `the merge with ${trunk} changes the released content of #${n}; ${refusal}`);
  if (!checkout) return die('repair', `the lane worktree of ${branch} is missing`);
  try {
    await updateLane(checkout, branch, trunk, n);
  } catch (error) {
    if (error instanceof HostError && error.code === exits.repair) die('repair', error.message);
    throw error;
  }
  return { kind: 'released', patch };
}
