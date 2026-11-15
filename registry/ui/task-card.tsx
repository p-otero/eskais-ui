"use client"

import { Button } from "@ui-sdk/react/button"
import { memo, type ComponentProps } from "react"

import { activeAttempt, attemptCount, needsDecision, taskCost } from "@/lib/agent-task-board-model"
import { effectiveAgent, type TaskView } from "@/lib/agent-task-types"
import type { Instant } from "@/lib/time"
import { cn } from "@/lib/utils"
import { AcceptanceBar, countAcceptance } from "@/components/ui/acceptance-list"
import { AgentBadge } from "@/components/ui/agent-badge"
import type { AgentApproval, BoardMode } from "@/components/ui/agent-task-board-primitive"
import { agentTaskBoardLabels, type AgentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { DependencyChips } from "@/components/ui/dependency-chips"
import { LivenessIndicator } from "@/components/ui/liveness-indicator"
import { ProposalActions } from "@/components/ui/proposal-actions"
import { QuantityValue } from "@/components/ui/quantity-value"
import { StatusPill } from "@/components/ui/status-pill"
import { AnalysisModeIcon, TaskBlocker } from "@/components/ui/task-card-parts"
import { taskStatusTones } from "@/components/ui/task-status"
import { usageFormatter } from "@/components/ui/usage"

interface TaskDisplayOptions {
  mode?: BoardMode
  /** One `useNow()` per board, passed down. */
  now?: Instant
  locale?: string
  timeZone?: string
  formatCurrency?: (usd: number) => string
  labels?: AgentTaskBoardLabels
  onApproveProposal?: (id: string) => void | Promise<void>
  onRejectProposal?: (id: string) => void | Promise<void>
  agentApproval?: AgentApproval
  /** Makes each dependency chip a button; only dependencies for which `canSelect` is true are pressable. */
  onSelectTask?: (id: string) => void
  canSelect?: (id: string) => boolean
}

type TaskCardProps = Omit<ComponentProps<"article">, "children" | "onSelect"> &
  TaskDisplayOptions & {
    task: TaskView
    selected?: boolean
  }

function proposalError(error: unknown, labels: AgentTaskBoardLabels) {
  return (error instanceof Error && error.message) || labels.errors.unknown
}

function dependencyChips(task: TaskView) {
  return task.dependsOn.map((dependency) => ({
    id: dependency.id,
    label: dependency.title ?? dependency.id,
    tone: taskStatusTones[dependency.status],
  }))
}

function TaskCardComponent({
  task,
  selected = false,
  mode = "snapshot",
  now,
  locale,
  timeZone,
  formatCurrency,
  labels = agentTaskBoardLabels,
  onApproveProposal,
  onRejectProposal,
  agentApproval,
  onSelectTask,
  canSelect,
  className,
  ...props
}: TaskCardProps) {
  const text = labels.card
  const parts = labels.components
  const attempt = activeAttempt(task)
  const blocker = attempt?.blocker
  const counts = countAcceptance(task.acceptance)
  const attempts = attemptCount(task)
  const time = { now, locale, timeZone }
  const pressable = onSelectTask && task.dependsOn.some((dependency) => canSelect?.(dependency.id) ?? true)

  return (
    <article
      data-slot="task-card"
      data-task-id={task.id}
      data-status={task.status}
      data-selected={selected ? "" : undefined}
      className={cn(
        "relative flex flex-col gap-2 rounded-surface border bg-card/(--glass-opacity) px-surface py-control-x text-sm text-card-foreground backdrop-surface hover:border-ring data-selected:border-primary data-selected:ring-1 data-selected:ring-primary",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span data-slot="task-card-id" className="font-mono text-muted-foreground">
          {task.id}
        </span>
        {task.analysisMode && (
          <AnalysisModeIcon mode={task.analysisMode} label={text.analysisMode[task.analysisMode]} />
        )}
        {task.profile && <span className="ms-auto min-w-0 truncate text-muted-foreground">{task.profile}</span>}
      </div>
      <Button
        data-task-select=""
        data-task-id={task.id}
        aria-label={text.open(task.id, task.title)}
        aria-current={selected ? "true" : undefined}
        title={task.title}
        onClick={() => onSelectTask?.(task.id)}
        className="cursor-pointer text-start font-medium outline-none after:absolute after:inset-0 after:rounded-surface focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background"
      >
        <span className="line-clamp-2">{task.title}</span>
      </Button>
      {needsDecision(task) && (
        <StatusPill tone="warning" title={task.decisionNeeded} data-slot="task-card-decision">
          {text.decisionNeeded}
        </StatusPill>
      )}
      {attempt && (
        <AgentBadge
          agent={effectiveAgent(attempt)}
          requested={attempt.configured}
          labels={parts.agentBadge}
          className="relative z-10 w-fit"
        />
      )}
      {attempt?.liveness && attempt.liveness !== "finished" && (
        <LivenessIndicator
          liveness={attempt.liveness}
          lastActivityAt={attempt.lastActivityAt}
          labels={parts.liveness}
          {...time}
        />
      )}
      {task.acceptance.length > 0 && (
        <AcceptanceBar
          counts={counts}
          labels={{ bar: text.acceptance(task.id) }}
          formatSummary={parts.acceptanceSummary}
        />
      )}
      {(attempts > 0 || task.usage) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{text.attempts(attempts)}</span>
          <span className="relative z-10 ms-auto">
            <span className="sr-only">{text.cost} </span>
            <QuantityValue
              value={taskCost(task)}
              format={usageFormatter("cost", { locale, formatCurrency })}
              labels={parts.usage?.quantity}
              className="text-foreground"
            />
          </span>
        </div>
      )}
      <DependencyChips
        aria-label={text.dependencies(task.id)}
        items={dependencyChips(task)}
        max={3}
        onSelect={pressable ? (id) => (canSelect?.(id) ?? true) && onSelectTask(id) : undefined}
        className="relative z-10"
      />
      {blocker && <TaskBlocker blocker={blocker} retryLabel={text.retry} {...time} />}
      {task.status === "proposed" && (
        <ProposalActions
          taskId={task.id}
          mode={mode}
          onApprove={onApproveProposal}
          onReject={onRejectProposal}
          agentApproval={agentApproval}
          labels={labels.proposals}
          renderError={(error) => proposalError(error, labels)}
          className="relative z-10"
        />
      )}
    </article>
  )
}

const TaskCard = memo(TaskCardComponent)

export { TaskCard, proposalError }
export type { TaskCardProps, TaskDisplayOptions }
