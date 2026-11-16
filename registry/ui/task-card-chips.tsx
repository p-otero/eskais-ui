"use client"

import type { ComponentProps } from "react"

import { activeAttempt, needsDecision, taskCost } from "@/lib/agent-task-board-model"
import type { TaskView } from "@/lib/agent-task-types"
import { cn } from "@/lib/utils"
import { AcceptanceBar, countAcceptance } from "@/components/ui/acceptance-list"
import { colorIndex } from "@/components/ui/agent-avatar"
import type { AgentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { DependencyChips } from "@/components/ui/dependency-chips"
import { livenessLabels, livenessTones } from "@/components/ui/liveness-indicator"
import { QuantityValue } from "@/components/ui/quantity-value"
import type { StatusTone } from "@/components/ui/status-pill"
import { AnalysisModeIcon, TaskBlocker } from "@/components/ui/task-card-parts"
import type { TaskDisplayOptions } from "@/components/ui/task-card"
import { taskStatusTones } from "@/components/ui/task-status"
import { usageFormatter } from "@/components/ui/usage"

const chipClassName =
  "relative z-10 inline-flex h-5 max-w-full min-w-0 items-center gap-1 rounded-md border px-1.5 text-xs whitespace-nowrap text-muted-foreground [&_svg]:size-3 [&_svg]:shrink-0"

const toneText: Record<StatusTone, string> = {
  neutral: "text-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
}

const labelDots = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"] as const

function Chip({ className, children, ...props }: ComponentProps<"span">) {
  return (
    <span data-slot="task-card-chip" className={cn(chipClassName, className)} {...props}>
      {children}
    </span>
  )
}

type TaskCardChipsProps = Pick<
  TaskDisplayOptions,
  "now" | "locale" | "timeZone" | "formatCurrency" | "onSelectTask" | "canSelect"
> & {
  task: TaskView
  labels: AgentTaskBoardLabels
}

function TaskCardChips({
  task,
  labels,
  now,
  locale,
  timeZone,
  formatCurrency,
  onSelectTask,
  canSelect,
}: TaskCardChipsProps) {
  const text = labels.card
  const parts = labels.components
  const attempt = activeAttempt(task)
  const liveness = attempt?.liveness !== "finished" ? attempt?.liveness : undefined
  // Running and idle are routine: a dot is enough. Waiting and stuck need a person, so they say so.
  const livenessShown = liveness === "waiting_input" || liveness === "suspect_dead"
  const livenessName = liveness && (parts.liveness?.[liveness] ?? livenessLabels[liveness])
  const counts = countAcceptance(task.acceptance)
  const pressable = onSelectTask && task.dependsOn.some((dependency) => canSelect?.(dependency.id) ?? true)

  return (
    <div data-slot="task-card-chips" className="flex min-w-0 flex-wrap items-center gap-1">
      {(liveness || task.analysisMode) && (
        <Chip data-slot="task-card-signals">
          {liveness && (
            <span
              data-slot="task-card-liveness"
              title={livenessName}
              className={cn("inline-flex min-w-0 items-center gap-1", toneText[livenessTones[liveness]])}
            >
              <span aria-hidden="true" className="relative inline-flex size-1.5 shrink-0">
                {liveness === "running" && (
                  <span className="absolute inset-0 rounded-full bg-current opacity-60 motion-safe:animate-ping motion-reduce:hidden" />
                )}
                <span className="relative size-full rounded-full bg-current" />
              </span>
              <span className={livenessShown ? "truncate" : "sr-only"}>{livenessName}</span>
            </span>
          )}
          {task.analysisMode && (
            <AnalysisModeIcon mode={task.analysisMode} label={text.analysisMode[task.analysisMode]} />
          )}
        </Chip>
      )}
      {task.profile && <Chip className="text-foreground">{task.profile}</Chip>}
      {task.labels?.map((label) => (
        <Chip key={label} className="text-foreground">
          <span
            aria-hidden="true"
            className={cn("size-1.5 shrink-0 rounded-full", labelDots[colorIndex(label, labelDots.length)])}
          />
          <span className="truncate">{label}</span>
        </Chip>
      ))}
      <DependencyChips
        aria-label={text.dependencies(task.id)}
        items={task.dependsOn.map((dependency) => ({
          id: dependency.id,
          label: `${dependency.id} ${dependency.title ?? ""}`.trim(),
          tone: taskStatusTones[dependency.status],
        }))}
        max={1}
        onSelect={pressable ? (id) => (canSelect?.(id) ?? true) && onSelectTask(id) : undefined}
        className="relative z-10 min-w-0 gap-1"
      />
      {needsDecision(task) && (
        <Chip title={task.decisionNeeded} className="border-warning/40 text-warning">
          {text.decisionNeeded}
        </Chip>
      )}
      {attempt?.blocker && (
        <TaskBlocker blocker={attempt.blocker} retryLabel={text.retry} now={now} locale={locale} timeZone={timeZone} />
      )}
      {(task.attempts.length > 0 || task.usage) && (
        <Chip>
          <span className="sr-only">{text.cost} </span>
          <QuantityValue
            value={taskCost(task)}
            format={usageFormatter("cost", { locale, formatCurrency })}
            labels={parts.usage?.quantity}
            className="text-foreground"
          />
        </Chip>
      )}
      {task.acceptance.length > 0 && (
        <Chip>
          <AcceptanceBar
            counts={counts}
            labels={{ bar: text.acceptance(task.id) }}
            formatSummary={parts.acceptanceSummary}
            className="w-5"
          />
          <span aria-hidden="true" className="tabular-nums">
            {counts.pass}/{task.acceptance.length}
          </span>
        </Chip>
      )}
    </div>
  )
}

export { TaskCardChips }
