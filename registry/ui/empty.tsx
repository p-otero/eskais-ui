import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function part(slot: string, base: string) {
  return function EmptyPart({ className, render, ...props }: PartProps<"div">) {
    return renderElement("div", { "data-slot": slot, className: cn(base, className), ...props }, render)
  }
}

const Empty = part(
  "empty",
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-surface rounded-surface border border-dashed p-surface text-center text-balance",
)
const EmptyHeader = part("empty-header", "flex max-w-sm flex-col items-center gap-2")
const EmptyTitle = part("empty-title", "text-lg font-medium")
const EmptyDescription = part(
  "empty-description",
  "text-sm text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-foreground",
)
const EmptyContent = part("empty-content", "flex w-full max-w-sm flex-col items-center gap-4 text-sm text-balance")

const emptyMediaVariants = cva(
  "flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "size-10 rounded-control bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

function EmptyMedia({
  className,
  variant,
  render,
  ...props
}: PartProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return renderElement(
    "div",
    {
      "data-slot": "empty-media",
      "data-variant": variant ?? "default",
      className: cn(emptyMediaVariants({ variant }), className),
      ...props,
    },
    render,
  )
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, emptyMediaVariants, EmptyTitle }
