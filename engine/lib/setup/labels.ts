import type { Label } from '../contract/contract.ts';
import type { Tracker } from '../tracker/tracker.ts';

export const labelStyles = {
  'needs-triage': ['not yet classified', 'FBCA04'],
  bug: ["Something isn't working", 'd73a4a'],
  enhancement: ['New feature or request', 'a2eeef'],
  hotfix: ['production broken, the fix ships now', 'FEF2C0'],
  chore: ['zero-behavior-change edit', '006B75'],
  epic: ['parent of several feature sub-issues', '0052CC'],
  'needs-info': ['the report lacks what its lane needs; the questions are in a comment', 'FEF2C0'],
  'ready-for-agent': ['plan posted; no human hold; build completion is recorded in comments', 'D93F0B'],
  'ready-for-human': ['a step needs assistance before continuation', 'C2E0C6'],
  deferred: ['the maintainer put this issue off', 'D4C5F9'],
  wontfix: ['This will not be worked on', 'ffffff'],
  'hold-landing': ['the landing waits until the maintainer lands or discards the change', 'BFD4F2'],
} as const satisfies Record<Label, readonly [string, string]>;

export async function ensureLabel(tracker: Tracker, name: Label): Promise<void> {
  if ((await tracker.labels()).includes(name)) return;
  const [description, color] = labelStyles[name];
  await tracker.createLabel({ name, description, color });
}
