import { cn } from 'cn';
import type { ComponentProps } from 'react';

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-grid min-h-5 min-w-[22px] place-items-center rounded-sm border border-b-2 border-border-strong bg-secondary px-[5px] py-0 font-mono text-[0.6875rem] leading-none font-medium text-foreground',
        className,
      )}
      {...props}
    />
  );
}
