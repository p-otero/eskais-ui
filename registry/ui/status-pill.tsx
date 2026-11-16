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
        neutral: "border-neutral-border bg-neutral-soft text-neutral-soft-foreground",
        info: "border-info-border bg-info-soft text-info-soft-foreground",
        success: "border-success-border bg-success-soft text-success-soft-foreground",
        warning: "border-warning-border bg-warning-soft text-warning-soft-foreground",
        destructive: "border-destructive-border bg-destructive-soft text-destructive-soft-foreground",
        violet: "border-violet-border bg-violet-soft text-violet-soft-foreground",
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
  violet: "text-violet",
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
