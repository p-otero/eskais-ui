"use client"

import {
  Radio as RadioPrimitive,
  RadioGroup as RadioGroupPrimitive,
  RadioIndicator as RadioIndicatorPrimitive,
  createRadioGroupController,
} from "@ui-sdk/react/radio"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

function RadioGroup<T extends string = string>({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive<T>>) {
  return (
    <RadioGroupPrimitive<T>
      className={cnState("flex flex-col gap-items data-disabled:opacity-50", className)}
      {...props}
    />
  )
}

function Radio({ className, ...props }: ComponentProps<typeof RadioPrimitive>) {
  return (
    <RadioPrimitive
      className={cnState(
        "inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-input-strong bg-background/(--glass-opacity) text-primary shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:border-destructive data-checked:border-primary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function RadioIndicator({ className, ...props }: ComponentProps<typeof RadioIndicatorPrimitive>) {
  return <RadioIndicatorPrimitive className={cnState("size-2 rounded-full bg-current", className)} {...props} />
}

export { createRadioGroupController, Radio, RadioGroup, RadioIndicator }
export type { RadioGroupController, RadioGroupState, RadioState } from "@ui-sdk/react/radio"
