import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden font-medium whitespace-nowrap tabular-nums [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        count: "min-h-5 min-w-6 rounded-sm bg-accent px-[7px] text-[0.71875rem] leading-none text-ink-muted",
        alert: "h-[18px] min-w-[18px] rounded-[9px] bg-needs px-[5px] text-[0.6875rem] leading-[18px] font-semibold text-primary-foreground",
        pill: "min-h-6 rounded-md px-[9px] py-1 pl-[7px] text-xs leading-[1.25] [&>svg]:size-[13px]",
        tag: "h-[22px] rounded-sm bg-secondary px-2 text-xs text-ink-muted",
      },
    },
    defaultVariants: {
      variant: "tag",
    },
  }
)

function Badge({
  className,
  variant = "tag",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
