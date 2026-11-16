"use client"

import {
  Progress as ProgressPrimitive,
  ProgressIndicator as ProgressIndicatorPrimitive,
  ProgressLabel as ProgressLabelPrimitive,
  ProgressTrack as ProgressTrackPrimitive,
  ProgressValue as ProgressValuePrimitive,
} from "@ui-sdk/react/progress"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

const gaugeClassNames = {
  root: "flex w-full flex-wrap items-baseline justify-between gap-inline",
  label: "text-sm font-medium",
  value: "text-sm text-muted-foreground tabular-nums",
  track: "relative h-2 w-full basis-full overflow-hidden rounded-full bg-input/40",
  indicator: "absolute inset-y-0 rounded-full bg-primary transition-all motion-reduce:transition-none",
}

function Progress({ className, ...props }: ComponentProps<typeof ProgressPrimitive>) {
  return <ProgressPrimitive className={cnState(gaugeClassNames.root, className)} {...props} />
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
export type { ProgressState } from "@ui-sdk/react/progress"
