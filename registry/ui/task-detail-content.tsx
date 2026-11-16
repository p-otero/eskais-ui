"use client"

import type { ReactNode } from "react"

import { attemptCount, needsDecision, taskCost } from "@/lib/agent-task-board-model"
import type { TaskLink, TaskView, ThreadRef } from "@/lib/agent-task-types"
import { cn } from "@/lib/utils"
import { AcceptanceList } from "@/components/ui/acceptance-list"
import { agentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { AttemptTimeline } from "@/components/ui/attempt-timeline"
import { DependencyChips } from "@/components/ui/dependency-chips"
import { ProposalActions } from "@/components/ui/proposal-actions"
import { RelativeTime } from "@/components/ui/relative-time"
import { TaskStatusIcon, TaskStatusPill, taskStatusTones } from "@/components/ui/task-status"
import { proposalError, type TaskDisplayOptions } from "@/components/ui/task-card"
import { Block, DetailValue } from "@/components/ui/task-detail-parts"
import { TaskLinks } from "@/components/ui/task-links"
import { UsageGrid } from "@/components/ui/usage-grid"

type TaskDetailContentProps = TaskDisplayOptions & {
  task: TaskView
  renderThreadLink?: (thread: ThreadRef) => ReactNode
  onOpenThread?: (thread: ThreadRef) => void
  /** Replaces the default link in the detail's list of links. */
  renderLink?: (link: TaskLink) => ReactNode
  /** Fills the attachments slot in the main column. */
  renderAttachments?: (task: TaskView) => ReactNode
  /** Fills the location slot in the side column. */
  renderLocation?: (task: TaskView) => ReactNode
  /**
   * `"split"` sets the side column beside the main one once the content is 56rem wide, inside an
   * `@container/task-detail`; `"stack"` (default) keeps one column, the side after the main.
   */
  layout?: "stack" | "split"
  /** Lists the status among the details; turn it off where a header already shows it. */
  showStatus?: boolean
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
    <div className="flex flex-wrap items-center gap-items text-xs">
      <span className="font-mono text-muted-foreground">{task.id}</span>
      <TaskStatusIcon status={task.status} />
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
  renderLink,
  onOpenLink,
  renderAttachments,
  renderLocation,
  agentAvatars,
  statusTones,
  layout = "stack",
  showStatus = true,
  headingLevel = 3,
}: TaskDetailContentProps) {
  const text = labels.panel
  const parts = labels.components
  const time = { now, locale, timeZone }
  const selectable = onSelectTask && task.dependsOn.some((dependency) => canSelect?.(dependency.id) ?? true)
  const counts = task.counts
  const attachments = renderAttachments?.(task)
  const location = renderLocation?.(task)
  const links = task.links ?? []
  const split = layout === "split"

  return (
    <div
      data-slot="task-detail-content"
      data-layout={layout}
      className={cn(
        "flex min-w-0 flex-col gap-group",
        split &&
          "@4xl/task-detail:grid @4xl/task-detail:grid-cols-(--task-detail-columns) @4xl/task-detail:items-start @4xl/task-detail:gap-section",
      )}
    >
      <div data-slot="task-detail-main" className="flex min-w-0 flex-col gap-group">
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
            <AcceptanceList
              criteria={task.acceptance}
              labels={parts.acceptance}
              evidence="disclosure"
              className="gap-inline"
            />
          ) : (
            <p className="text-sm text-muted-foreground">{text.noAcceptance}</p>
          )}
        </Block>

        {attachments ? (
          <Block title={text.attachments} level={headingLevel}>
            {attachments}
          </Block>
        ) : null}

        <Block title={text.activity} level={headingLevel}>
          {task.attempts.length > 0 ? (
            <AttemptTimeline
              attempts={task.attempts}
              labels={{ ...parts.attemptTimeline, threadLink: labels.openThread }}
              usageLabels={parts.usage}
              usageOpenUpTo={0}
              agentAvatars={agentAvatars}
              formatCurrency={formatCurrency}
              renderThreadLink={renderThreadLink}
              onOpenThread={onOpenThread}
              {...time}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{labels.empty.attempts}</p>
          )}
        </Block>
      </div>

      <div data-slot="task-detail-side" className="flex min-w-0 flex-col gap-group">
        <dl className="grid grid-cols-(--detail-value-columns) content-start gap-x-group gap-y-items text-sm">
          {showStatus && (
            <DetailValue term={text.status}>
              <span className="inline-flex items-center gap-inline">
                <TaskStatusIcon status={task.status} tone={statusTones?.[task.status]} />
                <span>{parts.taskStatus?.[task.status] ?? labels.columns[task.status]}</span>
              </span>
            </DetailValue>
          )}
          {task.profile && <DetailValue term={text.profile}>{task.profile}</DetailValue>}
          {task.project && <DetailValue term={text.project}>{task.project}</DetailValue>}
          <DetailValue term={text.updated}>
            <RelativeTime value={task.updatedAt} {...time} />
          </DetailValue>
          {!task.usage && (
            <DetailValue
              term={text.cost}
              quantity={taskCost(task)}
              locale={locale}
              formatCurrency={formatCurrency}
              quantityLabels={parts.usage?.quantity}
            />
          )}
          {task.labels && task.labels.length > 0 && (
            <DetailValue term={text.labels} wrap>
              <ul className="flex flex-wrap gap-inline">
                {task.labels.map((label) => (
                  <li
                    key={label}
                    className="rounded-control border bg-secondary px-inset-chip py-inset-chip text-xs text-secondary-foreground"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </DetailValue>
          )}
        </dl>

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

        <Block title={text.attemptsSummary} level={headingLevel}>
          <dl className="grid grid-cols-(--detail-value-columns) gap-x-group gap-y-inline text-sm">
            <DetailValue term={text.counts.attempts} inline>
              {counts?.attempts ?? attemptCount(task)}
            </DetailValue>
            {counts && (
              <>
                <DetailValue term={text.counts.repairs} inline>
                  {counts.repairs}
                </DetailValue>
                <DetailValue term={text.counts.reviews} inline>
                  {counts.reviews}
                </DetailValue>
                <DetailValue term={text.counts.humanInterventions} inline>
                  {counts.humanInterventions}
                </DetailValue>
              </>
            )}
            {task.acceptedFirstPass !== undefined && (
              <DetailValue term={text.acceptedFirstPass} inline>
                {task.acceptedFirstPass ? text.yes : text.no}
              </DetailValue>
            )}
          </dl>
        </Block>

        {task.usage && (
          <Block title={text.usage} level={headingLevel}>
            <UsageGrid
              usage={task.usage}
              variant="compact"
              aria-label={text.usageOf(task.id)}
              labels={parts.usage}
              locale={locale}
              formatCurrency={formatCurrency}
            />
          </Block>
        )}

        {links.length > 0 && (
          <Block title={text.links} level={headingLevel}>
            <TaskLinks
              links={links}
              aria-label={text.linksOf(task.id)}
              labels={labels.link}
              renderLink={renderLink}
              onOpenLink={onOpenLink && ((link) => onOpenLink(link, task))}
            />
          </Block>
        )}

        {location ? (
          <Block title={text.location} level={headingLevel}>
            {location}
          </Block>
        ) : null}
      </div>
    </div>
  )
}

export { TaskDetailContent, TaskDetailMeta }
export type { TaskDetailContentProps }
