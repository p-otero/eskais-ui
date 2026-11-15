import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

import { axeViolations } from "./axe"

const agent = createAgent()

type View = "board" | "table" | "timeline"

function ViewSwitch({ onValueChange }: { onValueChange?: (value: View | null) => void }) {
  return (
    <Field>
      <FieldLabel>View</FieldLabel>
      <SegmentedControl<View> defaultValue="board" onValueChange={onValueChange}>
        <SegmentedControlIndicator />
        <SegmentedControlItem value="board">Board</SegmentedControlItem>
        <SegmentedControlItem value="table">Table</SegmentedControlItem>
        <SegmentedControlItem value="timeline" disabled>
          Timeline
        </SegmentedControlItem>
      </SegmentedControl>
    </Field>
  )
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

test("the field label names the radio group and only the checked item is tabbable", async () => {
  const user = userEvent.setup()
  render(<ViewSwitch />)
  const group = screen.getByRole("radiogroup", { name: "View" })
  expect(group.dataset.orientation).toBe("horizontal")
  const board = screen.getByRole("radio", { name: "Board" })
  expect(board.getAttribute("aria-checked")).toBe("true")
  expect(board.hasAttribute("data-checked")).toBe(true)
  await user.tab()
  expect(document.activeElement).toBe(board)
  await user.tab()
  expect(group.contains(document.activeElement)).toBe(false)
})

test("keyboard: arrows check the next item in both directions and skip disabled ones", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<ViewSwitch onValueChange={onValueChange} />)
  await user.tab()
  await user.keyboard("{ArrowRight}")
  const table = screen.getByRole("radio", { name: "Table" })
  expect(table.getAttribute("aria-checked")).toBe("true")
  expect(document.activeElement).toBe(table)
  expect(onValueChange).toHaveBeenLastCalledWith("table", expect.objectContaining({ reason: "list-navigation" }))

  await user.keyboard("{ArrowRight}")
  expect(screen.getByRole("radio", { name: "Board" }).getAttribute("aria-checked")).toBe("true")
  await user.keyboard("{ArrowLeft}")
  expect(table.getAttribute("aria-checked")).toBe("true")
  expect(screen.getByRole("radio", { name: "Timeline" }).hasAttribute("data-disabled")).toBe(true)
})

test("a click checks an item and reports why", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<ViewSwitch onValueChange={onValueChange} />)
  await user.click(screen.getByRole("radio", { name: "Table" }))
  expect(onValueChange).toHaveBeenLastCalledWith("table", expect.objectContaining({ reason: "item-press" }))
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <ViewSwitch />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent can find the view switch and pick a view by its label", async () => {
  const onValueChange = vi.fn()
  render(<ViewSwitch onValueChange={onValueChange} />)
  await settle()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const control = components.find((entry) => entry.component === "segmented-control")
  expect(control?.label).toBe("View")
  expect(control?.actions).toContain("setValue")

  const result = await act(() => agent.act({ steps: [{ ref: "View", action: "setValue", args: ["Table"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("radio", { name: "Table" }).getAttribute("aria-checked")).toBe("true")
  expect(onValueChange).toHaveBeenLastCalledWith("table", expect.objectContaining({ source: "agent" }))
})
