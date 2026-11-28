import { z } from 'zod';
import type { Host } from '../host/names.ts';
import type { Terminal } from '../terminal/types.ts';

export type CoordinatorState = 'none' | 'starting' | 'dialog' | 'works' | 'turn-ended';
export type CoordinatorAction = 'open' | 'say' | 'key' | 'interrupt' | 'end' | 'go';
export const coordinatorKeys = ['up', 'down', 'enter', 'esc', '1', '2', '3'] as const;
export type CoordinatorKey = (typeof coordinatorKeys)[number];
export const coordinatorAct = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('say'), text: z.string() }),
  z.strictObject({ kind: z.literal('key'), key: z.enum(coordinatorKeys) }),
  z.strictObject({ kind: z.literal('interrupt') }),
  z.strictObject({ kind: z.literal('end') }),
]);
export type CoordinatorAct = z.output<typeof coordinatorAct>;
export type CoordinatorFacts = Readonly<{ host: Host; terminal: string; session: string | null; prompt: string }>;
export const permittedActions: Readonly<Record<CoordinatorState, readonly CoordinatorAction[]>> = {
  none: ['open'],
  starting: ['go'],
  dialog: ['key', 'go'],
  works: ['say', 'interrupt', 'go'],
  'turn-ended': ['say', 'end', 'go'],
};

export function coordinatorStateOf(terminal: Pick<Terminal, 'status'> | null): Exclude<CoordinatorState, 'none'> {
  if (terminal?.status === 'blocked') return 'dialog';
  if (terminal?.status === 'working') return 'works';
  return terminal?.status ? 'turn-ended' : 'starting';
}
