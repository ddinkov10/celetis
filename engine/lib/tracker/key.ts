import { grammar } from './grammar.ts';

declare const issueKey: unique symbol;

export type IssueKey = string & { readonly [issueKey]: true };

const envelope = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?$/;

export function parseKey(text: string): IssueKey | null {
  const { pattern, accepts } = grammar();
  return envelope.test(text) && new RegExp(`^(?:${pattern})$`).test(text) && accepts(text) ? (text as IssueKey) : null;
}

export function parseHandle(text: string): IssueKey | null {
  return parseKey(text.startsWith('#') ? text.slice(1) : text);
}

export function isKey(value: unknown): value is IssueKey {
  return typeof value === 'string' && parseKey(value) !== null;
}

export function compareKeys(a: IssueKey, b: IssueKey): number {
  return grammar().compare(a, b);
}

export function keySource(): string {
  return `(?:${grammar().pattern})`;
}
