"use client"

import { useId, type ComponentProps, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"
import { agentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { Button } from "@/components/ui/button"
import { TaskDetailContent, TaskDetailMeta, type TaskDetailContentProps } from "@/components/ui/task-detail-content"
import { CloseIcon, insidePopup } from "@/components/ui/task-detail-parts"

type CloseReason = "close-press" | "escape-key" | "outside-press"

type TaskDetailPanelProps = Omit<ComponentProps<"section">, "children"> &
  Omit<TaskDetailContentProps, "headingLevel"> & {
    onClose?: (reason: CloseReason) => void
    /** Heading level of the task title; sections inside take the next one. */
    headingLevel?: 2 | 3 | 4 | 5
  }

function TaskDetailPanel({
  task,
  mode,
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
  const Title = `h${headingLevel}` as "h2"
  const content = {
    task,
    mode,
    now,
    locale,
    timeZone,
    formatCurrency,
    labels,
    onApproveProposal,
    onRejectProposal,
    agentApproval,
    onSelectTask,
    canSelect,
    renderThreadLink,
    onOpenThread,
  }

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
        "@container/task-detail flex flex-col gap-surface overflow-y-auto overscroll-contain rounded-surface border bg-popover/(--glass-opacity) p-inset-surface text-popover-foreground shadow-surface backdrop-surface",
        className,
      )}
      {...props}
    >
      <header className="flex items-start gap-items">
        <div className="flex min-w-0 flex-1 flex-col gap-inline">
          <TaskDetailMeta task={task} labels={labels} />
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
          <Button variant="ghost" size="icon" aria-label={labels.panel.close} onClick={() => onClose("close-press")}>
            <CloseIcon />
          </Button>
        )}
      </header>
      <TaskDetailContent {...content} headingLevel={headingLevel + 1} />
    </section>
  )
}

export { TaskDetailPanel }
export type { CloseReason, TaskDetailPanelProps }
