import { useCallback, useRef, useState } from "react"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import type { DetailPresentation } from "@/components/ui/agent-task-board-props"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import type { TaskFilters } from "@/lib/agent-task-board-model"
import type { TaskLink, TaskStatus, TaskView } from "@/lib/agent-task-types"

import { GENERATED_AT, generateTasks, sampleStages, sampleTasks } from "../../../../test/fixtures/agent-tasks"
import { Section } from "../section"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const PROJECTS = ["docs", "app"] as const
const withProjects = (list: TaskView[]) =>
  list.map((task, index) => ({ ...task, project: task.project ?? PROJECTS[index % PROJECTS.length] }))
const BOARD_FILTERS = ["query", "project", "profile", "model", "stage"] as const
const HOST_FILTERS = ["query", "profile", "model", "stage"] as const

function AgentTaskBoardSection() {
  const [mode, setMode] = useState<"snapshot" | "live">("live")
  const [detail, setDetail] = useState<DetailPresentation>("dialog")
  const [tasks, setTasks] = useState<TaskView[]>(() => withProjects(sampleTasks))
  const [projectPicker, setProjectPicker] = useState<"board" | "host">("board")
  const [filters, setFilters] = useState<TaskFilters>({})
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

  const copyCommand = useCallback(
    (task: TaskView) => (
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Copy command for ${task.id}`}
        title={`Copy command for ${task.id}`}
        onClick={() => {
          void navigator.clipboard?.writeText(`agent run ${task.id}`).catch(() => undefined)
          setLog(`Copied the command for ${task.id}.`)
        }}
      >
        Copy command
      </Button>
    ),
    [],
  )

  const shared = {
    tasks,
    timeZone: "UTC",
    detailPresentation: detail,
    onOpenThread: (thread: { id: string }) => setLog(`Open thread ${thread.id}.`),
    onOpenLink: (link: TaskLink) => setLog(`Open ${link.label}.`),
    stages: sampleStages,
    onApproveProposal: approve,
    onRejectProposal: reject,
    renderBacklogActions: copyCommand,
    filters,
    onFiltersChange: setFilters,
    filterControls: projectPicker === "host" ? HOST_FILTERS : BOARD_FILTERS,
  }

  return (
    <Section
      title="AgentTaskBoard"
      description="The full board for agent tasks: filters and stages, board, table or backlog (each row with a host action), summary, collapsible columns, attachments, and the detail as a dialog, drawer or side panel. Live mode decides proposals; snapshot mode is read-only."
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
                setTasks(withProjects(next === "large" ? generateTasks(200, 30) : sampleTasks))
              }}
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="sample">Sample</SegmentedControlItem>
              <SegmentedControlItem value="large">200 tasks</SegmentedControlItem>
            </SegmentedControl>
          </Field>
          <Field>
            <FieldLabel>Project picker</FieldLabel>
            <SegmentedControl value={projectPicker} onValueChange={(next) => next && setProjectPicker(next)}>
              <SegmentedControlIndicator />
              <SegmentedControlItem value="board">In the board</SegmentedControlItem>
              <SegmentedControlItem value="host">In the host</SegmentedControlItem>
            </SegmentedControl>
          </Field>
          {projectPicker === "host" && (
            <Field>
              <FieldLabel>Host project</FieldLabel>
              <SegmentedControl
                value={filters.project ?? "all"}
                onValueChange={(next) =>
                  next && setFilters((current) => ({ ...current, project: next === "all" ? undefined : next }))
                }
              >
                <SegmentedControlIndicator />
                <SegmentedControlItem value="all">All</SegmentedControlItem>
                {PROJECTS.map((project) => (
                  <SegmentedControlItem key={project} value={project}>
                    {project}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </Field>
          )}
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
