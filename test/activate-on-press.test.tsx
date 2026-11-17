import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { createTabsController, Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function Settings({
  activateOnPress,
  onValueChange,
  controller,
}: {
  activateOnPress?: boolean
  onValueChange?: (value: string | null, details: { reason: string }) => void
  controller?: ReturnType<typeof createTabsController>
}) {
  return (
    <Tabs
      defaultValue="account"
      activateOnPress={activateOnPress}
      onValueChange={onValueChange}
      controller={controller}
    >
      <TabsList aria-label="Settings" scrollable={false}>
        <TabsTab value="account">Account</TabsTab>
        <TabsTab value="password">Password</TabsTab>
        <TabsTab value="billing" disabled>
          Billing
        </TabsTab>
      </TabsList>
      <TabsPanel value="account">Profile</TabsPanel>
      <TabsPanel value="password">New password</TabsPanel>
      <TabsPanel value="billing">Invoices</TabsPanel>
    </Tabs>
  )
}

function View({
  activateOnPress,
  onValueChange,
  readOnly,
}: {
  activateOnPress?: boolean
  onValueChange?: (value: string | null, details: { reason: string }) => void
  readOnly?: boolean
}) {
  return (
    <SegmentedControl
      aria-label="View"
      defaultValue="board"
      activateOnPress={activateOnPress}
      onValueChange={onValueChange}
      readOnly={readOnly}
    >
      <SegmentedControlIndicator />
      <SegmentedControlItem value="board">Board</SegmentedControlItem>
      <SegmentedControlItem value="table">Table</SegmentedControlItem>
      <SegmentedControlItem value="timeline" disabled>
        Timeline
      </SegmentedControlItem>
    </SegmentedControl>
  )
}

function Controlled() {
  const [value, setValue] = useState<string | null>("account")
  return (
    <Tabs value={value} onValueChange={(next) => next !== "password" && setValue(next)} activateOnPress>
      <TabsList aria-label="Settings" scrollable={false}>
        <TabsTab value="account">Account</TabsTab>
        <TabsTab value="password">Password</TabsTab>
        <TabsTab value="billing">Billing</TabsTab>
      </TabsList>
    </Tabs>
  )
}

const press = (element: Element, pointerType: string, button = 0) =>
  fireEvent.pointerDown(element, { pointerType, button, buttons: button === 0 ? 1 : 2, isPrimary: true })

const selected = (name: string) => screen.getByRole("tab", { name }).getAttribute("aria-selected") === "true"
const checked = (name: string) => screen.getByRole("radio", { name }).getAttribute("aria-checked") === "true"

test("tabs: with activateOnPress, a mouse press selects before release, and the click after it changes nothing", async () => {
  const onValueChange = vi.fn()
  render(<Settings activateOnPress onValueChange={onValueChange} />)
  const password = screen.getByRole("tab", { name: "Password" })

  press(password, "mouse")
  expect(selected("Password")).toBe(true)
  expect(screen.getByRole("tabpanel", { name: "Password" }).textContent).toBe("New password")
  expect(onValueChange).toHaveBeenCalledTimes(1)
  expect(onValueChange).toHaveBeenLastCalledWith("password", expect.objectContaining({ reason: "item-press" }))

  fireEvent.pointerUp(password, { pointerType: "mouse", button: 0 })
  fireEvent.click(password)
  expect(selected("Password")).toBe(true)
  expect(onValueChange).toHaveBeenCalledTimes(1)
})

test("tabs: a pen selects on press too; touch, other buttons and disabled tabs don't", () => {
  render(<Settings activateOnPress />)
  press(screen.getByRole("tab", { name: "Password" }), "touch")
  expect(selected("Account")).toBe(true)
  press(screen.getByRole("tab", { name: "Password" }), "mouse", 2)
  expect(selected("Account")).toBe(true)
  press(screen.getByRole("tab", { name: "Billing" }), "mouse")
  expect(selected("Account")).toBe(true)
  press(screen.getByRole("tab", { name: "Password" }), "pen")
  expect(selected("Password")).toBe(true)
})

test("tabs: touch still selects on release", async () => {
  const user = userEvent.setup()
  render(<Settings activateOnPress />)
  await user.pointer({ keys: "[TouchA]", target: screen.getByRole("tab", { name: "Password" }) })
  expect(selected("Password")).toBe(true)
})

test("tabs: without activateOnPress, a press without release selects nothing", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Settings onValueChange={onValueChange} />)
  const password = screen.getByRole("tab", { name: "Password" })
  press(password, "mouse")
  expect(selected("Account")).toBe(true)
  await user.pointer({ keys: "[MouseLeft>]", target: password })
  expect(selected("Account")).toBe(true)
  expect(onValueChange).not.toHaveBeenCalled()
  await user.pointer({ keys: "[/MouseLeft]", target: password })
  expect(selected("Password")).toBe(true)
})

test("tabs: a canceled change keeps the selection, and a controlled value decides", () => {
  render(<Controlled />)
  press(screen.getByRole("tab", { name: "Password" }), "mouse")
  expect(selected("Account")).toBe(true)
  press(screen.getByRole("tab", { name: "Billing" }), "mouse")
  expect(selected("Billing")).toBe(true)
})

test("tabs: a caller's controller keeps working with activateOnPress", () => {
  const controller = createTabsController()
  render(<Settings activateOnPress controller={controller} />)
  press(screen.getByRole("tab", { name: "Password" }), "mouse")
  expect(controller.getValue()).toBe("password")
  act(() => void controller.select("account"))
  expect(selected("Account")).toBe(true)
})

test("tabs: keyboard and agents are unchanged with activateOnPress", async () => {
  const user = userEvent.setup()
  render(<Settings activateOnPress />)
  await user.tab()
  await user.keyboard("{ArrowRight}")
  expect(selected("Password")).toBe(true)
  await settle()
  const tablist = agent.snapshot().find((entry) => entry.component === "tabs" && entry.label === "Settings")
  expect(tablist?.actions).toContain("setValue")
  const result = await act(() => agent.act({ steps: [{ ref: "Settings", action: "setValue", args: ["Account"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(selected("Account")).toBe(true)
})

test("segmented control: with activateOnPress, a mouse press checks before release, once", () => {
  const onValueChange = vi.fn()
  render(<View activateOnPress onValueChange={onValueChange} />)
  const table = screen.getByRole("radio", { name: "Table" })
  press(table, "mouse")
  expect(checked("Table")).toBe(true)
  expect(onValueChange).toHaveBeenLastCalledWith("table", expect.objectContaining({ reason: "item-press" }))
  fireEvent.pointerUp(table, { pointerType: "mouse", button: 0 })
  fireEvent.click(table)
  expect(onValueChange).toHaveBeenCalledTimes(1)
})

test("segmented control: touch, disabled items and read-only don't check on press", () => {
  const { unmount } = render(<View activateOnPress />)
  press(screen.getByRole("radio", { name: "Table" }), "touch")
  expect(checked("Board")).toBe(true)
  press(screen.getByRole("radio", { name: "Timeline" }), "mouse")
  expect(checked("Board")).toBe(true)
  unmount()
  render(<View activateOnPress readOnly />)
  press(screen.getByRole("radio", { name: "Table" }), "mouse")
  expect(checked("Board")).toBe(true)
})

test("segmented control: without activateOnPress, a press without release checks nothing", async () => {
  const user = userEvent.setup()
  render(<View />)
  const table = screen.getByRole("radio", { name: "Table" })
  await user.pointer({ keys: "[MouseLeft>]", target: table })
  expect(checked("Board")).toBe(true)
  await user.pointer({ keys: "[/MouseLeft]", target: table })
  expect(checked("Table")).toBe(true)
})

test("segmented control: agents still set the value with activateOnPress", async () => {
  const onValueChange = vi.fn()
  render(<View activateOnPress onValueChange={onValueChange} />)
  await settle()
  const result = await act(() => agent.act({ steps: [{ ref: "View", action: "setValue", args: ["Table"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(checked("Table")).toBe(true)
  expect(onValueChange).toHaveBeenLastCalledWith("table", expect.objectContaining({ source: "agent" }))
})
