import type { CodexClient } from '../lib/codex-app-server.ts';
import { isSessionId } from '../lib/fields.ts';
import { type ChatEvent, callSummary, inputText, type Launch, object, type RecordRead, userEvents } from './chat.ts';

const quiet = new Set(['reasoning', 'plan', 'contextCompaction', 'hookPrompt', 'sleep']);

function iso(ms: unknown): string | null {
  if (typeof ms !== 'number') return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function contentText(items: unknown): string {
  if (!Array.isArray(items)) return '';
  return items.map((item) => (object(item) && typeof item.text === 'string' ? item.text : inputText(item))).join('\n');
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function codexEvents(entry: unknown, launch: Launch): ChatEvent[] | 'unknown' {
  if (!object(entry) || !object(entry.item)) return 'unknown';
  const item = entry.item;
  if (typeof item.type !== 'string') return 'unknown';
  if (quiet.has(item.type)) return [];
  if (typeof item.id !== 'string') return 'unknown';
  const id = item.id;
  const at = iso(item.startedAtMs ?? entry.startedAtMs);
  const call = (tool: string, summary: string, input: string, text: string, failed: boolean): ChatEvent[] => {
    const events: ChatEvent[] = [{ kind: 'call', id, at, tool, summary, input }];
    if (item.status !== 'inProgress')
      events.push({
        kind: 'result',
        id,
        at: iso(item.completedAtMs ?? entry.completedAtMs),
        text,
        failed: failed || item.status === 'failed' || item.status === 'declined',
      });
    return events;
  };
  switch (item.type) {
    case 'userMessage': {
      if (!Array.isArray(item.content)) return 'unknown';
      const texts = item.content.flatMap((part) =>
        object(part) && part.type === 'text' && typeof part.text === 'string' ? [part.text] : [],
      );
      return userEvents(id, at, texts.join('\n'), launch);
    }
    case 'agentMessage':
      return typeof item.text === 'string' && item.text.trim() !== ''
        ? [{ kind: 'agent', id, at, text: item.text }]
        : [];
    case 'commandExecution': {
      const command = typeof item.command === 'string' ? item.command : '';
      const text = typeof item.aggregatedOutput === 'string' ? item.aggregatedOutput : '';
      return call(
        'Shell',
        callSummary({ command }),
        command,
        text,
        typeof item.exitCode === 'number' && item.exitCode !== 0,
      );
    }
    case 'fileChange': {
      const changes = Array.isArray(item.changes) ? item.changes.filter(object) : [];
      const paths = strings(changes.map((change) => change.path));
      const input = changes.map((change) => strings([change.path, change.diff]).join('\n')).join('\n\n');
      return call('Edit', callSummary({ path: paths.join(', ') }), input, '', false);
    }
    case 'mcpToolCall': {
      const error = object(item.error) && typeof item.error.message === 'string' ? item.error.message : null;
      const result = object(item.result) ? contentText(item.result.content) : '';
      const tool = strings([item.server, item.tool]).join('.');
      return call(tool, callSummary(item.arguments), inputText(item.arguments), error ?? result, error !== null);
    }
    case 'dynamicToolCall': {
      const tool = typeof item.tool === 'string' ? item.tool : '';
      return call(
        tool,
        callSummary(item.arguments),
        inputText(item.arguments),
        contentText(item.contentItems),
        item.success === false,
      );
    }
    default:
      return 'unknown';
  }
}

export function createCodexRecord(
  threadId: string,
  client: CodexClient,
  prompt: string,
): { read(): Promise<RecordRead> } {
  let cursor: string | null = null;
  const counted = new Set<string>();
  const launch: Launch = { prompt, id: null };
  return {
    async read() {
      if (!isSessionId('codex', threadId)) throw new Error('the thread ID of the coordinator record is not valid');
      const events: ChatEvent[] = [];
      let unknown = 0;
      let page = cursor;
      for (;;) {
        const { result } = await client.request('thread/items/list', { threadId, cursor: page, limit: 100 });
        if (!object(result) || !Array.isArray(result.data)) throw new Error('the Codex item list has no data');
        for (const entry of result.data) {
          const found = codexEvents(entry, launch);
          if (found !== 'unknown') {
            events.push(...found);
            continue;
          }
          const key = object(entry) && object(entry.item) && typeof entry.item.id === 'string' ? entry.item.id : null;
          if (key === null || !counted.has(key)) unknown++;
          if (key !== null) counted.add(key);
        }
        const next = result.nextCursor;
        if (typeof next !== 'string' || next === '' || next === page) break;
        page = next;
      }
      cursor = page;
      return { events, unknown };
    },
  };
}
