import { z } from 'zod';
import type { Host } from '../config/core.ts';
import { isSessionId } from '../state/fields.ts';
import { count } from '../state/schemas.ts';
import { isHost } from './names.ts';

export const usageAttemptSchema = z
  .looseObject({
    id: z.string().min(1).max(128),
    host: z.custom<Host>(isHost),
    main: z.string().min(1),
    startedAt: count,
    sessionId: z.string().nullable(),
  })
  .refine((attempt) => attempt.sessionId === null || isSessionId(attempt.host, attempt.sessionId));
export type UsageAttempt = z.infer<typeof usageAttemptSchema>;

export const usageObservation = z.discriminatedUnion('kind', [
  z.looseObject({ kind: z.literal('blocked'), reason: z.string(), resetAt: count.nullable() }),
  z.looseObject({ kind: z.literal('available') }),
  z.looseObject({ kind: z.literal('unknown') }),
]);
export type UsageObservation = z.infer<typeof usageObservation>;

export type ObservedUsage = {
  attemptId: string;
  sequence: number;
} & ({ sessionId: null; observation: { kind: 'unknown' } } | { sessionId: string; observation: UsageObservation });

export const unknownUsage = (attempt: UsageAttempt): ObservedUsage => ({
  attemptId: attempt.id,
  sessionId: null,
  sequence: 0,
  observation: { kind: 'unknown' },
});

export const usageObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function usageAttempt(value: unknown): value is UsageAttempt {
  return usageAttemptSchema.safeParse(value).success;
}
