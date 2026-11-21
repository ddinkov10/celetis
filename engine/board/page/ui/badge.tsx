import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const badgeVariants = cva(
  'group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-sm border border-transparent text-[0.6875rem] font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring [&>svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'h-5 bg-primary px-2 text-primary-foreground',
        secondary: 'h-5 bg-secondary px-2 text-secondary-foreground',
        outline: 'h-5 border-border px-2 text-foreground',
        count: 'h-[18px] border-0 min-w-[18px] rounded-[9px] bg-needs px-[5px] leading-[18px] text-primary-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: 'badge', variant },
  });
}
