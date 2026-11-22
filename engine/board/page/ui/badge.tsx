import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const badgeVariants = cva(
  'group/badge inline-flex w-fit shrink-0 gap-1 overflow-hidden whitespace-nowrap rounded-sm border border-transparent text-[0.6875rem] font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring [&>svg]:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'h-5 items-center justify-center bg-primary px-2 text-primary-foreground',
        secondary: 'h-5 items-center justify-center bg-secondary px-2 text-secondary-foreground',
        outline: 'h-5 items-center justify-center border-border px-2 text-foreground',
        column:
          'inline-grid h-auto min-h-5 w-auto min-w-6 shrink justify-normal gap-[normal] place-items-center overflow-visible whitespace-normal border-0 bg-accent px-[7px] font-sans text-[0.71875rem] leading-none font-medium text-card-foreground normal-nums transition-[all] duration-0 ease-[ease]',
        tab: 'block h-[18px] w-auto min-w-[18px] shrink gap-[normal] overflow-visible rounded-[9px] border-0 bg-needs px-[5px] text-center font-sans leading-[18px] font-semibold text-primary-foreground transition-[all] duration-0 ease-[ease]',
        count:
          'h-[18px] items-center justify-center border-0 min-w-[18px] rounded-[9px] bg-needs px-[5px] leading-[18px] text-primary-foreground',
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
