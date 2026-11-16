import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, test, vi } from "vitest"

import { AgentTaskBoard, agentTaskBoardLabelsEs, type AgentTaskBoardProps } from "@/components/ui/agent-task-board"
import type { TaskFilters } from "@/lib/agent-task-board-model"
import type { TaskView } from "@/lib/agent-task-types"

import { axeViolations } from "./axe"
import { GENERATED_AT, generateTasks, sampleTasks } from "./fixtures/agent-tasks"

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const user = () => userEvent.setup({ pointerEventsCheck: 0 })

function renderBoard(props: Partial<AgentTaskBoardProps> = {}) {
  const all = {
    tasks: sampleTasks,
    mode: "snapshot",
    generatedAt: GENERATED_AT,
    timeZone: "UTC",
    locale: "en-US",
    ...props,
  }
  return render(<AgentTaskBoard {...(all as AgentTaskBoardProps)} />)
}

const openButton = (id: string) => screen.getByRole("button", { name: new RegExp(`^Open ${id} `) })
const panel = () => document.querySelector<HTMLElement>('[data-slot="task-detail-panel"], [data-task-detail]')
const cardOf = (id: string) => document.querySelector<HTMLElement>(`[data-slot="task-card"][data-task-id="${id}"]`)
const visibleIds = () =>
  [...document.querySelectorAll('[data-slot="task-card"]')].map((element) => element.getAttribute("data-task-id"))

function Controlled() {
  const [filters, setFilters] = useState<TaskFilters>({})
  return (
    <AgentTaskBoard
      tasks={sampleTasks}
      mode="snapshot"
      generatedAt={GENERATED_AT}
      filters={filters}
      onFiltersChange={setFilters}
    />
  )
}
describe("TaskCard", () => {
  test("renders every state in the sample", async () => {
    renderBoard({ columns: [{ status: "cancelled", hidden: false }] })
    await tick()
    for (const task of sampleTasks) {
      const element = cardOf(task.id)
      expect(element, task.id).toBeTruthy()
      expect(openButton(task.id).textContent).toBe(task.title)
    }
    expect(within(cardOf("T-011")!).getByText("Decision needed").closest("[title]")?.getAttribute("title")).toBe(
      "Approve the proposal before any agent runs?",
    )
    expect(within(cardOf("T-011")!).getByText("A person reviews it before agents run")).toBeTruthy()
    expect(within(cardOf("T-014")!).getByText("Agents run it on their own")).toBeTruthy()
    expect(within(cardOf("T-014")!).getByText("Running")).toBeTruthy()
    expect(within(cardOf("T-014")!).getByText("2 attempts")).toBeTruthy()
    expect(within(cardOf("T-014")!).getByText("$0.43 (estimated)")).toBeTruthy()
    expect(within(cardOf("T-014")!).getByRole("meter", { name: "Acceptance for T-014" })).toBeTruthy()
    expect(within(cardOf("T-015")!).getByText("Possibly stuck")).toBeTruthy()
    expect(within(cardOf("T-015")!).getByText("unknown")).toBeTruthy()
    expect(within(cardOf("T-016")!).getByText("Deploy token expired")).toBeTruthy()
    expect(within(cardOf("T-016")!).getByText("Decision needed")).toBeTruthy()
    expect(within(cardOf("T-013")!).getByRole("list", { name: "Dependencies of T-013" })).toBeTruthy()
    expect(cardOf("T-014")?.querySelector("[data-agent-avatar]")?.hasAttribute("data-differs")).toBe(true)
  })

  test("shows a blocker's retry time and keeps one dependency chip", async () => {
    const task: TaskView = {
      ...sampleTasks[3]!,
      dependsOn: ["A", "B", "C", "D"].map((id) => ({ id: `T-0${id}`, title: `Dep ${id}`, status: "done" })),
      attempts: [{ ...sampleTasks[3]!.attempts[0]!, liveness: "idle" }],
      activeAttemptId: undefined,
    }
    renderBoard({ tasks: [task] })
    await tick()
    const blocker = cardOf(task.id)!.querySelector('[data-slot="task-card-blocker"]')!
    expect(blocker.textContent).toBe("Provider quota exhausted · Retry in 3 hours")
    expect(blocker.querySelector("time")?.getAttribute("title")).toMatch(/9:30/)
    expect(within(cardOf(task.id)!).getByText("3 more")).toBeTruthy()
  })

  test("nothing in a card is focusable only for a tooltip, and chips are separate tab stops", async () => {
    renderBoard()
    await tick()
    const focusable = [...cardOf("T-013")!.querySelectorAll<HTMLElement>("button, [tabindex]")]
    expect(
      focusable.map((element) => (element.hasAttribute("data-task-select") ? "select" : element.textContent)),
    ).toEqual(["select", "T-012 Write the migration for the attempts table"])
  })
})

describe("selection and the side panel", () => {
  test("pressing a card opens the panel, focuses it, and closing returns focus", async () => {
    const onSelectTask = vi.fn()
    renderBoard({ onSelectTask, detailPresentation: "side" })
    await tick()
    await user().click(openButton("T-014"))
    expect(onSelectTask).toHaveBeenLastCalledWith("T-014")
    expect(openButton("T-014").getAttribute("aria-current")).toBe("true")
    expect(panel()?.getAttribute("data-task-id")).toBe("T-014")
    expect(document.activeElement?.getAttribute("data-slot")).toBe("task-detail-title")
    expect(within(panel()!).getByRole("list", { name: "Attempts" })).toBeTruthy()
    expect(within(panel()!).getByRole("group", { name: "Usage of T-014" })).toBeTruthy()

    await user().click(within(panel()!).getByRole("button", { name: "Close task details" }))
    expect(panel()).toBeNull()
    expect(onSelectTask).toHaveBeenLastCalledWith(null)
    expect(document.activeElement).toBe(openButton("T-014"))
  })

  test("Escape inside the panel closes it; dependencies select their task", async () => {
    renderBoard({ defaultSelectedTaskId: "T-013", detailPresentation: "side" })
    await tick()
    await user().click(within(panel()!).getByRole("button", { name: /T-012 Write the migration/ }))
    expect(panel()?.getAttribute("data-task-id")).toBe("T-012")
    within(panel()!).getByRole("button", { name: "Close task details" }).focus()
    await user().keyboard("{Escape}")
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(openButton("T-012"))
  })

  test("a controlled selection follows selectedTaskId", async () => {
    const { rerender } = renderBoard({ selectedTaskId: "T-009" })
    await tick()
    expect(panel()?.getAttribute("data-task-id")).toBe("T-009")
    rerender(<AgentTaskBoard tasks={sampleTasks} mode="snapshot" generatedAt={GENERATED_AT} selectedTaskId={null} />)
    expect(panel()).toBeNull()
  })
})

describe("filters, view and table", () => {
  test("profile and search filters narrow the board and report the change", async () => {
    const onFiltersChange = vi.fn()
    renderBoard({ onFiltersChange })
    await tick()
    await user().click(screen.getByRole("combobox", { name: "Profile" }))
    await user().click(screen.getByRole("option", { name: "bounded" }))
    expect(onFiltersChange).toHaveBeenLastCalledWith({ profile: "bounded" })
    expect(visibleIds().toSorted()).toEqual(["T-012", "T-013", "T-014"])

    await user().type(screen.getByRole("searchbox", { name: "Search tasks" }), "migration")
    expect(visibleIds()).toEqual(["T-012"])
    await user().click(screen.getByRole("button", { name: "Clear filters" }))
    expect(visibleIds()).toHaveLength(7)
  })

  test("the model filter matches the model that ran, or the configured one when none is recorded", async () => {
    render(<Controlled />)
    await tick()
    await user().click(screen.getByRole("combobox", { name: "Model" }))
    await user().click(screen.getByRole("option", { name: "openai-codex/gpt-6.1-terra-preview-2026-11" }))
    expect(visibleIds().toSorted()).toEqual(["T-014", "T-016"])
    await user().click(screen.getByRole("combobox", { name: "Model" }))
    await user().click(screen.getByRole("option", { name: "zai/glm-5.3" }))
    expect(visibleIds()).toEqual(["T-014"])
  })

  test("no match shows the filtered empty state", async () => {
    renderBoard({ defaultFilters: { query: "nothing like this" } })
    await tick()
    expect(screen.getByText("No tasks match these filters.")).toBeTruthy()
    await user().click(screen.getAllByRole("button", { name: "Clear filters" }).at(-1)!)
    expect(visibleIds()).toHaveLength(7)
  })

  test("the view switch shows a table sortable by column", async () => {
    const onViewChange = vi.fn()
    renderBoard({ onViewChange })
    await tick()
    await user().click(screen.getByRole("radio", { name: "Table" }))
    expect(onViewChange).toHaveBeenCalledWith("table")
    const table = screen.getByRole("table", { name: "Agent tasks table" })
    const order = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.getAttribute("data-task-id"))
    expect(order()[0]).toBe("T-011")
    expect(
      within(table)
        .getByRole("columnheader", { name: /Status/ })
        .getAttribute("aria-sort"),
    ).toBe("ascending")

    await user().click(within(table).getByRole("button", { name: "Sort by Title" }))
    const title = within(table).getByRole("columnheader", { name: /Title/ })
    expect(title.getAttribute("aria-sort")).toBe("ascending")
    expect(
      within(table)
        .getByRole("columnheader", { name: /Status/ })
        .hasAttribute("aria-sort"),
    ).toBe(false)
    expect(order()[0]).toBe("T-013")
    await user().click(within(table).getByRole("button", { name: "Sort by Title" }))
    expect(title.getAttribute("aria-sort")).toBe("descending")
    expect(order()[0]).toBe("T-012")

    await user().click(within(table).getByRole("button", { name: "Sort by Cost" }))
    expect(order().slice(0, 2)).toEqual(["T-014", "T-009"])
    await user().click(within(table).getByRole("button", { name: /^Open T-015 / }))
    expect(panel()?.getAttribute("data-task-id")).toBe("T-015")
  })
})

describe("modes, columns and labels", () => {
  test("snapshot mode shows no proposal actions; live mode does", async () => {
    const onApproveProposal = vi.fn()
    const { unmount } = renderBoard({ onApproveProposal })
    await tick()
    expect(screen.queryByRole("button", { name: "Approve proposal T-011" })).toBeNull()
    unmount()
    renderBoard({ mode: "live", now: GENERATED_AT, onApproveProposal, onRejectProposal: vi.fn() })
    await tick()
    expect(screen.queryByText(/^Snapshot/)).toBeNull()
    await user().click(within(cardOf("T-011")!).getByRole("button", { name: "Approve proposal T-011" }))
    expect(onApproveProposal).toHaveBeenCalledWith("T-011")
    expect(within(cardOf("T-011")!).getByRole("button", { name: "Reject proposal T-011" })).toBeTruthy()
  })

  test("columns collapse through onColumnsChange; cancelled is hidden unless a column config shows it", async () => {
    const onColumnsChange = vi.fn()
    renderBoard({ onColumnsChange })
    await tick()
    await user().click(screen.getByRole("button", { name: "Collapse Done" }))
    expect(onColumnsChange).toHaveBeenLastCalledWith([{ status: "done", collapsed: true }])
    expect(screen.getByRole("button", { name: "Expand Done" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Cancelled" })).toBeNull()
  })

  test("todo groups ready and waiting tasks; an empty column shows its empty state", async () => {
    renderBoard({ columns: [{ status: "cancelled", hidden: false }] })
    await tick()
    const todo = screen.getByRole("heading", { name: "To do" }).closest("li")!
    expect(within(todo).getByRole("heading", { name: "Ready" })).toBeTruthy()
    expect(within(todo).getByRole("heading", { name: "Waiting on dependencies" })).toBeTruthy()
    const cancelled = screen.getByRole("heading", { name: "Cancelled" }).closest("li")!
    expect(within(cancelled).getByText("Nothing here.")).toBeTruthy()
  })

  test("labels override one string; the Spanish preset translates the pieces too", async () => {
    const { unmount } = renderBoard({ labels: { board: "Agent work", columns: { done: "Shipped" } } })
    await tick()
    expect(screen.getByRole("region", { name: "Agent work" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Shipped" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "To do" })).toBeTruthy()
    unmount()

    renderBoard({ labels: agentTaskBoardLabelsEs, locale: "es-ES", defaultSelectedTaskId: "T-014" })
    await tick()
    expect(screen.getByRole("region", { name: "Tareas de agentes" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Por hacer" })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "Tablero" })).toBeTruthy()
    expect(screen.getByText(/^Instantánea · /)).toBeTruthy()
    expect(within(cardOf("T-014")!).getByText("En marcha")).toBeTruthy()
    expect(within(panel()!).getByRole("button", { name: "Cerrar detalles de la tarea" })).toBeTruthy()
    expect(within(panel()!).getByRole("list", { name: "Intentos" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Contraer Hechas" })).toBeTruthy()
  })
})

describe("accessibility", () => {
  test("axe passes on the board, the open panel and the table view", async () => {
    const { container } = renderBoard({
      mode: "live",
      now: GENERATED_AT,
      onApproveProposal: vi.fn(),
      onRejectProposal: vi.fn(),
    })
    await tick()
    expect(await axeViolations(container)).toEqual([])
    await user().click(openButton("T-014"))
    expect(await axeViolations(container)).toEqual([])
    await user().keyboard("{Escape}")
    await user().click(screen.getByRole("radio", { name: "Table" }))
    expect(await axeViolations(container)).toEqual([])
  })
})

test("scale: 200 tasks with up to 30 attempts render without virtualization", async () => {
  const tasks = generateTasks(200, 30)
  const started = performance.now()
  renderBoard({ tasks, columns: [{ status: "cancelled", hidden: false }] })
  const rendered = performance.now() - started
  await tick()
  expect(document.querySelectorAll('[data-slot="task-card"]')).toHaveLength(200)
  const selectStarted = performance.now()
  await act(async () => openButton("G-014").click())
  const selected = performance.now() - selectStarted
  console.log(
    `200x30 board: first render ${rendered.toFixed(0)} ms, selecting a card ${selected.toFixed(0)} ms (jsdom)`,
  )
  expect(panel()?.getAttribute("data-task-id")).toBe("G-014")
  expect(rendered).toBeLessThan(5000)
})
