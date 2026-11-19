import { useState } from "react"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import { Button } from "@/components/ui/button"

import { TaskDialog } from "../../../site/src/examples/task-detail-panel"
import { TASK_DIALOG_NOW, taskDialogTasks } from "../../../site/src/examples/task-dialog-fixtures"
import { sampleTasks } from "../../../../test/fixtures/agent-tasks"
import { Section } from "../section"

const boardTasks = [...taskDialogTasks, ...sampleTasks]

// ?demo=task-dialog&task=T-121&changes=1&acceptance=1: the dialog open over a board, for screenshots.
function TaskDialogPage({ params }: { params: URLSearchParams }) {
  const [open, setOpen] = useState<string>(params.get("task") ?? "T-121")
  const [history, setHistory] = useState<string>()
  return (
    <main className="flex min-h-dvh flex-col gap-section bg-background p-inset-surface">
      {history ? <p className="text-sm">Branch history of {history}</p> : null}
      <AgentTaskBoard
        tasks={boardTasks}
        mode="snapshot"
        generatedAt={TASK_DIALOG_NOW}
        timeZone="UTC"
        locale="en-US"
        selectedTaskId={null}
        onSelectTask={(id) => setOpen(id ?? "")}
      />
      <TaskDialog
        task={boardTasks.find((task) => task.id === open)}
        onClose={() => setOpen("")}
        onOpenHistory={(branch) => {
          setOpen("")
          setHistory(branch)
        }}
        changesOpen={params.get("changes") === "1"}
        acceptanceOpen={params.get("acceptance") === "1"}
      />
    </main>
  )
}

function TaskDialogSection() {
  const [open, setOpen] = useState<{ id: string; changes?: boolean; acceptance?: boolean }>()
  const [history, setHistory] = useState<string>()
  return (
    <Section
      title="Task dialog with a header strip"
      description="TaskDetailDialog with a stats strip, AcceptancePopover and a git line in its header, a collapsible changes section before the body, and hide removing what the header shows."
    >
      <div className="flex flex-wrap gap-items">
        <Button variant="outline" onClick={() => setOpen({ id: "T-121" })}>
          Task with a branch
        </Button>
        <Button variant="outline" onClick={() => setOpen({ id: "T-121", changes: true })}>
          Task with changes open
        </Button>
        <Button variant="outline" onClick={() => setOpen({ id: "T-121", acceptance: true })}>
          Task with acceptance open
        </Button>
        <Button variant="outline" onClick={() => setOpen({ id: "T-126" })}>
          Task without a branch
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {history ? `Opened the branch history of ${history}` : "Branch history closes the dialog and opens a git view."}
      </p>
      <TaskDialog
        key={open ? `${open.id}-${String(open.changes)}-${String(open.acceptance)}` : "closed"}
        task={taskDialogTasks.find((task) => task.id === open?.id)}
        changesOpen={open?.changes}
        acceptanceOpen={open?.acceptance}
        onClose={() => setOpen(undefined)}
        onOpenHistory={(branch) => {
          setOpen(undefined)
          setHistory(branch)
        }}
      />
    </Section>
  )
}

export { TaskDialogPage, TaskDialogSection }
