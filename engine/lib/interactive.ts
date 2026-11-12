import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:os';
import { readAgentOrder } from './agent-order.ts';
import { beginUsageAttempt, readUsage, recordUsage, selectAgent } from './agent-usage.ts';
import { exits } from './contract.ts';
import { HostError } from './errors.ts';
import { hostAvailability } from './host.ts';
import type { Host } from './host-names.ts';
import { hostAdapter } from './hosts.ts';
import type { Operation } from './operation.ts';
import { requireUpdatePolicy } from './plugin-policy.ts';
import { childEnv } from './process.ts';
import { repositoryLayout } from './state.ts';
import { withPluginRead } from './update-lock.ts';
import type { UsageAttempt } from './usage-types.ts';

export async function runInteractive(
  operation: Operation,
  textForHost: (host: Host) => Promise<{ title: string; prompt: string }>,
): Promise<number> {
  const { main, common, cwd } = operation.checkout;
  if (main === null || common === null) throw new HostError('celetis: need a Git checkout', exits.usage);
  const decision = selectAgent(
    operation.choice,
    (await readAgentOrder(common)).order,
    await readUsage(common),
    Date.now(),
    new Set(),
    false,
  );
  if (decision.kind === 'wait') {
    const blocked = decision.blocked.map(
      (value) =>
        `${value.host}: ${value.reason} Reset: ${value.resetAt === null ? 'unknown' : new Date(value.resetAt).toISOString()}`,
    );
    throw new HostError(`celetis: all default agents are blocked.\n${blocked.join('\n')}`, exits.prerequisite);
  }
  const host = decision.host;
  const adapter = hostAdapter(host);
  const availability = hostAvailability(host);
  if (!availability.available) throw new HostError(availability.cause, exits.prerequisite);
  const { executable } = availability;
  const home = await adapter.homeEnv();
  const pin = await withPluginRead(host, async () => {
    await requireUpdatePolicy(host, cwd);
    if (cwd !== main) await requireUpdatePolicy(host, main);
    return adapter.pin(main);
  });
  const { title, prompt } = await textForHost(host);
  const attempt: UsageAttempt = {
    id: randomUUID(),
    host,
    main,
    startedAt: Date.now(),
    sessionId: adapter.startId(),
  };
  const args = adapter.interactiveArguments(title, prompt, attempt.id);
  const ticket = await beginUsageAttempt(common, attempt);
  const layout = repositoryLayout(common);
  const capture = layout.usageCapture(attempt.id);
  const extra = await adapter.prepareUsage(attempt, layout);
  const child = spawn(executable, [...pin, ...extra, ...args], {
    cwd: main,
    env: childEnv({ ...process.env, CELETIS_SESSION_AGENT: host, ...home }),
    stdio: 'inherit',
  });
  const handlers = new Map<NodeJS.Signals, () => void>();
  for (const signal of ['SIGINT', 'SIGBREAK'] as const) {
    const hold = () => {};
    handlers.set(signal, hold);
    process.on(signal, hold);
  }
  for (const signal of ['SIGTERM', 'SIGHUP'] as const) {
    const handler = () => {
      child.kill(signal);
    };
    handlers.set(signal, handler);
    process.on(signal, handler);
  }
  let finished = false;
  let warning = false;
  let verified = false;
  const observe = async () => {
    try {
      if (!verified) {
        const startedAt = Math.floor(attempt.startedAt / 1000);
        const claim = await adapter.claim(main, args.at(-1) ?? '', ticket.attempt.sessionId ?? '', startedAt);
        if (claim.kind !== 'one') return;
        if (!(await adapter.verifySession(main, claim.id, startedAt))) return;
        ticket.attempt.sessionId = claim.id;
        verified = true;
      }
      const observation = await adapter.readUsage(ticket.attempt, capture.path);
      await recordUsage(common, ticket, observation);
    } catch (error) {
      if (!warning)
        console.error(`celetis: cannot record usage: ${error instanceof Error ? error.message : String(error)}`);
      warning = true;
    }
  };
  const status = new Promise<number>((resolve, reject) => {
    child.once('error', (error) =>
      reject(new HostError(`celetis: cannot start ${host}: ${error.message}`, exits.blocked)),
    );
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 128 + constants.signals[signal] : 1)));
  });
  const monitor = (async () => {
    while (!finished) {
      await observe();
      if (!finished) await Bun.sleep(1000);
    }
  })();
  try {
    return await status;
  } finally {
    finished = true;
    for (const [signal, handler] of handlers) process.off(signal, handler);
    await monitor;
    await observe();
  }
}
