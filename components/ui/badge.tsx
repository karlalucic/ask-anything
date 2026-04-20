import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/30 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-white text-black [a]:hover:bg-white/90",
        secondary:
          "border-white/20 bg-transparent text-white/50 [a]:hover:bg-white/5",
        destructive:
          "border-red-500/40 bg-transparent text-red-400 focus-visible:ring-red-400 [a]:hover:bg-red-500/10",
        outline:
          "border-white/10 bg-transparent text-white/30 [a]:hover:bg-white/5",
        ghost:
          "text-white/50 hover:text-white",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
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
