import { useState } from "react"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import { Button } from "@/components/ui/button"

import { TaskDialog } from "../../../site/src/examples/task-detail-panel"
import { TASK_DIALOG_NOW, taskChanges, taskDialogTasks } from "../../../site/src/examples/task-dialog-fixtures"
import { sampleTasks } from "../../../../test/fixtures/agent-tasks"
import { Section } from "../section"

const boardTasks = [...taskDialogTasks, ...sampleTasks]

function longChanges(task: string, lines: number) {
  const changes = taskChanges[task]
  if (!changes || !(lines > 0)) return
  const body = Array.from({ length: lines }, (_, index) => `+export const step${String(index)} = ${String(index)}`)
  const header = `diff --git a/src/long.ts b/src/long.ts\nnew file mode 100644\n--- /dev/null\n+++ b/src/long.ts\n`
  const patch = `${header}@@ -0,0 +1,${String(lines)} @@\n${body.join("\n")}\n`
  taskChanges[task] = { ...changes, all: { files: 1, additions: lines, deletions: 0, patch } }
}

const selectedRow = (task: string, row: string | null) =>
  row === null ? null : (taskChanges[task]?.commits.find((commit) => commit.id.startsWith(row))?.id ?? row)

function TaskDialogPage({ params }: { params: URLSearchParams }) {
  const [open, setOpen] = useState<string>(params.get("task") ?? "T-121")
  useState(() => longChanges(params.get("task") ?? "T-121", Number(params.get("lines"))))
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
        changesSelected={selectedRow(open, params.get("selected"))}
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
      description="TaskDetailDialog with a stats strip, AcceptancePopover and a git line in its header, a collapsible changes section before the body (CommitHistory beside GitDiff, all changes until a row is selected), and hide removing what the header shows."
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
