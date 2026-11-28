import { z } from 'zod';
import type { CodexClient } from '../../lib/host/codex/app-server.ts';
import { isSessionId } from '../../lib/state/fields.ts';
import { anyNumber } from '../../lib/state/schemas.ts';
import {
  anything,
  type ChatEvent,
  callSummary,
  inputText,
  type Launch,
  lax,
  type RecordRead,
  textList,
  userEvents,
} from './chat.ts';

const quiet = new Set(['reasoning', 'plan', 'contextCompaction', 'hookPrompt', 'sleep']);

const stamp = anyNumber.nullish().catch(Number.NaN);

const entryShape = z.looseObject({
  startedAtMs: stamp,
  completedAtMs: stamp,
  item: z.looseObject({
    type: lax(z.string()),
    id: lax(z.string()),
    startedAtMs: stamp,
    completedAtMs: stamp,
    status: anything,
    content: lax(textList),
    text: lax(z.string()),
    command: lax(z.string()),
    aggregatedOutput: lax(z.string()),
    exitCode: lax(anyNumber),
    changes: lax(
      z.array(
        z
          .looseObject({ path: lax(z.string()), diff: lax(z.string()) })
          .nullable()
          .catch(null),
      ),
    ),
    error: lax(z.looseObject({ message: lax(z.string()) })),
    result: lax(z.looseObject({ content: anything })),
    server: lax(z.string()),
    tool: lax(z.string()),
    arguments: anything,
    contentItems: anything,
    success: anything,
  }),
});

const itemList = z.looseObject({ data: z.array(z.unknown()), nextCursor: lax(z.string()) });
const textItem = z.looseObject({ text: z.string() });

function iso(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function contentText(items: unknown): string {
  const list = z.array(z.unknown()).safeParse(items);
  if (!list.success) return '';
  return list.data
    .map((item) => {
      const parsed = textItem.safeParse(item);
      return parsed.success ? parsed.data.text : inputText(item);
    })
    .join('\n');
}

const present = (value: string | undefined): value is string => value !== undefined;

export function codexEvents(entry: unknown, launch: Launch): ChatEvent[] | 'unknown' {
  const parsed = entryShape.safeParse(entry);
  if (!parsed.success) return 'unknown';
  const item = parsed.data.item;
  if (item.type === undefined) return 'unknown';
  if (quiet.has(item.type)) return [];
  if (item.id === undefined) return 'unknown';
  const id = item.id;
  const at = iso(item.startedAtMs ?? parsed.data.startedAtMs);
  const call = (tool: string, summary: string, input: string, text: string, failed: boolean): ChatEvent[] => {
    const events: ChatEvent[] = [{ kind: 'call', id, at, tool, summary, input }];
    if (item.status !== 'inProgress')
      events.push({
        kind: 'result',
        id,
        at: iso(item.completedAtMs ?? parsed.data.completedAtMs),
        text,
        failed: failed || item.status === 'failed' || item.status === 'declined',
      });
    return events;
  };
  switch (item.type) {
    case 'userMessage':
      return item.content ? userEvents(id, at, item.content.join('\n'), launch) : 'unknown';
    case 'agentMessage':
      return item.text !== undefined && item.text.trim() !== '' ? [{ kind: 'agent', id, at, text: item.text }] : [];
    case 'commandExecution': {
      const command = item.command ?? '';
      return call(
        'Shell',
        callSummary({ command }),
        command,
        item.aggregatedOutput ?? '',
        item.exitCode !== undefined && item.exitCode !== 0,
      );
    }
    case 'fileChange': {
      const changes = (item.changes ?? []).flatMap((change) => (change ? [change] : []));
      const paths = changes.map((change) => change.path).filter(present);
      const input = changes.map((change) => [change.path, change.diff].filter(present).join('\n')).join('\n\n');
      return call('Edit', callSummary({ path: paths.join(', ') }), input, '', false);
    }
    case 'mcpToolCall': {
      const error = item.error?.message ?? null;
      const result = item.result ? contentText(item.result.content) : '';
      const tool = [item.server, item.tool].filter(present).join('.');
      return call(tool, callSummary(item.arguments), inputText(item.arguments), error ?? result, error !== null);
    }
    case 'dynamicToolCall':
      return call(
        item.tool ?? '',
        callSummary(item.arguments),
        inputText(item.arguments),
        contentText(item.contentItems),
        item.success === false,
      );
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
        const list = itemList.safeParse(result);
        if (!list.success) throw new Error('the Codex item list has no data');
        for (const entry of list.data.data) {
          const found = codexEvents(entry, launch);
          if (found !== 'unknown') {
            events.push(...found);
            continue;
          }
          const key = entryShape.safeParse(entry).data?.item.id ?? null;
          if (key === null || !counted.has(key)) unknown++;
          if (key !== null) counted.add(key);
        }
        const next = list.data.nextCursor;
        if (next === undefined || next === '' || next === page) break;
        page = next;
      }
      cursor = page;
      return { events, unknown };
    },
  };
}
