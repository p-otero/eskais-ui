"use client"

import {
  Tooltip,
  TooltipArrow as TooltipArrowPrimitive,
  TooltipContent as TooltipContentPrimitive,
  TooltipShortcut as TooltipShortcutPrimitive,
  TooltipTrigger,
  createTooltipController,
} from "@ui-sdk/react/tooltip"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

const tooltipContentClassName =
  "z-popover m-0 max-w-xs overflow-visible rounded-control border-0 bg-primary px-inset-item py-inline text-xs text-balance text-primary-foreground shadow-floating origin-(--transform-origin) transition duration-micro ease-standard data-instant:transition-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-opacity motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100"

const arrowClassName =
  // oxlint-disable-next-line eskais/spacing-tokens -- half the arrow's size-2.5 (rounded down), so it sits just inside the bubble's edge
  "absolute size-2.5 rotate-45 data-[side=bottom]:-top-1 data-[side=bottom]:left-(--arrow-offset) data-[side=bottom]:-translate-x-1/2 data-[side=top]:-bottom-1 data-[side=top]:left-(--arrow-offset) data-[side=top]:-translate-x-1/2 data-[side=left]:-right-1 data-[side=left]:top-(--arrow-offset) data-[side=left]:-translate-y-1/2 data-[side=right]:-left-1 data-[side=right]:top-(--arrow-offset) data-[side=right]:-translate-y-1/2"

function TooltipContent({ className, ...props }: ComponentProps<typeof TooltipContentPrimitive>) {
  return <TooltipContentPrimitive className={cnState(tooltipContentClassName, className)} {...props} />
}

function TooltipArrow({ className, ...props }: ComponentProps<typeof TooltipArrowPrimitive>) {
  return <TooltipArrowPrimitive className={cnState(`${arrowClassName} bg-primary`, className)} {...props} />
}

function TooltipShortcut({ className, ...props }: ComponentProps<typeof TooltipShortcutPrimitive>) {
  return (
    <TooltipShortcutPrimitive
      className={cnState("ms-items font-mono text-xs text-primary-foreground/80", className)}
      {...props}
    />
  )
}

export { Tooltip, TooltipArrow, TooltipContent, TooltipShortcut, TooltipTrigger, createTooltipController }
