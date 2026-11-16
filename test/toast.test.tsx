import { act, fireEvent, render, screen, within } from "@testing-library/react"
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
  rerender(<ToastStack toaster={toaster} labels={{ close: "Cerrar" }} />)
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

test("only the toasts take pointer events, so the region never covers the page", async () => {
  const toaster = createToaster()
  render(<ToastStack toaster={toaster} />)
  await act(async () => {
    toaster("Saved")
  })
  const region = screen.getByRole("region", { name: "Notifications" })
  expect(region.className).toContain("pointer-events-none")
  expect(screen.getByRole("listitem").className).toContain("pointer-events-auto")
})

async function showTimedToast(duration: number) {
  const toaster = createToaster({ duration })
  render(<ToastStack toaster={toaster} hoverDelay={200} />)
  await act(async () => {
    toaster("Saved")
  })
  return { region: screen.getByRole("region", { name: "Notifications" }), item: screen.getByRole("listitem") }
}

// A browser sends pointerenter and pointerleave to the region and to the toast; user-event only to the toast.
const pointer = { pointerType: "mouse" }
function pointerIn(region: HTMLElement, init = pointer) {
  fireEvent.pointerEnter(region, init)
  fireEvent.pointerEnter(screen.getByRole("listitem"), init)
}
function pointerOut(region: HTMLElement) {
  fireEvent.pointerLeave(screen.getByRole("listitem"), pointer)
  fireEvent.pointerLeave(region, pointer)
}

test("a pointer passing over a toast doesn't pause its timer", async () => {
  const { region } = await showTimedToast(400)
  pointerIn(region)
  await settle(100)
  expect(region.hasAttribute("data-expanded")).toBe(false)
  pointerOut(region)
  await settle(450)
  expect(screen.queryByRole("listitem")).toBeNull()
})

test("a pointer resting on a toast pauses its timer until it leaves", async () => {
  const { region, item } = await showTimedToast(1000)
  pointerIn(region)
  await settle(300)
  expect(region.hasAttribute("data-expanded")).toBe(true)
  await settle(1000)
  expect(screen.getByRole("listitem")).toBe(item)
  pointerOut(region)
  await settle()
  expect(region.hasAttribute("data-expanded")).toBe(false)
  await settle(1100)
  expect(screen.queryByRole("listitem")).toBeNull()
})

test("a touch doesn't pause the timer", async () => {
  const { region } = await showTimedToast(Number.POSITIVE_INFINITY)
  pointerIn(region, { pointerType: "touch" })
  await settle(300)
  expect(region.hasAttribute("data-expanded")).toBe(false)
})

test("focus in a toast pauses its timer at once", async () => {
  const user = userEvent.setup()
  const { item } = await showTimedToast(1000)
  await user.keyboard("{F6}")
  expect(document.activeElement).toBe(item)
  await settle(1300)
  expect(screen.getByRole("listitem")).toBe(item)
})

test("the deprecated closeLabel still names the close button", async () => {
  const toaster = createToaster()
  render(<ToastStack toaster={toaster} closeLabel="Fermer" />)
  await act(async () => {
    toaster("Enregistré")
  })
  expect(screen.getByRole("button", { name: "Fermer" })).toBeTruthy()
})

test("each type shows a decorative icon in its tone, a spinner while loading and none by default", async () => {
  const toaster = createToaster()
  render(<ToastStack toaster={toaster} maxVisible={6} />)
  await act(async () => {
    toaster("Queued")
    toaster.info("Syncing")
    toaster.success("Archived")
    toaster.warning("Quota low")
    toaster.error("Deploy failed")
    toaster.loading("Uploading")
  })
  const icons = Object.fromEntries(
    screen.getAllByRole("listitem").map((item) => {
      const icon = item.querySelector<HTMLElement>("[data-slot=toast-icon]")
      expect(icon?.getAttribute("aria-hidden") ?? "true").toBe("true")
      return [item.dataset.type, icon ? `${icon.dataset.tone} ${icon.className}` : null]
    }),
  )
  expect(icons).toEqual({
    default: null,
    info: expect.stringContaining("info flex shrink-0 text-info"),
    success: expect.stringContaining("success flex shrink-0 text-success"),
    warning: expect.stringContaining("warning flex shrink-0 text-warning"),
    error: expect.stringContaining("destructive flex shrink-0 text-destructive"),
    loading: expect.stringContaining("loading flex shrink-0 text-muted-foreground"),
  })
  const loading = screen.getAllByRole("listitem").find((item) => item.dataset.type === "loading")!
  expect(loading.querySelector("[data-slot=spinner]")).toBeTruthy()
  const error = screen.getAllByRole("listitem").find((item) => item.dataset.type === "error")!
  expect(within(error).getByText("Deploy failed")).toBeTruthy()
})
