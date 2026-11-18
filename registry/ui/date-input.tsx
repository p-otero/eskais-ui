"use client"

import {
  DateInput as DateInputPrimitive,
  DateInputSegment as DateInputSegmentPrimitive,
  createDateInputController,
} from "@ui-sdk/react/date-input"
import type { ComponentProps } from "react"

import { floatingLabelControls } from "@/components/ui/field"
import { fieldSurfaceClassName } from "@/components/ui/input"
import { cnState } from "@/lib/utils"

// DateInput renders its own segments, so they're styled from the root.
const segmentsClassName =
  "[&_[data-slot=date-input-segment]]:rounded-sm [&_[data-slot=date-input-segment]]:bg-transparent [&_[data-slot=date-input-segment]]:text-center [&_[data-slot=date-input-segment]]:outline-none [&_[data-slot=date-input-segment]]:placeholder:text-muted-foreground [&_[data-slot=date-input-segment]:focus]:bg-accent [&_[data-slot=date-input-segment]:focus]:text-accent-foreground [&_[data-slot=date-input-segment][data-type=literal]]:text-muted-foreground"

/**
 * A date typed segment by segment in the locale's order, like `11/02/2026`. The value is an ISO date, or a date and
 * time with `granularity`; `null` until every segment holds something.
 */
function DateInput({ className, ...props }: ComponentProps<typeof DateInputPrimitive>) {
  return (
    <DateInputPrimitive
      className={cnState(
        `${fieldSurfaceClassName} inline-flex h-field-control w-fit max-w-full shrink-0 items-center rounded-control px-control-x text-entry tabular-nums has-focus-visible:ring-2 has-focus-visible:ring-ring has-aria-invalid:border-destructive data-invalid:border-destructive ${segmentsClassName}`,
        className,
      )}
      {...props}
    />
  )
}

/** One segment, for children rendered from the input's `segments`; styled by `DateInput`, which renders them for you. */
function DateInputSegment({ className, ...props }: ComponentProps<typeof DateInputSegmentPrimitive>) {
  return <DateInputSegmentPrimitive className={cnState("data-disabled:cursor-not-allowed", className)} {...props} />
}

floatingLabelControls.add(DateInput)

export { createDateInputController, DateInput, DateInputSegment }
export type {
  DateInputController,
  DateInputGranularity,
  DateInputSegmentState,
  DateInputValueChangeReason,
  DateMatchers,
} from "@ui-sdk/react/date-input"
