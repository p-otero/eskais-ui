"use client"

import {
  Popover,
  PopoverArrow as PopoverArrowPrimitive,
  PopoverClose as PopoverClosePrimitive,
  PopoverContent as PopoverContentPrimitive,
  PopoverDescription as PopoverDescriptionPrimitive,
  PopoverTitle as PopoverTitlePrimitive,
  PopoverTrigger as PopoverTriggerPrimitive,
  createPopoverController,
} from "@ui-sdk/react/popover"
import type { VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cnState } from "@/lib/utils"

type ButtonLook = VariantProps<typeof buttonVariants>

const floatingSurfaceClassName =
  "z-50 m-0 surface-floating outline-none origin-(--transform-origin) transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-opacity motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100"

const arrowClassName =
  // oxlint-disable-next-line eskais/spacing-tokens -- half the arrow's size-2.5 (rounded up), so it straddles the edge
  "absolute size-2.5 rotate-45 border border-floating-border bg-popover data-[side=bottom]:-top-1.5 data-[side=bottom]:left-(--arrow-offset) data-[side=bottom]:-translate-x-1/2 data-[side=bottom]:border-e-0 data-[side=bottom]:border-b-0 data-[side=top]:-bottom-1.5 data-[side=top]:left-(--arrow-offset) data-[side=top]:-translate-x-1/2 data-[side=top]:border-s-0 data-[side=top]:border-t-0 data-[side=left]:-right-1.5 data-[side=left]:top-(--arrow-offset) data-[side=left]:-translate-y-1/2 data-[side=left]:border-b-0 data-[side=left]:border-s-0 data-[side=right]:-left-1.5 data-[side=right]:top-(--arrow-offset) data-[side=right]:-translate-y-1/2 data-[side=right]:border-e-0 data-[side=right]:border-t-0"

const popoverContentClassName = `${floatingSurfaceClassName} flex w-72 max-w-(--available-width) flex-col gap-group p-inset-surface`

function PopoverTrigger({
  className,
  variant = "outline",
  size,
  ...props
}: ComponentProps<typeof PopoverTriggerPrimitive> & ButtonLook) {
  return <PopoverTriggerPrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

function PopoverContent({ className, ...props }: ComponentProps<typeof PopoverContentPrimitive>) {
  return <PopoverContentPrimitive className={cnState(popoverContentClassName, className)} {...props} />
}

function PopoverArrow({ className, ...props }: ComponentProps<typeof PopoverArrowPrimitive>) {
  return <PopoverArrowPrimitive className={cnState(arrowClassName, className)} {...props} />
}

function PopoverTitle({ className, ...props }: ComponentProps<typeof PopoverTitlePrimitive>) {
  return <PopoverTitlePrimitive className={cnState("text-sm leading-none font-semibold", className)} {...props} />
}

function PopoverDescription({ className, ...props }: ComponentProps<typeof PopoverDescriptionPrimitive>) {
  return <PopoverDescriptionPrimitive className={cnState("text-sm text-muted-foreground", className)} {...props} />
}

function PopoverClose({
  className,
  variant = "outline",
  size = "sm",
  ...props
}: ComponentProps<typeof PopoverClosePrimitive> & ButtonLook) {
  return <PopoverClosePrimitive className={cnState(buttonVariants({ variant, size }), className)} {...props} />
}

export {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  createPopoverController,
  floatingSurfaceClassName,
}
