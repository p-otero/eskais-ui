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

// Segments are inputs, whose `size` left room for twice their digits, so "09" sat apart from its ":". Each takes
// its text's width (field-sizing, or ch where a browser has none), at least 24px so it stays a target (WCAG 2.5.8),
// and separators keep their spaces and sit a pixel into each neighbour: "09:38", with no two segments overlapping.
const segmentWidths =
  // oxlint-disable-next-line shadcn/no-arbitrary-values -- widths in ch: two digits, a year and a day period
  "[&_input[data-type]]:w-[2ch] [&_input[data-type=year]]:w-[4ch] [&_input[data-type=dayPeriod]]:w-[3ch] supports-[field-sizing:content]:[&_input[data-type]]:w-auto supports-[field-sizing:content]:[&_input[data-type]]:field-sizing-content [&_input[data-type]]:min-w-6 [&_input[data-type]]:self-stretch [&_input[data-type]]:text-center [&_input[data-type]]:relative [&_input[data-type]]:z-10 [&_[data-type=literal]]:-mx-px [&_[data-type=literal]]:pointer-events-none [&_[data-type=literal]]:whitespace-pre"

// DateInput renders its own segments, so they're styled from the root.
const segmentsClassName =
  "[&_[data-slot=date-input-segment]]:rounded-sm [&_[data-slot=date-input-segment]]:bg-transparent [&_[data-slot=date-input-segment]]:outline-none [&_[data-slot=date-input-segment]]:placeholder:text-muted-foreground [&_[data-slot=date-input-segment]:focus]:bg-accent [&_[data-slot=date-input-segment]:focus]:text-accent-foreground [&_[data-slot=date-input-segment][data-type=literal]]:text-muted-foreground"

/**
 * A date typed segment by segment in the locale's order, like `11/02/2026`. The value is an ISO date, or a date and
 * time with `granularity`; `null` until every segment holds something.
 */
function DateInput({ className, ...props }: ComponentProps<typeof DateInputPrimitive>) {
  return (
    <DateInputPrimitive
      className={cnState(
        `${fieldSurfaceClassName} inline-flex h-field-control w-fit max-w-full shrink-0 items-center rounded-control px-control-x text-entry tabular-nums has-focus-visible:ring-2 has-focus-visible:ring-ring has-aria-invalid:border-destructive data-invalid:border-destructive ${segmentsClassName} ${segmentWidths}`,
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
