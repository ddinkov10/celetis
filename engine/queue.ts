import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { HostSelection } from './lib/operation.ts';
import type { QueueAction, QueueRecord } from './lib/queue-types.ts';

type Status = { command: 'status' };
type Wake = { command: 'wake'; id: string; token: string };
type QueueShape = Status | Wake | { command: 'action' | 'admit'; json: string };
type QueueForm = Status | Wake | { command: 'action' | 'admit'; action: QueueAction };

const usage =
  "usage: celetis --agent <host> queue action '<QueueAction JSON>' | queue status; an action with a wake sends one request to the master daemon of this repository and returns";
const removed = 'the program version of this command was removed after an update; run the command again';
const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const here = import.meta.dir;
async function gone(files: string[]) {
  for (const file of files) if (!(await stat(join(here, file)).catch(() => null))?.isFile()) return true;
  return false;
}

function shapeOf(argv: string[]): QueueShape | null {
  const [command, ...rest] = argv;
  if (command === 'status' && rest.length === 0) return { command };
  if ((command === 'action' || command === 'admit') && rest.length === 1) return { command, json: rest[0] as string };
  if (command === 'wake' && rest.length === 2 && rest.every((value) => uuid.test(value)))
    return { command, id: rest[0] as string, token: rest[1] as string };
  return null;
}

export async function main(argv: string[]): Promise<number> {
  const unavailable = await gone([
    'daemon.ts',
    'next-step.ts',
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
    'lib/private-folder.ts',
    'lib/process-identity.ts',
    'lib/process.ts',
    'lib/program.ts',
    'lib/queue-actions.ts',
    'lib/queue.ts',
    'lib/quota-recovery.ts',
    'lib/refresh-hints.ts',
    'lib/session.ts',
    'lib/state-folder.ts',
    'lib/state-migration.ts',
    'lib/state-move.ts',
    'lib/state-preparation.ts',
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
    console.error(usage);
    return 2;
  }
  if (unavailable) {
    console.error(`queue: ${removed}`);
    return 1;
  }
  let form: QueueForm;
  try {
    const { parseQueueAction } = await import('./lib/queue.ts');
    form = 'json' in shape ? { command: shape.command, action: parseQueueAction(JSON.parse(shape.json)) } : shape;
  } catch {
    console.error(usage);
    return 2;
  }
  const { markDefect } = await import('./lib/events.ts');
  const { HostError, requireBun, selectHost } = await import('./lib/host.ts');
  const { requestSelection, requireDaemon, sendRun } = await import('./lib/daemon-client.ts');
  const { createOperation, locateCheckouts } = await import('./lib/operation.ts');
  const { explicitHost, readQueue, readQueueView, requireQueueChoice } = await import('./lib/queue.ts');
  const { admitQueue } = await import('./lib/queue-actions.ts');
  try {
    requireBun();
    const checkout = await locateCheckouts(process.cwd());
    if (checkout.main === null || checkout.common === null) throw new HostError('celetis: need a Git checkout', 2);
    const { main, common } = checkout;
    const requested = requestSelection(explicit);
    const queue = await readQueue(main, common);
    let selection: HostSelection = { explicit, environment: process.env.CELETIS_AGENT };
    const adding = (form.command === 'action' || form.command === 'admit') && form.action.kind === 'add';
    if (queue?.choice && !adding) {
      const named = selection.explicit ?? selection.environment;
      if (form.command !== 'status' && named !== undefined) {
        try {
          requireQueueChoice(queue.choice, { kind: 'explicit', host: selectHost(named) });
        } catch (cause) {
          throw new HostError((cause as Error).message, 2);
        }
      }
      const pinned = explicitHost(queue.choice);
      selection = pinned === null ? {} : { saved: pinned };
    }
    const operation = await createOperation(checkout, selection, 'main');
    const subject = (record: QueueRecord | null) =>
      record?.numbers[0] === undefined ? 'queue' : `#${record.numbers[0]}`;
    if (form.command === 'status') {
      console.log(JSON.stringify(await readQueueView(operation)));
      return 0;
    }
    if (form.command === 'wake')
      return await sendRun(
        common,
        { kind: 'queue', id: form.id, token: form.token, selection: requested, quiet },
        'queue',
        subject(queue),
      );
    const { action } = form;
    if (
      form.command === 'action' &&
      (action.kind === 'continue' || action.kind === 'retry' || (action.kind === 'add' && !queue?.numbers.length))
    )
      await requireDaemon(common, 'queue');
    const receipt = await admitQueue(operation, action);
    if (form.command === 'admit') {
      console.log(JSON.stringify(receipt));
      return 0;
    }
    console.log(JSON.stringify(receipt.view));
    if (!receipt.wake) return 0;
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
    return error instanceof HostError ? error.code : 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
