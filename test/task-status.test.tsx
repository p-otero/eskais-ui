import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"

import type { AttemptStatus, ContextMode, TaskStatus } from "@/lib/agent-task-types"
import {
  AttemptStatusPill,
  ContextModePill,
  TaskStatusPill,
  attemptStatusLabels,
  attemptStatusLabelsEs,
  attemptStatusTones,
  contextModeLabels,
  contextModeLabelsEs,
  contextModeTones,
  taskStatusLabels,
  taskStatusLabelsEs,
  taskStatusTones,
} from "@/components/ui/task-status"

import { sampleTasks } from "./fixtures/agent-tasks"

const taskStatuses: TaskStatus[] = ["proposed", "todo", "working", "review", "blocked", "done", "cancelled"]
const attemptStatuses: AttemptStatus[] = [
  "dispatching",
  "active",
  "succeeded",
  "failed",
  "cancelled",
  "superseded",
  "unknown",
]
const modes: ContextMode[] = ["fresh", "reuse", "fork", "compact"]
const pill = () => document.querySelector<HTMLElement>("[data-slot=status-pill]")!

test.each(taskStatuses)("task status %s has a label and a tone in both presets", (status) => {
  render(<TaskStatusPill status={status} />)
  expect(pill().textContent).toBe(taskStatusLabels[status])
  expect(pill().dataset.tone).toBe(taskStatusTones[status])
  expect(pill().dataset.status).toBe(status)
  expect(taskStatusLabelsEs[status]).toBeTruthy()
})

test.each(attemptStatuses)("attempt status %s has a label and a tone in both presets", (status) => {
  render(<AttemptStatusPill status={status} />)
  expect(pill().textContent).toBe(attemptStatusLabels[status])
  expect(pill().dataset.tone).toBe(attemptStatusTones[status])
  expect(attemptStatusLabelsEs[status]).toBeTruthy()
})

test.each(modes)("context mode %s has a label and a tone in both presets", (mode) => {
  render(<ContextModePill mode={mode} />)
  expect(pill().textContent).toBe(contextModeLabels[mode])
  expect(pill().dataset.tone).toBe(contextModeTones[mode])
  expect(contextModeLabelsEs[mode]).toBeTruthy()
})

test("tones read together: problems are destructive, success is success, discarded is muted", () => {
  expect(taskStatusTones.working).toBe("info")
  expect(taskStatusTones.blocked).toBe("destructive")
  expect(attemptStatusTones.failed).toBe("destructive")
  expect(taskStatusTones.done).toBe("success")
  expect(attemptStatusTones.succeeded).toBe("success")
  expect(taskStatusTones.proposed).toBe("warning")
  expect(taskStatusTones.cancelled).toBe("muted")
  expect(attemptStatusTones.superseded).toBe("muted")
})

test("labels override one status at a time", () => {
  render(<TaskStatusPill status="todo" labels={{ todo: "Backlog" }} dot />)
  expect(pill().textContent).toBe("Backlog")
  expect(pill().querySelector("[data-slot=status-pill-dot]")).not.toBeNull()
})

test("reuse and fork show their source thread, through renderThreadLink when given", () => {
  const forked = sampleTasks.flatMap((task) => task.attempts).find((attempt) => attempt.id === "T-014-A2")!
  const { rerender } = render(<ContextModePill mode="fork" sourceThread={forked.sourceThread} />)
  const source = document.querySelector<HTMLElement>("[data-slot=context-mode-source]")!
  expect(source.textContent).toBe("fromIndex docs, first try")
  expect(screen.getByTitle("Index docs, first try").className).toContain("truncate")

  rerender(
    <ContextModePill
      mode="reuse"
      sourceThread={{ id: "th-7", href: "t3-thread://th-7" }}
      labels={contextModeLabelsEs}
      renderThreadLink={(thread) => <a href={thread.href}>{thread.title ?? thread.id}</a>}
    />,
  )
  expect(screen.getByText("Contexto reutilizado")).toBeDefined()
  expect(screen.getByRole("link", { name: "th-7" }).getAttribute("href")).toBe("t3-thread://th-7")

  rerender(<ContextModePill mode="fresh" sourceThread={forked.sourceThread} />)
  expect(document.querySelector("[data-slot=context-mode-source]")).toBeNull()
})
