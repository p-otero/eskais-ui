import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type StepState = "complete" | "current" | "upcoming"

const markerClassName: Record<StepState, string> = {
  complete: "border-primary bg-primary text-primary-foreground",
  current: "border-primary bg-background text-foreground ring-2 ring-ring",
  upcoming: "border-input-strong bg-background text-muted-foreground",
}

const titleClassName: Record<StepState, string> = {
  complete: "text-muted-foreground",
  current: "font-medium text-foreground",
  upcoming: "text-muted-foreground narrow:sr-only",
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      className="size-3.5"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

type StepFormProgressProps = {
  steps: { id: string; title: ReactNode }[]
  current: number
  /** Names the list for screen readers, in the page's language. */
  label: string
  className?: string
}

/** Where the wizard is: an ordered list, the current step marked with `aria-current="step"`. */
function StepFormProgress({ steps, current, label, className }: StepFormProgressProps) {
  return (
    <ol
      aria-label={label}
      data-slot="step-form-progress"
      className={cn("flex min-w-0 flex-wrap items-center gap-items text-body-sm", className)}
    >
      {steps.map((step, index) => {
        const state: StepState = index < current ? "complete" : index === current ? "current" : "upcoming"
        return (
          <li
            key={step.id}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            className="flex min-w-0 items-center gap-inline"
          >
            {index === 0 ? null : <span aria-hidden="true" className="h-px w-4 shrink-0 bg-border" />}
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-caption",
                markerClassName[state],
              )}
            >
              {state === "complete" ? <CheckIcon /> : index + 1}
            </span>
            <span className={cn("truncate", titleClassName[state])}>{step.title}</span>
          </li>
        )
      })}
    </ol>
  )
}

export { StepFormProgress }
export type { StepFormProgressProps }
