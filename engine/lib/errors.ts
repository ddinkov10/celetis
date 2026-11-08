import type { ExitCode } from './contract.ts';

export class HostError extends Error {
  constructor(
    message: string,
    readonly code: ExitCode,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class NotInstalled extends HostError {}
