import type { Host } from './config-core.ts';
import { isSessionId, uuid } from './fields.ts';
import { isHost } from './host-names.ts';

export type UsageAttempt = {
  id: string;
  host: Host;
  main: string;
  startedAt: number;
  sessionId: string | null;
};

export type UsageObservation =
  | { kind: 'blocked'; reason: string; resetAt: number | null }
  | { kind: 'available' }
  | { kind: 'unknown' };

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

export const usageUuid = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);

export function usageAttempt(value: unknown): value is UsageAttempt {
  return (
    usageObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    value.id.length <= 128 &&
    isHost(value.host) &&
    typeof value.main === 'string' &&
    value.main.length > 0 &&
    typeof value.startedAt === 'number' &&
    Number.isSafeInteger(value.startedAt) &&
    value.startedAt > 0 &&
    (value.sessionId === null || isSessionId(value.host, value.sessionId))
  );
}
