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

function ScrollAreaScrollbar({ className, ...props }: ComponentProps<typeof ScrollAreaScrollbarPrimitive>) {
  return (
    <ScrollAreaScrollbarPrimitive
      className={cnState(
        "flex touch-none p-0.5 opacity-0 transition-opacity select-none data-visible:opacity-100 data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:w-2.5",
        className,
      )}
      {...props}
    />
  )
}

function ScrollAreaThumb({ className, ...props }: ComponentProps<typeof ScrollAreaThumbPrimitive>) {
  return (
    <ScrollAreaThumbPrimitive
      className={cnState("relative flex-1 rounded-full bg-input data-dragging:bg-muted-foreground", className)}
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
