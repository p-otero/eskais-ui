import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { AgentTaskBoard, moveTask, type TaskMove } from "@/components/ui/agent-task-board"
import type { AgentApproval } from "@/components/ui/agent-task-board-primitive"
import type { TaskView } from "@/lib/agent-task-types"

import { GENERATED_AT, sampleTasks } from "./fixtures/agent-tasks"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const onPage = () => agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
const cardIds = (column: string) =>
  [
    ...(document
      .querySelector(`[data-slot="board-column"][data-status="${column}"]`)
      ?.querySelectorAll("[data-task-id][data-slot='task-card']") ?? []),
  ].map((card) => card.getAttribute("data-task-id"))

function Movable({ onMove, agentApproval }: { onMove?: (move: TaskMove) => void; agentApproval?: AgentApproval }) {
  const [tasks, setTasks] = useState<TaskView[]>(sampleTasks)
  return (
    <AgentTaskBoard
      tasks={tasks}
      mode="snapshot"
      generatedAt={GENERATED_AT}
      agentApproval={agentApproval}
      onMoveTask={(move) => {
        onMove?.(move)
        setTasks((current) => moveTask(current, move.id, move.to, move.before))
      }}
    />
  )
}

test("moveTask changes the status and puts the task before another, or after its column's last", () => {
  const moved = moveTask(sampleTasks, "T-012", "working", "T-014")
  expect(moved.find((task) => task.id === "T-012")?.status).toBe("working")
  const working = moved.filter((task) => task.status === "working").map((task) => task.id)
  expect(working).toEqual(["T-012", "T-014"])
  const atEnd = moveTask(sampleTasks, "T-012", "working", null).filter((task) => task.status === "working")
  expect(atEnd.map((task) => task.id)).toEqual(["T-014", "T-012"])
  expect(moveTask(sampleTasks, "nope", "done", null)).toEqual(sampleTasks)
})

test("without onMoveTask, cards have no handles", () => {
  render(<AgentTaskBoard tasks={sampleTasks} mode="snapshot" generatedAt={GENERATED_AT} />)
  expect(screen.queryAllByRole("button", { name: /^Move / })).toHaveLength(0)
})

test("a card's handle moves it to the next column that takes it, which reports a status change", async () => {
  const user = userEvent.setup()
  const onMove = vi.fn()
  render(<Movable onMove={onMove} />)
  const handle = screen.getByRole("button", { name: "Move Write the migration for the attempts table" })
  expect(handle.getAttribute("aria-roledescription")).toBe("draggable task")
  expect(screen.getByRole("button", { name: "Open T-012 Write the migration for the attempts table" })).toBeTruthy()

  act(() => handle.focus())
  // To do's "Waiting" group doesn't take a ready task, so Right goes on to Working.
  await user.keyboard(" {ArrowRight} ")
  expect(onMove).toHaveBeenCalledWith({ id: "T-012", from: "todo", to: "working", index: 0, before: "T-014" })
  expect(cardIds("working")).toEqual(["T-012", "T-014"])
  expect(within(screen.getByRole("heading", { name: "Working" }).closest("li")!).getByText("2")).toBeTruthy()
})

test("a card's handle follows the board's tab stops: only the active card's handle is in the tab order", async () => {
  const user = userEvent.setup()
  const onMove = vi.fn()
  render(<Movable onMove={onMove} />)
  const primary = screen.getByRole("button", { name: "Open T-012 Write the migration for the attempts table" })
  act(() => primary.focus())
  await user.keyboard("{ArrowRight}")
  const working = screen.getByRole("button", { name: "Open T-014 Index the docs for search" })
  expect(document.activeElement).toBe(working)
  const handle = screen.getByRole("button", { name: "Move Index the docs for search" })
  const other = screen.getByRole("button", { name: "Move Write the migration for the attempts table" })
  expect(handle.tabIndex).toBe(0)
  expect(other.tabIndex).toBe(-1)
  // Back past the card's pull request link, the one control between the handle and the title.
  await user.tab({ shift: true })
  await user.tab({ shift: true })
  expect(document.activeElement).toBe(handle)
  await user.keyboard(" {ArrowRight} ")
  expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: "T-014", from: "working", to: "review" }))
})

test("a proposal stays put by default, and nothing moves into Proposed", async () => {
  const user = userEvent.setup()
  const onMove = vi.fn()
  render(<Movable onMove={onMove} />)
  act(() => screen.getByRole("button", { name: "Move Propose a cache layer for the price lookups" }).focus())
  await user.keyboard(" {ArrowRight} ")
  expect(onMove).not.toHaveBeenCalled()
  expect(cardIds("proposed")).toEqual(["T-011"])

  act(() => screen.getByRole("button", { name: "Move Index the docs for search" }).focus())
  await user.keyboard(" {ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft} ")
  expect(onMove.mock.calls.at(-1)?.[0]).toMatchObject({ id: "T-014", to: "todo" })
})

test("an agent's moveTask needs a person by default, and the board's own drag moves stay hidden from it", async () => {
  approve = false
  const onMove = vi.fn()
  render(<Movable onMove={onMove} />)
  await tick()
  expect(onPage().find((entry) => entry.component === "board-transfer")).toBeUndefined()
  const moves = onPage().find((entry) => entry.component === "agent-task-moves")
  expect(moves?.label).toBe("Task moves")
  expect(moves?.confirm).toBe("Moves a task to another column, which changes its status")
  expect(moves?.actions).toEqual(["moveTask"])

  const refused = await agent.act({ steps: [{ ref: "Task moves", action: "moveTask", args: ["T-015", "done"] }] })
  expect(refused.ok).toBe(false)
  expect(onMove).not.toHaveBeenCalled()

  approve = true
  const done = await agent.act({ steps: [{ ref: "Task moves", action: "moveTask", args: ["T-015", "done", 0] }] })
  approve = false
  expect(done.ok, done.error?.message).toBe(true)
  expect(onMove).toHaveBeenCalledWith({ id: "T-015", from: "review", to: "done", index: 0, before: "T-009" })
  expect(cardIds("done")).toEqual(["T-015", "T-009"])
})

test("an agent is told why a move can't happen", async () => {
  render(<Movable agentApproval="allow" />)
  await tick()
  const moves = onPage().find((entry) => entry.component === "agent-task-moves")
  expect(moves?.confirm).toBeUndefined()
  const proposal = await agent.act({ steps: [{ ref: "Task moves", action: "moveTask", args: ["T-011", "todo"] }] })
  expect(proposal.error?.message).toMatch(/can't move to "todo"/)
  const hidden = await agent.act({ steps: [{ ref: "Task moves", action: "moveTask", args: ["T-012", "cancelled"] }] })
  expect(hidden.error?.message).toMatch(/"cancelled" isn't shown/)
  const range = await agent.act({ steps: [{ ref: "Task moves", action: "moveTask", args: ["T-012", "done", 5] }] })
  expect(range.error?.message).toMatch(/index from 0 to 1/)
})

test("agentApproval deny keeps moveTask from agents", async () => {
  render(<Movable agentApproval="deny" />)
  await tick()
  expect(onPage().find((entry) => entry.component === "agent-task-moves")).toBeUndefined()
})
