"use client"

import { columnOrder, type ColumnConfig, type StatusColumn } from "@/lib/agent-task-board-model"
import type { TaskStatus, TaskView } from "@/lib/agent-task-types"
import type { Tone } from "@/lib/tone"
import type { AgentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { Board, BoardColumn, BoardColumnGroup } from "@/components/ui/board"
import { TaskCard, type TaskDisplayOptions } from "@/components/ui/task-card"

type AgentTaskBoardColumnsProps = {
  columns: StatusColumn[]
  selectedTaskId: string | null
  display: TaskDisplayOptions & { labels: AgentTaskBoardLabels }
  onCollapsedChange: (status: TaskStatus, collapsed: boolean) => void
  /** Each column's accent tone; none leaves the columns plain. */
  tones?: Record<TaskStatus, Tone>
}

// Writes the full order, so changing one column never moves it ahead of the columns that had no config yet.
function withColumn(columns: readonly ColumnConfig[], status: TaskStatus, change: Partial<ColumnConfig>) {
  const config = new Map(columns.map((column) => [column.status, column]))
  return columnOrder(columns).map((each) => {
    const column = config.get(each) ?? { status: each }
    return each === status ? { ...column, ...change } : column
  })
}

function AgentTaskBoardColumns({
  columns,
  selectedTaskId,
  display,
  onCollapsedChange,
  tones,
}: AgentTaskBoardColumnsProps) {
  const { labels } = display
  const card = (task: TaskView) => (
    <TaskCard key={task.id} task={task} selected={task.id === selectedTaskId} {...display} />
  )

  return (
    <Board aria-label={labels.views.board}>
      {columns.map((column) => {
        const { ready = [], waiting = [] } = column.groups ?? {}
        const content = column.groups
          ? [
              ready.length > 0 && (
                <BoardColumnGroup key="ready" title={labels.ready} count={ready.length}>
                  {ready.map(card)}
                </BoardColumnGroup>
              ),
              waiting.length > 0 && (
                <BoardColumnGroup key="waiting" title={labels.waiting} count={waiting.length}>
                  {waiting.map(card)}
                </BoardColumnGroup>
              ),
            ].filter(Boolean)
          : column.tasks.map(card)
        return (
          <BoardColumn
            key={column.status}
            data-status={column.status}
            title={labels.columns[column.status]}
            tone={tones?.[column.status]}
            count={column.tasks.length}
            collapsed={column.collapsed}
            onCollapsedChange={(collapsed) => onCollapsedChange(column.status, collapsed)}
            empty={<p className="text-sm text-muted-foreground">{labels.empty.column}</p>}
            labels={labels.components.boardColumn}
          >
            {content}
          </BoardColumn>
        )
      })}
    </Board>
  )
}

export { AgentTaskBoardColumns, withColumn }
export type { AgentTaskBoardColumnsProps }
