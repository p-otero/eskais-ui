"use client"

import type { ReactNode } from "react"

import { needsDecision, taskCost } from "@/lib/agent-task-board-model"
import type { TaskView, ThreadRef } from "@/lib/agent-task-types"
import { AcceptanceList } from "@/components/ui/acceptance-list"
import { agentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { AttemptTimeline } from "@/components/ui/attempt-timeline"
import { DependencyChips } from "@/components/ui/dependency-chips"
import { ProposalActions } from "@/components/ui/proposal-actions"
import { RelativeTime } from "@/components/ui/relative-time"
import { TaskStatusPill, taskStatusTones } from "@/components/ui/task-status"
import { proposalError, type TaskDisplayOptions } from "@/components/ui/task-card"
import { Block, DetailValue } from "@/components/ui/task-detail-parts"
import { UsageTable } from "@/components/ui/usage"

type TaskDetailContentProps = TaskDisplayOptions & {
  task: TaskView
  renderThreadLink?: (thread: ThreadRef) => ReactNode
  onOpenThread?: (thread: ThreadRef) => void
  /** Heading level of each section. */
  headingLevel?: number
}

function TaskDetailMeta({
  task,
  labels = agentTaskBoardLabels,
}: {
  task: TaskView
  labels?: TaskDisplayOptions["labels"]
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="font-mono text-muted-foreground">{task.id}</span>
      <TaskStatusPill status={task.status} labels={labels?.components.taskStatus} />
    </div>
  )
}

function TaskDetailContent({
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
  renderThreadLink,
  onOpenThread,
  headingLevel = 3,
}: TaskDetailContentProps) {
  const text = labels.panel
  const parts = labels.components
  const time = { now, locale, timeZone }
  const selectable = onSelectTask && task.dependsOn.some((dependency) => canSelect?.(dependency.id) ?? true)

  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm @lg/task-detail:grid-cols-4">
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
        <Block title={text.goal} level={headingLevel}>
          <p className="text-sm whitespace-pre-line">{task.goal}</p>
        </Block>
      )}

      {needsDecision(task) && (
        <Block title={text.decision} level={headingLevel}>
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

      <Block title={text.acceptance} level={headingLevel}>
        {task.acceptance.length > 0 ? (
          <AcceptanceList criteria={task.acceptance} labels={parts.acceptance} />
        ) : (
          <p className="text-sm text-muted-foreground">{text.noAcceptance}</p>
        )}
      </Block>

      {task.dependsOn.length > 0 && (
        <Block title={text.dependencies} level={headingLevel}>
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
        <Block title={text.usage} level={headingLevel}>
          <UsageTable
            usage={task.usage}
            aria-label={text.usageOf(task.id)}
            labels={parts.usage}
            locale={locale}
            formatCurrency={formatCurrency}
          />
        </Block>
      )}

      <Block title={text.attempts} level={headingLevel}>
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
    </>
  )
}

export { TaskDetailContent, TaskDetailMeta }
export type { TaskDetailContentProps }
