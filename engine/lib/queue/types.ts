import { z } from 'zod';
import type { AgentChoice } from '../config/core.ts';
import { hosts } from '../host/names.ts';
import type { Next } from '../resolver/lines.ts';
import { code, count, issueKey, members, uuidText } from '../state/schemas.ts';
import { type Lane, lanes, type Run, type RunState, type Stop, steps } from '../workflow/workflow.ts';

const step = z.enum(steps);
const host = z.enum(hosts);
const laneNames = z.enum(Object.keys(lanes) as Lane[]);
const runStates: Record<RunState, true> = {
  unrouted: true,
  unspecified: true,
  undiagnosed: true,
  chore: true,
  hotfix: true,
  defined: true,
  planned: true,
  built: true,
};

const run: z.ZodType<Run> = z.strictObject({
  kind: z.literal('run'),
  step,
  lane: laneNames.nullable(),
  state: members(runStates),
});

export const agentChoice: z.ZodType<AgentChoice> = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('default') }),
  z.strictObject({ kind: z.literal('explicit'), host }),
]);

export const sameChoice = (a: AgentChoice, b: AgentChoice) =>
  a.kind === b.kind && (a.kind === 'default' || (b.kind === 'explicit' && a.host === b.host));

type Plain = Extract<Stop, { reason: 'wontfix' }>['reason'];
type Variant<R extends Stop['reason']> = Extract<Stop, { reason: R; variant: string }>['variant'];
const plainReasons: Record<Plain, true> = {
  wontfix: true,
  finished: true,
  deferred: true,
  'needs-info': true,
  epic: true,
  'land-by-hand': true,
  held: true,
  released: true,
};
const readyVariants: Record<Variant<'ready-for-human'>, true> = { 'landing-refused': true, 'your-step': true };
const humanVariants: Record<Variant<'human-step'>, true> = { evidence: true, report: true, removal: true };

const next: z.ZodType<Next> = z.union([
  run,
  z.strictObject({ kind: z.literal('observed'), reason: z.literal('dirty'), path: z.string() }),
  z.strictObject({ kind: z.literal('observed'), reason: z.enum(['landing', 'unreadable']) }),
  z.strictObject({ kind: z.literal('stop'), reason: members(plainReasons) }),
  z.strictObject({ kind: z.literal('stop'), reason: z.literal('ready-for-human'), variant: members(readyVariants) }),
  z.strictObject({ kind: z.literal('stop'), reason: z.literal('human-step'), variant: members(humanVariants) }),
  z.strictObject({ kind: z.literal('stop'), reason: z.literal('several-lanes'), labels: z.array(z.string()) }),
]);

export const queueExpected = z
  .strictObject({ id: uuidText.nullable(), revision: code, current: issueKey.nullable() })
  .refine((value) => (value.id === null ? value.revision === 0 && value.current === null : value.revision > 0));

export const queueAction = z.discriminatedUnion('kind', [
  z.strictObject({ expected: queueExpected, kind: z.literal('add'), number: issueKey, step }),
  z.strictObject({
    expected: queueExpected,
    kind: z.literal('move'),
    number: issueKey,
    direction: z.enum(['up', 'down']),
  }),
  z.strictObject({ expected: queueExpected, kind: z.literal('remove'), number: issueKey }),
  z.strictObject({ expected: queueExpected, kind: z.literal('continue'), step }),
  z.strictObject({ expected: queueExpected, kind: z.literal('retry'), step: step.nullable() }),
]);

type State = 'empty' | 'starting' | 'running' | 'quota-wait' | 'me-gate' | 'error';
const states: Record<State, true> = {
  empty: true,
  starting: true,
  running: true,
  'quota-wait': true,
  'me-gate': true,
  error: true,
};

const authorizationOf = <T extends z.ZodType>(item: T) =>
  z
    .strictObject({ number: item, step: step.nullable(), retry: z.boolean() })
    .refine((value) => value.step !== null || value.retry);

const recordFields = <T extends z.ZodType>(item: T) => ({
  id: uuidText,
  revision: count,
  choice: agentChoice.nullable(),
  activeHost: host.nullable(),
  numbers: z.array(item).refine((numbers) => new Set(numbers).size === numbers.length),
  state: members(states),
  waitId: uuidText.nullable(),
  current: run.nullable(),
  last: run.nullable(),
  reason: z.string().nullable(),
  act: z.string().nullable(),
  launch: z.strictObject({ token: uuidText, authorization: authorizationOf(item).nullable() }).nullable(),
});

type Invariant = {
  state: State;
  numbers: readonly unknown[];
  choice: unknown;
  activeHost: unknown;
  waitId: unknown;
  current: unknown;
  last: unknown;
  reason: unknown;
  act: unknown;
  launch: { authorization: { number: unknown } | null } | null;
};

const invariant = (value: Invariant) =>
  value.state === 'empty'
    ? !value.numbers.length &&
      [
        value.choice,
        value.activeHost,
        value.waitId,
        value.current,
        value.last,
        value.reason,
        value.act,
        value.launch,
      ].every((item) => item === null)
    : value.numbers.length > 0 &&
      value.choice !== null &&
      (value.state === 'quota-wait' ? value.waitId !== null && value.activeHost === null : value.waitId === null) &&
      (value.state === 'starting') === (value.launch !== null) &&
      (value.state !== 'me-gate' || value.current !== null) &&
      (value.launch?.authorization == null || value.launch.authorization.number === value.numbers[0]);

export const queueRecord = z.strictObject({ schema: z.literal(4), ...recordFields(issueKey) }).refine(invariant);
export const queueRecordSchema3 = z.strictObject({ schema: z.literal(3), ...recordFields(count) }).refine(invariant);

const queueActions = z.strictObject({ add: z.boolean(), edit: z.boolean(), continue: z.boolean(), retry: z.boolean() });

export const queueView = z.strictObject({
  record: queueRecord.nullable(),
  owner: z.string().nullable(),
  next: next.nullable(),
  error: z.string().nullable(),
  actions: queueActions,
});

export const queueWake = z.strictObject({ id: uuidText, token: uuidText, choice: agentChoice });

export const queueReceipt = z
  .strictObject({ view: queueView, wake: queueWake.nullable() })
  .refine(
    ({ view: { record }, wake }) =>
      wake === null ||
      (record?.launch != null &&
        record.choice !== null &&
        wake.id === record.id &&
        wake.token === record.launch.token &&
        sameChoice(wake.choice, record.choice)),
  );

export type QueueExpected = z.output<typeof queueExpected>;
export type QueueAction = z.output<typeof queueAction>;
export type QueueRecord = z.output<typeof queueRecord>;
export type QueueView = z.output<typeof queueView>;
export type QueueWake = z.output<typeof queueWake>;
export type QueueReceipt = z.output<typeof queueReceipt>;
