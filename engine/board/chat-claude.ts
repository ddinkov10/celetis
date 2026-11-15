import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { isSessionId } from '../lib/fields.ts';
import { configHome } from '../lib/homes.ts';
import {
  type ChatEvent,
  callSummary,
  inputText,
  type Launch,
  launchNote,
  object,
  type RecordRead,
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

function textOf(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;
  return content
    .flatMap((part) => (object(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : []))
    .join('\n');
}

export function claudeEvents(row: unknown, launch: Launch): ChatEvent[] | 'unknown' {
  if (!object(row) || typeof row.type !== 'string') return 'unknown';
  if (row.isSidechain === true) return [];
  if (row.type === 'attachment' && object(row.attachment) && row.attachment.type === 'queued_command') {
    const { prompt, origin } = row.attachment;
    if (typeof row.uuid !== 'string' || typeof prompt !== 'string') return 'unknown';
    return textEvents(row.uuid, typeof row.timestamp === 'string' ? row.timestamp : null, prompt, origin, launch);
  }
  if (internal.has(row.type)) return [];
  if (row.type !== 'user' && row.type !== 'assistant') return 'unknown';
  if (typeof row.uuid !== 'string' || !object(row.message)) return 'unknown';
  const id = row.uuid;
  const at = typeof row.timestamp === 'string' ? row.timestamp : null;
  const content = row.message.content;
  if (row.type === 'assistant') {
    if (!Array.isArray(content)) return 'unknown';
    return content.flatMap((part, index): ChatEvent[] => {
      if (!object(part)) return [];
      if (part.type === 'text' && typeof part.text === 'string' && part.text.trim() !== '')
        return [{ kind: 'agent', id: `${id}:${index}`, at, text: part.text }];
      if (part.type === 'tool_use' && typeof part.id === 'string' && typeof part.name === 'string')
        return [
          {
            kind: 'call',
            id: part.id,
            at,
            tool: part.name,
            summary: callSummary(part.input),
            input: inputText(part.input),
          },
        ];
      return [];
    });
  }
  if (row.isCompactSummary === true) return [{ kind: 'note', id, at, text: 'The conversation was compacted' }];
  if (row.isMeta === true) return [];
  if (Array.isArray(content) && content.some((part) => object(part) && part.type === 'tool_result'))
    return content.flatMap((part): ChatEvent[] =>
      object(part) && part.type === 'tool_result' && typeof part.tool_use_id === 'string'
        ? [
            {
              kind: 'result',
              id: part.tool_use_id,
              at,
              text: textOf(part.content) ?? '',
              failed: part.is_error === true,
            },
          ]
        : [],
    );
  const text = textOf(content);
  if (text === null) return 'unknown';
  return textEvents(id, at, text, row.origin, launch);
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
  if (object(origin) && origin.kind !== 'human') return [];
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
