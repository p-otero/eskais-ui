import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { TaskDetailDialog, type TaskDetailDialogProps } from "@/components/ui/task-detail-dialog"
import type { TaskView } from "@/lib/agent-task-types"

import { axeViolations } from "./axe"
import { GENERATED_AT, sampleTasks } from "./fixtures/agent-tasks"
import { settle } from "./overlay-helpers"

const agent = createAgent()
const task = sampleTasks.find((candidate) => candidate.id === "T-014") ?? sampleTasks[0]!

function Detail(props: Partial<TaskDetailDialogProps> & { onClose?: TaskDetailDialogProps["onClose"] }) {
  const [shown, setShown] = useState<TaskView | undefined>(task)
  return (
    <TaskDetailDialog
      task={shown}
      now={GENERATED_AT}
      locale="en-US"
      timeZone="UTC"
      {...props}
      onClose={(reason) => {
        props.onClose?.(reason)
        setShown(undefined)
      }}
    />
  )
}

test("renderHeader, renderBeforeBody and renderAfterBody render around the default sections", async () => {
  render(
    <Detail
      renderHeader={(current) => <p data-testid="header">Stats of {current.id}</p>}
      renderBeforeBody={() => <section aria-label="Changes">Changes</section>}
      renderAfterBody={(current) => <p data-testid="after">End of {current.id}</p>}
    />,
  )
  await settle()
  const dialog = screen.getByRole("dialog", { name: new RegExp(task.title) })
  const header = dialog.querySelector('[data-slot="task-detail-header"]')!
  expect(within(header as HTMLElement).getByTestId("header").textContent).toBe(`Stats of ${task.id}`)
  expect(within(header as HTMLElement).getByRole("button", { name: "Close task details" })).toBeTruthy()

  const body = dialog.querySelector('[data-slot="dialog-body"]')!
  const order = [...body.children].map(
    (child) => child.getAttribute("aria-label") ?? child.getAttribute("data-slot") ?? child.getAttribute("data-testid"),
  )
  expect(order).toEqual(["Changes", "task-detail-content", "after"])
})

test("without slots it renders the same title row and body as before", async () => {
  render(<Detail />)
  await settle()
  const dialog = screen.getByRole("dialog", { name: new RegExp(task.title) })
  const header = dialog.querySelector('[data-slot="task-detail-header"]')!
  expect(header.children).toHaveLength(1)
  const body = dialog.querySelector('[data-slot="dialog-body"]')!
  expect([...body.children].map((child) => child.getAttribute("data-slot"))).toEqual(["task-detail-content"])
})

test("keeps focus, Escape and the close button with slots", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const { unmount } = render(<Detail onClose={onClose} renderHeader={() => <Button>Branch history</Button>} />)
  await settle(20)
  const dialog = screen.getByRole("dialog", { name: new RegExp(task.title) })
  expect(document.activeElement).toBe(dialog)
  await user.keyboard("{Escape}")
  expect(onClose).toHaveBeenLastCalledWith("escape-key")
  unmount()

  render(<Detail onClose={onClose} renderHeader={() => <Button>Branch history</Button>} />)
  await settle(20)
  await user.click(screen.getByRole("button", { name: "Close task details" }))
  expect(onClose).toHaveBeenLastCalledWith("close-press")
})

test("has no axe violations with slots", async () => {
  render(
    <Detail
      renderHeader={() => <p>Stats</p>}
      renderBeforeBody={() => <section aria-label="Changes">Changes</section>}
    />,
  )
  await settle(20)
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent presses a control in the header slot and closes the dialog", async () => {
  const onHistory = vi.fn()
  const onClose = vi.fn()
  render(<Detail onClose={onClose} renderHeader={() => <Button onClick={onHistory}>Branch history</Button>} />)
  await settle(20)
  const dialog = agent.snapshot().find((entry) => entry.component === "dialog")
  expect(dialog?.label).toContain(task.title)
  expect(dialog?.buttons).toContain("Branch history")
  const pressed = await agent.act({ steps: [{ ref: "Branch history", action: "press" }] })
  expect(pressed.ok, pressed.error?.message).toBe(true)
  expect(onHistory).toHaveBeenCalledOnce()
  await act(async () => {
    const closed = await agent.act({ steps: [{ ref: dialog!.ref, action: "setOpen", args: [false] }] })
    expect(closed.ok, closed.error?.message).toBe(true)
  })
  expect(onClose).toHaveBeenCalledWith("imperative")
})
