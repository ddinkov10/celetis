import { useSyncExternalStore } from 'react';
import type { AgentOrder, Host } from '../../../lib/config/core.ts';
import type { Registry } from '../../../lib/host/names.ts';
import type { IssueKey } from '../../../lib/tracker/key.ts';
import type {
  AgentPickerView,
  AgentReplaceConflict,
  AgentReplaceRequest,
  MenuEntry,
  QuotaWait,
  RunRequest,
} from '../../types.ts';
import { clock } from '../../view.ts';
import { shellStore } from '../store.ts';
import { post, SERVER_DOWN } from '../ui.ts';

export class OrderConflict extends Error {
  constructor(
    readonly latest: AgentOrder,
    message: string,
  ) {
    super(message);
  }
}

export type DragSession = { isStarted(): boolean; cancel(): void };
export type AgentView = Readonly<{
  view: AgentPickerView;
  registry: Registry;
  order: readonly Host[];
  excluded: readonly Host[];
  isSaving: boolean;
  status: string;
  retrying: ReadonlySet<string>;
}>;
export type AgentState = Readonly<{ shown: AgentView | null; live: string; menuFor: Host | null }>;

const resetText = (at: number | null) => {
  if (at === null) return 'reset unknown';
  const date = new Date(at);
  const today = date.toDateString() === new Date().toDateString();
  return `resets ${clock(date.toISOString(), !today)}`;
};
const same = (a: readonly Host[], b: readonly Host[]) => a.length === b.length && a.every((host, at) => b[at] === host);

let view: AgentPickerView | null = null;
let registry: Registry | null = null;
let confirmed: AgentOrder | null = null;
let saving: readonly Host[] | null = null;
let notice = '';
let drag: DragSession | null = null;
let drawn = '';
let polled = '';
const retrying = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: AgentState = { shown: null, live: '', menuFor: null };

const publish = (patch: Partial<AgentState>) => {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
};
const announce = (text: string) => {
  publish({ live: '' });
  setTimeout(() => {
    publish({ live: text });
  }, 50);
};
const shown = (): readonly Host[] => saving ?? confirmed?.order ?? [];
const nameOf = (host: Host) => registry?.[host].name ?? host;
const excluded = () => (registry ? (Object.keys(registry) as Host[]) : []).filter((host) => !shown().includes(host));
const paused = () => Boolean(view && shown().every((host) => view?.usage[host]));

const detail = (host: Host) => {
  if (!shown().includes(host)) return 'Excluded from default work';
  const parts: string[] = [];
  if (view?.activeHosts.includes(host)) parts.push('In use');
  const block = view?.usage[host];
  if (block) parts.push(`Limit reached · ${resetText(block.resetAt)}`, block.reason);
  else if (!parts.length) parts.push('Available');
  return parts.join(' · ');
};

const redraw = (force = false) => {
  if (!view || !registry || !confirmed || drag) return;
  const signature = JSON.stringify([view, registry, confirmed, saving, notice, [...retrying]]);
  if (!force && signature === drawn) return;
  drawn = signature;
  const status =
    notice ||
    (saving
      ? 'Saving the agent order.'
      : view.error
        ? `The agent state is unavailable: ${view.error}`
        : paused() && !view.waits.length
          ? 'New default work waits: every included agent reached a usage limit.'
          : '');
  if (!saving && !notice && status !== polled) {
    polled = status;
    if (status) announce(status);
  }
  publish({
    shown: {
      view,
      registry,
      order: shown(),
      excluded: excluded(),
      isSaving: Boolean(saving),
      status,
      retrying: new Set(retrying),
    },
  });
};

const replaceOrder = async (order: readonly Host[], expectedVersion: string): Promise<AgentOrder> => {
  if (shellStore.handlers().isReconnecting()) throw new Error('the board is reconnecting');
  void shellStore.handlers().readAgain();
  try {
    let response: Response;
    try {
      response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, expectedVersion } satisfies AgentReplaceRequest),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error(`${SERVER_DOWN}. Refresh before another change.`);
    }
    const body = (await response.json().catch(() => null)) as
      | { order: AgentOrder }
      | AgentReplaceConflict
      | { error: string }
      | null;
    if (response.ok && body && 'order' in body) return body.order;
    if (response.status === 409 && body && 'latest' in body) throw new OrderConflict(body.latest, body.error);
    throw new Error(body && 'error' in body ? body.error : `the server answered ${response.status}`);
  } finally {
    void shellStore.handlers().readAgain();
  }
};
const retryWait = async (number: IssueKey, waitId: string) => {
  const outcome = await post('/api/run', { number, waitId } satisfies RunRequest, 'Retry failed', { timeout: 150_000 });
  void shellStore.handlers().readAgain();
  if (outcome.status !== 'accepted') throw new Error(outcome.error ?? SERVER_DOWN);
};

const commit = async (next: readonly Host[], success: string) => {
  if (!confirmed || saving || same(next, confirmed.order) || !next.length) return;
  const version = confirmed.version;
  saving = next;
  notice = '';
  redraw();
  try {
    confirmed = await replaceOrder(next, version);
    notice = '';
    announce(success);
  } catch (cause) {
    if (cause instanceof OrderConflict) {
      confirmed = cause.latest;
      notice = 'Another tab or command saved a new order first. The current order shows now. Change it again.';
    } else notice = `The order was not saved: ${cause instanceof Error ? cause.message : String(cause)}`;
    announce(notice);
  } finally {
    saving = null;
    redraw(true);
  }
};
const move = (host: Host, to: number) => {
  const order = [...shown()];
  const from = order.indexOf(host);
  to = Math.max(0, Math.min(order.length - 1, to));
  if (from < 0 || from === to) return;
  order.splice(from, 1);
  order.splice(to, 0, host);
  void commit(
    order,
    to === 0 ? `${nameOf(host)} is now first.` : `${nameOf(host)} moved to position ${to + 1} of ${order.length}.`,
  );
};
const toggle = (host: Host) => {
  const order = shown();
  if (order.includes(host)) {
    if (order.length > 1)
      void commit(
        order.filter((each) => each !== host),
        `${nameOf(host)} is excluded from default work.`,
      );
  } else void commit([...order, host], `${nameOf(host)} is included in default work, last in the order.`);
};

const retry = async (wait: QuotaWait) => {
  if (retrying.has(wait.waitId)) return;
  retrying.add(wait.waitId);
  redraw();
  try {
    await retryWait(wait.number, wait.waitId);
    notice = '';
    announce(`Retry requested for #${wait.number}. Its run starts one attempt with the current order.`);
  } catch (cause) {
    notice = `Retry of #${wait.number} failed: ${cause instanceof Error ? cause.message : String(cause)}`;
    announce(notice);
  } finally {
    retrying.delete(wait.waitId);
    redraw();
  }
};

const entries = (host: Host): (MenuEntry | 'rule')[] => {
  const order = shown();
  const at = order.indexOf(host);
  const included = at >= 0;
  const last = order.length - 1;
  const act = (
    id: string,
    icon: string,
    label: string,
    blocked: boolean,
    run: () => void,
    title?: string,
  ): MenuEntry => ({
    id,
    icon,
    label,
    isDisabled: blocked || Boolean(saving),
    ...(blocked && title ? { title } : {}),
    run: () => {
      if (!blocked && !saving) run();
    },
  });
  return [
    act('first', 'move-first', 'Move first', !included || at === 0, () => move(host, 0)),
    'rule',
    act('up', 'move-up', 'Move up', !included || at === 0, () => move(host, at - 1)),
    act('down', 'move-down', 'Move down', !included || at === last, () => move(host, at + 1)),
    act('bottom', 'move-last', 'Move to bottom', !included || at === last, () => move(host, last)),
    'rule',
    included
      ? act(
          'exclude',
          'xcircle',
          'Exclude from default work',
          order.length === 1,
          () => toggle(host),
          'At least one agent stays included.',
        )
      : act('include', 'check', 'Include in default work', false, () => toggle(host)),
  ];
};

export const agentStore = {
  get: (): AgentState => snapshot,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  update(next: AgentPickerView, served: Registry): void {
    registry = served;
    if (snapshot.menuFor && !(snapshot.menuFor in served)) publish({ menuFor: null });
    const changed = Boolean(confirmed && next.order.version !== confirmed.version);
    view = next;
    if (saving) return;
    if (changed && drag) {
      const started = drag.isStarted();
      drag.cancel();
      drag = null;
      if (started) {
        notice = 'The order changed in another tab or command. The drag stopped. The current order shows now.';
        announce(notice);
      }
    } else if (changed && notice.startsWith('Another tab')) notice = '';
    confirmed = next.order;
    redraw();
  },
  move,
  retry,
  entries,
  detail,
  nameOf,
  resetText,
  openMenu(host: Host): void {
    if (registry?.[host]) publish({ menuFor: host });
  },
  closeMenu(): void {
    if (snapshot.menuFor !== null) publish({ menuFor: null });
  },
  focusFirst(): boolean {
    const handle = document.querySelector<HTMLElement>('#agent-picker [data-handle]');
    handle?.focus();
    return Boolean(handle);
  },
  setDrag(session: DragSession | null): void {
    drag = session;
  },
  cancelDrag(): boolean {
    if (!drag) return false;
    drag.cancel();
    drag = null;
    redraw(true);
    return true;
  },
  redraw,
};

export const useAgents = <T>(select: (state: AgentState) => T): T =>
  useSyncExternalStore(agentStore.subscribe, () => select(snapshot));
