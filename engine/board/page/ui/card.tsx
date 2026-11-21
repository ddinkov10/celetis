import { cn } from 'cn';
import type * as React from 'react';

function Card({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="card"
      className={cn(
        'group/card min-w-0 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-raise phone:p-4',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('text-sm leading-[1.4] font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('mt-2 mb-0 text-[0.78125rem] leading-normal text-pretty text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Card, CardDescription, CardTitle };
