import { parseAllDocuments } from 'yaml';
import type { z } from 'zod';
import { keySource, parseKey } from '../tracker/key.ts';
import type { AcceptedEpic, EpicDeclaration } from '../workflow/workflow.ts';
import {
  type AcceptedEpicResult,
  acceptance,
  accepted,
  children,
  compare,
  type EpicChild,
  type EpicForms,
  type EpicResult,
  type EpicSubmission,
  string,
  submission,
} from './schemas.ts';

type Path = readonly PropertyKey[];

function label(path: Path, root: string, prefixed: readonly string[]): string {
  // An item of a list of strings carries the label of its list.
  const listed = path.at(-2) === 'reports' || (path.at(-2) === 'children' && path.at(-4) === 'scenarios');
  const segments = listed && typeof path.at(-1) === 'number' ? path.slice(0, -1) : path;
  return segments.reduce<string>(
    (text, segment, index) =>
      typeof segment === 'number'
        ? `${text}[${segment}]`
        : index === 0 && !prefixed.includes(String(segment))
          ? String(segment)
          : `${text}.${String(segment)}`,
    root,
  );
}

function line(issue: z.core.$ZodIssue, input: unknown, root: string, prefixed: readonly string[]): string {
  const { path } = issue;
  if (issue.code === 'unrecognized_keys') return `${label(path, root, prefixed)}: unknown field ${issue.keys[0]}`;
  const field = path.at(-1);
  const parent = path.slice(0, -1).reduce<unknown>((node, key) => (node as Record<PropertyKey, unknown>)[key], input);
  if (
    issue.code !== 'invalid_union' &&
    typeof field === 'string' &&
    typeof parent === 'object' &&
    parent !== null &&
    !Object.hasOwn(parent, field)
  ) {
    return `${label(path.slice(0, -1), root, prefixed)}.${field}: missing field`;
  }
  return `${label(path, root, prefixed)}: ${issue.message}`;
}

function checked<S extends z.ZodType>(
  schema: S,
  value: unknown,
  root: string,
  prefixed: readonly string[] = [],
): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new Error(line(result.error.issues[0] as z.core.$ZodIssue, value, root, prefixed));
}

function json(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const documents = parseAllDocuments(text, { uniqueKeys: true });
  const error = documents.flatMap((document) => document.errors)[0];
  if (error) throw new Error(`invalid JSON object: ${error.message.split('\n')[0]}`);
  return value;
}

function githubRepository(value: unknown): string {
  const text = checked(string, value, 'repository');
  const url = new URL(text);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.href !== text ||
    !/^\/[\w.-]+\/[\w.-]+$/.test(url.pathname)
  ) {
    throw new Error('repository: need a canonical repository URL');
  }
  return text;
}

export const githubForms: EpicForms = {
  repository: githubRepository,
  issueUrl: (repository, key) => `${repository}/issues/${key}`,
  issueKey(url) {
    const match = new RegExp(`^(.*)/issues/(${keySource()})$`).exec(url);
    const key = match && parseKey(match[2] as string);
    if (!match || key === null) return null;
    return { repository: githubRepository(match[1]), key };
  },
};

export function parseEpicChildren(value: unknown, forms: EpicForms): EpicChild[] {
  return checked(children(forms), value, 'children');
}

function sectionOf(body: string): string {
  const lines = body.split('\n');
  const sections: string[] = [];
  let start: number | null = null;
  let fence: { character: string; length: number } | null = null;
  for (const [index, line] of lines.entries()) {
    const delimiter = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    const ticks = delimiter?.[1];
    const tail = delimiter?.[2] ?? '';
    if (fence) {
      if (ticks && ticks.charAt(0) === fence.character && ticks.length >= fence.length && !tail.trim()) {
        fence = null;
      }
      continue;
    }
    if (ticks) {
      fence = { character: ticks.charAt(0), length: ticks.length };
      continue;
    }
    if (!line.startsWith('## ')) continue;
    if (start !== null) {
      sections.push(`${lines.slice(start, index).join('\n')}\n`);
      start = null;
    }
    if (/^## Epic acceptance[ \t]*$/.test(line)) start = index;
  }
  if (start !== null) sections.push(lines.slice(start).join('\n'));
  const [section] = sections;
  if (sections.length !== 1 || section === undefined)
    throw new Error('need exactly one top-level ## Epic acceptance section');
  return section;
}

export function parseEpicAcceptance(body: string | null, forms: EpicForms): EpicDeclaration {
  try {
    const section = sectionOf((body ?? '').replaceAll('\r\n', '\n'));
    const content = section.slice(section.indexOf('\n') + 1);
    const fenced = /^\s*```json\n([\s\S]*?)\n```[ \t]*(?:\n\s*)?$/.exec(content)?.[1];
    if (fenced === undefined) throw new Error('acceptance: need one bounded json fence and no other content');
    return {
      kind: 'valid',
      acceptance: checked(acceptance(forms), json(fenced), 'acceptance', ['mode', 'rationale']),
      definitionHash: new Bun.CryptoHasher('sha256').update(section).digest('hex'),
    };
  } catch (error) {
    return { kind: 'unresolved', reason: error instanceof Error ? error.message : String(error) };
  }
}

export function parseEpicSubmission(text: string, forms: EpicForms): EpicSubmission {
  return checked(submission(forms), json(text), 'submission');
}

export function parseAcceptedEpic(text: string, forms: EpicForms): AcceptedEpic & { completionId: string } {
  const { mode, completionId, ...evidence } = checked(accepted(forms), json(text), 'accepted', ['mode']);
  let record: AcceptedEpic;
  if (mode === 'independent') {
    if (evidence.targets.length || evidence.results.length)
      throw new Error('independent acceptance has no targets or results');
    record = { ...evidence, mode, targets: [], results: [] };
  } else {
    const all: readonly EpicResult[] = evidence.results;
    const results = all.filter(
      (result): result is AcceptedEpicResult => result.result === 'PASS' || result.result === 'inapplicable',
    );
    if (results.length !== evidence.results.length || !results.length)
      throw new Error('combined acceptance needs accepted results');
    record = { ...evidence, mode, results };
  }
  if (completionId !== completionIdentity(record)) throw new Error('accepted.completionId: does not match record');
  return { ...record, completionId };
}

export function completionIdentity(record: AcceptedEpic): string {
  const value = {
    repository: record.repository,
    parent: record.parent,
    mode: record.mode,
    definitionHash: record.definitionHash,
    children: [...record.children]
      .sort((a, b) => compare(a.url, b.url))
      .map((child) => ({
        url: child.url,
        id: child.id,
        number: child.number,
        state: child.state,
        stateReason: child.stateReason,
        closedAt: child.closedAt,
      })),
    targets: [...record.targets]
      .sort((a, b) => compare(a.name, b.name))
      .map((target) => ({
        name: target.name,
        source: target.source.dirty
          ? {
              checkout: target.source.checkout,
              commit: target.source.commit,
              dirty: true,
              snapshot: target.source.snapshot,
            }
          : { checkout: target.source.checkout, commit: target.source.commit, dirty: false },
        runtime: target.runtime,
        sourceToFiles: target.sourceToFiles,
        filesToTarget: target.filesToTarget,
      })),
    results: [...record.results]
      .sort((a, b) => compare(a.scenario, b.scenario))
      .map((result) =>
        result.result === 'PASS'
          ? {
              scenario: result.scenario,
              result: result.result,
              target: result.target,
              observation: result.observation,
              oracle: result.oracle,
              reports: [...result.reports].sort(compare),
            }
          : {
              scenario: result.scenario,
              result: result.result,
              rationale: result.rationale,
              decision: result.decision,
            },
      ),
  };
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}
