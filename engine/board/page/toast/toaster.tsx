import { Toast } from '@base-ui/react/toast';
import { cn } from 'cn';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../app/icon.tsx';
import { Button } from '../ui/button.tsx';
import { ViewBoundary } from '../ui/view-boundary.tsx';
import { holdTimer, isFocusInToast, rememberOrigin, type ToastData, toastManager } from './toast.ts';

const ROOT =
  'fixed bottom-12 left-1/2 z-20 flex w-max max-w-[min(560px,calc(100vw-32px))] items-center gap-2.5 rounded-xl bg-card py-2.5 pr-2 pl-3 text-[0.8125rem] leading-[1.45] text-foreground [box-shadow:var(--float)] [overflow-wrap:anywhere] [transform:translate(calc(-50%_+_var(--toast-swipe-movement-x,0px)),var(--toast-swipe-movement-y,0px))] animate-rise data-ending-style:hidden phone:bottom-[calc(var(--dock)+12px)]';
const MARK = 'grid size-5 flex-none place-items-center rounded-sm [&_.icon]:size-[13px]';
const OK = 'bg-[color-mix(in_srgb,var(--ready)_14%,transparent)] text-ready';
const ERROR = 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-destructive';
const DETAIL = 'm-0 mt-px block text-[0.78125rem] text-card-foreground first-letter:uppercase';
const CODE = 'rounded-xs bg-accent px-[5px] py-px font-mono text-[0.75rem] leading-[1.4] font-normal text-foreground';

const withCode = (text: string) => {
  const node: ReactNode[] = [];
  text.split('`').forEach((part, index) => {
    if (part)
      node.push(
        index % 2 ? (
          <code key={index} className={CODE}>
            {part}
          </code>
        ) : (
          part
        ),
      );
  });
  return node;
};

function ToastItem({ toast }: { toast: Toast.Root.ToastObject<ToastData> }) {
  const isError = toast.type === 'error';
  const detail = toast.data?.detail ?? '';
  const close = useRef<HTMLButtonElement>(null);
  const [tookOver] = useState(isFocusInToast);
  useLayoutEffect(() => {
    if (tookOver) close.current?.focus({ preventScroll: true });
  }, [tookOver]);
  return (
    <Toast.Root toast={toast} className={ROOT}>
      <span className={cn(MARK, isError ? ERROR : OK)}>
        <Icon name={isError ? 'alert' : 'check'} />
      </span>
      <div>
        <Toast.Title render={<strong />} className="block font-semibold" />
        {detail ? <Toast.Description className={DETAIL}>{withCode(detail)}</Toast.Description> : null}
      </div>
      <Toast.Close
        ref={close}
        render={<Button variant="icon" size="icon" className="px-1.5 py-px [border:0]" aria-label="Close" />}
      >
        <Icon name="close" />
      </Toast.Close>
    </Toast.Root>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager<ToastData>();
  return (
    <ViewBoundary snapshot={toasts} fallback={null}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </ViewBoundary>
  );
}

export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager} limit={1}>
      <Toast.Portal>
        <Toast.Viewport
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            if (event.target === event.currentTarget) toastManager.close();
          }}
          onPointerEnter={(event) => event.pointerType !== 'touch' && holdTimer('pointer', true)}
          onPointerMove={(event) => event.pointerType !== 'touch' && holdTimer('pointer', true)}
          onPointerLeave={() => holdTimer('pointer', false)}
          onFocus={(event) => {
            if (event.relatedTarget instanceof Element && !event.currentTarget.contains(event.relatedTarget))
              rememberOrigin(event.relatedTarget);
            if (event.target.matches(':focus-visible')) holdTimer('focus', true);
          }}
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget) &&
              !event.currentTarget.contains(document.activeElement)
            )
              holdTimer('focus', false);
          }}
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
