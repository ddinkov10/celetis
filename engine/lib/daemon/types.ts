import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { HostError } from '../command/errors.ts';
import { type ExitCode, exitCodeOf, exits, passThrough } from '../contract/contract.ts';
import { hosts } from '../host/names.ts';
import type { ProcessState } from '../process/identity.ts';
import { queueAction, queueView } from '../queue/types.ts';
import type { RunInput, RunState } from '../run/engine.ts';
import { commit } from '../state/fields.ts';
import { bounded, code, count, issueKey, members, uuidText } from '../state/schemas.ts';
import { daemonSocketPath, type RepositoryLayout, repositoryLayout } from '../state/state.ts';
import { isSafeId } from '../terminal/terminal.ts';
import type { DialogKind } from '../terminal/types.ts';
import type { IssueKey } from '../tracker/key.ts';
import { levels, models } from '../workflow/effort.ts';
import { keyedSubject, sessionWorks } from '../workflow/workflow.ts';

export const textLimit = 4096;
export const stopLine = 'daemon: the daemon stops; start it again, then send the request';
export const stopKeptLine = (key: IssueKey) => `#${key}: the tab did not close; the run goes on`;
export const unprovedStopAct =
  'End those processes, then restart the daemon: celetis daemon stop, then celetis daemon start.';
export const codexStopLine = 'The daemon cannot prove the end of a Codex session. Close its tab, then use Set aside.';
export const requestUsage =
  'usage: GET /status | POST /run {"number":<issue>,"selection":<selection>,"effort":<level>|null,"model":<model>|null} | POST /auto {"on":<boolean>,"selection":<selection>} | POST /queue {"id":<uuid>,"token":<uuid>,"selection":<selection>} | POST /resume {"number":<issue>,"selection":<selection>} | POST /assist {"number":<issue>,"selection":<selection>} | POST /stop {} | POST /retry {"number":<issue>,"waitId":<text>} | POST /aside {"number":<issue>} | POST /halt {"number":<issue>,"terminal":<id>} | POST /queue/action {"action":<action>,"selection":<selection>} | POST /queue/reconcile {} | POST /land {"number":<issue>,"subject":<subject>,"selection":<selection>,"from":<path>} | POST /coordinator/open {"selection":<selection>} | POST /coordinator/read {"number":<issue>} | POST /coordinator/send {"number":<issue>,"authority":"maintainer"|"coordinator","text":<text>,"token":<uuid>} | POST /coordinator/end-assist {"number":<issue>,"token":<uuid>}; <selection> is {"explicit"?:"claude"|"codex"|"opencode","environment"?:<text>}; <level> is low|medium|high|xhigh|max; <model> is haiku|sonnet|opus|fable; <action> is a queue action of celetis queue action';

const text = bounded(textLimit);
const filled = text.refine((value) => value.length > 0);
const absolute = filled.refine(isAbsolute);
const exitCode = z.custom<ExitCode>((value) => exitCodeOf(value) !== null);
const latin1 = z.string().refine((value) => Buffer.from(value, 'latin1').toString('latin1') === value);

const authorities: Record<'maintainer' | 'coordinator', true> = { maintainer: true, coordinator: true };
const authority = members(authorities);
const selection = z.strictObject({ explicit: z.enum(hosts).optional(), environment: text.optional() });

const routed = <K extends string, T extends object>(kind: K, body: z.ZodType<T>) =>
  body.transform((value) => ({ kind, ...value }));

const bodies = {
  run: routed(
    'run',
    z.strictObject({
      number: issueKey,
      selection,
      effort: z.enum(levels).nullable(),
      model: z.enum(models).nullable(),
    }),
  ),
  auto: routed('auto', z.strictObject({ on: z.boolean(), selection })),
  queue: routed('queue', z.strictObject({ id: uuidText, token: uuidText, selection })),
  resume: routed('resume', z.strictObject({ number: issueKey, selection })),
  assist: routed('assist', z.strictObject({ number: issueKey, selection })),
  retry: routed('retry', z.strictObject({ number: issueKey, waitId: filled })),
  aside: routed('aside', z.strictObject({ number: issueKey })),
  halt: routed('halt', z.strictObject({ number: issueKey, terminal: z.string().refine(isSafeId) })),
  stop: z.strictObject({}).transform(() => ({ kind: 'stop' as const })),
  'queue-action': routed('queue-action', z.strictObject({ action: queueAction, selection })),
  'queue-reconcile': z.strictObject({}).transform(() => ({ kind: 'queue-reconcile' as const })),
  land: routed(
    'land',
    z
      .strictObject({ number: issueKey, subject: z.string(), selection, from: absolute })
      .refine(({ number, subject }) => landingSubject(number, subject)),
  ),
  'coordinator-open': routed('coordinator-open', z.strictObject({ selection })),
  'coordinator-read': routed('coordinator-read', z.strictObject({ number: issueKey })),
  'coordinator-send': routed(
    'coordinator-send',
    z.strictObject({ number: issueKey, authority, text: z.string(), token: uuidText }),
  ),
  'coordinator-end-assist': routed('coordinator-end-assist', z.strictObject({ number: issueKey, token: uuidText })),
};

const refusal = z.strictObject({ accepted: z.literal(false), line: text, code: exitCode });
const daemonAnswer = z.union([z.strictObject({ accepted: z.literal(true), run: uuidText.nullable() }), refusal]);
const coordinatorAnswer = z.union([z.strictObject({ accepted: z.literal(true), opened: z.boolean() }), refusal]);
const screenAnswer = z.union([
  z.strictObject({ accepted: z.literal(true), text: z.string(), complete: z.boolean(), why: text.nullable() }),
  refusal,
]);
const queueAnswer = z.union([
  z.strictObject({ accepted: z.literal(true), run: uuidText.nullable(), view: queueView }),
  refusal,
]);
const landingRecord = z.union([
  z.strictObject({ out: latin1 }),
  z.strictObject({ err: latin1 }),
  z.strictObject({ code: exitCode }),
]);

const daemonIdentity = z.strictObject({
  schema: z.literal(1),
  pid: count,
  start: filled,
  revision: z.string().regex(commit),
  main: absolute,
  common: absolute,
  socket: absolute,
});

const kinds: Record<RunInput['kind'], true> = { number: true, auto: true, queue: true, resume: true, assist: true };
const states: Record<RunState, true> = {
  starting: true,
  running: true,
  checking: true,
  waiting: true,
  exiting: true,
  'quota-wait': true,
  stopping: true,
  ending: true,
  'taken-over': true,
  finished: true,
};
const reads: Record<ProcessState, true> = { runs: true, gone: true, unknown: true };
const ends: Record<'closed' | 'gate' | 'stopped', true> = { closed: true, gate: true, stopped: true };
const attentions: Record<'dialog' | 'turn-ended' | 'quota-wait', true> = {
  dialog: true,
  'turn-ended': true,
  'quota-wait': true,
};
const dialogs: Record<DialogKind, true> = { permission: true, question: true, auth: true };
const autos: Record<'on' | 'off' | 'stopping', true> = { on: true, off: true, stopping: true };
const boardUrl = /^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/;

const attention = z.strictObject({ state: members(attentions), kind: members(dialogs).nullable(), changedMs: code });
const runRow = z.strictObject({
  id: uuidText,
  kind: members(kinds),
  issue: issueKey.nullable(),
  numbers: z.array(issueKey).nullable(),
  step: z.enum(sessionWorks).nullable(),
  host: z.enum(hosts).nullable(),
  tab: text.nullable(),
  terminal: text.nullable(),
  state: members(states),
  line: text.nullable(),
  changedMs: code,
  session: members(reads).nullable(),
  attention: attention.nullable(),
  outcome: z.strictObject({ kind: members(ends), reason: text, code: code.transform(passThrough) }).nullable(),
});
const landingRow = z.strictObject({ issue: issueKey, state: z.enum(['runs', 'waits']), changedMs: code });
const daemonStatus = z.strictObject({
  schema: z.literal(1),
  daemon: daemonIdentity,
  board: z.string().regex(boardUrl),
  auto: members(autos),
  runs: z.array(runRow),
  landings: z.array(landingRow),
  coordinator: z.boolean(),
});
const statusShape = daemonStatus.extend({
  daemon: z.unknown(),
  runs: z.array(z.unknown()),
  landings: z.array(z.unknown()),
});

export type Selection = z.output<typeof selection>;
export type Authority = z.output<typeof authority>;
export type DaemonRequest = { kind: 'status' } | z.output<(typeof bodies)[keyof typeof bodies]>;
export type LandingRecord = z.output<typeof landingRecord>;
export type DaemonAnswer = z.output<typeof daemonAnswer>;
export type CoordinatorAnswer = z.output<typeof coordinatorAnswer>;
export type ScreenAnswer = z.output<typeof screenAnswer>;
export type QueueAnswer = z.output<typeof queueAnswer>;
export type DaemonIdentity = z.output<typeof daemonIdentity>;
export type Attention = z.output<typeof attention>;
export type RunRow = z.output<typeof runRow>;
export type LandingRow = z.output<typeof landingRow>;
export type DaemonStatus = z.output<typeof daemonStatus>;

export const requestPaths: Readonly<Record<Exclude<DaemonRequest['kind'], 'status'>, string>> = {
  run: '/run',
  auto: '/auto',
  queue: '/queue',
  resume: '/resume',
  assist: '/assist',
  retry: '/retry',
  aside: '/aside',
  halt: '/halt',
  stop: '/stop',
  'queue-action': '/queue/action',
  'queue-reconcile': '/queue/reconcile',
  land: '/land',
  'coordinator-open': '/coordinator/open',
  'coordinator-read': '/coordinator/read',
  'coordinator-send': '/coordinator/send',
  'coordinator-end-assist': '/coordinator/end-assist',
};
const routes: Readonly<Record<string, 'GET' | 'POST'>> = Object.fromEntries([
  ['/status', 'GET'],
  ...Object.values(requestPaths).map((path) => [path, 'POST']),
]);
const bodyAt = new Map<string, z.ZodType<DaemonRequest>>(
  Object.entries(requestPaths).map(([kind, path]) => [path, bodies[kind as keyof typeof bodies]]),
);

export const isAuthority = (value: unknown): value is Authority => authority.safeParse(value).success;

export function landingSubject(key: IssueKey, subject: string): boolean {
  return (
    /^[a-z]+(\([^()]+\))?!?: [^ ]/.test(subject) &&
    !subject.includes('\n') &&
    !subject.endsWith(keyedSubject('', key).trimStart())
  );
}

export function daemonSocket(common: string): string {
  const socket = daemonSocketPath(common);
  const bytes = Buffer.byteLength(socket);
  if (bytes >= 104)
    throw new HostError(
      `daemon: the socket path ${socket} has ${bytes} bytes; a socket path needs fewer than 104`,
      exits.prerequisite,
    );
  return socket;
}

export async function daemonPaths(common: string): Promise<{
  layout: RepositoryLayout;
  identity: string;
  log: string;
  socket: string;
}> {
  const socket = daemonSocket(common);
  const layout = repositoryLayout(common);
  return { layout, identity: layout.daemonIdentity, log: layout.daemonLog, socket };
}

export function parseRequest(
  method: string,
  path: string,
  body: unknown,
): DaemonRequest | { status: 400 | 404 | 405; line: string } {
  if (!Object.hasOwn(routes, path)) return { status: 404, line: `daemon: no request at ${path.slice(0, 200)}` };
  const wanted = routes[path];
  if (method !== wanted) return { status: 405, line: `daemon: ${path} takes ${wanted}` };
  if (path === '/status') return { kind: 'status' };
  const parsed = bodyAt.get(path)?.safeParse(body);
  return parsed?.success ? parsed.data : { status: 400, line: requestUsage };
}

function checked<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HostError(`daemon: the daemon sent an invalid ${what}`, exits.blocked);
  return parsed.data;
}

export function parseAnswer(value: unknown): DaemonAnswer {
  return checked(daemonAnswer, value, 'answer');
}

export function parseQueueAnswer(value: unknown): QueueAnswer {
  return checked(queueAnswer, value, 'answer');
}

export function parseCoordinatorAnswer(value: unknown): CoordinatorAnswer {
  return checked(coordinatorAnswer, value, 'answer');
}

export function parseScreenAnswer(value: unknown): ScreenAnswer {
  return checked(screenAnswer, value, 'answer');
}

export function parseIdentity(value: unknown): DaemonIdentity {
  return checked(daemonIdentity, value, 'identity');
}

export function parseLandingRecord(line: string): LandingRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  const parsed = landingRecord.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseStatus(value: unknown): DaemonStatus {
  const top = checked(statusShape, value, 'status');
  return {
    ...top,
    daemon: parseIdentity(top.daemon),
    runs: top.runs.map((row) => checked(runRow, row, 'run')),
    landings: top.landings.map((row) => checked(landingRow, row, 'landing')),
  };
}
