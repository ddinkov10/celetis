import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import type * as React from 'react';

const cardVariants = cva('group/card rounded-xl border border-border bg-card text-card-foreground', {
  variants: { inset: { default: 'min-w-0 p-5 shadow-raise phone:p-4', none: '' } },
  defaultVariants: { inset: 'default' },
});

function Card({
  className,
  inset,
  render,
  ...props
}: useRender.ComponentProps<'section'> & VariantProps<typeof cardVariants>) {
  return useRender({
    defaultTagName: 'section',
    props: mergeProps<'section'>({ className: cn(cardVariants({ inset }), className) }, props),
    render,
    state: { slot: 'card' },
  });
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
