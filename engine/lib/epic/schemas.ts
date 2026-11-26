import { z } from 'zod';
import { revision } from '../state/fields.ts';
import { type IssueKey, isKey } from '../tracker/key.ts';

export type EpicForms = Readonly<{
  repository(value: unknown): string;
  issueUrl(repository: string, key: IssueKey): string;
  issueKey(url: string): Readonly<{ repository: string; key: IssueKey }> | null;
}>;

const nonblank = 'need a nonblank, NUL-free string';
export const string = z
  .string({ error: nonblank })
  .refine((value) => value.trim() !== '' && !value.includes('\0'), { error: nonblank, abort: true });
const key = z.custom<IssueKey>(isKey, { error: 'need an issue key' });
const empty = { error: 'must not be empty' };
const duplicate = { error: 'duplicate identity' };
const distinct = (values: readonly unknown[]) => new Set(values).size === values.length;

function strict<Shape extends z.core.$ZodLooseShape>(shape: Shape) {
  return z.strictObject(shape, { error: 'need an object' });
}

function list<Item extends z.ZodType>(item: Item) {
  return z.array(item, { error: 'need an array' });
}

// A discriminated union reports a present non-object at its own path, but the line names the discriminator.
const tagged = (value: unknown) =>
  value === undefined || (typeof value === 'object' && value !== null && !Array.isArray(value)) ? value : {};

export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function iso(text: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(text);
  return (
    match !== null &&
    Number.isFinite(Date.parse(text)) &&
    new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) === match[1] &&
    Number(match[2]) <= 23 &&
    Number(match[3]) <= 59 &&
    Number(match[4]) <= 59 &&
    Number(match[6] ?? 0) <= 23 &&
    Number(match[7] ?? 0) <= 59
  );
}

const timestamp = string.refine(iso, { error: 'need an ISO timestamp', abort: true });
const digest = string.regex(/^[0-9a-f]{64}$/, { error: 'need a SHA-256 digest', abort: true });

const issueUrl = (forms: EpicForms) =>
  string.refine((url) => forms.issueKey(url) !== null, { error: 'need a canonical issue URL', abort: true });

const child = (forms: EpicForms) =>
  strict({
    url: issueUrl(forms),
    id: string,
    number: key,
    state: z.enum(['open', 'closed'], { error: 'need open or closed' }),
    stateReason: z
      .enum(['completed', 'not_planned', 'duplicate', 'reopened'], { error: 'invalid state reason' })
      .nullable(),
    closedAt: timestamp.nullable(),
  })
    .refine((child) => forms.issueKey(child.url)?.key === child.number, { error: 'URL and number differ', abort: true })
    .refine((child) => (child.state === 'closed') === (child.closedAt !== null), {
      error: 'state and closedAt differ',
    });

export const children = (forms: EpicForms) =>
  list(child(forms))
    .refine((children) => distinct(children.map((child) => child.url)), { ...duplicate, abort: true })
    .refine((children) => distinct(children.map((child) => child.id)), duplicate)
    .transform((children) => children.sort((a, b) => compare(a.url, b.url)));

const scenario = (forms: EpicForms) =>
  strict({
    name: string,
    criterion: string,
    children: list(issueUrl(forms))
      .min(1, { ...empty, abort: true })
      .refine(distinct, duplicate),
    setup: string,
    preparation: string,
    target: string,
    expected: string,
    timing: string,
    sourceToFiles: string,
    filesToTarget: string,
    oracle: string,
  });

export const acceptance = (forms: EpicForms) =>
  z.preprocess(
    tagged,
    z.discriminatedUnion(
      'mode',
      [
        strict({ mode: z.literal('independent'), rationale: string }),
        strict({
          mode: z.literal('combined'),
          scenarios: list(scenario(forms))
            .min(1, { ...empty, abort: true })
            .refine((scenarios) => distinct(scenarios.map((scenario) => scenario.name)), duplicate),
        }),
      ],
      { error: 'need independent or combined' },
    ),
  );

const commit = string.regex(revision, { error: 'need a full commit', abort: true });

const source = z.preprocess(
  tagged,
  z.discriminatedUnion(
    'dirty',
    [
      strict({ checkout: string, commit, dirty: z.literal(false) }),
      strict({ checkout: string, commit, dirty: z.literal(true), snapshot: string }),
    ],
    { error: 'need a boolean' },
  ),
);

const target = strict({ name: string, source, runtime: string, sourceToFiles: string, filesToTarget: string });

const reports = list(string)
  .min(1, { ...empty, abort: true })
  .refine(distinct, duplicate);

const pass = strict({
  scenario: string,
  result: z.literal('PASS'),
  target: string,
  observation: string,
  oracle: string,
  reports,
});

const inapplicable = strict({
  scenario: string,
  result: z.literal('inapplicable'),
  rationale: string,
  decision: string,
});

const result = z.preprocess(
  tagged,
  z.discriminatedUnion(
    'result',
    [
      inapplicable,
      pass,
      strict({ scenario: string, result: z.enum(['FAIL', 'BLOCKED', 'unrun', 'UNVERIFIED']), reason: string, reports }),
    ],
    { error: 'invalid result' },
  ),
);

const evidence = (forms: EpicForms) => ({
  repository: z.unknown(),
  parent: key,
  definitionHash: digest,
  children: children(forms),
  review: strict({ session: string, at: timestamp }),
  targets: list(target).refine((targets) => distinct(targets.map((target) => target.name)), duplicate),
  results: list(result),
});

export const submission = (forms: EpicForms) =>
  strict(evidence(forms)).transform((data) => ({ ...data, repository: forms.repository(data.repository) }));

export const accepted = (forms: EpicForms) =>
  strict({
    ...evidence(forms),
    mode: z.enum(['independent', 'combined'], { error: 'need independent or combined' }),
    completionId: digest,
  }).transform((data) => ({ ...data, repository: forms.repository(data.repository) }));

type Frozen<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends readonly (infer Item)[]
    ? readonly Frozen<Item>[]
    : { readonly [Key in keyof T]: Frozen<T[Key]> };

export type EpicChild = Frozen<z.output<ReturnType<typeof child>>>;
export type EpicScenario = Frozen<z.output<ReturnType<typeof scenario>>>;
export type EpicAcceptance = Frozen<z.output<ReturnType<typeof acceptance>>>;
export type EpicSource = Frozen<z.output<typeof source>>;
export type EpicTarget = Frozen<z.output<typeof target>>;
export type AcceptedEpicResult = Frozen<z.output<typeof pass> | z.output<typeof inapplicable>>;
export type EpicResult = Frozen<z.output<typeof result>>;
export type EpicSubmission = Frozen<z.output<ReturnType<typeof submission>>>;
