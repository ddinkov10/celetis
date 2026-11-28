import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { z } from 'zod';
import { configHome } from '../../lib/host/homes.ts';
import { isSessionId } from '../../lib/state/fields.ts';
import {
  anything,
  type ChatEvent,
  callSummary,
  inputText,
  type Launch,
  launchNote,
  lax,
  type RecordRead,
  textList,
  userEvents,
} from './chat.ts';

const internal = new Set([
  'agent-name',
  'ai-title',
  'api-request',
  'api-request-blob',
  'api-request-shape',
  'atis-latch',
  'attachment',
  'bridge-session',
  'cost-state',
  'custom-title',
  'file-history-delta',
  'file-history-snapshot',
  'last-prompt',
  'mode',
  'permission-mode',
  'queue-operation',
  'session-owner',
  'system',
  'tools-used',
]);

const rowShape = z.looseObject({
  type: z.string(),
  uuid: lax(z.string()),
  timestamp: lax(z.string()),
  isSidechain: lax(z.literal(true)),
  isCompactSummary: lax(z.literal(true)),
  isMeta: lax(z.literal(true)),
  message: lax(z.looseObject({ content: anything })),
  origin: anything,
  attachment: lax(z.looseObject({ type: z.literal('queued_command'), prompt: lax(z.string()), origin: anything })),
});

const assistantPart = z.union([
  z.looseObject({ type: z.literal('text'), text: z.string() }),
  z.looseObject({ type: z.literal('tool_use'), id: z.string(), name: z.string(), input: anything }),
]);

const resultPart = z.looseObject({
  type: z.literal('tool_result'),
  tool_use_id: lax(z.string()),
  content: anything,
  is_error: lax(z.literal(true)),
});

const messageText = z.union([z.string(), textList.transform((texts) => texts.join('\n'))]);
const originShape = z.looseObject({ kind: anything });

function textOf(content: unknown): string | null {
  const parsed = messageText.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export function claudeEvents(row: unknown, launch: Launch): ChatEvent[] | 'unknown' {
  const parsed = rowShape.safeParse(row);
  if (!parsed.success) return 'unknown';
  const { type, uuid, message, attachment } = parsed.data;
  if (parsed.data.isSidechain) return [];
  const at = parsed.data.timestamp ?? null;
  if (type === 'attachment' && attachment) {
    if (uuid === undefined || attachment.prompt === undefined) return 'unknown';
    return textEvents(uuid, at, attachment.prompt, attachment.origin, launch);
  }
  if (internal.has(type)) return [];
  if (type !== 'user' && type !== 'assistant') return 'unknown';
  if (uuid === undefined || !message) return 'unknown';
  const content = message.content;
  if (type === 'assistant') {
    if (!Array.isArray(content)) return 'unknown';
    return content.flatMap((item, index): ChatEvent[] => {
      const part = assistantPart.safeParse(item);
      if (!part.success) return [];
      if (part.data.type === 'text')
        return part.data.text.trim() === ''
          ? []
          : [{ kind: 'agent', id: `${uuid}:${index}`, at, text: part.data.text }];
      return [
        {
          kind: 'call',
          id: part.data.id,
          at,
          tool: part.data.name,
          summary: callSummary(part.data.input),
          input: inputText(part.data.input),
        },
      ];
    });
  }
  if (parsed.data.isCompactSummary) return [{ kind: 'note', id: uuid, at, text: 'The conversation was compacted' }];
  if (parsed.data.isMeta) return [];
  const results = Array.isArray(content) ? content.map((item) => resultPart.safeParse(item)) : [];
  if (results.some((result) => result.success))
    return results.flatMap((result): ChatEvent[] =>
      result.success && result.data.tool_use_id !== undefined
        ? [
            {
              kind: 'result',
              id: result.data.tool_use_id,
              at,
              text: textOf(result.data.content) ?? '',
              failed: result.data.is_error === true,
            },
          ]
        : [],
    );
  const text = textOf(content);
  if (text === null) return 'unknown';
  return textEvents(uuid, at, text, parsed.data.origin, launch);
}

function tag(text: string, name: string): string | null {
  return new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text)?.[1]?.trim() || null;
}

function textEvents(id: string, at: string | null, text: string, origin: unknown, launch: Launch): ChatEvent[] {
  if (/^<(?:local-command-|bash-stdout>|bash-stderr>)/.test(text)) return [];
  if (text.startsWith('<bash-input>')) {
    const command = tag(text, 'bash-input');
    return command ? [{ kind: 'note', id, at, text: `!${command}` }] : [];
  }
  if (text.startsWith('<task-notification>'))
    return [{ kind: 'note', id, at, text: tag(text, 'summary') ?? 'A background task ended' }];
  if (text.startsWith('<command-')) {
    const name = tag(text, 'command-name');
    return name ? [launchNote(launch, id, at, name) ?? { kind: 'note', id, at, text: name }] : [];
  }
  const source = originShape.safeParse(origin);
  if (source.success && source.data.kind !== 'human') return [];
  return userEvents(id, at, text, launch);
}

async function find(projects: string, sessionId: string): Promise<string | null> {
  for (const name of await readdir(projects).catch(() => [])) {
    const candidate = join(projects, name, `${sessionId}.jsonl`);
    if (
      await lstat(candidate).then(
        () => true,
        () => false,
      )
    )
      return candidate;
  }
  return null;
}

export function createClaudeRecord(sessionId: string, prompt: string): { read(): Promise<RecordRead> } {
  let path: string | null = null;
  let offset = 0;
  const launch: Launch = { prompt, id: null };
  return {
    async read() {
      if (!isSessionId('claude', sessionId)) throw new Error('the session ID of the coordinator record is not valid');
      const projects = join(configHome('claude'), 'projects');
      path ??= await find(projects, sessionId);
      if (path === null) return { events: [], unknown: 0 };
      const [folder, entry] = await Promise.all([lstat(dirname(path)), lstat(path)]);
      if (folder.isSymbolicLink() || entry.isSymbolicLink() || !entry.isFile())
        throw new Error(`the session record ${path} is a symbolic link or not a regular file`);
      if (!(await realpath(path)).startsWith(`${await realpath(projects)}${sep}`))
        throw new Error(`the session record ${path} is outside ${projects}`);
      const handle = await open(path, 'r');
      try {
        const opened = await handle.stat();
        if (opened.ino !== entry.ino || opened.dev !== entry.dev)
          throw new Error(`the session record ${path} changed during the read`);
        if (opened.size < offset) offset = 0;
        const buffer = Buffer.alloc(opened.size - offset);
        let filled = 0;
        while (filled < buffer.length) {
          const { bytesRead } = await handle.read(buffer, filled, buffer.length - filled, offset + filled);
          if (bytesRead === 0) break;
          filled += bytesRead;
        }
        const end = buffer.lastIndexOf(0x0a, filled - 1);
        if (end < 0) return { events: [], unknown: 0 };
        offset += end + 1;
        const events: ChatEvent[] = [];
        let unknown = 0;
        for (const line of buffer.subarray(0, end).toString('utf8').split('\n')) {
          let row: unknown;
          try {
            row = JSON.parse(line);
          } catch {
            continue;
          }
          const found = claudeEvents(row, launch);
          if (found === 'unknown') unknown++;
          else events.push(...found);
        }
        return { events, unknown };
      } finally {
        await handle.close();
      }
    },
  };
}
