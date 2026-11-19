import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { WORKING_TREE } from "@/components/ui/commit-history"

import { TaskDialog } from "../apps/site/src/examples/task-detail-panel"
import { taskDialogTasks } from "../apps/site/src/examples/task-dialog-fixtures"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()
const [withBranch, withoutBranch] = taskDialogTasks

test("the composed dialog shows acceptance only in the header popover, open from the start", async () => {
  render(<TaskDialog task={withBranch} onClose={() => {}} onOpenHistory={() => {}} acceptanceOpen />)
  await settle(20)
  const dialog = screen.getByRole("dialog", { name: /Back off webhook retries/ })
  expect(document.activeElement).toBe(dialog)
  const popover = screen.getByRole("dialog", { name: "Acceptance" })
  expect(within(popover).getAllByRole("listitem")).toHaveLength(3)
  expect(within(dialog).queryByRole("heading", { level: 3, name: "Acceptance" })).toBeNull()
  expect(within(dialog).queryByRole("heading", { name: "Work" })).toBeNull()
  expect(within(dialog).getByRole("heading", { name: "Usage" })).toBeTruthy()
  expect(within(dialog).getByRole("button", { name: "Acceptance: 1 of 3 passed, 1 failed" })).toBeTruthy()
})

const diffLabel = () =>
  document.querySelector("[data-slot=git-diff] [role=group][aria-label]")?.getAttribute("aria-label")
const allChanges = () => screen.getByRole("button", { name: /^All changes/ })

test("the changes section lists the branch's commits beside all changes against the base", async () => {
  const user = userEvent.setup()
  render(<TaskDialog task={withBranch} onClose={() => {}} onOpenHistory={() => {}} />)
  await settle(20)
  const trigger = screen.getByRole("button", { name: /^Changes/ })
  expect(trigger.textContent).toContain("3 not pushed")
  await user.click(trigger)
  const history = screen.getByRole("region", { name: "Commits on fix/webhook-backoff" })
  const rows = within(history).getAllByRole("treeitem")
  expect(rows.map((row) => row.getAttribute("aria-selected") === "true")).toEqual([false, false, false, false])
  expect(rows[0]?.textContent).toContain("Uncommitted changes")
  expect(within(history).getByRole("treeitem", { name: /^Cap webhook retries at 8 attempts.*not pushed/ })).toBeTruthy()
  expect(allChanges().getAttribute("aria-pressed")).toBe("true")
  expect(allChanges().textContent).toContain("+22 −6")
  expect(diffLabel()).toBe("All changes against main")
})

test("selecting a commit shows its diff, and All changes clears the selection", async () => {
  const user = userEvent.setup()
  render(<TaskDialog task={withBranch} onClose={() => {}} onOpenHistory={() => {}} changesOpen />)
  await settle(20)
  const commit = screen.getByRole("treeitem", { name: /^Back off webhook retries exponentially/ })
  await user.click(commit.querySelector("[data-slot=tree-label]") as HTMLElement)
  expect(commit.getAttribute("aria-selected")).toBe("true")
  expect(diffLabel()).toBe("Changes in 2372a8e")
  expect(allChanges().getAttribute("aria-pressed")).toBe("false")
  await user.click(allChanges())
  expect(commit.getAttribute("aria-selected")).not.toBe("true")
  expect(diffLabel()).toBe("All changes against main")
  await user.click(allChanges())
  expect(allChanges().getAttribute("aria-pressed")).toBe("true")
})

test("the working-tree row shows the uncommitted changes as Staged and Unstaged groups", async () => {
  render(
    <TaskDialog
      task={withBranch}
      onClose={() => {}}
      onOpenHistory={() => {}}
      changesOpen
      changesSelected={WORKING_TREE}
    />,
  )
  await settle(20)
  expect(diffLabel()).toBe("Uncommitted changes")
  const badges = [...document.querySelectorAll("[data-slot=diff-file-group]")].map((badge) => badge.textContent)
  expect(badges).toEqual(["Staged", "Unstaged"])
})

test("the diff grows with the dialog body instead of a fixed box", async () => {
  render(<TaskDialog task={withBranch} onClose={() => {}} onOpenHistory={() => {}} changesOpen />)
  await settle(20)
  expect(document.querySelector("[data-slot=git-diff]")?.getAttribute("data-height")).toBe("auto")
  expect(document.querySelector(".h-160")).toBeNull()
})

test("without a branch the changes say so", async () => {
  render(<TaskDialog task={withoutBranch} onClose={() => {}} onOpenHistory={() => {}} changesOpen />)
  await settle(20)
  expect(screen.getByText("No changes to show")).toBeTruthy()
  expect(screen.queryByRole("region", { name: /^Commits on/ })).toBeNull()
})

test("without a branch the git line says so and Branch history is off", async () => {
  render(<TaskDialog task={withoutBranch} onClose={() => {}} onOpenHistory={() => {}} />)
  await settle(20)
  expect(screen.getByText("No branch: this task's attempts haven't created one")).toBeTruthy()
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Branch history" }).disabled).toBe(true)
})

test("has no axe violations", async () => {
  render(<TaskDialog task={withBranch} onClose={() => {}} onOpenHistory={() => {}} changesOpen />)
  await settle(20)
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent opens the acceptance popover and presses Branch history by name", async () => {
  const onOpenHistory = vi.fn()
  render(<TaskDialog task={withBranch} onClose={() => {}} onOpenHistory={onOpenHistory} />)
  await settle(20)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const opened = await agent.act({ steps: [{ ref: "Acceptance: 1 of 3 passed, 1 failed", action: "press" }] })
  expect(opened.ok, opened.error?.message).toBe(true)
  expect(screen.getByRole("dialog", { name: "Acceptance" })).toBeTruthy()
  const closed = await agent.act({ steps: [{ ref: "Acceptance", action: "setOpen", args: [false] }] })
  expect(closed.ok, closed.error?.message).toBe(true)
  const pressed = await agent.act({ steps: [{ ref: "Branch history", action: "press" }] })
  expect(pressed.ok, pressed.error?.message).toBe(true)
  expect(onOpenHistory).toHaveBeenCalledWith("fix/webhook-backoff")
})

test("an agent selects a commit by its subject and goes back to all changes", async () => {
  render(<TaskDialog task={withBranch} onClose={() => {}} onOpenHistory={() => {}} changesOpen />)
  await settle(20)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const selected = await agent.act({
    steps: [{ ref: "Commits on fix/webhook-backoff", action: "select", args: ["Cap webhook retries at 8 attempts"] }],
  })
  expect(selected.ok, selected.error?.message).toBe(true)
  expect(diffLabel()).toBe("Changes in 28e0e8d")
  const all = agent.snapshot().find((entry) => entry.label?.startsWith("All changes"))
  expect(all, "All changes is an agent item").toBeTruthy()
  const pressed = await agent.act({ steps: [{ ref: all?.ref ?? "", action: "setPressed", args: [true] }] })
  expect(pressed.ok, pressed.error?.message).toBe(true)
  expect(diffLabel()).toBe("All changes against main")
})
