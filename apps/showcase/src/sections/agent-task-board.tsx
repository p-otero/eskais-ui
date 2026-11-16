import { useRef, useState } from "react"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import type { DetailPresentation } from "@/components/ui/agent-task-board-props"
import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import type { TaskLink, TaskStatus, TaskView } from "@/lib/agent-task-types"

import { GENERATED_AT, generateTasks, sampleTasks } from "../../../../test/fixtures/agent-tasks"
import { Section } from "../section"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function AgentTaskBoardSection() {
  const [mode, setMode] = useState<"snapshot" | "live">("live")
  const [detail, setDetail] = useState<DetailPresentation>("dialog")
  const [tasks, setTasks] = useState<TaskView[]>(sampleTasks)
  const [data, setData] = useState<"sample" | "large">("sample")
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
    detailPresentation: detail,
    onOpenThread: (thread: { id: string }) => setLog(`Open thread ${thread.id}.`),
    onOpenLink: (link: TaskLink) => setLog(`Open ${link.label}.`),
    renderLocation: (task: TaskView) =>
      task.project ? <code className="font-mono text-xs">{task.project}</code> : null,
    onApproveProposal: approve,
    onRejectProposal: reject,
  }

  return (
    <Section
      title="AgentTaskBoard"
      description="The full board for agent tasks: filters, board or table, summary, collapsible columns, and the detail as a dialog, drawer or side panel. Live mode decides proposals; snapshot mode is read-only."
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
          <Field>
            <FieldLabel>Task detail</FieldLabel>
            <SegmentedControl value={detail} onValueChange={(next) => next && setDetail(next)}>
              <SegmentedControlIndicator />
              <SegmentedControlItem value="dialog">Dialog</SegmentedControlItem>
              <SegmentedControlItem value="drawer">Drawer</SegmentedControlItem>
              <SegmentedControlItem value="side">Side</SegmentedControlItem>
            </SegmentedControl>
          </Field>
          <Field>
            <FieldLabel>Data</FieldLabel>
            <SegmentedControl
              value={data}
              onValueChange={(next) => {
                if (!next) return
                setData(next)
                setTasks(next === "large" ? generateTasks(200, 30) : sampleTasks)
              }}
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="sample">Sample</SegmentedControlItem>
              <SegmentedControlItem value="large">200 tasks</SegmentedControlItem>
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
