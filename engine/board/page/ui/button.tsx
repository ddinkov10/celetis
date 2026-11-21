import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const buttonVariants = cva(
  'group/button inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border border-transparent py-0 text-[0.78125rem] leading-none font-medium transition-[background-color,border-color,opacity,transform] duration-150 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] aria-busy:cursor-progress aria-busy:opacity-70 motion-safe:aria-busy:[&_.icon]:animate-[turn_0.9s_linear_infinite] aria-disabled:cursor-not-allowed aria-disabled:opacity-[0.42] aria-disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        outline: 'border-border bg-secondary text-foreground hover:border-border-strong hover:bg-accent',
        ghost: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-7 gap-1.5 px-[11px] [&_.icon]:size-[13px]',
        icon: 'size-[26px] rounded-[7px] p-0 [&_.icon]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
