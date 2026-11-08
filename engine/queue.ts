import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type ExitCode, exits, usage } from './lib/contract.ts';
import type { QueueAction, QueueRecord } from './lib/queue-types.ts';

type Status = { command: 'status' };
type QueueShape = Status | { command: 'action'; json: string };
type QueueForm = Status | { command: 'action'; action: QueueAction };

const removed = 'the program version of this command was removed after an update; run the command again';
const here = import.meta.dir;
async function gone(files: string[]) {
  for (const file of files) if (!(await stat(join(here, file)).catch(() => null))?.isFile()) return true;
  return false;
}

function shapeOf(argv: string[]): QueueShape | null {
  const [command, ...rest] = argv;
  if (command === 'status' && rest.length === 0) return { command };
  if (command === 'action' && rest.length === 1) return { command, json: rest[0] as string };
  return null;
}

export async function main(argv: string[]): Promise<ExitCode> {
  const unavailable = await gone([
    'daemon.ts',
    'lib/agent-order.ts',
    'lib/config-core.ts',
    'lib/config.ts',
    'lib/daemon-client.ts',
    'lib/daemon-types.ts',
    'lib/effort.ts',
    'lib/epic-acceptance.ts',
    'lib/events.ts',
    'lib/host.ts',
    'lib/lines.ts',
    'lib/locks.ts',
    'lib/operation.ts',
    'lib/plugin-metadata.ts',
    'lib/process-identity.ts',
    'lib/process.ts',
    'lib/program.ts',
    'lib/queue-actions.ts',
    'lib/queue.ts',
    'lib/quota-recovery.ts',
    'lib/refresh-hints.ts',
    'lib/resolver.ts',
    'lib/session.ts',
    'lib/state-migration.ts',
    'lib/state-move.ts',
    'lib/state-preparation.ts',
    'lib/state.ts',
    'lib/terminal.ts',
    'lib/tracker.ts',
    'lib/update-lock.ts',
    'lib/vendor/yaml.mjs',
    'lib/windows.ts',
    'lib/workflow.ts',
  ]);
  if (!unavailable) (await import('./lib/events.ts')).installRecorder('queue');
  let explicit: string | undefined;
  if (!unavailable) {
    try {
      const input = (await import('./lib/operation.ts')).commandInput(argv);
      argv = input.args;
      explicit = input.explicit;
    } catch (error) {
      const { HostError } = await import('./lib/host.ts');
      if (!(error instanceof HostError)) throw error;
      if (error.message) console.error(error.message);
      return error.code;
    }
  } else if (argv[0] === '--agent') argv = argv.slice(2);
  const quiet = argv.includes('--quiet');
  if (quiet) argv = argv.toSpliced(argv.indexOf('--quiet'), 1);
  const shape = shapeOf(argv);
  if (shape === null) {
    console.error(usage('queue'));
    return exits.usage;
  }
  if (unavailable) {
    console.error(`queue: ${removed}`);
    return exits.prerequisite;
  }
  let form: QueueForm;
  try {
    const { parseQueueAction } = await import('./lib/queue.ts');
    form = 'json' in shape ? { command: shape.command, action: parseQueueAction(JSON.parse(shape.json)) } : shape;
  } catch {
    console.error(usage('queue'));
    return exits.usage;
  }
  const { markDefect } = await import('./lib/events.ts');
  const { HostError, requireBun } = await import('./lib/host.ts');
  const { requestSelection, requireDaemon, sendRun } = await import('./lib/daemon-client.ts');
  const { createOperation, locateCheckouts } = await import('./lib/operation.ts');
  const { queueSelection, readQueue, readQueueView } = await import('./lib/queue.ts');
  const { admitQueue } = await import('./lib/queue-actions.ts');
  try {
    requireBun();
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null)
      throw new HostError('celetis: need a Git checkout', exits.usage);
    const { main, common } = checkout;
    const requested = requestSelection(explicit);
    const queue = await readQueue(main, common);
    const use = form.command === 'status' ? 'read' : form.action.kind === 'add' ? 'add' : 'act';
    const operation = await createOperation(
      checkout,
      queueSelection(queue, use, { explicit, environment: process.env.CELETIS_AGENT }),
      'main',
    );
    const subject = (record: QueueRecord | null) =>
      record?.numbers[0] === undefined ? 'queue' : `#${record.numbers[0]}`;
    if (form.command === 'status') {
      console.log(JSON.stringify(await readQueueView(operation)));
      return exits.done;
    }
    const { action } = form;
    if (action.kind === 'continue' || action.kind === 'retry' || (action.kind === 'add' && !queue?.numbers.length))
      await requireDaemon(common, 'queue');
    const receipt = await admitQueue(operation, action);
    console.log(JSON.stringify(receipt.view));
    if (!receipt.wake) return exits.done;
    return await sendRun(
      common,
      { kind: 'queue', id: receipt.wake.id, token: receipt.wake.token, selection: requested, quiet },
      'queue',
      subject(receipt.view.record),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (reason) console.error(reason);
    markDefect(error);
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
