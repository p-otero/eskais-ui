import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import type { TaskLink } from "@/lib/agent-task-types"
import { AgentTaskBoard, agentTaskBoardLabelsEs } from "@/components/ui/agent-task-board"

import { axeViolations } from "./axe"
import { GENERATED_AT, sampleTasks } from "./fixtures/agent-tasks"

const agent = createAgent()
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const column = (status: string) =>
  document.querySelector<HTMLElement>(`[data-slot="board-column"][data-status="${status}"]`)
const snapshotBoard = { tasks: sampleTasks, mode: "snapshot" as const, generatedAt: GENERATED_AT, timeZone: "UTC" }

test("columns carry their tone by default; columnTones overrides it and the cards' status icons follow", async () => {
  const { unmount } = render(<AgentTaskBoard {...snapshotBoard} />)
  await tick()
  const expected = {
    proposed: "neutral",
    todo: "neutral",
    working: "info",
    review: "warning",
    blocked: "destructive",
    done: "success",
  }
  for (const [status, tone] of Object.entries(expected)) {
    expect(column(status)?.getAttribute("data-tone"), status).toBe(tone)
    expect(column(status)?.querySelector('[data-slot="board-column-dot"]')?.getAttribute("aria-hidden")).toBe("true")
  }
  const working = document.querySelector('[data-slot="task-card"][data-task-id="T-014"] [data-slot="task-status-icon"]')
  expect(working?.getAttribute("data-tone")).toBe("info")
  const proposed = document.querySelector(
    '[data-slot="task-card"][data-task-id="T-011"] [data-slot="task-status-icon"]',
  )
  expect(proposed?.getAttribute("data-tone")).toBe("neutral")
  unmount()

  const recolored = render(<AgentTaskBoard {...snapshotBoard} columnTones={{ working: "success" }} />)
  await tick()
  expect(column("working")?.getAttribute("data-tone")).toBe("success")
  expect(
    document
      .querySelector('[data-slot="task-card"][data-task-id="T-014"] [data-slot="task-status-icon"]')
      ?.getAttribute("data-tone"),
  ).toBe("success")
  recolored.unmount()

  render(<AgentTaskBoard {...snapshotBoard} columnAccent="none" />)
  await tick()
  expect(column("working")?.hasAttribute("data-tone")).toBe(false)
  expect(document.querySelector('[data-slot="board-column-dot"]')).toBeNull()
})

test("the collapse toggle ends the column header, names its column and shows a tooltip; an agent collapses by name", async () => {
  const user = userEvent.setup()
  const onColumnsChange = vi.fn()
  render(<AgentTaskBoard {...snapshotBoard} labels={agentTaskBoardLabelsEs} onColumnsChange={onColumnsChange} />)
  await tick()
  const header = column("done")?.querySelector('[data-slot="board-column-header"]')
  const toggle = screen.getByRole("button", { name: "Contraer Hechas" })
  const count = header?.querySelector('[data-slot="board-column-count"]')
  expect(header?.contains(toggle)).toBe(true)
  // After the title and the count, so it no longer reads as "move left".
  expect(count && count.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(toggle.querySelector('[data-slot="board-column-fold-icon"]')).not.toBeNull()

  await user.hover(toggle)
  expect((await screen.findByRole("tooltip")).textContent).toBe("Contraer columna")

  const result = await act(() => agent.act({ steps: [{ ref: "Contraer Hechas", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(onColumnsChange).toHaveBeenLastCalledWith([{ status: "done", collapsed: true }])
  expect(screen.getByRole("button", { name: "Expandir Hechas" })).toBeTruthy()
})

test("a thread opens from an 'Open thread' button that keeps its id in a tooltip, never as its text", async () => {
  const user = userEvent.setup()
  const onOpenThread = vi.fn()
  render(<AgentTaskBoard {...snapshotBoard} defaultSelectedTaskId="T-014" onOpenThread={onOpenThread} />)
  await tick()
  const dialog = screen.getByRole("dialog", { name: "T-014 Index the docs for search" })
  const button = within(dialog).getByRole("button", { name: "Open thread th-2" })
  expect(button.textContent).toBe("Open thread")
  expect(button.getAttribute("title")).toBe("th-2")
  expect(within(dialog).queryByText("th-2")).toBeNull()
  await user.click(button)
  expect(onOpenThread).toHaveBeenCalledWith(expect.objectContaining({ id: "th-2" }))
})

test("links list in the detail with their state, the card gets a pull request link, and renderLink replaces them", async () => {
  const user = userEvent.setup()
  const onOpenLink = vi.fn()
  const { unmount } = render(
    <AgentTaskBoard {...snapshotBoard} defaultSelectedTaskId="T-014" onOpenLink={onOpenLink} />,
  )
  await tick()
  const dialog = screen.getByRole("dialog", { name: "T-014 Index the docs for search" })
  const links = within(dialog).getByRole("list", { name: "Links of T-014" })
  const items = within(links).getAllByRole("listitem")
  expect(items.map((item) => item.getAttribute("data-kind"))).toEqual(["pull-request", "branch", "issue"])
  expect(
    within(items[0] as HTMLElement)
      .getByText("Open")
      .closest('[data-slot="status-pill"]')
      ?.getAttribute("data-tone"),
  ).toBe("info")
  const pr = within(links).getByRole("link", { name: "#128 Index the docs for search" })
  expect(pr.getAttribute("href")).toBe("https://example.com/acme/docs/pull/128")
  await user.click(pr)
  expect(onOpenLink).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "pull-request" }),
    expect.objectContaining({ id: "T-014" }),
  )
  expect(await axeViolations(dialog)).toEqual([])
  unmount()

  const merged = render(<AgentTaskBoard {...snapshotBoard} />)
  await tick()
  const cardLink = screen.getByRole("link", { name: "Open pull request #131 Ask before destructive steps" })
  expect(cardLink.getAttribute("href")).toBe("https://example.com/acme/app/pull/131")
  expect(cardLink.closest('[data-slot="task-card"]')?.getAttribute("data-task-id")).toBe("T-015")
  merged.unmount()

  render(
    <AgentTaskBoard
      {...snapshotBoard}
      defaultSelectedTaskId="T-014"
      renderLink={(link: TaskLink) => <span data-testid="custom-link">{link.label}</span>}
      renderAttachments={(task) => <p>Files of {task.id}</p>}
      renderLocation={(task) => <p>Checkout of {task.id}</p>}
    />,
  )
  await tick()
  expect(screen.getAllByTestId("custom-link")).toHaveLength(3)
  expect(screen.getByRole("heading", { name: "Attachments" })).toBeTruthy()
  expect(screen.getByText("Files of T-014")).toBeTruthy()
  expect(screen.getByRole("heading", { name: "Location" })).toBeTruthy()
  expect(screen.getByText("Checkout of T-014")).toBeTruthy()
})

test("an agent opens a task's link by label or href; the action refuses unknown links and boards without a handler", async () => {
  const onOpenLink = vi.fn()
  const { unmount } = render(<AgentTaskBoard {...snapshotBoard} onOpenLink={onOpenLink} />)
  await tick()
  const board = agent.snapshot().find((entry) => entry.component === "agent-task-board")
  expect(board?.actions).toEqual(expect.arrayContaining(["openLink", "openThread", "selectTask"]))

  const result = await agent.act({
    steps: [
      { ref: "Agent tasks", action: "openLink", args: ["T-014", "index-docs"] },
      { ref: "Agent tasks", action: "openLink", args: ["T-015", "https://example.com/acme/app/commit/4f2a9c1"] },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onOpenLink.mock.calls.map(([link, task]) => `${task.id} ${link.kind}`)).toEqual([
    "T-014 branch",
    "T-015 commit",
  ])

  const unknown = await agent.act({ steps: [{ ref: "Agent tasks", action: "openLink", args: ["T-014", "nope"] }] })
  expect(unknown.ok).toBe(false)
  expect(unknown.error?.message).toMatch(/no link "nope". Links: #128/)
  unmount()

  render(<AgentTaskBoard {...snapshotBoard} />)
  await tick()
  const refused = await agent.act({
    steps: [{ ref: "Agent tasks", action: "openLink", args: ["T-014", "index-docs"] }],
  })
  expect(refused.ok).toBe(false)
  expect(refused.error?.message).toMatch(/doesn't open links/)
})

test("the detail dialog is xl and splits into a main and a side column; acceptance evidence is a disclosure", async () => {
  const user = userEvent.setup()
  render(<AgentTaskBoard {...snapshotBoard} defaultSelectedTaskId="T-014" />)
  await tick()
  const dialog = screen.getByRole("dialog", { name: "T-014 Index the docs for search" })
  expect(dialog.getAttribute("data-size")).toBe("xl")
  expect(dialog.querySelector('[data-slot="dialog-body"]')).not.toBeNull()
  const content = dialog.querySelector('[data-slot="task-detail-content"]')
  expect(content?.getAttribute("data-layout")).toBe("split")
  const main = content?.querySelector('[data-slot="task-detail-main"]') as HTMLElement
  const side = content?.querySelector('[data-slot="task-detail-side"]') as HTMLElement
  expect(within(main).getByRole("heading", { name: "Acceptance" })).toBeTruthy()
  expect(within(main).getByRole("heading", { name: "Activity" })).toBeTruthy()
  for (const name of ["Work", "Usage", "Links"]) expect(within(side).getByRole("heading", { name })).toBeTruthy()
  expect(within(side).getByRole("group", { name: "Usage of T-014" }).getAttribute("data-variant")).toBe("compact")

  expect(screen.queryByText("1,204 of 1,204")).toBeNull()
  await user.click(within(main).getByRole("button", { name: /Every page is indexed/ }))
  expect(screen.getByText("1,204 of 1,204")).toBeTruthy()
})

test("the drawer keeps one column", async () => {
  render(<AgentTaskBoard {...snapshotBoard} defaultSelectedTaskId="T-014" detailPresentation="drawer" />)
  await tick()
  const content = document.querySelector('[data-slot="task-detail-content"]')
  expect(content?.getAttribute("data-layout")).toBe("stack")
  expect(content?.className).not.toContain("@4xl/task-detail:grid")
})
