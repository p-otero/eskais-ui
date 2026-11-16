"use client"

import { activeAttempt, backlogGroups } from "@/lib/agent-task-board-model"
import { effectiveAgent, type TaskView } from "@/lib/agent-task-types"
import { AgentAvatar } from "@/components/ui/agent-avatar"
import { agentBadgeLabels, agentSummary } from "@/components/ui/agent-badge"
import type { AgentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty"
import { List, ListGroup, ListItem } from "@/components/ui/list-item"
import { ProposalActions } from "@/components/ui/proposal-actions"
import { RelativeTime } from "@/components/ui/relative-time"
import { StagePill } from "@/components/ui/stage-track"
import { proposalError, type TaskDisplayOptions } from "@/components/ui/task-card"
import { stageOf } from "@/components/ui/task-location"
import { TaskStatusIcon, taskStatusLabels } from "@/components/ui/task-status"

type AgentTaskBoardBacklogProps = {
  tasks: TaskView[]
  selectedTaskId: string | null
  display: TaskDisplayOptions & { labels: AgentTaskBoardLabels }
}

const labelChipClassName =
  "inline-flex h-5 max-w-full min-w-0 items-center rounded-md border px-inset-chip text-xs whitespace-nowrap text-foreground"

function BacklogRow({
  task,
  selected,
  display,
}: {
  task: TaskView
  selected: boolean
  display: AgentTaskBoardBacklogProps["display"]
}) {
  const { labels, now, locale, timeZone, mode = "snapshot", stages, statusTones, agentAvatars } = display
  const parts = labels.components
  const attempt = activeAttempt(task)
  const agent = attempt && effectiveAgent(attempt)
  const agentName = agent && agentSummary(agent, attempt.configured, { ...agentBadgeLabels, ...parts.agentBadge })

  return (
    <ListItem
      id={task.id}
      title={task.title}
      selected={selected}
      onSelect={() => display.onSelectTask?.(task.id)}
      leading={
        <span className="flex items-center gap-inline">
          <TaskStatusIcon
            status={task.status}
            tone={statusTones?.[task.status]}
            label={parts.taskStatus?.[task.status] ?? taskStatusLabels[task.status]}
          />
          <span data-slot="backlog-task-id" className="font-mono text-caption">
            {task.id}
          </span>
        </span>
      }
      status={
        task.location && (
          <StagePill stage={stageOf(stages, task.location.stage)} href={task.location.href} className="max-w-full" />
        )
      }
      meta={
        task.labels && task.labels.length > 0
          ? task.labels.map((label) => (
              <span key={label} className={labelChipClassName}>
                <span className="truncate">{label}</span>
              </span>
            ))
          : undefined
      }
      trailing={
        agent ? (
          <AgentAvatar agent={agent} avatars={agentAvatars} label={agentName} title={agentName} />
        ) : (
          <RelativeTime value={task.updatedAt} now={now} locale={locale} timeZone={timeZone} formatStyle="short" />
        )
      }
      actions={
        task.status === "proposed" && mode === "live" && (display.onApproveProposal || display.onRejectProposal) ? (
          <ProposalActions
            taskId={task.id}
            mode={mode}
            onApprove={display.onApproveProposal}
            onReject={display.onRejectProposal}
            agentApproval={display.agentApproval}
            labels={labels.proposals}
            renderError={(error) => proposalError(error, labels)}
          />
        ) : undefined
      }
    />
  )
}

/** Proposals and to-do tasks that aren't ready, as rows grouped by why they wait. */
function AgentTaskBoardBacklog({ tasks, selectedTaskId, display }: AgentTaskBoardBacklogProps) {
  const { labels } = display
  const { proposed, notReady } = backlogGroups(tasks)
  if (proposed.length === 0 && notReady.length === 0) {
    return (
      <Empty data-slot="agent-task-board-backlog-empty">
        <EmptyHeader>
          <EmptyDescription>{labels.empty.backlog}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  const groups = [
    { key: "proposed", label: labels.backlog.proposed, tasks: proposed },
    { key: "not-ready", label: labels.backlog.notReady, tasks: notReady },
  ].filter((group) => group.tasks.length > 0)

  return (
    <List
      aria-label={labels.backlog.name}
      className="rounded-surface border bg-card/(--glass-opacity) p-inline backdrop-surface"
    >
      {groups.map((group) => (
        <ListGroup key={group.key} label={group.label} count={group.tasks.length}>
          {group.tasks.map((task) => (
            <BacklogRow key={task.id} task={task} selected={task.id === selectedTaskId} display={display} />
          ))}
        </ListGroup>
      ))}
    </List>
  )
}

export { AgentTaskBoardBacklog }
export type { AgentTaskBoardBacklogProps }
