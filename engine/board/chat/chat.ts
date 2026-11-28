import { z } from 'zod';
import { noteMarker } from '../../lib/coordinator/coordinator.ts';
import type { ChatBlock, ChatCall, ChatEntry, ChatInline, ChatText } from '../types.ts';

export type ChatEvent =
  | { kind: 'you' | 'agent' | 'note'; id: string; at: string | null; text: string }
  | { kind: 'call'; id: string; at: string | null; tool: string; summary: string; input: string }
  | { kind: 'result'; id: string; at: string | null; text: string; failed: boolean };
export type RecordRead = { events: ChatEvent[]; unknown: number };

export const INPUT_LIMIT = 2000;
export const RESULT_LIMIT = 4000;

export const lax = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

export const anything = z.unknown().optional();

const textPart = z.looseObject({ type: z.literal('text'), text: z.string() });
export const textList = z
  .array(textPart.nullable().catch(null))
  .transform((parts) => parts.flatMap((part) => (part ? [part.text] : [])));

export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function clip(text: string, limit: number): ChatText {
  if (text.length <= limit) return { text, cut: 0 };
  const code = text.charCodeAt(limit - 1);
  const end = code >= 0xd800 && code <= 0xdbff ? limit - 1 : limit;
  return { text: text.slice(0, end), cut: text.length - end };
}

export function inputText(value: unknown): string {
  return typeof value === 'string' ? value : (JSON.stringify(value ?? null, null, 2) ?? '');
}

export function callSummary(input: unknown): string {
  if (!object(input)) return '';
  const value = [input.command, input.file_path, input.path, input.pattern, ...Object.values(input)].find(
    (candidate) => typeof candidate === 'string' && candidate.trim() !== '',
  );
  return typeof value === 'string' ? (value.trim().split('\n', 1)[0] ?? '').slice(0, 200) : '';
}

const interrupts = new Set(['[Request interrupted by user]', '[Request interrupted by user for tool use]']);

export type Launch = { prompt: string; id: string | null };

export function launchNote(launch: Launch, id: string, at: string | null, text: string): ChatEvent | null {
  if (text !== launch.prompt) return null;
  launch.id ??= id;
  return launch.id === id ? { kind: 'note', id, at, text: `The session started with ${launch.prompt}` } : null;
}

export function userEvents(id: string, at: string | null, text: string, launch: Launch): ChatEvent[] {
  if (text.trim() === '') return [];
  const started = launchNote(launch, id, at, text);
  if (started) return [started];
  if (text.startsWith(noteMarker)) {
    const items = text
      .split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2));
    return [{ kind: 'note', id, at, text: items.join('; ') || 'A note of the daemon' }];
  }
  if (interrupts.has(text)) return [{ kind: 'note', id, at, text: 'Interrupted' }];
  return [{ kind: 'you', id, at, text }];
}

export function foldChat(events: readonly ChatEvent[], waiting: boolean): ChatEntry[] {
  const latest = new Map<string, ChatEvent>();
  for (const event of events) latest.set(`${event.kind}:${event.id}`, event);
  const results = new Map<string, Extract<ChatEvent, { kind: 'result' }>>();
  for (const event of latest.values()) if (event.kind === 'result') results.set(event.id, event);
  const entries: ChatEntry[] = [];
  let open: ChatCall | undefined;
  for (const event of latest.values()) {
    if (event.kind === 'result') continue;
    if (event.kind === 'call') {
      const result = results.get(event.id);
      const call: ChatCall = {
        id: event.id,
        tool: event.tool,
        summary: event.summary,
        input: clip(event.input, INPUT_LIMIT),
        result: result ? clip(result.text, RESULT_LIMIT) : null,
        state: result ? (result.failed ? 'failed' : 'done') : 'runs',
        startedAt: event.at,
        endedAt: result?.at ?? null,
      };
      const last = entries.at(-1);
      if (last?.kind === 'steps') last.calls.push(call);
      else entries.push({ kind: 'steps', id: event.id, calls: [call] });
      if (!result) open = call;
      continue;
    }
    if (event.kind === 'agent')
      entries.push({ kind: 'agent', id: event.id, at: event.at, blocks: markdownBlocks(event.text) });
    else entries.push({ kind: event.kind, id: event.id, at: event.at, text: event.text });
  }
  if (waiting && open) open.state = 'waits';
  return entries;
}

type Node = { type: unknown; props: Record<string, unknown> };

const headings: Readonly<Record<string, 1 | 2 | 3 | 4 | 5 | 6>> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
const DEPTH_LIMIT = 8;
const blockTypes = new Set([...Object.keys(headings), 'p', 'pre', 'ul', 'ol', 'blockquote', 'hr', 'table', 'html']);

function node(value: unknown): value is Node {
  return object(value) && object(value.props);
}

function kids(value: Node): unknown[] {
  const children = value.props.children;
  if (children === undefined || children === null) return [];
  return Array.isArray(children) ? children : [children];
}

function plain(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (!node(value)) return '';
  if (value.type === 'img') return typeof value.props.alt === 'string' ? value.props.alt : '';
  if (value.type === 'br') return '\n';
  return kids(value).map(plain).join('');
}

function inlines(values: readonly unknown[], depth = 0): ChatInline[] {
  const out: ChatInline[] = [];
  const add = (item: ChatInline) => {
    const last = out.at(-1);
    if (typeof item === 'string' && typeof last === 'string') out[out.length - 1] = last + item;
    else if (item !== '') out.push(item);
  };
  for (const value of values) {
    if (!node(value)) {
      add(plain(value));
      continue;
    }
    const type = value.type;
    if (type === 'img' || type === 'br') add(plain(value));
    else if (depth === DEPTH_LIMIT) for (const item of inlines(kids(value), depth)) add(item);
    else if (type === 'strong' || type === 'em' || type === 'code')
      add({ k: type, c: inlines(kids(value), depth + 1) });
    else if (type === 'a') {
      const href = value.props.href;
      add({
        k: 'link',
        href: typeof href === 'string' && /^https?:/i.test(href) ? href : null,
        c: inlines(kids(value), depth + 1),
      });
    } else for (const item of inlines(kids(value), depth)) add(item);
  }
  return out;
}

function rows(value: Node): Node[] {
  return kids(value)
    .filter(node)
    .flatMap((child) => (child.type === 'tr' ? [child] : rows(child)));
}

function block(value: Node, type: string, depth: number): ChatBlock[] {
  const inner = Math.min(depth + 1, DEPTH_LIMIT);
  const level = headings[type];
  if (level) return [{ k: 'h', level, c: inlines(kids(value)) }];
  switch (type) {
    case 'p':
      return [{ k: 'p', c: inlines(kids(value)) }];
    case 'pre': {
      const language = value.props.language;
      return [
        {
          k: 'code',
          language: typeof language === 'string' && language !== '' ? language : null,
          text: plain(value).replace(/\n$/, ''),
        },
      ];
    }
    case 'ul':
    case 'ol': {
      const start = value.props.start;
      const items = kids(value)
        .filter(node)
        .map((item) => blocks(kids(item), inner));
      if (depth === DEPTH_LIMIT) return items.flat();
      return [{ k: 'list', ordered: type === 'ol', start: typeof start === 'number' ? start : null, items }];
    }
    case 'blockquote': {
      const c = blocks(kids(value), inner);
      return depth === DEPTH_LIMIT ? c : [{ k: 'quote', c }];
    }
    case 'hr':
      return [{ k: 'rule' }];
    case 'table':
      return rows(value).map((row) => ({ k: 'p', c: [kids(row).map(plain).join(' | ')] }));
    default:
      return [{ k: 'p', c: [plain(value).replace(/\n$/, '')] }];
  }
}

function blocks(values: readonly unknown[], depth = 0): ChatBlock[] {
  const out: ChatBlock[] = [];
  let run: unknown[] = [];
  const flush = () => {
    const c = inlines(run);
    run = [];
    if (c.some((item) => typeof item !== 'string' || item.trim() !== '')) out.push({ k: 'p', c });
  };
  for (const value of values) {
    if (node(value) && typeof value.type === 'string' && blockTypes.has(value.type)) {
      flush();
      out.push(...block(value, value.type, depth));
    } else run.push(value);
  }
  flush();
  return out;
}

export function markdownBlocks(source: string): ChatBlock[] {
  try {
    const tree: unknown = Bun.markdown.react(source);
    return node(tree) ? blocks(kids(tree)) : [];
  } catch {
    return source.trim() === '' ? [] : [{ k: 'p', c: [source] }];
  }
}
