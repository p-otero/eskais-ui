"use client"

import {
  Progress as ProgressPrimitive,
  ProgressIndicator as ProgressIndicatorPrimitive,
  ProgressLabel as ProgressLabelPrimitive,
  ProgressTrack as ProgressTrackPrimitive,
  ProgressValue as ProgressValuePrimitive,
} from "@ui-sdk/react/progress"
import type { ComponentProps } from "react"

import type { Tone } from "@/lib/tone"
import { cnState } from "@/lib/utils"

const gaugeClassNames = {
  root: "group/gauge flex w-full flex-wrap items-baseline justify-between gap-inline",
  label: "text-sm font-medium",
  value: "text-sm text-muted-foreground tabular-nums",
  track: "relative h-2 w-full basis-full overflow-hidden rounded-full bg-input/40",
  indicator:
    "absolute inset-y-0 rounded-full bg-primary transition-all motion-reduce:transition-none group-data-[tone=neutral]/gauge:bg-muted-foreground group-data-[tone=info]/gauge:bg-info group-data-[tone=success]/gauge:bg-success group-data-[tone=warning]/gauge:bg-warning group-data-[tone=destructive]/gauge:bg-destructive",
}

/** Colours the indicator by what the value means; without it the indicator takes the primary colour. */
type GaugeToneProps = { tone?: Tone }

function Progress({ className, tone, ...props }: ComponentProps<typeof ProgressPrimitive> & GaugeToneProps) {
  return <ProgressPrimitive data-tone={tone} className={cnState(gaugeClassNames.root, className)} {...props} />
}

function ProgressLabel({ className, ...props }: ComponentProps<typeof ProgressLabelPrimitive>) {
  return <ProgressLabelPrimitive className={cnState(gaugeClassNames.label, className)} {...props} />
}

function ProgressValue({ className, ...props }: ComponentProps<typeof ProgressValuePrimitive>) {
  return <ProgressValuePrimitive className={cnState(gaugeClassNames.value, className)} {...props} />
}

function ProgressTrack({ className, children, ...props }: ComponentProps<typeof ProgressTrackPrimitive>) {
  return (
    <ProgressTrackPrimitive className={cnState(gaugeClassNames.track, className)} {...props}>
      {children ?? <ProgressIndicator />}
    </ProgressTrackPrimitive>
  )
}

// Indeterminate has no width to show, so the whole track pulses; reduced motion keeps it still.
function ProgressIndicator({ className, ...props }: ComponentProps<typeof ProgressIndicatorPrimitive>) {
  return (
    <ProgressIndicatorPrimitive
      className={cnState(
        `${gaugeClassNames.indicator} data-indeterminate:inset-x-0 data-indeterminate:motion-safe:animate-pulse`,
        className,
      )}
      {...props}
    />
  )
}

export { gaugeClassNames, Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue }
export type { GaugeToneProps }
export type { ProgressState } from "@ui-sdk/react/progress"
