"use client"

import {
  Switch as SwitchPrimitive,
  SwitchThumb as SwitchThumbPrimitive,
  createSwitchController,
} from "@ui-sdk/react/switch"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

// The unchecked track takes the input color, not muted: the control's outline must reach 3:1 against the page.
function Switch({ className, children, ...props }: ComponentProps<typeof SwitchPrimitive>) {
  return (
    <SwitchPrimitive
      className={cnState(
        "touch-target inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input-strong shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:ring-2 aria-invalid:ring-destructive data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children ?? <SwitchThumb />}
    </SwitchPrimitive>
  )
}

function SwitchThumb({ className, ...props }: ComponentProps<typeof SwitchThumbPrimitive>) {
  return (
    <SwitchThumbPrimitive
      className={cnState(
        "pointer-events-none block size-4 rounded-full bg-background shadow-sm transition-transform motion-reduce:transition-none data-checked:translate-x-4 rtl:data-checked:-translate-x-4",
        className,
      )}
      {...props}
    />
  )
}

export { createSwitchController, Switch, SwitchThumb }
export type { SwitchController, SwitchState } from "@ui-sdk/react/switch"
