import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { cn } from 'cn';
import { useLayoutEffect, useRef } from 'react';

function Dialog({ open = false, ...props }: DialogPrimitive.Root.Props) {
  const prior = useRef<Element | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) prior.current = document.activeElement;
  useLayoutEffect(() => {
    const target = prior.current;
    if (!open && wasOpen.current && target instanceof HTMLElement && target.isConnected && target !== document.body)
      target.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  return <DialogPrimitive.Root data-slot="dialog" open={open} {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-[110] bg-black/50 backdrop-blur-[2px] data-ending-style:pointer-events-none',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({ className, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-[110] max-h-[calc(100%-6px-2em)] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 animate-rise-in overflow-auto rounded-3xl bg-card p-0 data-ending-style:pointer-events-none text-card-foreground shadow-float outline-none',
          className,
        )}
        finalFocus={false}
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('m-0 text-sm leading-[1.3] font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogTitle };
