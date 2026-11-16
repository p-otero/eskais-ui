"use client"

import {
  Slider as SliderPrimitive,
  SliderControl as SliderControlPrimitive,
  SliderIndicator as SliderIndicatorPrimitive,
  SliderThumb as SliderThumbPrimitive,
  SliderTrack as SliderTrackPrimitive,
  SliderValue as SliderValuePrimitive,
  createSliderController,
} from "@ui-sdk/react/slider"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

function Slider<Value extends number | number[] = number | number[]>({
  className,
  ...props
}: ComponentProps<typeof SliderPrimitive<Value>>) {
  return (
    <SliderPrimitive<Value>
      className={cnState(
        "flex flex-col gap-inline data-disabled:opacity-50 data-[orientation=vertical]:h-40 data-[orientation=vertical]:w-fit",
        className,
      )}
      {...props}
    />
  )
}

function SliderValue({ className, ...props }: ComponentProps<typeof SliderValuePrimitive>) {
  return (
    <SliderValuePrimitive className={cnState("text-sm text-muted-foreground tabular-nums", className)} {...props} />
  )
}

function SliderControl({ className, ...props }: ComponentProps<typeof SliderControlPrimitive>) {
  return (
    <SliderControlPrimitive
      className={cnState(
        "flex cursor-pointer touch-none items-center select-none data-disabled:cursor-not-allowed data-[orientation=horizontal]:h-control-sm data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-control-sm data-[orientation=vertical]:justify-center",
        className,
      )}
      {...props}
    />
  )
}

function SliderTrack({ className, ...props }: ComponentProps<typeof SliderTrackPrimitive>) {
  return (
    <SliderTrackPrimitive
      className={cnState(
        "rounded-full bg-input/40 data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
        className,
      )}
      {...props}
    />
  )
}

function SliderIndicator({ className, ...props }: ComponentProps<typeof SliderIndicatorPrimitive>) {
  return <SliderIndicatorPrimitive className={cnState("rounded-full bg-primary", className)} {...props} />
}

// UI SDK positions thumbs and the indicator with inline styles; the thumb's border carries the 3:1 edge.
function SliderThumb({ className, ...props }: ComponentProps<typeof SliderThumbPrimitive>) {
  return (
    <SliderThumbPrimitive
      className={cnState(
        "size-4 rounded-full border border-input-strong bg-background shadow-sm transition-shadow has-focus-visible:ring-2 has-focus-visible:ring-ring data-dragging:ring-2 data-dragging:ring-ring",
        className,
      )}
      {...props}
    />
  )
}

export { createSliderController, Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue }
export type { SliderController, SliderState, SliderValueChangeDetails } from "@ui-sdk/react/slider"
