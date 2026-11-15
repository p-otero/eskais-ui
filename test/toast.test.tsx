import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { ToastStack, createToaster } from "@/components/ui/toast"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function noop() {}

function TaskBoard({ onUndo = noop }: { onUndo?: () => void }) {
  const [toast] = useState(() => createToaster())
  return (
    <>
      <Button
        onClick={() =>
          toast.success("Task archived", {
            description: "Index the docs",
            action: { label: "Undo", onAction: onUndo },
          })
        }
      >
        Archive task
      </Button>
      <Button onClick={() => toast("Run queued", { cancel: { label: "Hide", onCancel: () => {} } })}>Queue run</Button>
      <ToastStack toaster={toast} />
    </>
  )
}

test("shows a toast in the Notifications region with its title, description and action", async () => {
  const user = userEvent.setup()
  render(<TaskBoard />)
  await user.click(screen.getByRole("button", { name: "Archive task" }))
  const region = screen.getByRole("region", { name: "Notifications" })
  expect(region.hasAttribute("data-agent-hidden")).toBe(true)
  const item = within(region).getByRole("listitem")
  expect(item.dataset.type).toBe("success")
  expect(item).toHaveProperty("textContent", expect.stringContaining("Index the docs"))
  expect(within(item).getByRole("button", { name: "Undo" }).className).toContain("bg-primary")
  expect(within(item).getByRole("button", { name: "Dismiss" })).toBeTruthy()
})

test("the action runs and dismisses the toast", async () => {
  const user = userEvent.setup()
  const onUndo = vi.fn()
  render(<TaskBoard onUndo={onUndo} />)
  await user.click(screen.getByRole("button", { name: "Archive task" }))
  await user.click(screen.getByRole("button", { name: "Undo" }))
  await settle()
  expect(onUndo).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("listitem")).toBeNull()
})

test("the close button and Escape dismiss a toast", async () => {
  const user = userEvent.setup()
  render(<TaskBoard />)
  await user.click(screen.getByRole("button", { name: "Archive task" }))
  await user.click(screen.getByRole("button", { name: "Dismiss" }))
  await settle()
  expect(screen.queryByRole("listitem")).toBeNull()

  const trigger = screen.getByRole("button", { name: "Archive task" })
  await user.click(trigger)
  await user.keyboard("{F6}")
  const item = screen.getByRole("listitem")
  expect(document.activeElement).toBe(item)
  await user.keyboard("{Escape}")
  await settle()
  expect(screen.queryByRole("listitem")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test("a cancel option replaces the close icon and the close label is overridable", async () => {
  const user = userEvent.setup()
  const { rerender } = render(<TaskBoard />)
  await user.click(screen.getByRole("button", { name: "Queue run" }))
  const item = screen.getByRole("listitem")
  expect(within(item).getByRole("button", { name: "Hide" })).toBeTruthy()
  expect(within(item).queryByRole("button", { name: "Dismiss" })).toBeNull()

  const toaster = createToaster()
  rerender(<ToastStack toaster={toaster} closeLabel="Cerrar" />)
  await act(async () => {
    toaster("Guardado")
  })
  expect(screen.getByRole("button", { name: "Cerrar" })).toBeTruthy()
})

test("has no axe violations with a toast showing", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <TaskBoard />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Archive task" }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent sees every control named and the region stays hidden from it", async () => {
  render(<TaskBoard />)
  await settle()
  const result = await agent.act({ steps: [{ ref: "Archive task", action: "press" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("listitem")).toBeTruthy()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.component)).not.toContain("toast")
})
