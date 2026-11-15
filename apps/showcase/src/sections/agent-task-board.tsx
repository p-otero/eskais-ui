import { useRef, useState } from "react"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import type { TaskStatus, TaskView } from "@/lib/agent-task-types"

import { GENERATED_AT, sampleTasks } from "../../../../test/fixtures/agent-tasks"
import { Section } from "../section"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function AgentTaskBoardSection() {
  const [mode, setMode] = useState<"snapshot" | "live">("live")
  const [tasks, setTasks] = useState<TaskView[]>(sampleTasks)
  const [log, setLog] = useState("Approve fails the first time on purpose.")
  const approvals = useRef(0)

  const move = (id: string, status: TaskStatus) =>
    setTasks((list) =>
      list.map((task) => (task.id === id ? { ...task, status, decisionNeeded: undefined, ready: true } : task)),
    )

  async function approve(id: string) {
    await wait(1200)
    if (approvals.current++ === 0) throw new Error("Couldn't start the agents. Try again.")
    move(id, "todo")
    setLog(`Approved ${id}.`)
  }

  async function reject(id: string) {
    await wait(800)
    move(id, "cancelled")
    setLog(`Rejected ${id}.`)
  }

  const shared = {
    tasks,
    timeZone: "UTC",
    onOpenThread: (thread: { id: string }) => setLog(`Open thread ${thread.id}.`),
    onApproveProposal: approve,
    onRejectProposal: reject,
  }

  return (
    <Section
      title="AgentTaskBoard"
      description="The full board for agent tasks: filters, board or table, summary, collapsible columns and a non-modal detail panel. Live mode decides proposals; snapshot mode is read-only."
    >
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field>
            <FieldLabel>Board mode</FieldLabel>
            <SegmentedControl value={mode} onValueChange={(next) => next && setMode(next)}>
              <SegmentedControlIndicator />
              <SegmentedControlItem value="live">Live</SegmentedControlItem>
              <SegmentedControlItem value="snapshot">Snapshot</SegmentedControlItem>
            </SegmentedControl>
          </Field>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {log}
          </p>
        </div>
        {mode === "live" ? (
          <AgentTaskBoard {...shared} mode="live" />
        ) : (
          <AgentTaskBoard {...shared} mode="snapshot" generatedAt={GENERATED_AT} />
        )}
      </div>
    </Section>
  )
}

export { AgentTaskBoardSection }
