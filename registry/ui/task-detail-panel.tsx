"use client"

import { useId, type ComponentProps, type KeyboardEvent, type ReactNode } from "react"

import { needsDecision, taskCost } from "@/lib/agent-task-board-model"
import type { TaskView, ThreadRef } from "@/lib/agent-task-types"
import { cn } from "@/lib/utils"
import { AcceptanceList } from "@/components/ui/acceptance-list"
import { agentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { AttemptTimeline } from "@/components/ui/attempt-timeline"
import { Button } from "@/components/ui/button"
import { DependencyChips } from "@/components/ui/dependency-chips"
import { ProposalActions } from "@/components/ui/proposal-actions"
import { RelativeTime } from "@/components/ui/relative-time"
import { TaskStatusPill, taskStatusTones } from "@/components/ui/task-status"
import { proposalError, type TaskDisplayOptions } from "@/components/ui/task-card"
import { Block, DetailValue, insidePopup } from "@/components/ui/task-detail-parts"
import { UsageTable } from "@/components/ui/usage"

type CloseReason = "close-press" | "escape-key"

type TaskDetailPanelProps = Omit<ComponentProps<"section">, "children"> &
  TaskDisplayOptions & {
    task: TaskView
    onClose?: (reason: CloseReason) => void
    renderThreadLink?: (thread: ThreadRef) => ReactNode
    onOpenThread?: (thread: ThreadRef) => void
    /** Heading level of the task title; sections inside take the next one. */
    headingLevel?: 2 | 3 | 4 | 5
  }

function TaskDetailPanel({
  task,
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
  onClose,
  renderThreadLink,
  onOpenThread,
  headingLevel = 2,
  className,
  onKeyDown,
  ...props
}: TaskDetailPanelProps) {
  const titleId = useId()
  const text = labels.panel
  const parts = labels.components
  const Title = `h${headingLevel}` as "h2"
  const sub = headingLevel + 1
  const time = { now, locale, timeZone }
  const selectable = onSelectTask && task.dependsOn.some((dependency) => canSelect?.(dependency.id) ?? true)

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    onKeyDown?.(event)
    if (event.key !== "Escape" || event.defaultPrevented || !onClose) return
    if (insidePopup(event.target, event.currentTarget)) return
    event.preventDefault()
    onClose("escape-key")
  }

  return (
    // Escape anywhere inside the non-modal panel closes it, as it would a dialog; the handler only listens to bubbling keys.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      data-slot="task-detail-panel"
      data-task-id={task.id}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex flex-col gap-surface overflow-y-auto overscroll-contain rounded-surface border bg-popover/(--glass-opacity) p-surface text-popover-foreground shadow-surface backdrop-surface",
        className,
      )}
      {...props}
    >
      <header className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-muted-foreground">{task.id}</span>
            <TaskStatusPill status={task.status} labels={parts.taskStatus} />
          </div>
          <Title
            id={titleId}
            data-slot="task-detail-title"
            tabIndex={-1}
            className="rounded-control text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {task.title}
          </Title>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" aria-label={text.close} onClick={() => onClose("close-press")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </Button>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {task.project && <DetailValue term={text.project}>{task.project}</DetailValue>}
        {task.profile && <DetailValue term={text.profile}>{task.profile}</DetailValue>}
        <DetailValue term={text.updated}>
          <RelativeTime value={task.updatedAt} {...time} />
        </DetailValue>
        <DetailValue
          term={text.cost}
          quantity={taskCost(task)}
          locale={locale}
          formatCurrency={formatCurrency}
          quantityLabels={parts.usage?.quantity}
        />
      </dl>

      {task.goal && (
        <Block title={text.goal} level={sub}>
          <p className="text-sm whitespace-pre-line">{task.goal}</p>
        </Block>
      )}

      {needsDecision(task) && (
        <Block title={text.decision} level={sub}>
          {task.decisionNeeded && <p className="text-sm">{task.decisionNeeded}</p>}
          {task.status === "proposed" && (
            <ProposalActions
              taskId={task.id}
              mode={mode}
              onApprove={onApproveProposal}
              onReject={onRejectProposal}
              agentApproval={agentApproval}
              labels={labels.proposals}
              renderError={(error) => proposalError(error, labels)}
            />
          )}
        </Block>
      )}

      <Block title={text.acceptance} level={sub}>
        {task.acceptance.length > 0 ? (
          <AcceptanceList criteria={task.acceptance} labels={parts.acceptance} />
        ) : (
          <p className="text-sm text-muted-foreground">{text.noAcceptance}</p>
        )}
      </Block>

      {task.dependsOn.length > 0 && (
        <Block title={text.dependencies} level={sub}>
          <DependencyChips
            aria-label={text.dependenciesOf(task.id)}
            items={task.dependsOn.map((dependency) => ({
              id: dependency.id,
              label: `${dependency.id} ${dependency.title ?? ""}`.trim(),
              tone: taskStatusTones[dependency.status],
            }))}
            onSelect={selectable ? (id) => (canSelect?.(id) ?? true) && onSelectTask?.(id) : undefined}
          />
        </Block>
      )}

      {task.usage && (
        <Block title={text.usage} level={sub}>
          <UsageTable
            usage={task.usage}
            aria-label={text.usageOf(task.id)}
            labels={parts.usage}
            locale={locale}
            formatCurrency={formatCurrency}
          />
        </Block>
      )}

      <Block title={text.attempts} level={sub}>
        {task.attempts.length > 0 ? (
          <AttemptTimeline
            attempts={task.attempts}
            labels={parts.attemptTimeline}
            usageLabels={parts.usage}
            formatCurrency={formatCurrency}
            renderThreadLink={renderThreadLink}
            onOpenThread={onOpenThread}
            {...time}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{labels.empty.attempts}</p>
        )}
      </Block>
    </section>
  )
}

export { TaskDetailPanel }
export type { CloseReason, TaskDetailPanelProps }
