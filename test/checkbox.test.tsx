import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Checkbox, CheckboxGroup, CheckboxIndicator, type CheckedState } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"

import { axeViolations } from "./axe"

const agent = createAgent()

function ArchivedCheckbox({ onCheckedChange }: { onCheckedChange?: (checked: CheckedState) => void }) {
  return (
    <Field>
      <Checkbox onCheckedChange={onCheckedChange}>
        <CheckboxIndicator />
      </Checkbox>
      <div className="flex flex-col gap-1">
        <FieldLabel>Show archived tasks</FieldLabel>
        <FieldDescription>Includes tasks closed more than 30 days ago.</FieldDescription>
      </div>
    </Field>
  )
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

test("the field label names the checkbox and the description describes it", () => {
  render(<ArchivedCheckbox />)
  const checkbox = screen.getByRole("checkbox", { name: "Show archived tasks" })
  expect(checkbox.getAttribute("aria-checked")).toBe("false")
  expect(document.getElementById(checkbox.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
    "Includes tasks closed more than 30 days ago.",
  )
})

test("a Field holding a checkbox lays out as a row without extra classes", () => {
  render(
    <>
      <ArchivedCheckbox />
      <Field>
        <FieldLabel>Owner</FieldLabel>
      </Field>
    </>,
  )
  const checkbox = screen.getByRole("checkbox", { name: "Show archived tasks" })
  const row = checkbox.parentElement!
  expect(row.dataset.slot).toBe("field")
  expect(row.matches(":has(> [data-slot=checkbox])")).toBe(true)
  expect(row.className).toContain("has-[>[data-slot=checkbox]]:flex-row")
  expect(screen.getByText("Owner").parentElement!.matches(":has(> [data-slot=checkbox])")).toBe(false)
})

test("Space toggles it, the label toggles it, and each change reports why", async () => {
  const user = userEvent.setup()
  const onCheckedChange = vi.fn()
  render(<ArchivedCheckbox onCheckedChange={onCheckedChange} />)
  const checkbox = screen.getByRole("checkbox", { name: "Show archived tasks" })

  await user.tab()
  expect(document.activeElement).toBe(checkbox)
  await user.keyboard(" ")
  expect(checkbox.getAttribute("aria-checked")).toBe("true")
  expect(checkbox.hasAttribute("data-checked")).toBe(true)
  expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: "press" }))

  await user.click(screen.getByText("Show archived tasks"))
  expect(checkbox.getAttribute("aria-checked")).toBe("false")
  expect(onCheckedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "press" }))
})

test("an indeterminate checkbox is mixed and a press checks it", async () => {
  const user = userEvent.setup()
  render(
    <Checkbox aria-label="Select all" defaultChecked="indeterminate">
      <CheckboxIndicator />
    </Checkbox>,
  )
  const checkbox = screen.getByRole("checkbox", { name: "Select all" })
  expect(checkbox.getAttribute("aria-checked")).toBe("mixed")
  expect(checkbox.hasAttribute("data-indeterminate")).toBe(true)
  await user.click(checkbox)
  expect(checkbox.getAttribute("aria-checked")).toBe("true")
})

test("a group keeps one list of checked values", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(
    <CheckboxGroup aria-label="Status" defaultValue={["open"]} onValueChange={onValueChange}>
      {["open", "blocked", "done"].map((status) => (
        <label key={status} className="flex items-center gap-2">
          <Checkbox value={status}>
            <CheckboxIndicator />
          </Checkbox>
          {status}
        </label>
      ))}
    </CheckboxGroup>,
  )
  await user.click(screen.getByRole("checkbox", { name: "done" }))
  expect(onValueChange).toHaveBeenLastCalledWith(["open", "done"], expect.objectContaining({ reason: "item-press" }))
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <ArchivedCheckbox />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent can find the checkbox and check it", async () => {
  const onCheckedChange = vi.fn()
  render(<ArchivedCheckbox onCheckedChange={onCheckedChange} />)
  await settle()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const checkbox = components.find((entry) => entry.component === "checkbox")
  expect(checkbox?.label).toBe("Show archived tasks")
  expect(checkbox?.actions).toContain("setChecked")

  const result = await act(() =>
    agent.act({ steps: [{ ref: "Show archived tasks", action: "setChecked", args: [true] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("checkbox", { name: "Show archived tasks" }).getAttribute("aria-checked")).toBe("true")
  expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ source: "agent" }))
})
