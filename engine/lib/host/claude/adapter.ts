import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { HostError } from '../../command/errors.ts';
import { exits } from '../../contract/contract.ts';
import { isSessionId } from '../../state/fields.ts';
import { ensureFolder } from '../../state/state.ts';
import { invocation, tabLabel } from '../../workflow/workflow.ts';
import { configHome } from '../homes.ts';
import type { HostAdapter } from '../types.ts';
import { prepareClaudeUsage, readClaudeUsage } from './usage.ts';

const transcriptRow = z.looseObject({
  sessionId: z.string(),
  type: z.literal('user'),
  cwd: z.string(),
  timestamp: z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/),
});

export const claude: HostAdapter = {
  app: 'claude-code',
  capability: { steps: 'all', interactive: true, dispatch: true, landing: true, setup: true },
  appliesEffort: true,
  exitKeys: (terminal) => ['send', terminal, '/exit'],
  checkHome: async () => {},
  homeEnv: async () => ({}),
  stepEnv: (source) => {
    const windows = process.platform === 'win32';
    return Object.fromEntries(
      Object.entries(source).filter(([key]) => (windows ? key.toUpperCase() : key) !== 'CLAUDE_CODE_EFFORT_LEVEL'),
    );
  },
  pin: async () => [],
  sessionEnv: async () => ({}),
  stepPrompt: invocation,
  stepArguments: async ({ issue, step, start, stepText }) => ({
    args: [
      '--permission-mode',
      'auto',
      '--model',
      start.model,
      '--effort',
      start.level,
      '-n',
      tabLabel(issue, step),
      ...(step === 'specify' ? [] : ['--append-system-prompt', await stepText()]),
      invocation(step, issue),
    ],
    applied: start.level,
    model: null,
  }),
  resumeArguments: (session) => {
    if (session.effort === null) throw new HostError('daemon: a claude session record has no effort', exits.internal);
    return ['--resume', session.session_id, '--effort', session.effort];
  },
  sessionArguments: (sessionId) => ['--session-id', sessionId],
  interactiveArguments: (title, prompt) => ['-n', title, prompt],
  startId: () => randomUUID(),
  claim: async (_checkout, _prompt, announced) => ({ kind: 'one', id: announced }),
  verifySession: async (checkout, sessionId, startedAt) => {
    if (!isSessionId('claude', sessionId)) return false;
    const projects = join(configHome('claude'), 'projects');
    for (const name of await readdir(projects).catch(() => [])) {
      const source = await readFile(join(projects, name, `${sessionId}.jsonl`), 'utf8').catch(() => null);
      if (source === null) continue;
      for (const line of source.split('\n').filter(Boolean)) {
        let value: unknown;
        try {
          value = JSON.parse(line);
        } catch {
          break;
        }
        const row = transcriptRow.safeParse(value);
        if (
          row.success &&
          row.data.sessionId === sessionId &&
          row.data.cwd === checkout &&
          Date.parse(row.data.timestamp) / 1000 >= startedAt
        )
          return true;
      }
    }
    return false;
  },
  recovery: 'claude --resume',
  prepareUsage: async (attempt, layout) => {
    const capture = layout.usageCapture(attempt.id);
    ensureFolder(layout.root);
    ensureFolder(layout.usageCaptures);
    ensureFolder(capture);
    return prepareClaudeUsage(attempt, capture.path);
  },
  readUsage: readClaudeUsage,
  sessionVariable: 'CLAUDE_CODE_SESSION_ID',
  terminatesAfterGrace: true,
};
