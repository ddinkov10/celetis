import { readFile } from 'node:fs/promises';
import { HostError } from './lib/command/errors.ts';
import { commandInput, locateCheckouts } from './lib/command/operation.ts';
import { type ExitCode, exits, usage } from './lib/contract/contract.ts';
import { askCoordinator, readStatus, requestSelection, requireDaemon } from './lib/daemon/client.ts';
import { isAuthority, parseAnswer, parseCoordinatorAnswer, parseScreenAnswer } from './lib/daemon/types.ts';
import { requireBun } from './lib/host/host.ts';
import { requireCan } from './lib/host/hosts.ts';
import { isHost } from './lib/host/names.ts';
import { installRecorder, markDefect } from './lib/state/events.ts';
import { uuid } from './lib/state/fields.ts';
import { parseHandle } from './lib/tracker/key.ts';

const notCoordinator =
  'coordinator: this session is not the coordinator session of the daemon; run celetis coordinator in a terminal';

export async function main(argv: string[]): Promise<ExitCode> {
  try {
    requireBun();
    const { args, explicit } = commandInput(argv);
    const at = args[0] === 'send' ? args.indexOf('--as') : -1;
    const named = at < 0 ? undefined : args[at + 1];
    const authority = isAuthority(named) ? named : null;
    const words = at < 0 ? args : args.toSpliced(at, 2);
    const key = parseHandle(words[1] ?? '');
    const form =
      words.length === 0
        ? 'open'
        : words.length === 1 && words[0] === 'status'
          ? 'status'
          : words.length === 2 && words[0] === 'read' && key !== null
            ? 'read'
            : words.length === 3 && words[0] === 'send' && key !== null && authority
              ? 'send'
              : words.length === 2 && words[0] === 'end' && key !== null
                ? 'end'
                : null;
    if (form === null) throw new HostError(usage('coordinator'), exits.usage);
    const { common, main } = await locateCheckouts(process.cwd());
    if (common === null || main === null)
      throw new HostError('coordinator: this folder is no Git checkout', exits.usage);
    if (form === 'status') {
      await requireDaemon(common, 'coordinator');
      console.log(JSON.stringify(await readStatus(common)));
      return exits.done;
    }
    if (form === 'end' && key !== null) {
      const token = process.env.CELETIS_COORDINATOR ?? '';
      if (!uuid.test(token)) throw new HostError(notCoordinator, exits.prerequisite);
      const { answer } = await askCoordinator(
        common,
        { kind: 'coordinator-end-assist', number: key, token },
        parseAnswer,
      );
      if (!answer.accepted) {
        console.error(answer.line);
        return answer.code;
      }
      console.log(`coordinator: asked the assist session of #${key} to exit`);
      return exits.done;
    }
    if (form === 'send' && authority && key !== null) {
      const file = words[2] as string;
      let bytes: Uint8Array;
      try {
        bytes = await readFile(file);
      } catch (error) {
        throw new HostError(`coordinator: cannot read ${file}: ${(error as Error).message}`, exits.usage);
      }
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        throw new HostError(`coordinator: ${file} is not valid UTF-8`, exits.usage);
      }
      const token = process.env.CELETIS_COORDINATOR ?? '';
      if (!uuid.test(token)) throw new HostError(notCoordinator, exits.prerequisite);
      const { answer } = await askCoordinator(
        common,
        {
          kind: 'coordinator-send',
          number: key,
          authority,
          text: text.endsWith('\n') ? text.slice(0, -1) : text,
          token,
        },
        parseAnswer,
      );
      if (!answer.accepted) {
        console.error(answer.line);
        return answer.code;
      }
      console.log(`coordinator: sent to #${key} as ${authority}`);
      return exits.done;
    }
    if (form === 'read' && key !== null) {
      const { answer } = await askCoordinator(common, { kind: 'coordinator-read', number: key }, parseScreenAnswer);
      if (!answer.accepted) {
        console.error(answer.line);
        return answer.code;
      }
      process.stdout.write(answer.text.endsWith('\n') ? answer.text : `${answer.text}\n`);
      if (!answer.complete)
        console.error(
          `coordinator: #${key}: hc gave only the visible screen${answer.why === null ? '' : ` (the session is ${answer.why})`}`,
        );
      return exits.done;
    }
    const selection = requestSelection(explicit);
    const chosen = selection.explicit ?? selection.environment;
    if (isHost(chosen)) requireCan(chosen, { kind: 'interactive', command: 'coordinator' }, 'celetis');
    const { identity, answer } = await askCoordinator(
      common,
      { kind: 'coordinator-open', selection },
      parseCoordinatorAnswer,
    );
    if (!answer.accepted) {
      (answer.code === exits.done ? console.log : console.error)(answer.line);
      return answer.code;
    }
    console.log(
      answer.opened
        ? `coordinator: opened the coordinator session of the daemon PID ${identity.pid} in the tab Coordinator`
        : 'coordinator: a coordinator session runs; its tab Coordinator is at the front',
    );
    return exits.done;
  } catch (error) {
    markDefect(error);
    console.error(error instanceof HostError ? error.message : `coordinator: ${(error as Error).message}`);
    return error instanceof HostError ? error.code : exits.internal;
  }
}

if (import.meta.main) {
  installRecorder('coordinator');
  process.exitCode = await main(process.argv.slice(2));
}
