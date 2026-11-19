import { dirname } from 'node:path';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { versionFolderGone } from './lib/install/version-folder.ts';
import type { QueueAction, QueueRecord } from './lib/queue/types.ts';

type Status = { command: 'status' };
type QueueShape = Status | { command: 'action'; json: string };
type QueueForm = Status | { command: 'action'; action: QueueAction };

const removed = 'the engine version of this command was removed after an update; run the command again';

function shapeOf(argv: string[]): QueueShape | null {
  const [command, ...rest] = argv;
  if (command === 'status' && rest.length === 0) return { command };
  if (command === 'action' && rest.length === 1) return { command, json: rest[0] as string };
  return null;
}

export async function main(argv: string[]): Promise<ExitCode> {
  const unavailable = await versionFolderGone(dirname(import.meta.dir));
  if (!unavailable) (await import('./lib/state/events.ts')).installRecorder('queue');
  let explicit: string | undefined;
  if (!unavailable) {
    try {
      const input = (await import('./lib/command/operation.ts')).commandInput(argv);
      argv = input.args;
      explicit = input.explicit;
    } catch (error) {
      const { HostError } = await import('./lib/command/errors.ts');
      if (!(error instanceof HostError)) throw error;
      if (error.message) console.error(error.message);
      return error.code;
    }
  } else if (argv[0] === '--agent') argv = argv.slice(2);
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
    const { parseQueueAction } = await import('./lib/queue/queue.ts');
    form = 'json' in shape ? { command: shape.command, action: parseQueueAction(JSON.parse(shape.json)) } : shape;
  } catch {
    console.error(usage('queue'));
    return exits.usage;
  }
  const { markDefect } = await import('./lib/state/events.ts');
  const { HostError } = await import('./lib/command/errors.ts');
  const { requireBun } = await import('./lib/host/host.ts');
  const { requestSelection, requireDaemon, sendRun } = await import('./lib/daemon/client.ts');
  const { createOperation, locateCheckouts } = await import('./lib/command/operation.ts');
  const { queueSelection, readQueue, readQueueView } = await import('./lib/queue/queue.ts');
  const { admitQueue } = await import('./lib/queue/actions.ts');
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
      { kind: 'queue', id: receipt.wake.id, token: receipt.wake.token, selection: requested },
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
