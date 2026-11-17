"use client"

import {
  Meter as MeterPrimitive,
  MeterIndicator as MeterIndicatorPrimitive,
  MeterLabel as MeterLabelPrimitive,
  MeterTrack as MeterTrackPrimitive,
  MeterValue as MeterValuePrimitive,
} from "@ui-sdk/react/meter"
import { use, useMemo, type ComponentProps } from "react"

import {
  GaugeRangeContext,
  gaugeClassNames,
  type GaugeToneProps,
  type GaugeValueFormatProps,
} from "@/components/ui/progress"
import { cnState } from "@/lib/utils"

function Meter({ className, tone, ...props }: ComponentProps<typeof MeterPrimitive> & GaugeToneProps) {
  const { min = 0, max = 100 } = props
  const range = useMemo(() => ({ min, max }), [min, max])
  return (
    <GaugeRangeContext value={range}>
      <MeterPrimitive data-tone={tone} className={cnState(gaugeClassNames.root, className)} {...props} />
    </GaugeRangeContext>
  )
}

function MeterLabel({ className, ...props }: ComponentProps<typeof MeterLabelPrimitive>) {
  return <MeterLabelPrimitive className={cnState(gaugeClassNames.label, className)} {...props} />
}

function MeterValue({
  className,
  formatValue,
  children,
  ...props
}: ComponentProps<typeof MeterValuePrimitive> & GaugeValueFormatProps<number>) {
  const range = use(GaugeRangeContext)
  return (
    <MeterValuePrimitive className={cnState(gaugeClassNames.value, className)} {...props}>
      {children ??
        (formatValue && ((state) => formatValue(state.value, { ...range, percent: state.percent, text: state.text })))}
    </MeterValuePrimitive>
  )
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
