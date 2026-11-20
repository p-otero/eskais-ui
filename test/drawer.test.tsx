import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHandle,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function TaskDrawer({ side }: { side?: "right" | "bottom" }) {
  return (
    <Drawer side={side}>
      <DrawerTrigger>Open task</DrawerTrigger>
      <DrawerBackdrop />
      <DrawerContent>
        {side === "bottom" && <DrawerHandle />}
        <DrawerHeader>
          <DrawerTitle>Index the docs</DrawerTitle>
          <DrawerDescription>Queued by the planner.</DrawerDescription>
        </DrawerHeader>
        <Field>
          <FieldLabel>Task title</FieldLabel>
          <Input defaultValue="Index the docs" />
        </Field>
        <DrawerFooter>
          <DrawerClose>Close task</DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

test.each(["right", "bottom"] as const)("a %s drawer opens on that side and Escape returns focus", async (side) => {
  const user = userEvent.setup()
  render(<TaskDrawer side={side} />)
  const trigger = screen.getByRole("button", { name: "Open task" })
  expect(trigger.className).toContain("border-input")

  await user.click(trigger)
  const drawer = screen.getByRole("dialog", { name: "Index the docs" })
  expect(drawer.dataset.side).toBe(side)
  expect(drawer.getAttribute("aria-modal")).toBe("true")
  expect(drawer.getAttribute("aria-describedby")).toBeTruthy()
  expect(drawer.contains(document.activeElement)).toBe(true)

  await user.keyboard("{Escape}")
  await settle()
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test("Tab stays inside the open drawer and the Close part closes it", async () => {
  const user = userEvent.setup()
  render(<TaskDrawer side="right" />)
  await user.click(screen.getByRole("button", { name: "Open task" }))
  const drawer = screen.getByRole("dialog", { name: "Index the docs" })
  for (let step = 0; step < 4; step++) {
    await user.tab()
    expect(drawer.contains(document.activeElement)).toBe(true)
  }
  await user.click(screen.getByRole("button", { name: "Close task" }))
  await settle()
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("the handle of a bottom drawer has an overridable name", async () => {
  const user = userEvent.setup()
  render(<TaskDrawer side="bottom" />)
  await user.click(screen.getByRole("button", { name: "Open task" }))
  expect(screen.getByRole("button", { name: "Resize" }).dataset.slot).toBe("drawer-handle")
})

test("has no axe violations closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <TaskDrawer side="bottom" />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Open task" }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent can open the drawer and edit its field", async () => {
  render(<TaskDrawer side="right" />)
  await settle()
  const opened = await agent.act({ steps: [{ ref: "Open task", action: "open" }] })
  expect(opened.ok, opened.error?.message).toBe(true)

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).toContain("Task title")

  const result = await agent.act({ steps: [{ ref: "Task title", action: "setValue", args: ["Index the API"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Task title" }).value).toBe("Index the API")
})

test("the drawer's viewport takes the visible part of the page, not UI SDK's innerHeight inset", async () => {
  // iOS 26 Safari: toolbars shorten the visible part while innerHeight stays stale at the full height.
  const viewport = Object.assign(new EventTarget(), {
    width: innerWidth,
    height: innerHeight - 90,
    offsetTop: 0,
    scale: 1,
  })
  vi.stubGlobal("visualViewport", viewport)
  try {
    const user = userEvent.setup()
    render(<TaskDrawer side="bottom" />)
    await user.click(screen.getByRole("button", { name: "Open task" }))
    const drawer = screen.getByRole("dialog", { name: "Index the docs" })
    const box = drawer.parentElement as HTMLElement
    expect(box.dataset.slot).toBe("drawer-viewport")
    expect(box.style.getPropertyValue("--dialog-viewport-bottom")).toBe(`${String(innerHeight - 90)}px`)
    // The rules on the content reach its parent, over the inline inset UI SDK writes.
    expect(drawer.className).toContain(
      "[:has(>&)]:[--keyboard-inset:max(0px,100%-var(--dialog-viewport-bottom,100%))]!",
    )
    expect(drawer.className).toContain(
      "[:has(>&)]:top-[clamp(0px,var(--dialog-viewport-top,0px),100%-var(--dialog-viewport-height,100%))]!",
    )
    expect(drawer.className).toContain("max-h-[calc(min(100%,var(--dialog-viewport-height,100%))-2rem)]")
  } finally {
    vi.unstubAllGlobals()
  }
})
