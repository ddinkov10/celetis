import { z } from 'zod';
import { type IssueKey, isKey } from '../tracker/key.ts';
import { commit, revision, uuid } from './fields.ts';

export const count = z.int().positive();
// z.number() refuses Infinity, which a host JSON number such as 1e999 gives.
export const anyNumber = z.custom<number>((value) => typeof value === 'number');
export const code = z.int().nonnegative();
export const bounded = (limit: number) => z.string().refine((value) => value.length <= limit);
export const filled = z.string().refine((value) => value.length > 0);
export const filledWithin = (limit: number) => z.string().refine((value) => value.length >= 1 && value.length <= limit);
export const identityFields = { pid: count, start: filled };
export const identity = z.strictObject(identityFields);
export const issueKey = z.custom<IssueKey>((value) => isKey(value));
export const uuidText = z.string().regex(uuid);
export const lowerUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
export const digestText = z.string().regex(/^[0-9a-f]{64}$/);
export const revisionText = z.string().regex(revision);
export const commitText = z.string().regex(commit);
export const members = <T extends string>(table: Readonly<Record<T, true>>) =>
  z.enum(Object.keys(table) as [T, ...T[]]);
