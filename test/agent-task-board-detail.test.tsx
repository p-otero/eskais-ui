import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { AgentTaskBoard, type AgentTaskBoardProps } from "@/components/ui/agent-task-board"

import { GENERATED_AT, sampleTasks } from "./fixtures/agent-tasks"

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const user = () => userEvent.setup({ pointerEventsCheck: 0 })
const openButton = (id: string) => screen.getByRole("button", { name: new RegExp(`^Open ${id} `) })
const scope = () => document.querySelector('[data-slot="agent-task-board-density"]')
const detail = () => document.querySelector<HTMLElement>("[data-task-detail]")

function renderBoard(props: Partial<AgentTaskBoardProps> = {}) {
  const all = { tasks: sampleTasks, mode: "snapshot", generatedAt: GENERATED_AT, timeZone: "UTC", ...props }
  return render(<AgentTaskBoard {...(all as AgentTaskBoardProps)} />)
}

describe("detail dialog (default)", () => {
  test("pressing a card opens a modal dialog named by the task id and title", async () => {
    const onSelectTask = vi.fn()
    renderBoard({ onSelectTask })
    await tick()
    await user().click(openButton("T-014"))
    const dialog = screen.getByRole("dialog", { name: "T-014 Index the docs for search" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(dialog.getAttribute("data-task-detail")).toBe("dialog")
    expect(dialog.contains(document.activeElement)).toBe(true)
    expect(within(dialog).getByRole("list", { name: "Attempts" })).toBeTruthy()
    expect(within(dialog).getByRole("table", { name: "Usage of T-014" })).toBeTruthy()
    expect(document.querySelector('[data-slot="task-detail-panel"]')).toBeNull()

    await user().click(within(dialog).getByRole("button", { name: "Close task details" }))
    await tick()
    expect(onSelectTask).toHaveBeenLastCalledWith(null)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(openButton("T-014"))
  })

  test("Escape closes it and returns focus to the card; a dependency switches the task", async () => {
    renderBoard()
    await tick()
    await user().click(openButton("T-013"))
    await user().click(within(detail()!).getByRole("button", { name: /T-012 Write the migration/ }))
    expect(screen.getByRole("dialog", { name: /^T-012 / })).toBeTruthy()
    await user().keyboard("{Escape}")
    await tick()
    expect(detail()).toBeNull()
    expect(document.activeElement).toBe(openButton("T-012"))
  })

  test("selectedTaskId drives it; a controlled board that keeps the selection keeps it open", async () => {
    const onSelectTask = vi.fn()
    const { rerender } = renderBoard({ selectedTaskId: "T-009", onSelectTask })
    await tick()
    expect(detail()?.getAttribute("data-task-id")).toBe("T-009")
    await user().keyboard("{Escape}")
    expect(onSelectTask).toHaveBeenLastCalledWith(null)
    expect(detail()?.getAttribute("data-task-id")).toBe("T-009")
    rerender(<AgentTaskBoard tasks={sampleTasks} mode="snapshot" generatedAt={GENERATED_AT} selectedTaskId={null} />)
    await tick()
    expect(detail()).toBeNull()
  })
})

describe("other presentations and density", () => {
  test("drawer presents the detail from the right without resizing the board", async () => {
    renderBoard({ detailPresentation: "drawer", defaultSelectedTaskId: "T-014" })
    await tick()
    const drawer = screen.getByRole("dialog", { name: "T-014 Index the docs for search" })
    expect(drawer.getAttribute("data-task-detail")).toBe("drawer")
    expect(drawer.getAttribute("data-side")).toBe("right")
    await user().click(within(drawer).getByRole("button", { name: "Close task details" }))
    await tick()
    expect(detail()).toBeNull()
  })

  test("side keeps the non-modal panel beside the board", async () => {
    renderBoard({ detailPresentation: "side", defaultSelectedTaskId: "T-014" })
    await tick()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.querySelector('[data-slot="task-detail-panel"]')?.getAttribute("data-task-id")).toBe("T-014")
  })

  test("density scopes the board's tokens; auto by default", async () => {
    const { unmount } = renderBoard()
    expect(scope()?.getAttribute("data-density")).toBe("auto")
    unmount()
    renderBoard({ density: "compact" })
    expect(scope()?.getAttribute("data-density")).toBe("compact")
  })
})
