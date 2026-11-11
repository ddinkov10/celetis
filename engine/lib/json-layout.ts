import { isDeepStrictEqual } from 'node:util';

export type JSONStyle = Readonly<{ indent: string; newline: '\n' | '\r\n' }>;
type Item = (before: string, comma: boolean) => string;
type Node =
  | { kind: 'scalar'; start: number; end: number }
  | { kind: 'array'; start: number; end: number; items: readonly Node[] }
  | { kind: 'object'; start: number; end: number; members: readonly Member[] };
type Member = { key: string; keyStart: number; value: Node };

const lineWidth = 80;

function indentUnit(source: string): string | undefined {
  const lead = source.match(/^[ \t]+(?=[^ \t\r\n])/m)?.[0];
  if (lead === undefined) return undefined;
  return lead.startsWith('\t') ? '\t' : ' '.repeat(lead.length <= 7 ? lead.length : 2);
}

export function jsonStyle(source: string, other: string): JSONStyle {
  return {
    indent: indentUnit(source) ?? indentUnit(other) ?? '  ',
    newline: source.match(/\r?\n/)?.[0] === '\r\n' ? '\r\n' : '\n',
  };
}

function columns(line: string): number {
  const lead = /^[ \t]*/.exec(line)?.[0] ?? '';
  return lead.length + lead.split('\t').length - 1 + Bun.stringWidth(line.slice(lead.length));
}

const scalar = (value: unknown) => value === null || typeof value !== 'object';
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const lastLine = (text: string) => text.slice(text.lastIndexOf('\n') + 1);

function oneLine(items: readonly string[], before: string, comma: boolean): string | undefined {
  const line = `[${items.join(', ')}]`;
  return columns(`${before}${line}${comma ? ',' : ''}`) <= lineWidth ? line : undefined;
}

function block(open: string, close: string, before: string, style: JSONStyle, items: readonly Item[]): string {
  if (!items.length) return open + close;
  const indent = /^[ \t]*/.exec(before)?.[0] ?? '';
  const inner = indent + style.indent;
  const lines = items.map((item, i) => `${style.newline}${inner}${item(inner, i < items.length - 1)}`);
  return `${open}${lines.join(',')}${style.newline}${indent}${close}`;
}

function member(head: string, value: (before: string, comma: boolean) => string): Item {
  return (before, comma) => head + value(lastLine(before + head), comma);
}

export function layoutJSON(value: unknown, style: JSONStyle, before = '', comma = false): string {
  if (scalar(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => JSON.stringify(item));
    const line = value.every(scalar) ? oneLine(items, before, comma) : undefined;
    return (
      line ??
      block(
        '[',
        ']',
        before,
        style,
        value.map((item) => (inner: string, more: boolean) => layoutJSON(item, style, inner, more)),
      )
    );
  }
  return block(
    '{',
    '}',
    before,
    style,
    Object.entries(value as Record<string, unknown>).map(([key, item]) =>
      member(`${JSON.stringify(key)}: `, (start, more) => layoutJSON(item, style, start, more)),
    ),
  );
}

function scan(source: string): Node {
  let i = 0;
  const skip = () => {
    while (' \t\r\n'.includes(source[i] ?? '-')) i++;
  };
  const string = () => {
    i++;
    while (source[i] !== '"') i += source[i] === '\\' ? 2 : 1;
    i++;
  };
  const node = (): Node => {
    skip();
    const start = i;
    const open = source[i];
    if (open === '{' || open === '[') {
      i++;
      const members: Member[] = [];
      const items: Node[] = [];
      skip();
      if (source[i] === (open === '{' ? '}' : ']')) i++;
      else
        for (let more = true; more; more = source[i++] === ',') {
          if (open === '{') {
            skip();
            const keyStart = i;
            string();
            const key = JSON.parse(source.slice(keyStart, i)) as string;
            skip();
            i++;
            members.push({ key, keyStart, value: node() });
          } else items.push(node());
          skip();
        }
      return open === '{' ? { kind: 'object', start, end: i, members } : { kind: 'array', start, end: i, items };
    }
    if (open === '"') string();
    else while (i < source.length && !' \t\r\n,]}'.includes(source[i] as string)) i++;
    return { kind: 'scalar', start, end: i };
  };
  return node();
}

export function editJSON(
  source: string,
  after: unknown,
  style: JSONStyle,
  replaced: readonly (readonly string[])[],
): string {
  const text = (node: Node) => source.slice(node.start, node.end);
  const edit = (node: Node, value: unknown, path: readonly string[], before: string, comma: boolean): string => {
    if (isDeepStrictEqual(JSON.parse(text(node)), value)) return text(node);
    const owned = replaced.some((ownedPath) => isDeepStrictEqual(ownedPath, path));
    if (node.kind === 'object' && isObject(value) && !owned) {
      const keys = Object.keys(value);
      const kept = node.members.filter((m) => Object.hasOwn(value, m.key));
      const keptValue = (m: Member) => (start: string, more: boolean) =>
        edit(m.value, value[m.key], [...path, m.key], start, more);
      if (kept.length === node.members.length && keys.length === kept.length) {
        let out = '';
        let at = node.start;
        node.members.forEach((m, i) => {
          out += source.slice(at, m.value.start);
          out += keptValue(m)(lastLine(before + out), i < node.members.length - 1);
          at = m.value.end;
        });
        return out + source.slice(at, node.end);
      }
      return block('{', '}', before, style, [
        ...kept.map((m) => member(source.slice(m.keyStart, m.value.start), keptValue(m))),
        ...keys
          .filter((key) => !node.members.some((m) => m.key === key))
          .map((key) =>
            member(`${JSON.stringify(key)}: `, (start, more) => layoutJSON(value[key], style, start, more)),
          ),
      ]);
    }
    if (node.kind === 'array' && Array.isArray(value) && !owned) {
      const kept: Node[] = [];
      for (const item of node.items)
        if (kept.length < value.length && isDeepStrictEqual(JSON.parse(text(item)), value[kept.length]))
          kept.push(item);
      const added = value.slice(kept.length);
      const line = value.every(scalar)
        ? oneLine([...kept.map(text), ...added.map((item) => JSON.stringify(item))], before, comma)
        : undefined;
      return (
        line ??
        block('[', ']', before, style, [
          ...kept.map((item) => () => text(item)),
          ...added.map((item) => (start: string, more: boolean) => layoutJSON(item, style, start, more)),
        ])
      );
    }
    return layoutJSON(value, style, before, comma);
  };
  const root = scan(source);
  const lead = source.slice(0, root.start);
  return lead + edit(root, after, [], lastLine(lead), false) + source.slice(root.end);
}
