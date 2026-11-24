import type {
  BoardOffer,
  UpdateResponse,
  UpdateRestartRequest,
  UpdateRestartResponse,
  UpdateView,
} from '../../types.ts';
import { shellStore } from '../store.ts';
import { post } from '../ui.ts';

export type UpdateShown = Readonly<{
  isOpen: boolean;
  label: string;
  isAccent: boolean;
  isChecking: boolean;
  title: string;
  description: string;
  progress: string;
  isProgressBusy: boolean;
  diagnostic: string;
  recovery: string;
  later: string;
  showStart: boolean;
  startLabel: string;
  isStartDisabled: boolean;
  showCheck: boolean;
  isCheckDisabled: boolean;
  status: string;
}>;

type Kind = 'update' | 'restart';
type Phase = UpdateView['phase'] | 'timeout' | 'restart-refused';
type Pending = {
  kind: Kind;
  target: string;
  instance: string;
  recovery: string | null;
  deadline: number | null;
  reloaded: boolean;
};
const session = {
  get(key: string) {
    try {
      return sessionStorage.getItem(`celetis:update-${key}`);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) sessionStorage.removeItem(`celetis:update-${key}`);
      else sessionStorage.setItem(`celetis:update-${key}`, value);
    } catch {}
  },
};
const readPending = (): Pending | null => {
  try {
    const value = JSON.parse(session.get('pending') ?? 'null') as Pending | null;
    if (
      value &&
      (value.kind === 'update' || value.kind === 'restart') &&
      typeof value.target === 'string' &&
      typeof value.instance === 'string' &&
      (value.recovery === null || typeof value.recovery === 'string') &&
      (value.deadline === null || (typeof value.deadline === 'number' && Number.isFinite(value.deadline))) &&
      typeof value.reloaded === 'boolean'
    )
      return value;
  } catch {}
  return null;
};
const isRestartAnswer = (value: unknown): value is UpdateRestartResponse => {
  const answer = value as Partial<UpdateRestartResponse> | null;
  return (
    typeof answer?.target === 'string' &&
    typeof answer.runtime?.revision === 'string' &&
    typeof answer.runtime.instance === 'string'
  );
};
const names = { claude: 'Claude Code plugin', codex: 'Codex plugin', engine: 'Celetis engine' };
let reconnecting = false;
export const isReconnecting = () => reconnecting;

const listeners = new Set<() => void>();
let handlers = { reconnect: () => {}, connected: () => {} };
const signal = (name: keyof typeof handlers) => {
  try {
    handlers[name]();
  } catch (error) {
    reportError(error);
  }
};
const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
let isOpen = false;
let isStarted = false;
let shown: UpdateShown = {
  isOpen: false,
  label: 'Check for updates',
  isAccent: false,
  isChecking: false,
  title: '',
  description: '',
  progress: '',
  isProgressBusy: false,
  diagnostic: '',
  recovery: '',
  later: 'Later',
  showStart: true,
  startLabel: 'Update and restart',
  isStartDisabled: false,
  showCheck: false,
  isCheckDisabled: false,
  status: '',
};
const emit = () => {
  for (const listener of listeners) listener();
};
const write = (patch: Partial<UpdateShown>) => {
  if (Object.entries(patch).some(([key, value]) => shown[key as keyof UpdateShown] !== value))
    shown = { ...shown, ...patch };
};
let response: UpdateResponse | null = null;
let offered: BoardOffer | null = null;
let pending = readPending();
let refusal: { kind: Kind; line: string } | null = null;
let checkFailure: string | null = null;
let checking = false;
let submitting: Kind | null = null;
let timedOut = false;
let announced = '';
let announcing: ReturnType<typeof setTimeout> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let active: AbortController | undefined;
let epoch = 0;
const save = () => session.set('pending', pending ? JSON.stringify(pending) : null);
const beginReconnect = () => {
  if (!pending) return;
  if (pending.deadline === null) {
    pending.deadline = Date.now() + 60000;
    save();
  }
  reconnecting = true;
  signal('reconnect');
};
const kindOf = (): Kind => submitting ?? pending?.kind ?? refusal?.kind ?? 'update';
const phaseOf = (): Phase | undefined =>
  timedOut
    ? 'timeout'
    : refusal
      ? refusal.kind === 'restart'
        ? 'restart-refused'
        : 'update-failed'
      : submitting === 'restart'
        ? 'restarting'
        : pending
          ? reconnecting || pending.kind === 'restart'
            ? 'restarting'
            : 'updating'
          : checking
            ? 'checking'
            : checkFailure
              ? 'check-failed'
              : response?.update.phase;
const announce = (key: string, status: string) => {
  if (key === announced) return;
  announced = key;
  clearTimeout(announcing);
  if (shown.status !== status) write({ status });
  else {
    write({ status: '' });
    announcing = setTimeout(() => {
      write({ status });
      emit();
    }, 100);
  }
};
const paint = () => {
  const update = response?.update;
  const phase = phaseOf();
  const kind = kindOf();
  const busy = phase === 'updating' || phase === 'restarting';
  const failed =
    phase === 'update-failed' || phase === 'restart-refused' || phase === 'check-failed' || phase === 'timeout';
  const label = busy
    ? kind === 'restart'
      ? 'Restarting…'
      : 'Update in progress'
    : phase === 'checking'
      ? 'Checking…'
      : phase === 'check-failed'
        ? 'Update check failed'
        : failed
          ? kind === 'restart'
            ? 'Restart needs attention'
            : 'Update needs attention'
          : phase === 'restart-needed'
            ? 'Restart needed'
            : phase === 'available'
              ? 'Update available'
              : phase === 'updated'
                ? 'Update completed'
                : phase === 'current'
                  ? 'Up to date'
                  : 'Check for updates';
  const isAccent = phase === 'available' || phase === 'restart-needed';
  shellStore.setInputs({ updateAccent: isAccent });
  write({ isOpen, label, isAccent, isChecking: phase === 'checking' });
  const isRestart = kind === 'restart' || phase === 'restart-needed';
  const target = pending?.target ?? (isRestart ? null : offered?.target) ?? update?.target ?? null;
  if (phase === 'current') announce(JSON.stringify([phase, target]), 'Up to date');
  if (!phase || (phase === 'current' && !isOpen)) return;
  const title = text(
    {
      available: 'Update Celetis',
      'restart-needed': 'Restart the daemon',
      checking: 'Checking for updates',
      updating: 'Updating Celetis',
      restarting: 'Restarting the daemon',
      updated: 'Celetis is updated',
      'update-failed': 'The update did not finish',
      'restart-refused': 'The daemon did not restart',
      'check-failed': 'Cannot check for updates',
      timeout: 'The daemon did not come back',
      current: 'Celetis is up to date',
    }[phase],
  );
  const description = text(
    {
      available: 'Sessions keep running.',
      'restart-needed': 'It runs an older engine than the installed one.',
      checking: 'This takes a few seconds.',
      updating: 'The daemon restarts when it is done.',
      restarting: 'This page reconnects by itself.',
      updated: 'This daemon runs from a checkout, so it does not restart.',
      'update-failed': 'The daemon did not restart.',
      'restart-refused': 'It still runs its old engine.',
      'check-failed': 'The board still works.',
      timeout: `The ${kind} may be done. The page got no answer in 60 seconds.`,
      current: target ? `Installed ${target.slice(0, 12)}.` : 'No update is available.',
    }[phase],
  );
  let status = '';
  if (phase === 'restarting') status = 'Reconnecting to the new daemon…';
  else if (phase === 'restart-needed') status = 'The daemon runs an older Celetis engine.';
  else if (phase === 'updating') {
    const stage = update?.stage;
    status = stage
      ? `${stage.state === 'started' ? 'Updating' : 'Completed'} ${names[stage.part]}…`
      : 'Preparing the update…';
  } else if (phase === 'checking') status = 'Checking for updates…';
  else if (phase === 'current') status = 'Up to date';
  else if (failed || phase === 'updated') status = title;
  else status = 'An update is available.';
  if (phase !== 'current') announce(JSON.stringify([phase, kind, target, status]), status);
  const isProgressBusy = busy || phase === 'checking';
  const diagnostic = text(failed ? (checkFailure ?? refusal?.line ?? update?.error ?? '') : '');
  const recovery = text(failed && phase !== 'restart-refused' ? (pending?.recovery ?? update?.recovery ?? '') : '');
  const later = busy ? 'Hide progress' : failed || phase === 'updated' || phase === 'current' ? 'Close' : 'Later';
  const showStart = phase === 'available' || phase === 'restart-needed';
  const startLabel = phase === 'restart-needed' ? 'Restart' : 'Update and restart';
  const isStartDisabled = submitting !== null || checking || (phase === 'available' && !update?.offer);
  const showCheck = failed;
  const isCheckDisabled = checking;
  write({
    title,
    description,
    progress: status,
    isProgressBusy,
    diagnostic,
    recovery,
    later,
    showStart,
    startLabel,
    isStartDisabled,
    showCheck,
    isCheckDisabled,
  });
};
const draw = () => {
  const before = shown;
  paint();
  if (shown !== before) emit();
};
const expire = () => {
  if (!pending?.deadline || Date.now() < pending.deadline) return false;
  timedOut = true;
  clearTimeout(timer);
  active?.abort();
  draw();
  return true;
};
const accept = (next: UpdateResponse) => {
  if (expire()) return;
  if (!pending && JSON.stringify(response) === JSON.stringify(next)) return;
  response = next;
  const update = next.update;
  if (update.offer) offered = update.offer;
  if (pending && next.runtime.revision === pending.target && next.runtime.instance !== pending.instance) {
    if (pending.reloaded) {
      pending = null;
      reconnecting = false;
      save();
      signal('connected');
    } else {
      pending.reloaded = true;
      save();
      location.reload();
      return;
    }
  }
  if (update.phase === 'updating' || update.phase === 'restarting') {
    refusal = null;
    if (!pending && update.target) {
      pending = {
        // An approved update always names a part; a restart of the Restart control names none.
        kind: update.completed.length || update.incomplete.length ? 'update' : 'restart',
        target: update.target,
        instance: next.runtime.instance,
        recovery: update.recovery,
        deadline: null,
        reloaded: false,
      };
      save();
    }
    if (pending && update.recovery) {
      pending.recovery = update.recovery;
      save();
    }
  } else if (
    (update.phase === 'update-failed' || update.phase === 'updated') &&
    next.runtime.instance === pending?.instance
  ) {
    if (pending.kind === 'restart') refusal = { kind: 'restart', line: update.error ?? '' };
    pending = null;
    reconnecting = false;
    save();
    signal('connected');
  }
  if (pending) {
    if (update.phase === 'updating' && update.target === pending.target && next.runtime.instance === pending.instance) {
      if (reconnecting) {
        pending.deadline = null;
        reconnecting = false;
        save();
        signal('connected');
      }
    } else beginReconnect();
  }
  if (expire()) return;
  draw();
};
const schedule = () => {
  clearTimeout(timer);
  if (!timedOut) timer = setTimeout(poll, pending ? 1000 : document.hidden ? 15000 : 5000);
};
const poll = async (forCheck = false) => {
  if (expire()) return;
  const request = ++epoch;
  const controller = new AbortController();
  active = controller;
  const timeout = setTimeout(
    () => controller.abort(),
    Math.min(5000, pending?.deadline ? Math.max(1, pending.deadline - Date.now()) : 5000),
  );
  try {
    const result = await fetch('/api/update', { cache: 'no-store', signal: controller.signal });
    if (!result.ok) throw new Error('The board server does not answer.');
    const next = (await result.json()) as UpdateResponse;
    if (!next.runtime || !next.update) throw new Error('The update status could not be read.');
    if (request === epoch) {
      if (forCheck) checking = false;
      accept(next);
      draw();
    }
  } catch {
    if (request !== epoch) return;
    if (forCheck || (!pending && response?.update.phase === 'checking')) {
      checking = false;
      checkFailure ??= 'The update status could not be read. Check again.';
    }
    if (pending) {
      beginReconnect();
    }
    draw();
  } finally {
    clearTimeout(timeout);
    if (request === epoch) {
      expire();
      schedule();
    }
  }
};
const stopPoll = () => {
  ++epoch;
  clearTimeout(timer);
  active?.abort();
};
const approve = async () => {
  if (submitting || checking || pending || !response?.update.offer) return;
  const offer = response.update.offer;
  stopPoll();
  pending = {
    kind: 'update',
    target: offer.target,
    instance: response.runtime.instance,
    recovery: response.update.recovery,
    deadline: null,
    reloaded: false,
  };
  refusal = null;
  submitting = 'update';
  save();
  draw();
  const outcome = await post('/api/update/start', { offerId: offer.id }, 'Update failed', { timeout: 10000 });
  submitting = null;
  if (outcome.status === 'rejected') {
    pending = null;
    reconnecting = false;
    refusal = { kind: 'update', line: outcome.error };
    save();
    draw();
  } else beginReconnect();
  await poll();
};
const restart = async () => {
  if (submitting || checking || pending || phaseOf() !== 'restart-needed' || !response) return;
  const shown = response;
  stopPoll();
  refusal = null;
  submitting = 'restart';
  draw();
  const request: UpdateRestartRequest = {};
  const outcome = await post('/api/update/restart', request, 'Restart failed', { timeout: 10000 });
  submitting = null;
  if (outcome.status !== 'accepted' && outcome.error !== undefined) {
    refusal = { kind: 'restart', line: outcome.error };
    draw();
  } else {
    const answer = outcome.status === 'accepted' && isRestartAnswer(outcome.body) ? outcome.body : null;
    pending = {
      kind: 'restart',
      target: answer?.target ?? shown.update.target ?? '',
      instance: answer?.runtime.instance ?? shown.runtime.instance,
      recovery: shown.update.recovery,
      deadline: null,
      reloaded: false,
    };
    save();
    beginReconnect();
  }
  await poll();
};
const requestCheck = async (): Promise<void> => {
  if (phaseOf() === 'checking' || (pending && !timedOut)) return;
  if (timedOut) {
    pending = null;
    timedOut = false;
    reconnecting = false;
    save();
    signal('connected');
  }
  checking = true;
  refusal = null;
  checkFailure = null;
  stopPoll();
  draw();
  const result = await post('/api/update/check', {}, 'Update check failed');
  if (!result) checkFailure = 'The update check could not start. Check again.';
  await poll(true);
};
const close = () => {
  isOpen = false;
  draw();
};

export const updateStore = {
  get: () => shown,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  handle: (next: { reconnect(): void; connected(): void }) => {
    handlers = next;
  },
  start: () => {
    if (isStarted) return;
    isStarted = true;
    if (pending) beginReconnect();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || timedOut || submitting || checking) return;
      clearTimeout(timer);
      void poll();
    });
    draw();
    void poll();
  },
  press: () => {
    const phase = phaseOf();
    if (phase === 'checking') return;
    if (!phase || (phase === 'current' && !isOpen)) {
      void requestCheck();
      return;
    }
    isOpen = true;
    draw();
  },
  confirm: () => {
    if (!shown.isStartDisabled) void (phaseOf() === 'restart-needed' ? restart() : approve());
  },
  check: () => {
    if (!shown.isCheckDisabled) void requestCheck();
  },
  close,
  dismiss: () => {
    if (!isOpen) return false;
    close();
    return true;
  },
};
