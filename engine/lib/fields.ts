export const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const orderVersion = /^[a-f0-9]{64}$/;
export const revision = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
export const commit = /^[0-9a-f]{40}$/;

export function isHost(value: unknown): value is 'claude' | 'codex' {
  return value === 'claude' || value === 'codex';
}

export function isCommit(value: unknown): value is string {
  return typeof value === 'string' && commit.test(value);
}

export function isIssueNumber(value: string): boolean {
  return /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value));
}

export function isIssueField(value: unknown): value is number | string {
  return (typeof value === 'number' || typeof value === 'string') && isIssueNumber(String(value));
}
