import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { describe, expect, test, vi } from "vitest"

import { AgentTaskBoard, agentTaskBoardLabelsEs, type AgentTaskBoardProps } from "@/components/ui/agent-task-board"
import { agentTaskBoard } from "@/components/ui/agent-task-board-primitive"
import { Button } from "@/components/ui/button"
import { backlogGroups, countByStage, filterTasks } from "@/lib/agent-task-board-model"
import type { TaskView } from "@/lib/agent-task-types"

import { axeViolations } from "./axe"
import { GENERATED_AT, generateTasks, sampleStages, sampleTasks } from "./fixtures/agent-tasks"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const user = () => userEvent.setup({ pointerEventsCheck: 0 })
const onPage = () => agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
const cardOf = (id: string) => document.querySelector<HTMLElement>(`[data-slot="task-card"][data-task-id="${id}"]`)
const detail = () => document.querySelector<HTMLElement>("[data-task-detail], [data-slot='task-detail-panel']")
const visibleIds = () =>
  [...document.querySelectorAll('[data-slot="task-card"]')].map((element) => element.getAttribute("data-task-id"))
const backlogRows = () =>
  [...document.querySelectorAll('[data-slot="list-item"]')].map((element) => element.getAttribute("data-item-id"))

function renderBoard(props: Partial<AgentTaskBoardProps> = {}) {
  const all = {
    tasks: sampleTasks,
    stages: sampleStages,
    mode: "snapshot",
    generatedAt: GENERATED_AT,
    timeZone: "UTC",
    locale: "en-US",
    ...props,
  }
  return render(<AgentTaskBoard {...(all as AgentTaskBoardProps)} />)
}

describe("model", () => {
  test("the stage filter keeps tasks whose location is in any chosen stage", () => {
    expect(filterTasks(sampleTasks, { stage: ["pr", "prod"] }).map((task) => task.id)).toEqual(["T-014", "T-009"])
    expect(filterTasks(sampleTasks, { stage: [] })).toHaveLength(sampleTasks.length)
    expect(countByStage(sampleTasks)).toEqual({ branch: 1, pr: 1, staging: 1, dev: 1, prod: 1 })
  })

  test("the backlog holds proposals and the to-do tasks that aren't ready", () => {
    const { proposed, notReady } = backlogGroups(sampleTasks)
    expect(proposed.map((task) => task.id)).toEqual(["T-011"])
    expect(notReady.map((task) => task.id)).toEqual(["T-013"])
  })
})

describe("primitive", () => {
  test("setView takes backlog; filter takes stage ids and rejects others", () => {
    const view = mount(
      agentTaskBoard,
      { tasks: sampleTasks, stageIds: sampleStages.map((stage) => stage.id) },
      `<root aria-label="Agent tasks"></root>`,
    )
    try {
      expect(view.api.setView("backlog")).toBe(true)
      expect(view.part("root")?.getAttribute("data-view")).toBe("backlog")
      expect(() => view.api.setView("list")).toThrow(/board, table, backlog/)

      view.api.filter({ stage: ["dev", "dev", "prod"] })
      expect(view.state.filters).toEqual({ stage: ["dev", "prod"] })
      view.api.filter({ stage: "pr" })
      expect(view.state.filters).toEqual({ stage: ["pr"] })
      expect(() => view.api.filter({ stage: ["qa"] })).toThrow(/No stage "qa". Choices: branch, pr, dev, staging, prod/)
      expect(() => view.api.filter({ stage: [1] })).toThrow(TypeError)
      view.api.filter({ stage: [] })
      expect(view.state.filters).toEqual({})
      view.api.filter({ stage: "pr" })
      view.api.filter({ stage: null })
      expect(view.state.filters).toEqual({})
    } finally {
      view.unmount()
    }
  })

  test("without stageIds, the stages the tasks name are the choices", () => {
    const view = mount(agentTaskBoard, { tasks: sampleTasks }, `<root aria-label="Agent tasks"></root>`)
    try {
      expect(() => view.api.filter({ stage: ["qa"] })).toThrow(/Choices: branch, pr, staging, dev, prod/)
    } finally {
      view.unmount()
    }
  })

  test("renders on the server", () => {
    checkServer(agentTaskBoard, { tasks: sampleTasks, view: "backlog" }, `<root aria-label="Agent tasks"></root>`)
  })
})

describe("cards", () => {
  test("a card shows its stage as a pill and a paperclip count for its attachments", async () => {
    renderBoard()
    await tick()
    const card = cardOf("T-014")!
    const pill = card.querySelector('[data-slot="stage-pill"]')
    expect(pill?.textContent).toBe("Pull request")
    expect(pill?.getAttribute("href")).toBe("https://example.com/acme/docs/pull/128")
    const chip = card.querySelector('[data-slot="task-card-attachments"]')
    expect(chip?.textContent).toContain("3")
    expect(within(chip as HTMLElement).getByText("3 attachments").className).toContain("sr-only")
    expect(cardOf("T-012")?.querySelector('[data-slot="stage-pill"]')).toBeNull()
    expect(cardOf("T-012")?.querySelector('[data-slot="task-card-attachments"]')).toBeNull()
  })

  test("a location outside the board's stages still shows, named by its id", async () => {
    renderBoard({ stages: undefined })
    await tick()
    expect(cardOf("T-016")?.querySelector('[data-slot="stage-pill"]')?.textContent).toBe("dev")
    expect(screen.queryByRole("group", { name: "Stage" })).toBeNull()
  })
})

describe("detail", () => {
  test("the main column shows the attachment strip and the side column the stage track", async () => {
    renderBoard({ defaultSelectedTaskId: "T-014" })
    await tick()
    const strip = screen.getByRole("group", { name: "Attachments of T-014" })
    expect(within(strip).getByRole("button", { name: "Open search-results.png" })).toBeTruthy()
    expect(strip.closest('[data-slot="task-detail-main"]')).toBeTruthy()
    const track = screen.getByRole("list", { name: "Stage of T-014" })
    expect(track.closest('[data-slot="task-detail-side"]')).toBeTruthy()
    const current = track.querySelector('[aria-current="step"]')
    expect(current?.getAttribute("data-stage")).toBe("pr")
    expect(within(current as HTMLElement).getByRole("link", { name: "Pull request" })).toBeTruthy()
    expect(track.querySelectorAll('[data-state="reached"]')).toHaveLength(1)
    expect(await axeViolations(detail()!)).toEqual([])
  })

  test("an image opens in the lightbox", async () => {
    renderBoard({ defaultSelectedTaskId: "T-014" })
    await tick()
    await user().click(screen.getByRole("button", { name: "Open index-status.png" }))
    expect(await screen.findByRole("dialog", { name: /index-status.png|Image viewer/ })).toBeTruthy()
  })

  test("renderAttachments and renderLocation still replace them", async () => {
    renderBoard({
      defaultSelectedTaskId: "T-014",
      renderAttachments: (task) => <p>custom files of {task.id}</p>,
      renderLocation: () => <p>custom place</p>,
    })
    await tick()
    expect(screen.getByText("custom files of T-014")).toBeTruthy()
    expect(screen.getByText("custom place")).toBeTruthy()
    expect(screen.queryByRole("group", { name: "Attachments of T-014" })).toBeNull()
    expect(screen.queryByRole("list", { name: "Stage of T-014" })).toBeNull()
  })

  test("Spanish labels reach the strip, the lightbox and the track", async () => {
    renderBoard({ defaultSelectedTaskId: "T-014", labels: agentTaskBoardLabelsEs })
    await tick()
    expect(screen.getByRole("group", { name: "Adjuntos de T-014" })).toBeTruthy()
    expect(screen.getByRole("list", { name: "Etapa de T-014" })).toBeTruthy()
    await user().click(screen.getByRole("button", { name: "Abrir search-results.png" }))
    expect(await screen.findByRole("button", { name: "Cerrar visor" })).toBeTruthy()
  })
})

describe("card actions", () => {
  test("renderCardActions ends each card, above its stretched button, and an agent presses it", async () => {
    const copied = vi.fn()
    renderBoard({
      renderCardActions: (task) =>
        task.status === "working" ? (
          <Button variant="outline" size="sm" onClick={() => copied(task.id)}>
            {`Copy command for ${task.id}`}
          </Button>
        ) : null,
    })
    await tick()
    const card = cardOf("T-014")!
    expect(card.lastElementChild?.getAttribute("data-slot")).toBe("task-card-actions")
    expect(cardOf("T-015")?.querySelector('[data-slot="task-card-actions"]')).toBeNull()
    await user().click(within(card).getByRole("button", { name: "Copy command for T-014" }))
    expect(copied).toHaveBeenCalledWith("T-014")
    expect(detail()).toBeNull()
    const result = await agent.act({ steps: [{ ref: "Copy command for T-014", action: "press" }] })
    expect(result.ok, result.error?.message).toBe(true)
    expect(copied).toHaveBeenCalledTimes(2)
  })
})

describe("stage filter", () => {
  test("a row of stage toggles with counts filters the board", async () => {
    renderBoard()
    await tick()
    const row = screen.getByRole("group", { name: "Stage" })
    const dev = within(row).getByRole("button", { name: /^In Dev/ })
    expect(dev.textContent).toContain("1")
    await user().click(dev)
    expect(visibleIds()).toEqual(["T-016"])
    await user().click(within(row).getByRole("button", { name: /^In Prod/ }))
    expect(visibleIds().toSorted()).toEqual(["T-009", "T-016"])
    await user().click(screen.getByRole("button", { name: "Clear filters" }))
    expect(visibleIds()).toHaveLength(sampleTasks.length)
  })

  test("counts follow the other filters", async () => {
    renderBoard({ defaultFilters: { profile: "bounded" } })
    await tick()
    const row = screen.getByRole("group", { name: "Stage" })
    expect(within(row).getByRole("button", { name: /^Pull request/ }).textContent).toContain("1")
    expect(within(row).getByRole("button", { name: /^In Prod/ }).textContent).toContain("0")
  })
})

describe("backlog", () => {
  test("the third view lists proposals and tasks that aren't ready, grouped with counts", async () => {
    const onApproveProposal = vi.fn()
    renderBoard({ mode: "live", now: GENERATED_AT, onApproveProposal, onRejectProposal: vi.fn() })
    await tick()
    await user().click(screen.getByRole("radio", { name: "Backlog" }))
    const list = screen.getByRole("group", { name: "Backlog" })
    expect(backlogRows()).toEqual(["T-011", "T-013"])
    const groups = [...list.querySelectorAll('[data-slot="list-group"]')].map((group) =>
      group.firstElementChild?.textContent?.replaceAll(/\s+/g, " "),
    )
    expect(groups).toEqual(["Proposed 1", "Not ready 1"])

    const proposal = list.querySelector<HTMLElement>('[data-item-id="T-011"]')!
    expect(within(proposal).getByText("T-011")).toBeTruthy()
    expect(within(proposal).getByText("pricing")).toBeTruthy()
    expect(within(proposal).getByRole("button", { name: "Approve proposal T-011" })).toBeTruthy()
    const notReady = list.querySelector<HTMLElement>('[data-item-id="T-013"]')!
    expect(notReady.querySelector('[data-slot="stage-pill"]')?.textContent).toBe("Branch")
    expect(within(notReady).queryByRole("button", { name: /Approve/ })).toBeNull()
    expect(await axeViolations(list)).toEqual([])

    await user().click(within(proposal).getByRole("button", { name: "Approve proposal T-011" }))
    expect(onApproveProposal).toHaveBeenCalledWith("T-011")
  })

  test("selecting a row opens the detail, and closing it returns focus to the row", async () => {
    renderBoard({ defaultView: "backlog" })
    await tick()
    const row = screen.getByRole("button", { name: /^Backfill usage for old attempts/ })
    await user().click(row)
    expect(detail()?.getAttribute("data-task-id")).toBe("T-013")
    await user().keyboard("{Escape}")
    await tick()
    expect(detail()).toBeNull()
    expect(document.activeElement).toBe(row)
  })

  test("snapshot mode shows no proposal actions; an empty backlog says so", async () => {
    renderBoard({ defaultView: "backlog" })
    await tick()
    expect(screen.queryByRole("button", { name: /Approve proposal/ })).toBeNull()
    await user().click(screen.getByRole("button", { name: /^Pull request/ }))
    expect(screen.getByText("Nothing in the backlog.")).toBeTruthy()
  })

  test("host actions follow Approve/Reject in each row, also in snapshot mode", async () => {
    const copied = vi.fn()
    const renderBacklogActions = (task: TaskView) => (
      <Button variant="ghost" size="sm" onClick={() => copied(task.id)}>
        {`Copy command for ${task.id}`}
      </Button>
    )
    const { unmount } = renderBoard({
      defaultView: "backlog",
      mode: "live",
      now: GENERATED_AT,
      onApproveProposal: vi.fn(),
      renderBacklogActions,
    })
    await tick()
    const proposal = document.querySelector<HTMLElement>('[data-slot="list-item"][data-item-id="T-011"]')!
    const actions = proposal.querySelector('[data-slot="list-item-actions"]')!
    const names = within(actions as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent)
    expect(names.at(-1)).toBe("Copy command for T-011")
    expect(names).toContain("Approve proposal T-011")
    await user().click(within(proposal).getByRole("button", { name: "Copy command for T-011" }))
    expect(copied).toHaveBeenCalledWith("T-011")
    expect(detail()).toBeNull()
    unmount()

    renderBoard({ defaultView: "backlog", renderBacklogActions })
    await tick()
    expect(screen.queryByRole("button", { name: /Approve proposal/ })).toBeNull()
    expect(screen.getByRole("button", { name: "Copy command for T-013" })).toBeTruthy()
    expect(await axeViolations(screen.getByRole("group", { name: "Backlog" }))).toEqual([])
  })

  test("without host actions or live proposals, a row has no actions slot", async () => {
    renderBoard({ defaultView: "backlog", renderBacklogActions: () => null })
    await tick()
    expect(document.querySelector('[data-slot="list-item-actions"]')).toBeNull()
  })

  test("Spanish labels", async () => {
    renderBoard({ defaultView: "backlog", labels: agentTaskBoardLabelsEs })
    await tick()
    expect(screen.getByRole("radio", { name: "Backlog" })).toBeTruthy()
    expect(screen.getByRole("group", { name: "Etapa" })).toBeTruthy()
    expect(screen.getByText("No listas")).toBeTruthy()
  })

  test("200 tasks: the backlog renders every proposal and unready task", async () => {
    const tasks = generateTasks(200, 30)
    const started = performance.now()
    renderBoard({ tasks, defaultView: "backlog" })
    const rendered = performance.now() - started
    await tick()
    const { proposed, notReady } = backlogGroups(tasks)
    expect(backlogRows()).toHaveLength(proposed.length + notReady.length)
    expect(rendered).toBeLessThan(5000)
  })
})

describe("agents", () => {
  test("an agent switches to the backlog, filters by stage, selects a task and opens an attachment", async () => {
    renderBoard({ mode: "live", now: GENERATED_AT, onApproveProposal: vi.fn() })
    await tick()
    for (const entry of onPage()) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
    expect(onPage().map((entry) => entry.label)).toContain("Stage")

    const backlog = await agent.act({ steps: [{ ref: "Agent tasks", action: "setView", args: ["backlog"] }] })
    expect(backlog.ok, backlog.error?.message).toBe(true)
    const list = onPage().find((entry) => entry.label === "Backlog" && entry.component === "list")
    expect(list?.actions).toContain("select")

    const filtered = await agent.act({
      steps: [
        { ref: "Agent tasks", action: "filter", args: [{ stage: ["branch"] }] },
        { ref: "Agent tasks", action: "selectTask", args: ["T-013"] },
      ],
    })
    expect(filtered.ok, filtered.error?.message).toBe(true)
    expect(backlogRows()).toEqual(["T-013"])
    expect(detail()?.getAttribute("data-task-id")).toBe("T-013")

    const rejected = await agent.act({ steps: [{ ref: "Agent tasks", action: "filter", args: [{ stage: ["qa"] }] }] })
    expect(rejected.ok).toBe(false)

    const opened = await agent.act({
      steps: [
        { ref: "Agent tasks", action: "selectTask", args: ["T-014"] },
        { ref: "Attachments of T-014", action: "openAttachment", args: ["T-014-shot-2"] },
      ],
    })
    expect(opened.ok, opened.error?.message).toBe(true)
    expect(await screen.findByRole("button", { name: "Close viewer" })).toBeTruthy()
  })

  test("an agent presses a host action inside a backlog row by its name", async () => {
    const copied = vi.fn()
    renderBoard({
      defaultView: "backlog",
      renderBacklogActions: (task) => (
        <Button variant="ghost" size="sm" onClick={() => copied(task.id)}>
          {`Copy command for ${task.id}`}
        </Button>
      ),
    })
    await tick()
    // The row's own button reads the action in its row text, so the name alone is ambiguous: the documented
    // flow is to take the ref from the snapshot.
    const copy = onPage().find((entry) => entry.label === "Copy command for T-013")
    expect(copy?.actions).toContain("press")
    const result = await agent.act({ steps: [{ ref: copy!.ref, action: "press" }] })
    expect(result.ok, result.error?.message).toBe(true)
    expect(copied).toHaveBeenCalledWith("T-013")
    expect(detail()).toBeNull()
  })

  test("an agent selects a backlog row through the list", async () => {
    renderBoard({ defaultView: "backlog" })
    await tick()
    approve = false
    const result = await agent.act({ steps: [{ ref: "Backlog", action: "select", args: ["T-011"] }] })
    expect(result.ok, result.error?.message).toBe(true)
    expect(detail()?.getAttribute("data-task-id")).toBe("T-011")
  })
})
