import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { HostError, unsupported } from '../../command/errors.ts';
import { exits } from '../../contract/contract.ts';
import { run } from '../../process/process.ts';
import { isSessionId } from '../../state/fields.ts';
import { writeAtomic } from '../../state/state.ts';
import { command, type Step } from '../../workflow/workflow.ts';
import type { HostAdapter } from '../types.ts';
import { unknownUsage } from '../usage.ts';

const configKeys = new Set(['OPENCODE_CONFIG_CONTENT', 'OPENCODE_CONFIG', 'OPENCODE_CONFIG_DIR']);
const base62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const opencodeTimeout = 60_000;
let lastMs = 0;
let counter = 0;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function opencodePrompt(step: Step, issue: number): string {
  return `Load the skill ${command(step)} with the skill tool and follow it for #${issue}. Complete its Celetis entry before any response, including commentary.`;
}

// OpenCode IDs sort newest first: the bitwise NOT of (ms * 0x1000 + counter), in 48 bits.
function newSessionId(): string {
  const now = Date.now();
  counter = now === lastMs ? counter + 1 : 1;
  lastMs = now;
  const time = ~(BigInt(now) * 0x1000n + BigInt(counter)) & 0xffff_ffff_ffffn;
  const random = Array.from(crypto.getRandomValues(new Uint8Array(14)), (byte) => base62[byte % 62]).join('');
  return `ses_${time.toString(16).padStart(12, '0')}${random}`;
}

async function opencodeJson(args: string[], cwd: string): Promise<unknown> {
  const result = await run('opencode', [...args, '--standalone'], { cwd, timeout: opencodeTimeout });
  return result.code === 0 ? JSON.parse(result.stdout) : null;
}

export const opencode: HostAdapter = {
  app: 'opencode',
  capability: { steps: ['triage'], interactive: false, dispatch: false, landing: false, setup: false },
  appliesEffort: false,
  exitKeys: (terminal) => ['send', terminal, '/exit'],
  checkHome: async () => {},
  homeEnv: async () => ({}),
  stepEnv: (source) => {
    const windows = process.platform === 'win32';
    return Object.fromEntries(
      Object.entries(source).filter(([key]) => !configKeys.has(windows ? key.toUpperCase() : key)),
    );
  },
  pin: async () => [],
  sessionEnv: async ({ plugin, folder, stepText }) => {
    if (stepText === null) return unsupported('opencode', 'interactive session');
    const instructions = join(folder, 'step.md');
    await writeAtomic(instructions, await stepText(), { mode: 0o600 });
    return {
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        skills: [join(await plugin(), 'skills')],
        instructions: [instructions],
      }),
    };
  },
  stepPrompt: opencodePrompt,
  stepArguments: async ({ issue, step, sessionId }) => {
    if (!isSessionId('opencode', sessionId))
      throw new HostError('daemon: an opencode start needs its announced session ID', exits.internal);
    return {
      args: ['--standalone', '--auto', '-s', sessionId, '--prompt', opencodePrompt(step, issue)],
      applied: null,
      model: null,
    };
  },
  resumeArguments: (session) => ['--standalone', '--auto', '-s', session.session_id],
  sessionArguments: () => unsupported('opencode', 'interactive session'),
  interactiveArguments: () => unsupported('opencode', 'interactive session'),
  startId: newSessionId,
  claim: async (_checkout, _prompt, announced) => ({ kind: 'one', id: announced }),
  verifySession: async (checkout, id, startedAt) => {
    if (!isSessionId('opencode', id)) return false;
    try {
      const sessions = await opencodeJson(['session', 'list', '--format', 'json'], checkout);
      const entry = Array.isArray(sessions) ? sessions.find((each) => object(each) && each.id === id) : undefined;
      if (
        !object(entry) ||
        typeof entry.directory !== 'string' ||
        typeof entry.created !== 'number' ||
        entry.created / 1000 < startedAt ||
        (await realpath(entry.directory)) !== (await realpath(checkout))
      )
        return false;
      const exported = await opencodeJson(['session', 'export', id], checkout);
      return (
        object(exported) &&
        object(exported.info) &&
        exported.info.id === id &&
        Array.isArray(exported.messages) &&
        exported.messages.some((message) => object(message) && message.type === 'user')
      );
    } catch {
      return false;
    }
  },
  recovery: 'opencode --standalone -s <session-id>',
  prepareUsage: async () => [],
  readUsage: async (attempt) => unknownUsage(attempt),
  sessionVariable: 'OPENCODE_SESSION_ID',
  terminatesAfterGrace: true,
};
