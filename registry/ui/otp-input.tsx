"use client"

import {
  OTPInput as OTPInputPrimitive,
  OTPInputGroup as OTPInputGroupPrimitive,
  OTPInputSeparator as OTPInputSeparatorPrimitive,
  OTPInputSlot as OTPInputSlotPrimitive,
  createOTPInputController,
} from "@ui-sdk/react/otp-input"
import type { ComponentProps } from "react"

import { fieldSurfaceClassName } from "@/components/ui/input"
import { cnState } from "@/lib/utils"

function OTPInput({ className, ...props }: ComponentProps<typeof OTPInputPrimitive>) {
  return (
    <OTPInputPrimitive
      className={cnState("flex w-fit items-center gap-2 data-disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

function OTPInputGroup({ className, ...props }: ComponentProps<typeof OTPInputGroupPrimitive>) {
  return <OTPInputGroupPrimitive className={cnState("flex items-center gap-1.5", className)} {...props} />
}

// The input's own caret is hidden, so the active empty slot draws one.
function OTPInputSlot({ className, children, ...props }: ComponentProps<typeof OTPInputSlotPrimitive>) {
  return (
    <OTPInputSlotPrimitive
      className={cnState(
        `${fieldSurfaceClassName} relative flex size-control items-center justify-center rounded-choice text-base font-medium tabular-nums data-active:z-10 data-active:border-ring data-active:ring-2 data-active:ring-ring in-aria-invalid:border-destructive`,
        className,
      )}
      {...props}
    >
      {children ??
        ((state) =>
          state.hasFakeCaret ? (
            <span aria-hidden="true" className="h-4 w-px bg-foreground motion-safe:animate-pulse" />
          ) : (
            state.char
          ))}
    </OTPInputSlotPrimitive>
  )
}

function OTPInputSeparator({ className, children, ...props }: ComponentProps<typeof OTPInputSeparatorPrimitive>) {
  return (
    <OTPInputSeparatorPrimitive
      className={cnState("flex items-center text-muted-foreground [&_svg]:size-4", className)}
      {...props}
    >
      {children ?? <span aria-hidden="true" className="h-0.5 w-2 rounded-full bg-current" />}
    </OTPInputSeparatorPrimitive>
  )
}

export { createOTPInputController, OTPInput, OTPInputGroup, OTPInputSeparator, OTPInputSlot }
export type { OTPInputController, OTPInputSlotState, OTPInputState } from "@ui-sdk/react/otp-input"
