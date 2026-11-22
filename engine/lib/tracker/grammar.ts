export type TrackerKind = 'github' | 'local';

export type Grammar = Readonly<{
  kind: TrackerKind;
  tracker: string;
  pattern: string;
  query: string;
  accepts(text: string): boolean;
  compare(a: string, b: string): number;
}>;

export const github: Grammar = {
  kind: 'github',
  tracker: 'GitHub',
  pattern: '[1-9][0-9]*',
  query: '[0-9]+',
  accepts: (text) => Number.isSafeInteger(Number(text)),
  compare: (a, b) => Number(a) - Number(b),
};

export const local: Grammar = {
  kind: 'local',
  tracker: 'the local tracker',
  pattern: '[0-9a-f]{7}',
  query: '[0-9a-f]{1,7}',
  accepts: () => true,
  compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
};

let current = github;

export function useGrammar(kind: TrackerKind): void {
  current = kind === 'local' ? local : github;
}

export function grammar(): Grammar {
  return current;
}
