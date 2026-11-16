"use client"

import {
  Carousel as CarouselPrimitive,
  CarouselContent as CarouselContentPrimitive,
  CarouselIndicator as CarouselIndicatorPrimitive,
  CarouselIndicatorGroup as CarouselIndicatorGroupPrimitive,
  CarouselItem as CarouselItemPrimitive,
  CarouselNext as CarouselNextPrimitive,
  CarouselPlayToggle as CarouselPlayTogglePrimitive,
  CarouselPrevious as CarouselPreviousPrimitive,
  CarouselViewport as CarouselViewportPrimitive,
  createCarouselController,
} from "@ui-sdk/react/carousel"
import type { ComponentProps } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cnState } from "@/lib/utils"

const stepClassName = buttonVariants({ variant: "outline", size: "icon" })

function Chevron({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className="in-data-[orientation=horizontal]:rtl:rotate-180 in-data-[orientation=vertical]:rotate-90"
    >
      <path d={path} />
    </svg>
  )
}

function Carousel({ className, ...props }: ComponentProps<typeof CarouselPrimitive>) {
  return <CarouselPrimitive className={cnState("relative flex flex-col gap-group", className)} {...props} />
}

function CarouselViewport({ className, ...props }: ComponentProps<typeof CarouselViewportPrimitive>) {
  return (
    <CarouselViewportPrimitive
      className={cnState(
        "min-w-0 flex-1 rounded-surface outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-dragging:cursor-grabbing",
        className,
      )}
      {...props}
    />
  )
}

function CarouselContent({ className, ...props }: ComponentProps<typeof CarouselContentPrimitive>) {
  return (
    <CarouselContentPrimitive
      className={cnState("flex gap-section data-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  )
}

function CarouselItem({ className, ...props }: ComponentProps<typeof CarouselItemPrimitive>) {
  return <CarouselItemPrimitive className={cnState("min-w-0 basis-full", className)} {...props} />
}

function CarouselPrevious({
  className,
  children,
  "aria-label": label = "Previous slide",
  ...props
}: ComponentProps<typeof CarouselPreviousPrimitive>) {
  return (
    <CarouselPreviousPrimitive aria-label={label} className={cnState(stepClassName, className)} {...props}>
      {children ?? <Chevron path="m15 18-6-6 6-6" />}
    </CarouselPreviousPrimitive>
  )
}

function CarouselNext({
  className,
  children,
  "aria-label": label = "Next slide",
  ...props
}: ComponentProps<typeof CarouselNextPrimitive>) {
  return (
    <CarouselNextPrimitive aria-label={label} className={cnState(stepClassName, className)} {...props}>
      {children ?? <Chevron path="m9 18 6-6-6-6" />}
    </CarouselNextPrimitive>
  )
}

function CarouselIndicatorGroup({ className, ...props }: ComponentProps<typeof CarouselIndicatorGroupPrimitive>) {
  return (
    <CarouselIndicatorGroupPrimitive
      className={cnState("flex items-center justify-center gap-inline", className)}
      {...props}
    />
  )
}

type CarouselIndicatorProps = ComponentProps<typeof CarouselIndicatorPrimitive> & {
  label?: (page: number) => string
}

const slideLabel = (page: number) => `Slide ${page}`

function CarouselIndicator({ className, page, label = slideLabel, ...props }: CarouselIndicatorProps) {
  return (
    <CarouselIndicatorPrimitive
      page={page}
      aria-label={page === undefined ? undefined : label(page)}
      className={cnState(
        "group/indicator inline-flex size-control-sm cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="size-2 rounded-full bg-input transition-colors group-data-selected/indicator:bg-primary"
      />
    </CarouselIndicatorPrimitive>
  )
}

function CarouselPlayToggle({ className, ...props }: ComponentProps<typeof CarouselPlayTogglePrimitive>) {
  return <CarouselPlayTogglePrimitive className={cnState(stepClassName, className)} {...props} />
}

export {
  Carousel,
  CarouselContent,
  CarouselIndicator,
  CarouselIndicatorGroup,
  CarouselItem,
  CarouselNext,
  CarouselPlayToggle,
  CarouselPrevious,
  CarouselViewport,
  createCarouselController,
}
export type { CarouselIndicatorProps }
export type { CarouselController, CarouselOrientation, CarouselState } from "@ui-sdk/react/carousel"
