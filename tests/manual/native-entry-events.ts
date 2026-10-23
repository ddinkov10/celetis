import { isDeepStrictEqual } from 'node:util';

export interface ToolInput {
  file_path?: string;
  path?: string;
  code?: string;
  skill?: string;
  offset?: number;
  limit?: number;
  [key: string]: unknown;
}
export interface StreamBlock {
  type: string;
  id?: string;
  name?: string;
  input?: ToolInput;
  tool_use_id?: string;
  is_error?: boolean;
  content?: string | { type: string; text?: string }[];
  text?: string;
}
export interface NativeFile {
  filePath?: string;
  content?: string;
  contentSha256?: string;
  startLine?: number;
  numLines?: number;
  totalLines?: number;
  truncatedByTokenCap?: boolean;
}
export interface FileResult {
  type?: string;
  source?: string;
  file?: NativeFile;
  worktreePath?: string;
  [key: string]: unknown;
}
export interface Denial {
  tool_name: string;
  tool_use_id?: string;
  tool_input: ToolInput;
  native?: boolean;
}
export interface StreamRow {
  type: string;
  subtype?: string;
  plugin?: string;
  text?: string;
  session_id?: string;
  native?: boolean;
  message?: { role?: string; content?: StreamBlock[] | string };
  tool_use_result?: FileResult | string;
  is_error?: boolean;
  result?: unknown;
  permission_denials?: Denial[];
  path?: string;
  [key: string]: unknown;
}
interface Observation {
  event?: string;
  id?: unknown;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  origin?: unknown;
  session?: string;
  order: number;
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export function projectEvents(rows: unknown[]): unknown[] {
  const observations = new Map<number, Observation>();
  const ordinary = new Set<unknown>();
  rows.forEach((value, order) => {
    const row = object(value);
    if (row.type === 'assistant') {
      const blocks = object(row.message).content;
      if (Array.isArray(blocks))
        for (const value of blocks) {
          const block = object(value);
          if (block.type === 'tool_use') ordinary.add(block.id);
        }
    }
    if (
      row.type !== 'system' ||
      row.subtype !== 'ui_log' ||
      row.plugin !== 'celetis-entry-observer' ||
      typeof row.text !== 'string'
    )
      return;
    try {
      const parsed = object(JSON.parse(row.text));
      observations.set(order, {
        ...parsed,
        input: object(parsed.input),
        result: object(parsed.result),
        session: typeof row.session_id === 'string' ? row.session_id : undefined,
        order,
      });
    } catch {}
  });
  const begins = (record: Observation, event: string) =>
    [...observations.values()].some(
      (start) =>
        start.event === event &&
        isDeepStrictEqual(start.id, record.id) &&
        isDeepStrictEqual(start.input, record.input) &&
        isDeepStrictEqual(start.origin, record.origin) &&
        start.session === record.session &&
        start.order < record.order,
    );
  const events = rows.map((row, order): unknown => {
    const record = observations.get(order);
    if (!record) return row;
    if (record.event === 'fs.stat.result' && begins(record, 'fs.stat.start'))
      return { type: 'native_metadata', path: record.input.path, result: record.result, session_id: record.session };
    if (record.event === 'tool.start' && !ordinary.has(record.id)) {
      const { tool, tool_use_id: _id, agentId: _agent, ...input } = record.input;
      return {
        type: 'assistant',
        native: true,
        session_id: record.session,
        message: { role: 'assistant', content: [{ type: 'tool_use', id: record.id, name: tool, input }] },
      };
    }
    if (record.event === 'tool.result' && begins(record, 'tool.start') && !ordinary.has(record.id))
      return {
        type: 'user',
        native: true,
        session_id: record.session,
        tool_use_result: record.result.result ?? null,
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: record.id,
              is_error: record.result.isError === true || record.result.deny != null,
              content: record.result.text ?? record.result.deny ?? JSON.stringify(record.result.result ?? null),
            },
          ],
        },
      };
    if (record.event === 'tool.check' && record.result.decision === 'deny')
      return {
        type: 'native_denial',
        id: record.id,
        path: object(record.input.input).file_path,
        reason: record.result.reason,
        rule: record.result.rule,
      };
    return row;
  });
  const denials = events
    .filter((value) => object(value).type === 'native_denial')
    .map((value) => {
      const row = object(value);
      return { tool_name: 'Read', tool_use_id: row.id, tool_input: { file_path: row.path }, native: true };
    });
  return events.map((value) => {
    const row = object(value);
    if (row.type !== 'result') return value;
    const unique = new Map<unknown, unknown>();
    for (const denial of [...(Array.isArray(row.permission_denials) ? row.permission_denials : []), ...denials]) {
      const id = object(denial).tool_use_id;
      if (!unique.has(id)) unique.set(id, denial);
    }
    return {
      ...row,
      permission_denials: [...unique.values()].sort((a, b) =>
        String(object(a).tool_use_id).localeCompare(String(object(b).tool_use_id)),
      ),
    };
  });
}

if (import.meta.main) {
  try {
    let input = '';
    for await (const chunk of process.stdin) input += chunk.toString();
    const rows: unknown[] = input.trim()
      ? input
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
      : [];
    for (const event of projectEvents(rows)) console.log(JSON.stringify(event));
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
