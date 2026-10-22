#!/usr/bin/env -S BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros
import { BUN_NEEDED, cleanPath, isBunOk } from './runtime.ts';

import type { Command, Config } from './types.ts';

function stop(line: string, code = 1): never {
  console.error(line);
  process.exit(code);
}

if (!isBunOk(Bun.version)) stop(`agent-board: ${BUN_NEEDED}`);

const { realpath } = await import('node:fs/promises');
const { basename, delimiter, dirname } = await import('node:path');
const { text } = await import('node:stream/consumers');
const { parseConfig } = await import('./config.ts');
const { CONTRACT, readDocument } = await import('./contract.ts');
const { createBoard, run, runData } = await import('./server.ts');

if (process.env.PATH) process.env.PATH = cleanPath(process.env.PATH, delimiter);

const args = process.argv.slice(2);
const [command, flag = ''] = args;
if (
  !(
    (args.length === 1 && command === '--config-stdin') ||
    (args.length === 2 && command === 'check' && ['--config-stdin', '--stdin'].includes(flag))
  )
) {
  stop(
    'usage: agent-board --config-stdin | check --config-stdin | check --stdin (scripts/celetis board starts the board)',
    2,
  );
}

const revParse = async (...args: string[]) => {
  const { code, stdout } = await run('git', ['rev-parse', ...args]);
  return code === 0 ? stdout.replace(/\n$/, '') : null;
};

const mainCheckout = async () => {
  const common = await revParse('--path-format=absolute', '--git-common-dir');
  if (common === null) stop('agent-board: the current folder is not in a git checkout');
  const top = await revParse('--show-toplevel');
  if (basename(common) !== '.git' || top === null)
    stop('agent-board: the git directory is not the folder .git of a checkout (a bare repository or a submodule)');
  const main = await realpath(dirname(common));
  if ((await realpath(top)) !== main) stop(`agent-board: start the board in the main checkout: ${main}`);
  return main;
};

const report = (output: string) => {
  const { doc, failures } = readDocument(output);
  if (doc) {
    console.log(`agent-board: contract ${CONTRACT}, ${doc.issues.length} issues, ok`);
  } else {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
};

const checkData = async (main: string, data: Command | null) => {
  if (!data) stop('agent-board: the config has no "data"');
  const { output, error } = await runData(main, data);
  if (error !== null) stop(`agent-board: ${error}`);
  report(output as string);
};

const serve = (main: string, config: Config) => {
  const port = Number(process.env.PORT) || config.port || 4403;
  const refuse = (cause: NodeJS.ErrnoException) =>
    stop(
      `agent-board: cannot listen on 127.0.0.1:${port}: ${cause.code === 'EADDRINUSE' ? 'the port is in use' : cause.message}`,
    );
  const server = createBoard({ main, config }).on('error', refuse);
  try {
    server.listen(port, '127.0.0.1', () => {
      console.log(`agent-board: repository ${main}`);
      for (const key of ['data', 'run', 'resume'] as const)
        if (config[key]) console.log(`agent-board: ${key.padEnd(8)}${config[key].join(' ')}`);
      console.log(`agent-board: http://127.0.0.1:${port}`);
    });
  } catch (cause) {
    refuse(cause as NodeJS.ErrnoException);
  }
};

if (flag === '--stdin') {
  report(await text(process.stdin));
} else {
  const main = await mainCheckout();
  let config: Config;
  try {
    config = await parseConfig(main, await text(process.stdin), 'the input');
  } catch (cause) {
    stop(`agent-board: config stdin: ${(cause as Error).message}`);
  }
  if (command === 'check') await checkData(main, config.data);
  else serve(main, config);
}
