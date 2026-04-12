import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/8 text-primary dark:bg-primary/15",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-destructive/20 bg-destructive/8 text-destructive dark:bg-destructive/15",
        outline: "text-foreground/70 border-border/60 bg-transparent",
        success:
          "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-500/15",
        warning:
          "border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-400 dark:bg-amber-500/15",
        info:
          "border-blue-500/20 bg-blue-500/8 text-blue-700 dark:text-blue-400 dark:bg-blue-500/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
