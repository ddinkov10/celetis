import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:os';
import { join } from 'node:path';
import { readAgentOrder } from './agent-order.ts';
import { beginUsageAttempt, readUsage, recordUsage, selectAgent } from './agent-usage.ts';
import type { Host } from './config-core.ts';
import { HostError } from './host.ts';
import type { Operation } from './operation.ts';
import { codexHome, codexSessionPin } from './plugin-metadata.ts';
import { requireUpdatePolicy } from './plugin-policy.ts';
import { privateFolder } from './private-folder.ts';
import { childEnv } from './process.ts';
import { codexClaim, verifyNativeSession } from './session.ts';
import { withPluginRead } from './update-lock.ts';
import { prepareClaudeUsage, readClaudeUsage } from './usage-claude.ts';
import { readCodexUsage } from './usage-codex.ts';
import type { UsageAttempt } from './usage-types.ts';

export async function runInteractive(
  operation: Operation,
  argsForHost: (host: Host) => Promise<string[]>,
): Promise<number> {
  const { main, common, cwd } = operation.checkout;
  if (main === null || common === null) throw new HostError('celetis: need a Git checkout', 2);
  const decision = selectAgent(
    operation.choice,
    readAgentOrder(common).order,
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
    throw new HostError(`celetis: all default agents are blocked.\n${blocked.join('\n')}`);
  }
  const host = decision.host;
  const executable = Bun.which(host, { PATH: childEnv().PATH });
  if (!executable) throw new HostError(`celetis: ${host} is not on PATH`);
  if (host === 'codex') process.env.CODEX_HOME = await codexHome();
  const pin = await withPluginRead(host, async () => {
    await requireUpdatePolicy(host, cwd);
    if (cwd !== main) await requireUpdatePolicy(host, main);
    return host === 'codex' ? codexSessionPin(main) : [];
  });
  const args = await argsForHost(host);
  const attempt: UsageAttempt = {
    id: randomUUID(),
    host,
    main,
    startedAt: Date.now(),
    sessionId: host === 'claude' ? randomUUID() : null,
  };
  if (host === 'codex') args[args.length - 1] = `${args.at(-1) ?? ''}\nLauncher attempt: ${attempt.id}.`;
  const ticket = await beginUsageAttempt(common, attempt);
  const captureRoot = join(common, 'celetis-flow', 'usage-captures');
  const capture = join(captureRoot, attempt.id);
  const extra: string[] = [];
  if (host === 'claude') {
    const fail = (path: string, reason: string) => new HostError(`usage: ${path}: ${reason}`);
    await privateFolder(captureRoot, fail);
    await privateFolder(capture, fail);
    extra.push(...(await prepareClaudeUsage(attempt, capture)));
  }
  const child = spawn(executable, [...pin, ...extra, ...args], {
    cwd: main,
    env: childEnv({ ...process.env, CELETIS_SESSION_AGENT: host }),
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
      if (ticket.attempt.sessionId === null) {
        const claim = await codexClaim(main, args.at(-1) ?? '', Math.floor(attempt.startedAt / 1000));
        if (claim.kind !== 'one') return;
        if (!(await verifyNativeSession(host, main, claim.id, Math.floor(attempt.startedAt / 1000)))) return;
        ticket.attempt.sessionId = claim.id;
        verified = true;
      } else if (!verified) {
        if (!(await verifyNativeSession(host, main, ticket.attempt.sessionId, Math.floor(attempt.startedAt / 1000))))
          return;
        verified = true;
      }
      const observation =
        host === 'claude' ? await readClaudeUsage(ticket.attempt, capture) : await readCodexUsage(ticket.attempt);
      await recordUsage(common, ticket, observation);
    } catch (error) {
      if (!warning)
        console.error(`celetis: cannot record usage: ${error instanceof Error ? error.message : String(error)}`);
      warning = true;
    }
  };
  const status = new Promise<number>((resolve, reject) => {
    child.once('error', (error) => reject(new HostError(`celetis: cannot start ${host}: ${error.message}`)));
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
