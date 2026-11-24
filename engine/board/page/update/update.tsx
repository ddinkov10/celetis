import { Dialog } from '@base-ui/react/dialog';
import { cn } from 'cn';
import { type FocusEvent, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { Icon } from '../app/icon.tsx';
import { ViewBoundary } from '../ui/view-boundary.tsx';
import { type UpdateShown, updateStore } from './state.ts';

const POPUP =
  'fixed z-[100] m-0 max-h-[calc(100dvh-24px)] w-[min(272px,calc(100vw-24px))] overflow-auto rounded-[12px] border border-border bg-card pt-[18px] pr-[18px] pb-4 pl-[18px] text-foreground [box-shadow:var(--float)] [font:inherit] [position-anchor:--update] [position-try-fallbacks:flip-block] [inset:calc(anchor(--update_bottom)+8px)_auto_auto_anchor(--update_left)] [scrollbar-color:var(--fg3)_var(--card)] phone:[position-anchor:--bar] phone:[position-try-fallbacks:none] phone:[inset:auto_12px_calc(anchor(--bar_top)+8px)_auto]';
// The focus guards of Base UI add a Tab stop that a nonmodal dialog of the page must not have.
const NO_GUARDS = '[&>[data-base-ui-focus-guard]]:hidden';
const NOTE = 'm-[10px_0_0] text-[0.75rem] wrap-anywhere whitespace-pre-wrap';
const ACTION = 'w-full min-h-[34px] phone:min-h-11 aria-disabled:cursor-wait aria-disabled:opacity-50';

const useUpdate = () => useSyncExternalStore(updateStore.subscribe, updateStore.get);
const control = () => document.getElementById('update-open');
const titleNode = () => document.getElementById('update-title');
let prior: Element | null = null;

// The portal sets tabindex -1 on each button when the focus leaves, and only the hidden guards would undo it.
const keepTabOrder = (event: FocusEvent<HTMLDivElement>) => {
  for (const node of event.currentTarget.querySelectorAll('[data-tabindex]')) {
    const tabIndex = node.getAttribute('data-tabindex');
    node.removeAttribute('data-tabindex');
    if (tabIndex) node.setAttribute('tabindex', tabIndex);
    else node.removeAttribute('tabindex');
  }
};

function ControlBody({ shown }: { shown: UpdateShown }) {
  const name = `${shown.label}, Celetis`;
  return (
    <button
      type="button"
      className={cn(
        'sb-btn flex-none [anchor-name:--update] aria-disabled:cursor-wait aria-disabled:bg-[var(--fill)] aria-disabled:text-working',
        shown.isAccent &&
          'bg-[color-mix(in_srgb,var(--needs-tint)_10%,transparent)] text-needs [&:hover]:bg-[color-mix(in_srgb,var(--needs-tint)_13%,transparent)]',
        !shown.isAccent && !shown.isChecking && '-ms-2',
      )}
      id="update-open"
      aria-controls="update-dialog"
      aria-expanded={shown.isOpen}
      aria-disabled={shown.isChecking}
      aria-label={name}
      title={name}
      onClick={() => {
        const isRepeat = shown.isOpen && !shown.isChecking;
        const focused = document.activeElement;
        updateStore.press();
        if (!isRepeat) return;
        prior = focused;
        titleNode()?.focus();
      }}
    >
      <Icon name="refresh" />
      <span className="label">{shown.label}</span>
    </button>
  );
}

export function UpdateControl() {
  const shown = useUpdate();
  return (
    <ViewBoundary snapshot={shown} fallback={null}>
      <ControlBody shown={shown} />
    </ViewBoundary>
  );
}

function Content({ shown }: { shown: UpdateShown }) {
  const focusedBefore = document.activeElement;
  const start = useRef<HTMLButtonElement>(null);
  const check = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if ((focusedBefore === start.current && !shown.showStart) || (focusedBefore === check.current && !shown.showCheck))
      titleNode()?.focus();
  });
  return (
    <>
      <Dialog.Title id="update-title" tabIndex={-1} className="text-[0.875rem] leading-[1.4] font-semibold">
        {shown.title}
      </Dialog.Title>
      <Dialog.Description
        id="update-description"
        className="m-[6px_0_0] text-[0.78125rem] leading-[1.5] text-muted-foreground"
      >
        {shown.description}
        {shown.release ? (
          <span
            id="update-release"
            className="mt-[10px] block font-mono text-[0.6875rem] leading-[1.6] whitespace-pre-line wrap-anywhere text-card-foreground"
          >
            {shown.release}
          </span>
        ) : null}
      </Dialog.Description>
      <p
        id="update-progress"
        aria-hidden="true"
        className={cn(
          'm-[12px_0_0] text-[0.75rem] text-working',
          shown.isProgressBusy
            ? "before:mr-2 before:inline-block before:h-[7px] before:w-[7px] before:rounded-[50%] before:bg-current before:content-['']"
            : 'absolute h-px w-px overflow-hidden [clip-path:inset(50%)]',
        )}
      >
        {shown.progress}
      </p>
      <p id="update-error" className={cn(NOTE, 'text-[color:var(--danger)]')} hidden={!shown.diagnostic}>
        {shown.diagnostic}
      </p>
      <p id="update-recovery" className={cn(NOTE, 'text-card-foreground')} hidden={!shown.recovery}>
        {shown.recovery}
      </p>
      <div className="mt-[18px] grid gap-1.5">
        <button
          ref={start}
          type="button"
          className={cn('btn primary', ACTION)}
          id="update-start"
          hidden={!shown.showStart}
          aria-disabled={shown.isStartDisabled}
          onClick={updateStore.confirm}
        >
          {shown.startLabel}
        </button>
        <button
          ref={check}
          type="button"
          className={cn('btn primary', ACTION)}
          id="update-check"
          hidden={!shown.showCheck}
          aria-disabled={shown.isCheckDisabled}
          onClick={updateStore.check}
        >
          Check again
        </button>
        <button
          type="button"
          className={cn(
            'btn ghost bg-transparent text-card-foreground [&:hover]:bg-[var(--fill)] [&:hover]:text-foreground',
            ACTION,
          )}
          id="update-later"
          onClick={updateStore.close}
        >
          {shown.later}
        </button>
      </div>
    </>
  );
}

export function UpdateDialog() {
  const shown = useUpdate();
  const popup = useRef<HTMLDivElement>(null);
  const seen = useRef({ isOpen: false, wasInside: false });
  if (shown.isOpen !== seen.current.isOpen) {
    const active = document.activeElement;
    if (shown.isOpen) prior = active;
    else seen.current.wasInside = popup.current?.contains(active) ?? false;
    seen.current.isOpen = shown.isOpen;
  }
  // Base UI moves the focus a frame later, and a fast key would reach the board. The popup unhides after this commit.
  useLayoutEffect(() => {
    if (shown.isOpen) queueMicrotask(() => updateStore.get().isOpen && titleNode()?.focus());
    else if (seen.current.wasInside)
      (prior instanceof HTMLElement && prior.isConnected && !prior.hidden ? prior : control())?.focus();
  }, [shown.isOpen]);
  return (
    <>
      <p className="sr-only" id="update-status" role="status" aria-live="polite">
        {shown.status}
      </p>
      <div className={cn('contents', NO_GUARDS)}>
        <Dialog.Root
          modal={false}
          disablePointerDismissal
          open={shown.isOpen}
          onOpenChange={(next, details) => {
            if (details.reason === 'escape-key' && !popup.current?.contains(details.event.target as Node)) {
              details.cancel();
              return;
            }
            if (!next) updateStore.close();
          }}
        >
          <Dialog.Portal keepMounted className={NO_GUARDS}>
            <Dialog.Popup
              ref={popup}
              id="update-dialog"
              className={POPUP}
              initialFocus={false}
              finalFocus={false}
              onBlur={keepTabOrder}
            >
              <ViewBoundary snapshot={shown} fallback={null}>
                <Content shown={shown} />
              </ViewBoundary>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </>
  );
}
