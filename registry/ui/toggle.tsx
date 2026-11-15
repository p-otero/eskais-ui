"use client"

import {
  Toggle as TogglePrimitive,
  ToggleIcon as ToggleIconPrimitive,
  createToggleController,
} from "@ui-sdk/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

// Pressed is a full primary fill: a muted tint against the page doesn't reach the 3:1 a state needs.
const toggleVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-50 data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-primary/90 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-accent hover:text-accent-foreground",
        outline:
          "border border-input bg-background/(--glass-opacity) hover:bg-accent hover:text-accent-foreground data-pressed:border-primary",
      },
      size: {
        sm: "h-control-sm px-control-x",
        default: "h-control px-control-x",
        lg: "h-control-lg px-control-x",
        icon: "size-control",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

type ToggleProps = ComponentProps<typeof TogglePrimitive> & VariantProps<typeof toggleVariants>

function Toggle({ className, variant, size, ...props }: ToggleProps) {
  return (
    <TogglePrimitive
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      className={cnState(toggleVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function ToggleIcon({ className, ...props }: ComponentProps<typeof ToggleIconPrimitive>) {
  return (
    <ToggleIconPrimitive
      className={cnState("inline-flex shrink-0 items-center justify-center data-mirror:rtl:-scale-x-100", className)}
      {...props}
    />
  )
}

export { createToggleController, Toggle, ToggleIcon, toggleVariants }
export type { ToggleProps }
export type { ToggleController, TogglePressedChangeReason, ToggleState } from "@ui-sdk/react/toggle"
