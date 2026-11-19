import { command, type Decision, type Stop } from '../workflow/workflow.ts';

export type Observed = Readonly<
  | { kind: 'observed'; reason: 'dirty'; path: string }
  | { kind: 'observed'; reason: 'landing' }
  | { kind: 'observed'; reason: 'unreadable' }
>;
export type Next = Decision | Observed;
type Described = {
  line: string;
  row: { state: 'ready' | 'blocked' | 'done'; reason: string | null; act: string | null } | null;
};

function describeObserved(n: string, next: Observed): Described {
  switch (next.reason) {
    case 'dirty':
      return { line: `stop the working tree is dirty: ${next.path}; commit or stash first`, row: null };
    case 'landing':
      return {
        line: `stop the landing of #${n} runs; wait until celetis --agent <host> land ends`,
        row: null,
      };
    case 'unreadable':
      return { line: `stop cannot read #${n} from GitHub`, row: null };
  }
}

const humanStepActs = {
  evidence:
    'Add ready-for-human, do the act of the latest ## Before landing comment, report it in a ## Human steps done comment, then remove the label.',
  report: 'Post a ## Human steps done comment that reports each act of the latest ## Before landing comment.',
  removal: 'Add ready-for-human, then remove it: the removal confirms the ## Human steps done report.',
} as const;

function describeStop(n: string, next: Stop): Described {
  const blocked = (head: string, reason: string, act: string): Described => ({
    line: `stop #${n} ${head}. ${act}`,
    row: { state: 'blocked', reason, act },
  });
  switch (next.reason) {
    case 'wontfix':
      return { line: `stop #${n} is closed as wontfix.`, row: null };
    case 'finished':
      return { line: `stop #${n} is finished.`, row: { state: 'done', reason: null, act: null } };
    case 'needs-info':
      return blocked('needs info', 'needs info', 'Answer the questions on the issue, then remove the label.');
    case 'ready-for-human':
      return blocked(
        'is ready-for-human',
        next.variant === 'landing-refused' ? 'landing refused' : 'ready for your step',
        'Do the human step (e.g. the hotfix ship checklist), then remove the label.',
      );
    case 'human-step':
      return blocked('has an open human step', 'human step open', humanStepActs[next.variant]);
    case 'land-by-hand':
      return blocked(
        'waits for a landing by hand',
        'land by hand',
        `Run celetis --agent <host> land ${n} '<subject>' in your own shell, from the main checkout.`,
      );
    case 'epic':
      return { line: `stop #${n} is an epic. Each child runs its own flow.`, row: null };
    case 'several-lanes':
      return blocked(
        `has several lane labels (${next.labels.join(' ')})`,
        'several lane labels',
        'Keep one lane label and remove the others.',
      );
  }
}

export function describe(n: string, next: Next): Described {
  switch (next.kind) {
    case 'run':
      return {
        line: `run /celetis:${command(next.step)} #${n}`,
        row: { state: 'ready', reason: null, act: null },
      };
    case 'observed':
      return describeObserved(n, next);
    case 'stop':
      return describeStop(n, next);
  }
}

export function lineOf(n: string, next: Next): string {
  return describe(n, next).line;
}
