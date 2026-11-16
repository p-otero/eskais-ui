"use client"

import {
  SegmentedControl as SegmentedControlPrimitive,
  SegmentedControlIndicator as SegmentedControlIndicatorPrimitive,
  SegmentedControlItem as SegmentedControlItemPrimitive,
  createSegmentedControlController,
} from "@ui-sdk/react/segmented-control"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

function SegmentedControl<T extends string = string>({
  className,
  ...props
}: ComponentProps<typeof SegmentedControlPrimitive<T>>) {
  return (
    <SegmentedControlPrimitive<T>
      className={cnState(
        "relative isolate inline-flex w-fit rounded-control border bg-muted/(--glass-opacity) p-control-inset data-disabled:opacity-50 data-[orientation=horizontal]:h-control data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  )
}

// The indicator is the checked state, so it takes the primary fill: muted against background is far below 3:1.
function SegmentedControlIndicator({ className, ...props }: ComponentProps<typeof SegmentedControlIndicatorPrimitive>) {
  return (
    <SegmentedControlIndicatorPrimitive
      className={cnState(
        "absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-control bg-primary shadow-sm transition-all duration-200 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  )
}

function SegmentedControlItem({ className, ...props }: ComponentProps<typeof SegmentedControlItemPrimitive>) {
  return (
    <SegmentedControlItemPrimitive
      className={cnState(
        "inline-flex cursor-pointer items-center justify-center gap-inline rounded-control px-control-x text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring in-data-[orientation=vertical]:h-control-sm data-checked:text-primary-foreground data-checked:hover:text-primary-foreground data-disabled:cursor-not-allowed data-disabled:hover:text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}

export { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem, createSegmentedControlController }
export type { SegmentedControlController, SegmentedControlItemState } from "@ui-sdk/react/segmented-control"
