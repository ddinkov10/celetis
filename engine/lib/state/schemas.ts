import { z } from 'zod';
import { type IssueKey, isKey } from '../tracker/key.ts';
import { uuid } from './fields.ts';

export const count = z.int().positive();
// z.number() refuses Infinity, which a host JSON number such as 1e999 gives.
export const anyNumber = z.custom<number>((value) => typeof value === 'number');
export const code = z.int().nonnegative();
export const bounded = (limit: number) => z.string().refine((value) => value.length <= limit);
export const issueKey = z.custom<IssueKey>((value) => isKey(value));
export const uuidText = z.string().regex(uuid);
export const members = <T extends string>(table: Readonly<Record<T, true>>) =>
  z.enum(Object.keys(table) as [T, ...T[]]);
