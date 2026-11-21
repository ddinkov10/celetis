import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const toggleVariants = cva(
  'group/toggle inline-flex shrink-0 select-none items-center justify-center py-0 text-[0.78125rem] leading-none font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,opacity,transform] duration-150 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] aria-busy:cursor-progress aria-busy:opacity-70 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'rounded-sm border-0 bg-transparent font-normal text-muted-foreground hover:bg-accent hover:text-foreground',
        segmented:
          'rounded-lg border border-transparent bg-secondary text-card-foreground hover:border-border-strong data-pressed:border-border-strong data-pressed:bg-card data-pressed:text-foreground data-pressed:shadow-raise',
      },
      size: {
        default: 'h-7 gap-1.5 px-[11px] [&_.icon]:size-[13px]',
        sm: 'h-6 gap-[7px] px-2 text-xs [&_.icon]:size-[13px]',
      },
    },
    defaultVariants: {
      variant: 'segmented',
      size: 'default',
    },
  },
);

function Toggle({
  className,
  variant = 'segmented',
  size = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return <TogglePrimitive data-slot="toggle" className={cn(toggleVariants({ variant, size, className }))} {...props} />;
}

export { Toggle, toggleVariants };
