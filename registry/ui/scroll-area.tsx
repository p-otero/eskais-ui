"use client"

import {
  ScrollArea as ScrollAreaPrimitive,
  ScrollAreaContent,
  ScrollAreaCorner,
  ScrollAreaScrollbar as ScrollAreaScrollbarPrimitive,
  ScrollAreaScrollToEnd,
  ScrollAreaThumb as ScrollAreaThumbPrimitive,
  ScrollAreaViewport as ScrollAreaViewportPrimitive,
  createScrollAreaController,
} from "@ui-sdk/react/scroll-area"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

function ScrollArea({ className, ...props }: ComponentProps<typeof ScrollAreaPrimitive>) {
  return <ScrollAreaPrimitive className={cnState("relative overflow-hidden", className)} {...props} />
}

function ScrollAreaViewport({ className, ...props }: ComponentProps<typeof ScrollAreaViewportPrimitive>) {
  return (
    <ScrollAreaViewportPrimitive
      className={cnState(
        "size-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className,
      )}
      {...props}
    />
  )
}

/**
 * A scrollbar for one axis; without children it holds its thumb. `data-agent-hidden` on it leaves its scroll area out
 * of agents' snapshot and keeps what it holds: for one inside a component agents already know by name, which the
 * scroll area would otherwise repeat, making `query({ within })` with that name ambiguous.
 */
function ScrollAreaScrollbar({ className, children, ...props }: ComponentProps<typeof ScrollAreaScrollbarPrimitive>) {
  return (
    <ScrollAreaScrollbarPrimitive
      className={cnState(
        // oxlint-disable-next-line p-otero/spacing-tokens -- the thumb's inset inside the size-2 track: geometry, not spacing
        "group/scrollbar flex touch-none p-0.5 opacity-0 transition-opacity select-none data-visible:opacity-100 data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:w-2",
        className,
      )}
      {...props}
    >
      {children ?? <ScrollAreaThumb />}
    </ScrollAreaScrollbarPrimitive>
  )
}

function ScrollAreaThumb({ className, ...props }: ComponentProps<typeof ScrollAreaThumbPrimitive>) {
  return (
    <ScrollAreaThumbPrimitive
      className={cnState(
        "relative flex-1 rounded-full bg-muted-foreground/25 transition-colors group-hover/scrollbar:bg-muted-foreground/50 data-dragging:bg-muted-foreground/70",
        className,
      )}
      {...props}
    />
  )
}

export {
  createScrollAreaController,
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaCorner,
  ScrollAreaScrollbar,
  ScrollAreaScrollToEnd,
  ScrollAreaThumb,
  ScrollAreaViewport,
}
