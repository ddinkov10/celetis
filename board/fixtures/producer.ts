#!/usr/bin/env -S BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

process.stdout.write(await readFile(join(dirname(process.argv[1] as string), 'contract-1.json')));
