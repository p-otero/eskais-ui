import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { cva } from "class-variance-authority"
import type { ReactNode } from "react"

import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

type StatusTone = Tone | "muted"

const statusPillVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center gap-inline rounded-control border px-inset-chip py-inset-chip text-xs font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-border bg-secondary text-secondary-foreground",
        info: "border-info/30 bg-info/10 text-info",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        muted: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
)

// A dot on its own needs 3:1 against the page, so the quiet tones take a stronger grey than the pill's text.
const dotToneClassNames = {
  neutral: "text-muted-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-input-strong",
} satisfies Record<StatusTone, string>

function Dot({ pulse }: { pulse?: boolean }) {
  return (
    <span aria-hidden="true" data-slot="status-pill-dot" className="relative inline-flex size-1.5 shrink-0">
      {pulse && (
        <span className="absolute inset-0 rounded-full bg-current opacity-60 motion-safe:animate-ping motion-reduce:hidden" />
      )}
      <span className="relative size-full rounded-full bg-current" />
    </span>
  )
}

type StatusDotProps = Omit<PartProps<"span">, "children"> & {
  /** What the dot means, read by screen readers and agents in place of the colour. */
  label: string
  tone?: StatusTone
  /** Pulses to show something live; still under reduced motion. */
  pulse?: boolean
}

function StatusDot({ className, label, tone, pulse, render, ...props }: StatusDotProps) {
  return renderElement(
    "span",
    {
      "data-slot": "status-dot",
      "data-tone": tone ?? "neutral",
      "data-pulse": pulse ? "" : undefined,
      className: cn("inline-flex shrink-0 items-center", dotToneClassNames[tone ?? "neutral"], className),
      children: (
        <>
          <Dot pulse={pulse} />
          <span className="sr-only">{label}</span>
        </>
      ),
      ...props,
    },
    render,
  )
}

type StatusPillProps = Omit<PartProps<"span">, "children"> & {
  children?: ReactNode
  tone?: StatusTone
  dot?: boolean
  pulse?: boolean
}

// The label gets its own element so contrast is measured on the text alone, not on the dot beside it.
function StatusPill({ className, tone, dot, pulse, render, children, ...props }: StatusPillProps) {
  return renderElement(
    "span",
    {
      "data-slot": "status-pill",
      "data-tone": tone ?? "neutral",
      "data-pulse": dot && pulse ? "" : undefined,
      className: cn(statusPillVariants({ tone }), className),
      children: (
        <>
          {dot && <Dot pulse={pulse} />}
          <span data-slot="status-pill-label" className="inline-flex min-w-0 items-center gap-inline">
            {children}
          </span>
        </>
      ),
      ...props,
    },
    render,
  )
}

export { StatusDot, StatusPill, statusPillVariants }
export type { StatusDotProps, StatusPillProps, StatusTone }
