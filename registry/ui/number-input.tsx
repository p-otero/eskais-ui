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
import { MinusIcon, PlusIcon } from "lucide-react"

import { fieldSurfaceClassName, floatingLabelControls, useFloatingPlaceholder } from "@/components/ui/field"
import { ControlTooltip, type ControlTooltipOption } from "@/components/ui/tooltip"
import { cnState } from "@/lib/utils"

function NumberInput({ className, ...props }: ComponentProps<typeof NumberInputPrimitive>) {
  return <NumberInputPrimitive className={cnState("flex flex-col gap-inline", className)} {...props} />
}

function NumberInputGroup({ className, ...props }: ComponentProps<typeof NumberInputGroupPrimitive>) {
  return (
    <NumberInputGroupPrimitive
      className={cnState(
        `${fieldSurfaceClassName} flex h-field-control w-full items-center overflow-hidden rounded-control has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-aria-invalid:border-destructive`,
        className,
      )}
      {...props}
    />
  )
}

function NumberInputControl({ className, placeholder, ...props }: ComponentProps<typeof NumberInputControlPrimitive>) {
  return (
    <NumberInputControlPrimitive
      placeholder={useFloatingPlaceholder(placeholder)}
      className={cnState(
        "h-full min-w-0 flex-1 bg-transparent px-inline text-center text-entry tabular-nums outline-none placeholder:text-muted-foreground data-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  )
}

const stepButtonClassName =
  "inline-flex h-full w-control shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:bg-transparent [&_svg]:size-4"

function NumberInputDecrement({
  className,
  children,
  "aria-label": ariaLabel = "Decrease",
  tooltip,
  ...props
}: ComponentProps<typeof NumberInputDecrementPrimitive> & { tooltip?: ControlTooltipOption }) {
  return (
    <ControlTooltip label={ariaLabel} tooltip={tooltip} iconOnly={children === undefined}>
      <NumberInputDecrementPrimitive
        aria-label={ariaLabel}
        className={cnState(stepButtonClassName, className)}
        {...props}
      >
        {children ?? <MinusIcon />}
      </NumberInputDecrementPrimitive>
    </ControlTooltip>
  )
}

function NumberInputIncrement({
  className,
  children,
  "aria-label": ariaLabel = "Increase",
  tooltip,
  ...props
}: ComponentProps<typeof NumberInputIncrementPrimitive> & { tooltip?: ControlTooltipOption }) {
  return (
    <ControlTooltip label={ariaLabel} tooltip={tooltip} iconOnly={children === undefined}>
      <NumberInputIncrementPrimitive
        aria-label={ariaLabel}
        className={cnState(stepButtonClassName, className)}
        {...props}
      >
        {children ?? <PlusIcon />}
      </NumberInputIncrementPrimitive>
    </ControlTooltip>
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

floatingLabelControls.add(NumberInput)

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
