import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { cva } from "class-variance-authority"

import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

type AlertTone = Tone

const alertVariants = cva(
  // oxlint-disable-next-line eskais/spacing-tokens -- clears the absolute size-4 icon plus a 12px gap
  "relative flex w-full flex-col gap-inline rounded-surface border bg-background/(--glass-opacity) p-inset-surface text-sm text-foreground [&>svg]:absolute [&>svg]:start-inset-surface [&>svg]:top-inset-surface [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg~*]:ps-7",
  {
    variants: {
      tone: {
        neutral: "[&>svg]:text-muted-foreground",
        info: "border-info/50 [&>svg]:text-info [&>[data-slot=alert-title]]:text-info",
        success: "border-success/50 [&>svg]:text-success [&>[data-slot=alert-title]]:text-success",
        warning: "border-warning/50 [&>svg]:text-warning [&>[data-slot=alert-title]]:text-warning",
        destructive: "border-destructive/50 [&>svg]:text-destructive [&>[data-slot=alert-title]]:text-destructive",
      },
    },
    defaultVariants: { tone: "info" },
  },
)

// role="alert" interrupts a screen reader, so it's opt-in for messages that appear after the page loads.
type AlertProps = PartProps<"div"> & { tone?: AlertTone; announce?: boolean }

function Alert({ className, tone, announce, render, ...props }: AlertProps) {
  return renderElement(
    "div",
    {
      "data-slot": "alert",
      "data-tone": tone ?? "info",
      role: announce ? "alert" : undefined,
      className: cn(alertVariants({ tone }), className),
      ...props,
    },
    render,
  )
}

function AlertTitle({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    { "data-slot": "alert-title", className: cn("leading-snug font-medium", className), ...props },
    render,
  )
}

function AlertDescription({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "alert-description",
      className: cn("text-muted-foreground [&_p]:leading-relaxed", className),
      ...props,
    },
    render,
  )
}

export { Alert, AlertDescription, AlertTitle, alertVariants }
export type { AlertProps, AlertTone }
