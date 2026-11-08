import entryText from '../../docs/procedures/entry.md' with { type: 'text' };
import {
  type Config,
  ConfigError,
  checkSkills,
  parseConfigText,
  skillName,
  validateConfig,
} from '../lib/config-core.ts';
import { entryParts } from '../lib/entry-text.ts';
import type {
  Delivery,
  FileResult,
  Metadata,
  NativeOn,
  NativeTools,
  TextBlock,
  ToolReply,
  TurnChunk,
  TurnInput,
  TurnResult,
} from './native-host.d.ts';

type Reader = (path: string) => Promise<ToolReply>;
type Outcome = { value: unknown } | { error: string };

interface Cached {
  size: number;
  mtimeMs: number;
  outcome: Outcome;
}
interface Entry {
  error?: string;
}
interface Request {
  name?: string;
  path?: string;
  error?: string;
  entry?: Entry;
}
interface OwnedBlock {
  block: TextBlock;
  index: number;
  end: number;
  ticket: string;
  request: Request;
}

const { line: entryLine, contract } = entryParts(entryText);

function joined(folder: string, name: string) {
  return `${folder.replace(/[\\/]$/, '')}/${name}`;
}

function parent(folder: string) {
  const cut = /^[A-Za-z]:[\\/]/.test(folder)
    ? Math.max(folder.lastIndexOf('/'), folder.lastIndexOf('\\'))
    : folder.lastIndexOf('/');
  const value = folder.slice(0, cut);
  return /^[A-Za-z]:$/.test(value) ? `${value}/` : value || '/';
}

function slashed(path: string) {
  return /^[A-Za-z]:[\\/]/.test(path) ? path.replace(/\\/g, '/') : path;
}

function target(root: string, path = '') {
  const prefix = joined(slashed(root), 'skills/');
  const file = slashed(path);
  if (!file.startsWith(prefix)) return;
  const name = /^(.*)\/SKILL\.md$/.exec(file.slice(prefix.length))?.[1];
  return name && skillName.test(name) ? name : undefined;
}

const stopInstruction = '\nReport this entry block only. Do not give goal advice or use another access path.';

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function stopped(error: unknown) {
  const text = error && typeof error === 'object' && 'message' in error ? error.message : undefined;
  return `Celetis entry stopped: ${text || String(error)}${stopInstruction}`;
}

async function* nativeStop(error: string, e: TurnInput): AsyncGenerator<TurnChunk, TurnResult> {
  const answer = error.slice(0, -stopInstruction.length);
  yield { kind: 'text', index: 0, text: answer };
  yield { kind: 'stop', stopReason: 'end_turn', usage: null };
  return { turnId: e.turnId, index: e.index, answer, toolUses: [], stopReason: 'end_turn', usage: null };
}

async function metadata($: NativeTools, path: string) {
  try {
    return await $.fs.stat(path);
  } catch (error) {
    if (/\bENOENT$/.test(message(error))) return null;
    throw new Error(`${path} <document>: ${message(error)}`, { cause: error });
  }
}

async function read<T>(
  reader: Reader,
  path: string,
  stat: Metadata,
  cache: Map<string, Cached>,
  parse: (content: string) => T,
): Promise<T> {
  const answer = await reader(path);
  if (answer.deny || answer.isError) throw new Error(`${path} <document>: ${answer.deny || answer.text}`);
  const result: FileResult | undefined = answer.result && typeof answer.result === 'object' ? answer.result : undefined;
  const file = result?.file;
  if (file?.filePath !== path) throw new Error(`${path} <document>: native Read returned a different path`);
  let outcome: Outcome | undefined;
  if (
    result?.type === 'text' &&
    typeof file.content === 'string' &&
    file.startLine === 1 &&
    Number.isInteger(file.numLines) &&
    typeof file.numLines === 'number' &&
    file.numLines >= 0 &&
    file.numLines === file.totalLines &&
    file.truncatedByTokenCap !== true
  ) {
    try {
      outcome = { value: parse(file.content) };
    } catch (error) {
      outcome = { error: message(error) };
    }
    if (typeof stat.size === 'number' && typeof stat.mtimeMs === 'number')
      cache.set(path, { size: stat.size, mtimeMs: stat.mtimeMs, outcome });
  } else if (result?.type === 'file_unchanged') {
    const previous = cache.get(path);
    if (previous && previous.size === stat.size && previous.mtimeMs === stat.mtimeMs) outcome = previous.outcome;
  }
  if (!outcome) throw new Error(`${path} <document>: native Read did not return the complete file`);
  if ('error' in outcome) throw new Error(outcome.error);
  return outcome.value as T;
}

async function checkout($: NativeTools, reader: Reader, cache: Map<string, Cached>, agentId?: string) {
  let folder = agentId === undefined ? await $.session.root() : await $.session.cwd();
  while (true) {
    const path = joined(folder, '.git');
    const stat = await metadata($, path);
    if (stat?.kind === 'dir') return folder;
    if (stat) {
      if (stat.kind !== 'file' || stat.isLink !== false) throw new Error(`${path} <document>: invalid Git boundary`);
      const directory = await read(reader, path, stat, cache, (content) => {
        const value = /^gitdir: ([^\r\n]+)\r?\n?$/.exec(content)?.[1];
        if (!value) throw new Error(`${path} <document>: invalid gitdir`);
        return /^(\/|[A-Za-z]:[\\/])/.test(value) ? value : joined(folder, value);
      });
      if ((await metadata($, directory))?.kind !== 'dir')
        throw new Error(`${path} <document>: invalid gitdir directory`);
      return folder;
    }
    const above = parent(folder);
    if (above === folder) return null;
    folder = above;
  }
}

async function load($: NativeTools, name: string, reader: Reader, cache: Map<string, Cached>, agentId?: string) {
  const root = await checkout($, reader, cache, agentId);
  if (!root) return { root, custom: '' };
  const path = joined(root, '.celetis.yaml');
  const stat = await metadata($, path);
  if (!stat) return { root, custom: '' };
  if (stat.isLink !== false || stat.kind !== 'file')
    throw new Error(`${path} <document>: config must be a regular file, not a symlink`);
  const config = await read(reader, path, stat, cache, (content): Config => {
    try {
      return validateConfig(parseConfigText(content));
    } catch (error) {
      throw new Error(`${path} ${error instanceof ConfigError ? error.field : '<document>'}: ${message(error)}`);
    }
  });
  await checkSkills(config, $.plugin.root, async (file) => {
    const skill = await metadata($, file);
    return skill?.kind === 'file' && skill.isLink === false;
  }).catch((error: unknown) => {
    throw error instanceof ConfigError ? new Error(`${path} ${error.field}: ${error.message}`) : error;
  });
  return { root, custom: config.custom?.[name] ?? '' };
}

function facts(name: string, plugin: string, root: string | null, custom: string) {
  const lines = [
    `Celetis entry: celetis:${name}`,
    '- host: claude',
    `- plugin: ${plugin}`,
    `- checkout: ${root ?? 'none'}`,
    `- custom: ${custom ? 'after the contract' : 'none'}`,
    '',
    contract,
  ];
  if (custom) lines.push('', `Custom text of celetis:${name}:`, custom);
  return lines.join('\n');
}

export function register(on: NativeOn) {
  const loops = new Map<string | undefined, Entry>();
  const pending = new Map<string, Request>();
  const cache = new Map<string, Cached>();
  function expansion(request: Omit<Request, 'entry'>, text: string) {
    const ticket = `<celetis-entry:${crypto.randomUUID()}>`;
    pending.set(ticket, request);
    return { text: `${ticket}\n${text}` };
  }
  function owned(e: Delivery): OwnedBlock[] {
    return e.message.content.flatMap((block, index) => {
      if (block.type !== 'text') return [];
      const end = block.text.indexOf('\n');
      const ticket = block.text.slice(0, end);
      const request = pending.get(ticket);
      return request ? [{ block, index, end, ticket, request }] : [];
    });
  }
  function rewrite(e: Delivery, blocks: OwnedBlock[], text: string | ((block: OwnedBlock) => string)) {
    return {
      ...e,
      message: {
        ...e.message,
        content: e.message.content.map((part, index) => {
          const selected = blocks.find((block) => block.index === index);
          return selected ? { ...part, text: typeof text === 'function' ? text(selected) : text } : part;
        }),
      },
    };
  }
  on('turn.step', async function* (_$, e, next) {
    const error = loops.get(e.agentId)?.error;
    return yield* error ? nativeStop(error, e) : next(e);
  }).catch(async function* (_$, e, next) {
    const error = loops.get(e.agentId)?.error;
    if (!next.called && error) return yield* nativeStop(error, e);
  });
  on('skill.prompt', async ($, e, next) => {
    const name = target($.plugin.root, e.path);
    if (!name || e.source !== 'plugin' || e.pluginName !== 'celetis' || e.skill !== `celetis:${name}`) {
      return expansion({}, (await next(e)).text);
    }
    try {
      const result = await next(e);
      return expansion({ name, path: e.path }, result.text);
    } catch (error) {
      return expansion({ name, path: e.path, error: stopped(error) }, '');
    }
  }).catch(($, e, next) => {
    const name = target($.plugin.root, e.path);
    return name && e.source === 'plugin' && e.pluginName === 'celetis' && e.skill === `celetis:${name}`
      ? expansion({ name, path: e.path, error: stopped(next.error) }, '')
      : next(e);
  });
  on('session.append', async ($, e, next) => {
    const blocks = owned(e);
    if (!blocks.length) return next(e);
    const index = e.door === 'note' && e.agentId !== undefined ? 1 : 0;
    const { block, end, ticket, request } = blocks[0] as OwnedBlock;
    const bound =
      blocks.length === 1 &&
      blocks[0]?.index === index &&
      !request.entry &&
      e.message.type === 'user' &&
      e.message.role === 'user' &&
      e.message.isMeta === true &&
      typeof e.uuid === 'string' &&
      e.uuid.length > 0 &&
      (e.agentId === undefined || (typeof e.agentId === 'string' && e.agentId.length > 0)) &&
      ((e.door === 'note' && e.origin.kind === 'engine' && e.message.content.length === index + 1) ||
        (e.door === 'tool-message' &&
          e.origin.kind === 'tool' &&
          e.origin.tool === 'Skill' &&
          e.message.content.length === 1));
    if (!bound)
      return next(
        rewrite(e, blocks, (selected) =>
          selected.request.name
            ? stopped('native skill delivery has no supported loop binding')
            : selected.block.text.slice(selected.end + 1),
        ),
      );
    const skill = block.text.slice(end + 1);
    if (!request.name) {
      const previous = loops.get(e.agentId);
      request.entry = {};
      const result = await next(rewrite(e, blocks, skill));
      if (
        loops.get(e.agentId) === previous &&
        (result.message?.content[index] as TextBlock | undefined)?.text === skill
      )
        loops.set(e.agentId, request.entry);
      pending.delete(ticket);
      return result;
    }
    const entry: Entry = { error: request.error };
    request.entry = entry;
    loops.set(e.agentId, entry);
    let text: string;
    try {
      if (entry.error) text = entry.error;
      else {
        const at = skill.indexOf(entryLine);
        if (at < 0) throw new Error(`${request.path} <document>: the skill text has no Celetis entry line`);
        const { root, custom } = await load(
          $,
          request.name,
          (path) => $.tool.call({ tool: 'Read', file_path: path }),
          cache,
          e.agentId,
        );
        if (loops.get(e.agentId) !== entry || entry.error)
          throw new Error(entry.error || 'entry changed while loading');
        text =
          skill.slice(0, at) + facts(request.name, $.plugin.root, root, custom) + skill.slice(at + entryLine.length);
      }
    } catch (error) {
      text = stopped(error);
      if (loops.get(e.agentId) === entry) entry.error = text;
    }
    const result = await next(rewrite(e, blocks, text));
    pending.delete(ticket);
    return result;
  }).catch((_$, e, next) => {
    const blocks = owned(e);
    if (!blocks.length) return next(e);
    const text = stopped(next.error.message || 'native entry hook exceeded its budget');
    for (const { request } of blocks) if (request.name && request.entry) request.entry.error = text;
    return next(
      next.called
        ? e
        : rewrite(e, blocks, (selected) =>
            selected.request.name ? text : selected.block.text.slice(selected.end + 1),
          ),
    );
  });
}
