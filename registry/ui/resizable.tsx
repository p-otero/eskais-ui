"use client"

import {
  Resizable as ResizablePrimitive,
  ResizableHandle as ResizableHandlePrimitive,
  ResizablePanel as ResizablePanelPrimitive,
  createResizableController,
} from "@ui-sdk/react/resizable"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

function Resizable({ className, ...props }: ComponentProps<typeof ResizablePrimitive>) {
  return <ResizablePrimitive className={cnState("size-full", className)} {...props} />
}

function ResizablePanel({ className, ...props }: ComponentProps<typeof ResizablePanelPrimitive>) {
  // oxlint-disable-next-line eskais/scroll-area -- a layout fallback: panels put their own scroll area inside, and one per panel would nest a second viewport around theirs
  return <ResizablePanelPrimitive className={cnState("min-h-0 min-w-0 overflow-auto", className)} {...props} />
}

type ResizableHandleProps = ComponentProps<typeof ResizableHandlePrimitive> & {
  "aria-label": string
  withGrip?: boolean
}

function ResizableHandle({ className, withGrip = false, children, ...props }: ResizableHandleProps) {
  return (
    <ResizableHandlePrimitive
      className={cnState(
        "relative flex shrink-0 items-center justify-center bg-border outline-none transition-colors data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-hovering:bg-ring data-dragging:bg-ring focus-visible:bg-ring focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-default data-disabled:bg-border",
        className,
      )}
      {...props}
    >
      {children ??
        (withGrip && (
          <span
            aria-hidden="true"
            data-slot="resizable-grip"
            className="z-10 flex h-6 w-3 items-center justify-center rounded-choice border bg-background in-data-[orientation=vertical]:h-3 in-data-[orientation=vertical]:w-6"
          >
            {/* oxlint-disable-next-line eskais/no-inline-icons -- the separator's filled grip dots, sized to the handle */}
            <svg
              viewBox="0 0 6 14"
              className="h-3.5 w-1.5 fill-muted-foreground in-data-[orientation=vertical]:rotate-90"
            >
              <circle cx="1" cy="2" r="1" />
              <circle cx="5" cy="2" r="1" />
              <circle cx="1" cy="7" r="1" />
              <circle cx="5" cy="7" r="1" />
              <circle cx="1" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </span>
        ))}
    </ResizableHandlePrimitive>
  )
}

export { createResizableController, Resizable, ResizableHandle, ResizablePanel }
export type { ResizableHandleProps }
export type { ResizableController, ResizableSize, ResizableStorage } from "@ui-sdk/react/resizable"
