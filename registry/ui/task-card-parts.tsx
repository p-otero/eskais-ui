import type { AttemptView, TaskView } from "@/lib/agent-task-types"
import type { Instant } from "@/lib/time"
import { RelativeTime } from "@/components/ui/relative-time"

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const

function AnalysisModeIcon({ mode, label }: { mode: NonNullable<TaskView["analysisMode"]>; label: string }) {
  return (
    <span data-slot="task-card-analysis" data-mode={mode} title={label} className="relative z-10 text-muted-foreground">
      <svg {...iconProps} className="size-4">
        {mode === "review" ? (
          <>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </>
        ) : (
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
        )}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

type TaskBlockerProps = {
  blocker: NonNullable<AttemptView["blocker"]>
  retryLabel: string
  now?: Instant
  locale?: string
  timeZone?: string
}

function TaskBlocker({ blocker, retryLabel, ...time }: TaskBlockerProps) {
  return (
    <p
      data-slot="task-card-blocker"
      className="relative z-10 flex max-w-full min-w-0 items-start gap-inline rounded-md border border-destructive/40 px-inset-chip py-inset-chip text-xs text-destructive"
    >
      <svg {...iconProps} className="h-lh w-3 shrink-0">
        <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      <span className="min-w-0">
        {blocker.summary}
        {blocker.retryAt && (
          <span className="text-muted-foreground">
            {" · "}
            {retryLabel} <RelativeTime value={blocker.retryAt} {...time} />
          </span>
        )}
      </span>
    </p>
  )
}

export { AnalysisModeIcon, TaskBlocker }
