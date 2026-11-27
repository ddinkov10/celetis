import { z } from 'zod';
import { code, commitText, issueKey } from '../state/schemas.ts';

const time = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const tally = code.nullable();

const sampleShape = { at: time, needs: tally, working: tally };
const commitShape = { sha: commitText, issue: issueKey.nullable(), at: time };
const issueShape = { issue: issueKey, createdAt: time.nullable() };

export const sample = z.looseObject(sampleShape);
export const commitLine = z.looseObject(commitShape);
export const issueLine = z.looseObject(issueShape);

export type Sample = z.output<z.ZodObject<typeof sampleShape>>;
export type CacheLine = z.output<z.ZodObject<typeof commitShape>> | z.output<z.ZodObject<typeof issueShape>>;
