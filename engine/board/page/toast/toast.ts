import { Toast } from '@base-ui/react/toast';

export type ToastData = { detail: string };
type Hold = 'pointer' | 'focus';

const LIFETIME = 6000;

export const toastManager = Toast.createToastManager<ToastData>();

let current: string | null = null;
let origin: Element | null = null;
let isReplacing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let remaining = 0;
let startedAt = 0;
const holds = new Set<Hold>();

export const rememberOrigin = (element: Element | null) => {
  origin = element;
};

export const isFocusInToast = () =>
  document.activeElement?.closest('[aria-label="Notifications"] [role="alertdialog"]') != null;

const stopTimer = () => {
  clearTimeout(timer);
  timer = undefined;
};

const runTimer = () => {
  if (remaining === 0 || timer !== undefined || holds.size > 0) return;
  startedAt = Date.now();
  timer = setTimeout(() => {
    timer = undefined;
    remaining = 0;
    if (current !== null) toastManager.close(current);
  }, remaining);
};

// Base UI pauses its own timers on a window blur, and a success toast must expire with the window in the background.
export const holdTimer = (hold: Hold, isHeld: boolean) => {
  if (!isHeld) {
    holds.delete(hold);
    runTimer();
    return;
  }
  holds.add(hold);
  if (timer === undefined) return;
  stopTimer();
  remaining = Math.max(remaining - (Date.now() - startedAt), 1);
};

const onClose = () => {
  if (isReplacing) return;
  stopTimer();
  remaining = 0;
  holds.clear();
  const target = origin;
  origin = null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !active.closest('[aria-label="Notifications"]')) return;
  if (target instanceof HTMLElement && target.isConnected && !target.closest('[hidden]'))
    target.focus({ preventScroll: true });
  else active.blur();
};

export const toast = (
  title: string,
  { detail = '', isError = false }: { detail?: string; isError?: boolean } = {},
): void => {
  const previous = current;
  stopTimer();
  remaining = isError ? 0 : LIFETIME;
  current = toastManager.add({
    title,
    description: detail.split('`').join(''),
    data: { detail },
    type: isError ? 'error' : 'ok',
    timeout: 0,
    priority: 'high',
    onClose,
  });
  if (previous !== null) {
    isReplacing = true;
    toastManager.close(previous);
    isReplacing = false;
  }
  runTimer();
};
