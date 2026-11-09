import { readFile, realpath } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import {
  type CommandName,
  capPrefix,
  classOf,
  commands,
  type DeclaredClass,
  dispatchStatuses,
  type Entry,
  exitClasses,
  type Flag,
  type Form,
  formText,
  issueActs,
  headings as issueHeadings,
  issueStateKeys,
  labels,
  launcherForms,
  marker,
  pluginContract,
  pluginContractFile,
  servedContracts,
  servedContractsFile,
  setupStatusClosing,
  stepHeader,
  updateHint,
  usageText,
  worktreePathLine,
} from '../engine/lib/contract.ts';
import { entryParts } from '../engine/lib/entry-text.ts';
import { HostError } from '../engine/lib/errors.ts';
import { hostAdapter } from '../engine/lib/hosts.ts';
import { commandInput, createOperation, locateCheckouts } from '../engine/lib/operation.ts';
import { type Job, printJobs, runJobs } from '../engine/lib/parallel.ts';
import { bunArgs, childEnv, run } from '../engine/lib/process.ts';
import { lanes } from '../engine/lib/workflow.ts';
import { findTools, toolPins } from './install-tools.ts';

const root = dirname(import.meta.dir);
const plugin = 'plugins/celetis/';
export const generatedFiles = ['engine/board/board.js', `${plugin}hooks/entry.js`, 'celetis', 'docs/adr/index.md'];
export const fileRoles: Record<string, string> = {
  'engine/lib/vendor/yaml.mjs': 'unchanged vendored parser; checked by its SHA-256 and config type declarations',
  'engine/lib/vendor/yaml.d.mts': 'vendored parser API; checked by strict runtime types',
  'engine/lib/vendor/yaml.LICENSE': 'upstream licence; stays unchanged',
  '.gitignore': 'Git reads this text',
  '.gitattributes': 'Git reads this text',
  '.editorconfig': 'Biome reads these editor settings',
  'engine/board/fonts/OFL.txt': 'upstream font licence; stays unchanged',
  'engine/board/fonts/geist.woff2': 'binary font delivery asset',
  'engine/board/fonts/geist-mono.woff2': 'binary font delivery asset',
  'engine/board/index.html': 'HTML remains exempt until stable Biome HTML checking, per issue 83',
  '.codex/rules/celetis.rules': 'native host permission rules; Codex reads them',
};

export function classify(path: string, source: Buffer): string {
  if (
    /\.(?:sh|pl|jq)$/.test(path) ||
    /^#![^\n]*\b(?:bash|sh|dash|zsh|perl|jq|node)\b/.test(source.toString('utf8', 0, 512))
  )
    throw new Error(`verify: prohibited program: ${path}`);
  if (/[._](?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/.test(path))
    throw new Error(`verify: test file: ${path}: this repository keeps no tests (AGENTS.md, "Verify gate")`);
  if (path.startsWith(plugin) && /\.ts$/.test(path))
    throw new Error(
      `verify: TypeScript in the plugin folder: ${path}: the plugin ships no program source; keep it in engine/ or scripts/`,
    );
  if (generatedFiles.includes(path)) return 'generated';
  if (fileRoles[path]) return /\.json$/.test(path) ? 'biome' : 'role';
  if (/\.ts$/.test(path)) return 'typescript';
  if (/\.(?:json|jsonc|css)$/.test(path)) return 'biome';
  if (/^\.github\/workflows\/[^/]+\.yml$/.test(path)) return 'workflow';
  if (path === '.celetis.yaml') return 'config';
  if (/\.md$/.test(path)) return 'text';
  if (/^plugins\/celetis\/skills\/[^/]+\/agents\/openai\.yaml$/.test(path)) return 'text';
  throw new Error(`verify: no check for ${path}: add a row or an exemption in scripts/verify.ts`);
}

const pluginCitation = /<plugin>\/([A-Za-z0-9._/-]+)(?![A-Za-z0-9._/<>*{-])/g;
const relativeLink = /\]\(([^)\s]+)\)/g;
const quotedNames = /^,\s+"([^"]+)"((?:(?:,\s+and|,|\s+and)\s+"[^"]+")*)/;

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

function headings(text: string): string[] {
  const found: string[] = [];
  Bun.markdown.render(text, {
    codespan: (code) => `\`${code}\``,
    heading: (children) => {
      found.push(collapse(children));
      return '';
    },
  });
  return found;
}

function slugs(text: string): Set<string> {
  const seen = new Map<string, number>();
  const found = new Set<string>();
  for (const heading of headings(text)) {
    const slug = encodeURIComponent(
      heading
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, '')
        .replace(/ /g, '-'),
    );
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    found.add(count === 0 ? slug : `${slug}-${count}`);
  }
  return found;
}

const agentText = (files: ReadonlyMap<string, string>) =>
  [...files].filter(
    ([path]) =>
      /^plugins\/celetis\/skills\/.+\.md$/.test(path) ||
      /^plugins\/celetis\/docs\/(?:procedures|principles)\/[^/]+\.md$/.test(path) ||
      path === `${plugin}step-prompt.md`,
  );

export function checkCitations(files: ReadonlyMap<string, string>): string[] {
  const checked = agentText(files);
  const errors: string[] = [];
  const cited = new Map<string, Set<string>>();
  const agentFiles = new Set(checked.map(([file]) => file));
  const headingCache = new Map<string, string[]>();
  const headingsOf = (path: string) => {
    const known = headingCache.get(path);
    if (known) return known;
    const found = headings(files.get(path) ?? '');
    headingCache.set(path, found);
    return found;
  };
  for (const [file, text] of files) {
    if (!file.startsWith(plugin) || !/\.md$/.test(file)) continue;
    const targets = new Set<string>();
    if (agentFiles.has(file))
      for (const match of text.matchAll(pluginCitation)) {
        const target = (match[1] ?? '').replace(/\.$/, '');
        const cited = `${plugin}${target}`;
        targets.add(cited);
        if (!files.has(cited)) {
          errors.push(`verify: citation: ${file}: <plugin>/${target} is not a tracked file in ${plugin}`);
          continue;
        }
        const end = match.index + match[0].length;
        const quoted =
          text[match.index - 1] === '`' && text[end] === '`' ? quotedNames.exec(text.slice(end + 1)) : null;
        const names = quoted
          ? [quoted[1] ?? '', ...(quoted[2] ?? '').matchAll(/"([^"]+)"/g).map((name) => name[1] ?? '')]
          : [];
        const where = `${file}: line ${text.slice(0, match.index).split('\n').length}: <plugin>/${target}`;
        if (names.length === 0 && /^docs\/[^/]+\.md$/.test(target))
          errors.push(`verify: citation: ${where} needs a quoted section name after the span`);
        if (!cited.endsWith('.md')) continue;
        for (const name of names.map(collapse)) {
          const count = headingsOf(cited).filter((heading) => heading === name).length;
          if (count !== 1)
            errors.push(
              `verify: citation: ${where}, "${name}" ${count === 0 ? 'is not a heading' : `matches ${count} headings`}`,
            );
        }
      }
    for (const [, link = ''] of text.matchAll(relativeLink)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(link) || /[<{*]/.test(link)) continue;
      const hash = link.indexOf('#');
      const target = hash < 0 ? link : link.slice(0, hash);
      const fragment = hash < 0 ? undefined : link.slice(hash + 1);
      const resolved = target === '' ? file : posix.join(posix.dirname(file), target);
      if (target !== '') targets.add(resolved);
      if (!resolved.startsWith(plugin) || !files.has(resolved))
        errors.push(`verify: citation: ${file}: ${target} is not a tracked file in ${plugin}`);
      else if (fragment !== undefined) {
        if (!resolved.endsWith('.md'))
          errors.push(`verify: citation: ${file}: ${link} has a fragment on a file that is not Markdown`);
        else if (!slugs(files.get(resolved) ?? '').has(fragment))
          errors.push(`verify: citation: ${file}: ${link} is not a heading anchor of ${resolved}`);
      }
    }
    cited.set(file, targets);
  }
  for (const [file, text] of files) {
    const principleHostReference =
      /^plugins\/celetis\/docs\/principles\/[^/]+\.md$/.test(file) &&
      (text.includes('docs/hosts/') ||
        [...(cited.get(file) ?? [])].some((target) => target.startsWith(`${plugin}docs/hosts/`)));
    if (
      (/^plugins\/celetis\/(?:skills|docs\/procedures)\//.test(file) && text.includes('docs/hosts/')) ||
      principleHostReference
    )
      errors.push(`verify: host reference: ${file} cites docs/hosts/`);
  }
  for (const [module] of checked) {
    if (!/^plugins\/celetis\/docs\/procedures\/[^/]+\.md$/.test(module)) continue;
    const citers = checked.filter(
      ([file]) =>
        (/^plugins\/celetis\/skills\/.+\.md$/.test(file) || file === `${plugin}step-prompt.md`) &&
        cited.get(file)?.has(module),
    ).length;
    if (citers < 2) errors.push(`verify: module: ${module} is cited by ${citers} skills or the step text; need 2`);
  }
  let entryLine: string | undefined;
  try {
    entryLine = entryParts(files.get(`${plugin}docs/procedures/entry.md`) ?? '').line;
  } catch (error) {
    errors.push(`verify: entry line: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (entryLine)
    for (const [file, text] of checked) {
      if (!/^plugins\/celetis\/skills\/[^/]+\/SKILL\.md$/.test(file)) continue;
      if (text.split(entryLine).length - 1 !== 1)
        errors.push(`verify: entry line: ${file}: need the entry line of ${plugin}docs/procedures/entry.md once`);
    }
  return errors;
}

type Token = { kind: 'word' | 'punct' | 'string' | 'template' | 'regex'; text: string; line: number };

const wordPattern = /[\w$]+/y;
const regexAfter = new Set('return typeof case do else in of new delete void throw instanceof yield await'.split(' '));

function tokens(source: string): Token[] {
  const out: Token[] = [];
  const braces: ('brace' | 'template')[] = [];
  let at = 0;
  let line = 1;
  const advance = (to: number) => {
    for (; at < to; at++) if (source[at] === '\n') line++;
  };
  const template = (start: number, first: boolean) => {
    for (let end = at; end < source.length; end++) {
      if (source[end] === '\\') end++;
      else if (source[end] === '`') {
        const text = source.slice(at, end);
        advance(end + 1);
        out.push({ kind: first ? 'string' : 'template', text, line: start });
        return;
      } else if (source[end] === '$' && source[end + 1] === '{') {
        advance(end + 2);
        braces.push('template');
        return;
      }
    }
    advance(source.length);
  };
  while (at < source.length) {
    const char = source[at] ?? '';
    const next = source[at + 1];
    const start = line;
    const prev = out.at(-1);
    if (/\s/.test(char)) advance(at + 1);
    else if (char === '/' && (next === '/' || next === '*')) {
      const end = source.indexOf(next === '/' ? '\n' : '*/', at + 2);
      advance(end < 0 ? source.length : next === '/' ? end : end + 2);
    } else if (char === "'" || char === '"') {
      let end = at + 1;
      while (end < source.length && source[end] !== char && source[end] !== '\n') end += source[end] === '\\' ? 2 : 1;
      out.push({ kind: 'string', text: source.slice(at + 1, end), line: start });
      advance(end + 1);
    } else if (char === '`') {
      advance(at + 1);
      template(start, true);
    } else if (
      char === '/' &&
      (!prev ||
        (prev.kind === 'punct' && (!')]}'.includes(prev.text) || (prev.text === '}' && prev.line < start))) ||
        (prev.kind === 'word' && regexAfter.has(prev.text)))
    ) {
      let end = at + 1;
      for (let inClass = false; end < source.length && source[end] !== '\n'; end++) {
        if (source[end] === '\\') end++;
        else if (source[end] === '[') inClass = true;
        else if (source[end] === ']') inClass = false;
        else if (source[end] === '/' && !inClass) break;
      }
      while (/[a-z]/.test(source[end + 1] ?? '')) end++;
      out.push({ kind: 'regex', text: source.slice(at, end + 1), line: start });
      advance(end + 1);
    } else if (/[\w$]/.test(char)) {
      wordPattern.lastIndex = at;
      const [word = char] = wordPattern.exec(source) ?? [];
      out.push({ kind: 'word', text: word, line: start });
      advance(at + word.length);
    } else {
      if (char === '{') braces.push('brace');
      if (char === '}' && braces.pop() === 'template') {
        advance(at + 1);
        template(start, false);
        continue;
      }
      out.push({ kind: 'punct', text: char, line: start });
      advance(at + 1);
    }
  }
  return out;
}

const readSide: ReadonlySet<string> = new Set(
  ['perimeter', 'requests', 'reads', 'place', 'presses', 'view', 'start'].map((name) => `engine/board/${name}.ts`),
);
const engineState: ReadonlySet<string> = new Set(
  'resolver tracker operation quota-recovery agent-usage step-end refresh-hints git workflow'.split(' '),
);

export function checkImports(files: ReadonlyMap<string, string>): string[] {
  const errors: string[] = [];
  for (const [file, source] of files) {
    if (!/^engine\/(?:lib|board)\/.+\.ts$/.test(file)) continue;
    const list = tokens(source);
    for (const [index, token] of list.entries()) {
      if (token.kind !== 'string' || !token.text.startsWith('.')) continue;
      const [before, call, member] = [list[index - 1], list[index - 2], list[index - 3]];
      const specifier =
        (before?.kind === 'word' && ['from', 'import'].includes(before.text)) ||
        (before?.text === '(' &&
          call?.kind === 'word' &&
          ['import', 'require'].includes(call.text) &&
          member?.text !== '.');
      if (!specifier) continue;
      const target = posix.join(posix.dirname(file), token.text);
      if (posix.dirname(target) === 'engine' && ![...files.keys()].some((path) => path.startsWith(`${target}/`)))
        errors.push(
          `${file}:${token.line}: A library or board module imports the library, not a command file of engine/ (ADR-0081).`,
        );
      const state = /^engine\/lib\/(.+?)(?:\.ts)?$/.exec(target)?.[1];
      if (!state || !readSide.has(file) || !engineState.has(state)) continue;
      if (
        before?.text === '(' &&
        call?.text === 'import' &&
        !new Bun.Transpiler({ loader: 'ts' })
          .scanImports(source)
          .some((use) => use.kind === 'dynamic-import' && use.path === token.text)
      )
        continue;
      let start = index;
      while (start > 0 && !(list[start]?.kind === 'word' && ['import', 'export'].includes(list[start]?.text ?? '')))
        start--;
      if (before?.text !== '(' && list[start + 1]?.text === 'type' && list[start + 2]?.text !== 'from') continue;
      errors.push(
        `${file}:${token.line}: A read-side board module reads engine state through engine/lib/board-read.ts, not engine/lib/${state}.ts (ADR-0087).`,
      );
    }
  }
  return errors;
}

const otherPrograms: ReadonlySet<string> = new Set([
  'bun',
  'git',
  'gh',
  'claude',
  'codex',
  'hc',
  'herdr-app',
  'impeccable',
]);

type Node = { kind: string; children: (string | Node)[] };
type Text = { prose: string; flow: string; spans: string[]; lines: string[] };
type Block = { own: Text; lead?: Text };
type Mention = { entry: Entry; form: string };
type Outcome =
  | { kind: 'bound'; entries: readonly string[] }
  | { kind: 'undeclared'; entries: readonly string[] }
  | { kind: 'skip'; program: string }
  | { kind: 'unbound' };
export type Binding = Readonly<{ file: string; line: number; reference: string; code: string; outcome: Outcome }>;

const open = '\u{E000}';
const close = '\u{E001}';
const gap = '\u{E002}';
const spanOpen = '\u{E003}';
const spanClose = '\u{E004}';

function tree(text: string): Node {
  const mark = (kind: string) => (children: string) => `${open}${kind}${children}${close}`;
  const rendered = Bun.markdown.render(text, {
    paragraph: mark('p'),
    heading: mark('h'),
    list: mark('l'),
    listItem: mark('i'),
    tr: mark('r'),
    td: mark('c'),
    th: mark('c'),
    codespan: mark('s'),
    code: mark('k'),
  });
  const root: Node = { kind: 'root', children: [] };
  const stack = [root];
  for (const [token, kind] of rendered.matchAll(/\u{E000}([\s\S])|\u{E001}|[^\u{E000}\u{E001}]+/gu)) {
    const top = stack.at(-1) as Node;
    if (kind) {
      const node: Node = { kind, children: [] };
      top.children.push(node);
      stack.push(node);
    } else if (token === close) stack.pop();
    else top.children.push(token);
  }
  return root;
}

const flat = (node: Node): string =>
  node.children.map((child) => (typeof child === 'string' ? child : flat(child))).join('');

function own(node: Node, text: Text = { prose: '', flow: '', spans: [], lines: [] }): Text {
  for (const child of node.children) {
    if (typeof child === 'string') {
      text.prose += child;
      text.flow += child;
    } else if (child.kind === 's') {
      text.flow += `${spanOpen}${text.spans.push(flat(child)) - 1}${spanClose}`;
      text.prose += gap;
    } else if (child.kind === 'k') {
      text.lines.push(...flat(child).split('\n'));
      text.prose += gap;
      text.flow += gap;
    } else if (!['l', 'r', 'h'].includes(child.kind)) {
      text.prose += gap;
      text.flow += gap;
      own(child, text);
      text.prose += gap;
      text.flow += gap;
    }
  }
  return text;
}

function blocks(container: Node, item?: Text): Block[] {
  const found: Block[] = [];
  let stray = '';
  let previous: Node | undefined;
  for (const child of container.children) {
    if (typeof child === 'string') {
      if (!item) stray += child;
      continue;
    }
    if (stray.trim()) found.push({ own: { prose: stray, flow: stray, spans: [], lines: [] } });
    stray = '';
    if (child.kind === 'l') {
      const lead = item ?? (previous?.kind === 'p' ? own(previous) : undefined);
      for (const each of child.children) {
        if (typeof each === 'string') continue;
        const text = own(each);
        found.push({ own: text, ...(lead ? { lead } : {}) }, ...blocks(each, text));
      }
    } else if (child.kind === 'r' || child.kind === 'h' || (!item && (child.kind === 'p' || child.kind === 'k')))
      found.push({ own: own(child.kind === 'k' ? { kind: 'block', children: [child] } : child) });
    previous = child;
  }
  if (stray.trim()) found.push({ own: { prose: stray, flow: stray, spans: [], lines: [] } });
  return found;
}

const words = (span: string) => span.replaceAll(/[[\]]/g, '').match(/(?:<[^>]*>|'[^']*'|"[^"]*"|\S)+/g) ?? [];
const placeholder = (word: string) => (word.startsWith('<') && word.includes('>')) || /^[A-Z][A-Z0-9_]*$/.test(word);
const slot = (word: string) => /^[<'[]/.test(word) || /^[A-Z][A-Z0-9_]*$/.test(word);
const fits = (word: string, formWord: string) =>
  slot(formWord) || placeholder(word) || word === formWord || formWord.split('|').includes(word);
const program = (span: string) => {
  const all = words(span);
  const first = all.findIndex((word) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word));
  return first < 0 ? [] : all.slice(first);
};

function formMatch(text: readonly string[], { words: formWords, flags }: Form): boolean {
  let at = 0;
  for (let index = 0; index < text.length; index++) {
    const word = text[index] as string;
    if (word.startsWith('--') && formWords[at] !== word) {
      const [name, value] = word.split('=');
      const flag = flags.find((each) => each.name === name);
      if (!flag) return false;
      if (flag.value && value === undefined) index++;
      continue;
    }
    const formWord = formWords[at];
    if (formWord === undefined || !fits(word, formWord)) return false;
    at++;
  }
  return formWords.slice(at).every(slot);
}

type Read = { mentions: Mention[]; error?: string };

function read(span: string, line: boolean): Read {
  const all = program(span);
  if (all[0] !== 'celetis') {
    const entries = commands.filter(({ command }) => command === all[0]);
    if (line || all.length < 2 || !entries.length) return { mentions: [] };
    return {
      mentions: entries.flatMap((entry) =>
        entry.forms.filter((each) => formMatch(all, each)).map((each) => ({ entry, form: formText(each) })),
      ),
    };
  }
  const rest = all[1] === '--agent' ? all.slice(3) : all.slice(1);
  const [name] = rest;
  if (name !== undefined && placeholder(name))
    return { mentions: commands.map((entry) => ({ entry, form: rest.join(' ') })) };
  if (launcherForms.some((each) => formMatch(rest, each))) return { mentions: [] };
  const entries = commands.filter(({ command }) => command === name);
  if (!entries.length) return { mentions: [], error: `\`${span}\` names no command` };
  const mentions = entries.flatMap((entry) =>
    entry.forms.filter((each) => formMatch(rest, each)).map((each) => ({ entry, form: formText(each) })),
  );
  if (mentions.length) return { mentions };
  const declared = entries.flatMap(({ forms }) => forms.map(formText)).join(' | ');
  return { mentions, error: `\`${span}\` matches no form of ${name}: ${declared}` };
}

const labelNames: ReadonlySet<string> = new Set(labels);
const labelEffect = /\b(?:adds|added|removes|removed|keeps|kept|retains|retained|restores|restored|clears|cleared)\b/gi;
const spanMark = new RegExp(`${spanOpen}(\\d+)${spanClose}`, 'gu');
const prefixes = [...new Set(Object.values(lanes).map(({ prefix }) => prefix))].join('|');
const branchForm = new RegExp(`(?<![\\w-])(?:${prefixes})(?:\\|(?:${prefixes}))*\\/(?:<|\\d)`, 'g');

const exitReference =
  /\b(?:[Ee]xits?\s+with|(?:[Ee]xits?|[Ss]tatus)(?:\s+(?:status|codes?))?)\s+(?:128\+n|\d+)(?![\d+])(?:(?:\s*\([^)]*\))?(?:\s*,\s*(?:or\s+|and\s+)?|\s+(?:or|and)\s+)(?:128\+n|\d+)(?![\d+]))*/g;

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
type Range = { index: number; end: number };
const destination = '\\]\\([^)]*\\)';
function locate(source: string, from: number, text: string): Range[] {
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const word = (part: string) => [...part].map(literal).join(`(?:[*_\`]|${destination})*`);
  const pattern = new RegExp(parts.map(word).join(`(?:[\\s*_>|\`[\\]]|${destination})+`), 'g');
  pattern.lastIndex = from;
  const match = pattern.exec(source);
  return match ? [{ index: match.index, end: match.index + match[0].length }] : [];
}
const lineAt = (source: string, index: number) => source.slice(0, index).split('\n').length;
const declares = (code: string) => {
  const name: DeclaredClass | null = code === '128+n' ? 'signal' : classOf(Number(code));
  return ({ entry }: Mention) => name !== null && entry.exits.includes(name);
};
const formsOf = (list: readonly Mention[]) => [...new Set(list.map(({ form }) => form))];

const restated = 'name the act and the outcome that the agent acts on';

function scan(files: ReadonlyMap<string, string>): { bindings: Binding[]; errors: string[] } {
  const found: Binding[] = [];
  const errors: string[] = [];
  for (const [file, source] of agentText(files)) {
    let cursor = 0;
    for (const { own: text, lead } of blocks(tree(source))) {
      const segments = text.prose.split(gap).filter((each) => each.trim());
      const head = segments[0]?.trim().split(/\s+/).slice(0, 3).join(' ') ?? '';
      const anchors = [head, text.spans[0] ?? '', text.lines.find((l) => l.trim()) ?? ''];
      const located = anchors.flatMap((anchor) => locate(source, cursor, anchor));
      const start = located.length ? Math.min(...located.map(({ index }) => index)) : cursor;
      let end = Math.max(start + 1, ...located.map((range) => range.end));
      const at = (part: string, from = start) => {
        const [range] = locate(source, from, part);
        if (!range) return from;
        end = Math.max(end, range.end);
        return range.index;
      };
      at(segments.at(-1)?.trim().split(/\s+/).slice(-3).join(' ') ?? '');
      const mentions: Mention[] = [];
      const reads = [
        ...text.spans.map((span) => [span, read(span, false)] as const),
        ...text.lines.map((each) => [each, read(each, true)] as const),
      ];
      for (const [span, { mentions: named, error }] of reads) {
        mentions.push(...named);
        if (error) errors.push(`verify: contract: ${file}:${lineAt(source, at(span))}: ${error}`);
      }
      for (const span of lead?.spans ?? []) mentions.push(...read(span, false).mentions);
      for (const each of lead?.lines ?? []) mentions.push(...read(each, true).mentions);
      const programs = [...text.spans, ...(lead?.spans ?? [])].flatMap((span) => {
        const name = program(span)[0]?.split('/').at(-1);
        return name && otherPrograms.has(name) ? [name] : [];
      });
      let from = start;
      for (const [match] of text.prose.matchAll(exitReference)) {
        const reference = match.replaceAll(/\s+/g, ' ');
        from = at(reference, from);
        const line = lineAt(source, from);
        from++;
        for (const [code] of reference.replaceAll(/\([^)]*\)/g, '').matchAll(/128\+n|\d+/g)) {
          const outcome: Outcome = mentions.length
            ? mentions.some(declares(code))
              ? { kind: 'bound', entries: formsOf(mentions.filter(declares(code))) }
              : { kind: 'undeclared', entries: formsOf(mentions) }
            : programs[0]
              ? { kind: 'skip', program: programs[0] }
              : { kind: 'unbound' };
          found.push({ file, line, reference, code, outcome });
          if (outcome.kind === 'undeclared')
            errors.push(
              `verify: contract: ${file}:${line}: "${reference}": ${code} is not declared by ${outcome.entries.join(' | ')}`,
            );
          if (outcome.kind === 'unbound')
            errors.push(`verify: contract: ${file}:${line}: "${reference}": name the command of this exit`);
        }
      }
      from = start;
      for (const sentence of text.flow.split(new RegExp(`${gap}|[.!?](?=\\s)`, 'u'))) {
        for (const effect of sentence.matchAll(labelEffect)) {
          const tail = sentence.slice((effect.index ?? 0) + effect[0].length);
          const [hit] = [...tail.matchAll(spanMark)].flatMap((mark) => {
            const name = text.spans[Number(mark[1])];
            return name !== undefined && labelNames.has(name) ? [{ mark, name }] : [];
          });
          if (!hit) continue;
          const { mark, name } = hit;
          const middle = tail.slice(0, mark.index).replaceAll(spanMark, (_, index) => text.spans[Number(index)] ?? '');
          from = at(`${effect[0]} ${middle} ${name}`, from);
          errors.push(`verify: restated policy: ${file}:${lineAt(source, from)}: ${restated}`);
          from++;
          break;
        }
      }
      const branches = [...text.spans, ...segments].flatMap((part) => part.match(branchForm) ?? []);
      for (const form of branches) {
        from = at(form, from);
        errors.push(`verify: restated policy: ${file}:${lineAt(source, from)}: ${restated}`);
        from++;
      }
      cursor = end;
    }
  }
  return { bindings: found, errors };
}

export const bindings = (files: ReadonlyMap<string, string>): readonly Binding[] => scan(files).bindings;

export const checkContract = (files: ReadonlyMap<string, string>): string[] => scan(files).errors;

const flagShape = ({ name, value, optional }: Flag) => ({ name, value: value ?? null, optional });
const formShape = ({ words, flags, passThrough }: Form) => ({
  words,
  flags: flags.map(flagShape),
  passThrough: passThrough !== undefined,
});

export function contractDigest(): string {
  const header = {
    issue: 1,
    step: '<step>',
    host: '<host>',
    main: '<main>',
    pluginRoot: '<plugin>',
    landing: '<landing>',
  };
  const canonical = {
    exits: exitClasses.map(({ code, name }) => [code, name]),
    labels,
    headings: issueHeadings,
    markers: [marker('general'), marker('during-the-build')],
    keys: issueStateKeys,
    statuses: dispatchStatuses,
    lines: [
      capPrefix,
      updateHint,
      setupStatusClosing('<main>'),
      worktreePathLine('<path>'),
      stepHeader(header),
      stepHeader({ ...header, recovery: true }),
    ],
    commands: commands
      .map(({ command, agent, internal, exits, forms }) => ({
        command,
        agent,
        internal: internal ?? false,
        exits,
        forms: forms.map(formShape),
      }))
      .map((entry) => JSON.stringify(entry))
      .sort(),
    launcher: launcherForms.map(formShape),
    acts: Object.entries(issueActs)
      .map(([name, { words, flags, argument }]) => ({ name, words, flags: flags.map(flagShape), argument }))
      .sort((a, b) => (a.name < b.name ? -1 : 1)),
    usage: [...new Set<CommandName>(commands.map(({ command }) => command))]
      .sort()
      .map((command) => usageText(command)),
  };
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function checkContractVersion(files: ReadonlyMap<string, string>): string[] {
  const pluginFile = `${plugin}${pluginContractFile}`;
  const needs = pluginContract(files.get(pluginFile) ?? '');
  if (needs === null)
    return [`verify: contract version: ${pluginFile} declares no valid contract version; write { "contract": <n> }`];
  const served = servedContracts(files.get(servedContractsFile) ?? '');
  if (served === null) return [`verify: contract version: ${servedContractsFile} declares no valid served versions`];
  const versions = [...served.keys()].sort((a, b) => a - b);
  const newest = versions[versions.length - 1] as number;
  const errors: string[] = [];
  if (!served.has(needs))
    errors.push(
      `verify: contract version: the plugin needs contract ${needs} and the program serves ${versions.join(', ')}; serve ${needs} in ${servedContractsFile}, or set ${pluginFile} to a served version`,
    );
  const digest = contractDigest();
  if (served.get(newest) !== digest)
    errors.push(
      `verify: contract version: the declarations of engine/lib/contract.ts changed, and contract ${newest} records another digest; raise the contract version: add { "contract": ${newest + 1}, "digest": "${digest}" } to ${servedContractsFile}, and set ${pluginFile} to ${newest + 1} when the plugin text needs it`,
    );
  return errors;
}

export async function main(argv: string[]): Promise<number> {
  try {
    const { args, explicit } = commandInput(argv);
    return await execute(args, explicit);
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    if (error.message) console.error(error.message);
    return error.code;
  }
}

async function execute(args: string[], explicit: string | undefined): Promise<number> {
  if (args.length) {
    console.error('usage: scripts/verify.ts');
    return 2;
  }
  const operation = await createOperation(
    await locateCheckouts(process.cwd()),
    { explicit: explicit ?? process.env.CELETIS_AGENT ?? 'claude' },
    'host',
  );
  await hostAdapter(operation.host).checkHome();
  process.chdir(root);
  process.env.PATH = childEnv().PATH;
  try {
    for (const name of ['git', 'claude'])
      if (!Bun.which(name)) throw new Error(`verify: ${name} is missing (plugins/celetis/README.md, "Requirements")`);
    const tools = await findTools();
    const claude = await realpath(Bun.which('claude') as string);
    const actionVersion = await run(tools.actionlint.file, ['--version']);
    tools.actionlint.version = /\d+\.\d+\.\d+/.exec(actionVersion.stdout + actionVersion.stderr)?.[0] ?? '';
    const versions: Record<string, string> = {
      actionlint: tools.actionlint.version,
      biome: tools.biome.version,
      tsc: tools.tsc.version,
      '@types/bun': tools.bunTypesVersion,
    };
    for (const pin of await toolPins()) {
      const version = versions[pin.name] ?? '';
      console.log(`== ${pin.name} ${version}`);
      if (version !== pin.version)
        console.log(`verify: warning: ${pin.name} ${version} is not the pin ${pin.version} (scripts/install-tools.ts)`);
    }
    const listed = await run('git', ['ls-files', '-z']);
    if (listed.code) throw new Error(listed.stderr);
    const files = listed.stdout.split('\0').filter(Boolean);
    const biome: string[] = [];
    const workflows: string[] = [];
    const texts = new Map<string, string>();
    let unknown = false;
    for (const path of files) {
      try {
        const source = await readFile(path);
        texts.set(path, source.toString('utf8'));
        const role = classify(path, source);
        if (['biome', 'typescript'].includes(role)) biome.push(path);
        if (role === 'workflow') workflows.push(path);
      } catch (error) {
        console.error((error as Error).message);
        unknown = true;
      }
    }
    const textErrors = [
      ...checkCitations(texts),
      ...checkContract(texts),
      ...checkImports(texts),
      ...checkContractVersion(texts),
    ];
    for (const line of textErrors) console.error(line);
    if (unknown || textErrors.length) {
      console.log('verify: FAIL');
      return 1;
    }
    const vendor = await readFile('engine/lib/vendor/yaml.mjs');
    if (
      new Bun.CryptoHasher('sha256').update(vendor).digest('hex') !==
      '4ff31df191fa26a9cf07ef43fd233964e554426bd0dd314009bd9e1a377f0bd7'
    )
      throw new Error('verify: the vendored parser differs from its recorded source');
    const job = (label: string, file: string, args: string[]): Job => ({ label, file, args, cwd: root });
    const validate = (label: string, folder: string) =>
      /\.(?:c?js|mjs)$/.test(claude)
        ? job(label, process.execPath, bunArgs(claude, ['plugin', 'validate', folder]))
        : job(label, claude, ['plugin', 'validate', folder]);
    const jobs: Job[] = [
      job('biome', tools.biome.file, [
        ...tools.biome.args,
        'check',
        '--error-on-warnings',
        '--max-diagnostics=none',
        ...biome,
      ]),
      job('actionlint', tools.actionlint.file, ['-shellcheck=', ...workflows]),
      job('config', process.execPath, bunArgs(join(root, 'engine/config.ts'), [root, join(root, 'plugins/celetis')])),
      job('tsc runtime', tools.tsc.file, [
        ...tools.tsc.args,
        '-p',
        'tsconfig.runtime.json',
        '--typeRoots',
        tools.typeRoots,
      ]),
      job('tsc browser', tools.tsc.file, [
        ...tools.tsc.args,
        '-p',
        'engine/board/page/tsconfig.json',
        '--typeRoots',
        tools.typeRoots,
      ]),
      job('tsc native', tools.tsc.file, [...tools.tsc.args, '-p', 'tsconfig.native.json']),
      job('build', process.execPath, bunArgs(join(root, 'scripts/build.ts'), ['--check'])),
      validate('plugin', 'plugins/celetis'),
      validate('catalog', '.'),
    ];
    console.log('== tsc');
    const results = await runJobs(jobs);
    for (const result of results) {
      if (result.label === 'config' && result.code) result.code = 1;
      console.log(`== ${result.label === 'biome' ? 'biome check' : result.label}`);
      if (result.label === 'biome' && /Found .* info/.test(result.output)) result.code = 1;
      if (result.label === 'biome' && result.code)
        result.output += 'verify: fix each file that Biome names above with biome check --write <file>\n';
      if (result.label.startsWith('tsc ')) result.label = 'tsc';
    }
    const code = printJobs(results);
    console.log(`verify: ${code ? 'FAIL' : 'PASS'}`);
    return code;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
