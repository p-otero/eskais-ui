"use client"

import {
  Meter as MeterPrimitive,
  MeterIndicator as MeterIndicatorPrimitive,
  MeterLabel as MeterLabelPrimitive,
  MeterTrack as MeterTrackPrimitive,
  MeterValue as MeterValuePrimitive,
} from "@ui-sdk/react/meter"
import type { ComponentProps } from "react"

import { gaugeClassNames, type GaugeToneProps } from "@/components/ui/progress"
import { cnState } from "@/lib/utils"

function Meter({ className, tone, ...props }: ComponentProps<typeof MeterPrimitive> & GaugeToneProps) {
  return <MeterPrimitive data-tone={tone} className={cnState(gaugeClassNames.root, className)} {...props} />
}

function MeterLabel({ className, ...props }: ComponentProps<typeof MeterLabelPrimitive>) {
  return <MeterLabelPrimitive className={cnState(gaugeClassNames.label, className)} {...props} />
}

function MeterValue({ className, ...props }: ComponentProps<typeof MeterValuePrimitive>) {
  return <MeterValuePrimitive className={cnState(gaugeClassNames.value, className)} {...props} />
}

function MeterTrack({ className, children, ...props }: ComponentProps<typeof MeterTrackPrimitive>) {
  return (
    <MeterTrackPrimitive className={cnState(gaugeClassNames.track, className)} {...props}>
      {children ?? <MeterIndicator />}
    </MeterTrackPrimitive>
  )
}

function MeterIndicator({ className, ...props }: ComponentProps<typeof MeterIndicatorPrimitive>) {
  return <MeterIndicatorPrimitive className={cnState(gaugeClassNames.indicator, className)} {...props} />
}

export { Meter, MeterIndicator, MeterLabel, MeterTrack, MeterValue }
export type { MeterState } from "@ui-sdk/react/meter"
