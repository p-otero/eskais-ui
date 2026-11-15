"use client"

import {
  NumberInput as NumberInputPrimitive,
  NumberInputControl as NumberInputControlPrimitive,
  NumberInputDecrement as NumberInputDecrementPrimitive,
  NumberInputGroup as NumberInputGroupPrimitive,
  NumberInputIncrement as NumberInputIncrementPrimitive,
  NumberInputScrubArea as NumberInputScrubAreaPrimitive,
  NumberInputScrubAreaCursor as NumberInputScrubAreaCursorPrimitive,
  createNumberInputController,
} from "@ui-sdk/react/number-input"
import type { ComponentProps } from "react"

import { fieldSurfaceClassName } from "@/components/ui/input"
import { cnState } from "@/lib/utils"

function NumberInput({ className, ...props }: ComponentProps<typeof NumberInputPrimitive>) {
  return <NumberInputPrimitive className={cnState("flex flex-col gap-1.5", className)} {...props} />
}

function NumberInputGroup({ className, ...props }: ComponentProps<typeof NumberInputGroupPrimitive>) {
  return (
    <NumberInputGroupPrimitive
      className={cnState(
        `${fieldSurfaceClassName} flex h-control w-full items-center overflow-hidden rounded-control has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-aria-invalid:border-destructive`,
        className,
      )}
      {...props}
    />
  )
}

function NumberInputControl({ className, ...props }: ComponentProps<typeof NumberInputControlPrimitive>) {
  return (
    <NumberInputControlPrimitive
      className={cnState(
        "h-full min-w-0 flex-1 bg-transparent px-2 text-center text-sm tabular-nums outline-none placeholder:text-muted-foreground data-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  )
}

const stepButtonClassName =
  "inline-flex h-full w-control shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:bg-transparent [&_svg]:size-4"

function StepIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

function NumberInputDecrement({ className, children, ...props }: ComponentProps<typeof NumberInputDecrementPrimitive>) {
  return (
    <NumberInputDecrementPrimitive aria-label="Decrease" className={cnState(stepButtonClassName, className)} {...props}>
      {children ?? <StepIcon path="M5 12h14" />}
    </NumberInputDecrementPrimitive>
  )
}

function NumberInputIncrement({ className, children, ...props }: ComponentProps<typeof NumberInputIncrementPrimitive>) {
  return (
    <NumberInputIncrementPrimitive aria-label="Increase" className={cnState(stepButtonClassName, className)} {...props}>
      {children ?? <StepIcon path="M12 5v14M5 12h14" />}
    </NumberInputIncrementPrimitive>
  )
}

function NumberInputScrubArea({ className, ...props }: ComponentProps<typeof NumberInputScrubAreaPrimitive>) {
  return (
    <NumberInputScrubAreaPrimitive
      className={cnState("w-fit cursor-ew-resize select-none data-[orientation=vertical]:cursor-ns-resize", className)}
      {...props}
    />
  )
}

function NumberInputScrubAreaCursor({
  className,
  ...props
}: ComponentProps<typeof NumberInputScrubAreaCursorPrimitive>) {
  return (
    <NumberInputScrubAreaCursorPrimitive className={cnState("text-foreground [&_svg]:size-4", className)} {...props} />
  )
}

export {
  createNumberInputController,
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
  NumberInputScrubArea,
  NumberInputScrubAreaCursor,
}
export type { NumberInputController, NumberInputState, NumberInputValueChangeReason } from "@ui-sdk/react/number-input"
