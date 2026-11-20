export type Grammar = Readonly<{
  pattern: string;
  query: string;
  accepts(text: string): boolean;
  compare(a: string, b: string): number;
}>;

export const github: Grammar = {
  pattern: '[1-9][0-9]*',
  query: '[0-9]+',
  accepts: (text) => Number.isSafeInteger(Number(text)),
  compare: (a, b) => Number(a) - Number(b),
};

export function grammar(): Grammar {
  return github;
}
