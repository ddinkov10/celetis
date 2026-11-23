import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const TAP =
  'phone:relative phone:before:absolute phone:before:top-1/2 phone:before:left-1/2 phone:before:h-[max(100%,44px)] phone:before:w-[max(100%,44px)] phone:before:content-[""] phone:before:[transform:translate(-50%,-50%)]';
const FADE = 'transition-[background-color,border-color,opacity,transform] duration-150';
const LABEL = 'text-[0.78125rem] leading-none font-medium whitespace-nowrap';

const variants = cva(
  'group/button inline-flex shrink-0 select-none items-center justify-center rounded-lg border border-transparent py-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] aria-busy:cursor-progress aria-busy:opacity-70 motion-safe:aria-busy:[&_.icon]:animate-[turn_0.9s_linear_infinite] aria-disabled:cursor-not-allowed aria-disabled:opacity-[0.42] aria-disabled:active:scale-100 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: `${FADE} bg-primary text-primary-foreground hover:opacity-90`,
        outline: `${FADE} border-border bg-secondary text-foreground hover:border-border-strong hover:bg-accent`,
        ghost: `${FADE} bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground`,
        link: `${FADE} bg-transparent text-primary underline-offset-4 hover:underline`,
        primary: `${TAP} select-auto [transition:background-color_.15s,border-color_.15s,opacity_.15s,transform_.1s] bg-primary text-primary-foreground [&:hover:not([aria-disabled=true])]:opacity-[0.88]`,
        secondary: `${TAP} select-auto [transition:background-color_.15s,border-color_.15s,opacity_.15s,transform_.1s] border-border bg-secondary text-foreground [&:hover]:border-border-strong [&:hover]:bg-accent`,
        quiet: `${TAP} select-auto [transition:background-color_.15s,border-color_.15s,opacity_.15s,transform_.1s] bg-transparent text-card-foreground [&:hover]:bg-accent [&:hover]:text-foreground`,
        icon: `${TAP} grid select-auto justify-normal place-items-center border-0 bg-transparent text-muted-foreground active:scale-100 [&:hover]:bg-accent [&:hover]:text-foreground`,
      },
      size: {
        default: `h-7 gap-1.5 px-[11px] ${LABEL} [&_svg]:pointer-events-none [&_.icon]:size-[13px]`,
        action: `min-h-7 gap-1.5 px-[11px] ${LABEL} [&_.icon]:size-[13px]`,
        icon: 'size-[26px] rounded-[7px] p-0 [&_.icon]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export const buttonVariants = (props: Parameters<typeof variants>[0]) => cn(variants(props));

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof variants>) {
  return <ButtonPrimitive data-slot="button" className={buttonVariants({ variant, size, className })} {...props} />;
}
