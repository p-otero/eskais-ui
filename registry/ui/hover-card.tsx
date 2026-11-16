"use client"

import {
  HoverCard,
  HoverCardArrow as HoverCardArrowPrimitive,
  HoverCardContent as HoverCardContentPrimitive,
  HoverCardTrigger as HoverCardTriggerPrimitive,
  createHoverCardController,
} from "@ui-sdk/react/hover-card"
import type { ComponentProps } from "react"

import { floatingSurfaceClassName } from "@/components/ui/popover"
import { cnState } from "@/lib/utils"

const arrowClassName =
  // oxlint-disable-next-line eskais/spacing-tokens -- half the arrow's size-2.5 (rounded up), so it straddles the edge
  "absolute size-2.5 rotate-45 border border-floating-border bg-popover data-[side=bottom]:-top-1.5 data-[side=bottom]:left-(--arrow-offset) data-[side=bottom]:-translate-x-1/2 data-[side=bottom]:border-e-0 data-[side=bottom]:border-b-0 data-[side=top]:-bottom-1.5 data-[side=top]:left-(--arrow-offset) data-[side=top]:-translate-x-1/2 data-[side=top]:border-s-0 data-[side=top]:border-t-0 data-[side=left]:-right-1.5 data-[side=left]:top-(--arrow-offset) data-[side=left]:-translate-y-1/2 data-[side=left]:border-b-0 data-[side=left]:border-s-0 data-[side=right]:-left-1.5 data-[side=right]:top-(--arrow-offset) data-[side=right]:-translate-y-1/2 data-[side=right]:border-e-0 data-[side=right]:border-t-0"

function HoverCardTrigger({ className, ...props }: ComponentProps<typeof HoverCardTriggerPrimitive>) {
  return (
    <HoverCardTriggerPrimitive
      className={cnState(
        "rounded-sm font-medium text-link underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-open:underline",
        className,
      )}
      {...props}
    />
  )
}

function HoverCardContent({ className, ...props }: ComponentProps<typeof HoverCardContentPrimitive>) {
  return (
    <HoverCardContentPrimitive
      className={cnState(
        `${floatingSurfaceClassName} flex w-72 max-w-(--available-width) flex-col gap-items p-inset-surface text-sm`,
        className,
      )}
      {...props}
    />
  )
}

function HoverCardArrow({ className, ...props }: ComponentProps<typeof HoverCardArrowPrimitive>) {
  return <HoverCardArrowPrimitive className={cnState(arrowClassName, className)} {...props} />
}

export { HoverCard, HoverCardArrow, HoverCardContent, HoverCardTrigger, createHoverCardController }
