import { type ExitCode, exits } from './contract.ts';
import type { Host } from './host-names.ts';

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

export function unsupported(host: Host, part: string): never {
  throw new HostError(`celetis: ${host} has no ${part}; the host capability must refuse first`, exits.internal);
}
