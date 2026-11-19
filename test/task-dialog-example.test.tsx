import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

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

test("the changes section expands to the change list and the diff", async () => {
  const user = userEvent.setup()
  render(<TaskDialog task={withBranch} onClose={() => {}} onOpenHistory={() => {}} />)
  await settle(20)
  const trigger = screen.getByRole("button", { name: /^Changes/ })
  expect(trigger.textContent).toContain("3 not pushed")
  await user.click(trigger)
  const list = screen.getByRole("listbox", { name: "Changes" })
  expect(
    within(list)
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(expect.arrayContaining([expect.stringContaining("All changes vs main")]))
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
