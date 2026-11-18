import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent font-sans text-[0.78125rem] leading-none font-medium whitespace-nowrap transition-[background-color,border-color,opacity,transform] duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:not-aria-disabled:scale-[0.97] aria-disabled:cursor-not-allowed aria-disabled:opacity-42 aria-busy:cursor-progress aria-busy:opacity-70 phone:relative phone:before:absolute phone:before:top-1/2 phone:before:left-1/2 phone:before:h-[max(100%,44px)] phone:before:w-[max(100%,44px)] phone:before:-translate-1/2 phone:before:content-[''] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[13px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:not-aria-disabled:opacity-88",
        outline:
          "border-border bg-secondary text-foreground hover:not-aria-disabled:border-input hover:not-aria-disabled:bg-accent",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-7 gap-1.5 px-[11px]",
        icon: "size-[26px] rounded-md [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
