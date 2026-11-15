"use client"

import { Textarea as TextareaPrimitive, createInputController } from "@ui-sdk/react/textarea"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

// rounded-control is a pill in the default theme and clips multi-line text; rounded-lg follows --radius instead.
function Textarea({ className, ...props }: ComponentProps<typeof TextareaPrimitive>) {
  return (
    <TextareaPrimitive
      className={cnState(
        "min-h-20 w-full min-w-0 rounded-lg border border-input bg-background/(--glass-opacity) px-control-x py-2 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea, createInputController }
export type { InputController, TextareaState } from "@ui-sdk/react/textarea"
