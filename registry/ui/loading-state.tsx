import { cva } from "class-variance-authority"
import type { ComponentProps } from "react"

import type { EmptySize } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const loadingStateVariants = cva("flex min-w-0 flex-col", {
  variants: {
    size: {
      inline: "gap-items",
      panel: "flex-1 gap-items p-inset-surface",
      page: "flex-1 gap-group px-inset-surface py-section",
    },
    variant: { spinner: "items-center justify-center", skeleton: "" },
  },
  compoundVariants: [{ variant: "spinner", size: "inline", className: "items-start" }],
  defaultVariants: { size: "panel", variant: "spinner" },
})

type LoadingStateProps = Omit<ComponentProps<"div">, "children"> & {
  /** Read by screen readers, never shown. */
  label: string
  variant?: "spinner" | "skeleton"
  /** Placeholder lines, with `variant="skeleton"`. */
  rows?: number
  size?: EmptySize
}

function LoadingState({
  label,
  variant = "spinner",
  rows = 3,
  size = "panel",
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      data-slot="loading-state"
      data-variant={variant}
      data-size={size}
      aria-busy="true"
      className={cn(loadingStateVariants({ size, variant }), className)}
      {...props}
    >
      <output className="sr-only">{label}</output>
      {variant === "spinner" ? (
        <Spinner size={size === "inline" ? "md" : "lg"} className="text-muted-foreground" />
      ) : (
        Array.from({ length: rows }, (_, row) => (
          <Skeleton
            key={`row-${row}`}
            className="h-4 w-full nth-of-type-[4n+2]:w-11/12 nth-of-type-[4n+3]:w-4/5 nth-of-type-[4n]:w-2/3"
          />
        ))
      )}
    </div>
  )
}

export { LoadingState }
export type { LoadingStateProps }
