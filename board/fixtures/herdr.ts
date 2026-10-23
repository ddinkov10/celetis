#!/usr/bin/env -S BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 DO_NOT_TRACK=1 bun --no-env-file --no-install --config=/dev/null --no-macros
import { appendFile } from 'node:fs/promises';

const args = process.argv.slice(2);
if (process.env.HERDR_LOG) await appendFile(process.env.HERDR_LOG, `${args.join(' ')}\n`);
const command = args.slice(0, 2).join(' ');
let result = {};
if (command === 'api snapshot') {
  result = process.env.HERDR_AGENT_CWD
    ? {
        snapshot: {
          tabs: [{ tab_id: 't1', label: '#7' }],
          agents: [
            {
              terminal_id: 's1',
              pane_id: 'w1:p7',
              tab_id: 't1',
              agent: 'claude',
              agent_status: 'working',
              cwd: process.env.HERDR_AGENT_CWD,
            },
          ],
        },
      }
    : { snapshot: { tabs: [], agents: [] } };
} else if (command === 'workspace list') {
  result = { workspaces: [{ label: process.env.HERDR_WORKSPACE ?? '', workspace_id: 'w1' }] };
} else if (command === 'tab create') {
  result = { tab: { tab_id: 'w1:t1' }, root_pane: { pane_id: 'w1:p1' } };
}
console.log(JSON.stringify({ result }));
