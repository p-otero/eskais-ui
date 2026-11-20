import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { InlineEdit } from "@/components/ui/inline-edit"
import { inlineEdit } from "@/components/ui/inline-edit-primitive"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

// The field is a framework part; mount's markup holds the text and the edit button.
const markup = `<root aria-label="Name"><display>Apollo</display><trigger aria-label="Rename"></trigger></root>`

test("primitive: Enter or F2 on the text and a press of the edit button start editing", async () => {
  const view = mount(inlineEdit, { defaultValue: "Apollo", startOn: "double-click" }, markup)
  try {
    await view.click(view.part("display")!)
    expect(view.state.editing).toBeNull()
    await view.keys("F2")
    expect(view.state.editing).not.toBeNull()
    view.api.cancel()
    await view.settle()
    await view.click(view.part("trigger")!)
    expect(view.state.editing).not.toBeNull()
  } finally {
    view.unmount()
  }
})

test("primitive: rename and cancel work without the field", () => {
  const view = mount(inlineEdit, { defaultValue: "Apollo", validate: (text) => text.trim() !== "" }, markup)
  try {
    expect(() => view.api.rename("  ")).toThrow("rename was refused by the app.")
    expect(view.state.value).toBe("Apollo")
    expect(view.api.rename("Hermes")).toBe(true)
    expect(view.state.value).toBe("Hermes")
    expect(() => view.api.cancel()).toThrow("cancel isn't available while not editing.")
    view.api.start()
    expect(view.api.cancel()).toBe(true)
    expect(view.state.editing).toBeNull()
  } finally {
    view.unmount()
  }
})

test("primitive: renders on the server", () => {
  checkServer(inlineEdit, { defaultValue: "Apollo" }, markup)
})

function ProjectName({ onValueChange, blur }: { onValueChange?: (value: string) => void; blur?: "commit" | "cancel" }) {
  return (
    <InlineEdit
      label="Project name"
      defaultValue="Apollo"
      blur={blur}
      validate={(text) => text.trim() !== ""}
      onValueChange={onValueChange}
    />
  )
}

test("a press opens the field with the text, Enter saves and focus returns to the text", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<ProjectName onValueChange={onValueChange} />)
  expect(screen.getByRole("group", { name: "Project name" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Apollo" }))
  const field = screen.getByRole<HTMLInputElement>("textbox", { name: "Project name" })
  expect(field.value).toBe("Apollo")
  expect(document.activeElement).toBe(field)
  await user.clear(field)
  await user.type(field, "Hermes{Enter}")
  expect(onValueChange).toHaveBeenLastCalledWith("Hermes", expect.objectContaining({ reason: "enter-key" }))
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Hermes" }))
})

test("Escape puts the text back, and an empty name keeps editing", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<ProjectName onValueChange={onValueChange} />)
  await user.click(screen.getByRole("button", { name: "Apollo" }))
  await user.keyboard("{Control>}a{/Control}Draft{Escape}")
  expect(screen.getByRole("button", { name: "Apollo" })).toBe(document.activeElement)
  await user.keyboard("{F2}")
  await user.keyboard("{Control>}a{/Control}{Backspace}{Enter}")
  expect(screen.getByRole("textbox", { name: "Project name" })).toBeTruthy()
  expect(onValueChange).not.toHaveBeenCalled()
})

test("leaving the field saves, or cancels with blur=cancel", async () => {
  const user = userEvent.setup()
  const saved = vi.fn()
  const { unmount } = render(<ProjectName onValueChange={saved} />)
  await user.click(screen.getByRole("button", { name: "Apollo" }))
  await user.keyboard("{Control>}a{/Control}Hermes")
  await user.click(document.body)
  expect(saved).toHaveBeenLastCalledWith("Hermes", expect.objectContaining({ reason: "focus-out" }))
  unmount()

  const canceled = vi.fn()
  render(<ProjectName onValueChange={canceled} blur="cancel" />)
  await user.click(screen.getByRole("button", { name: "Apollo" }))
  await user.keyboard("{Control>}a{/Control}Hermes")
  await user.click(document.body)
  expect(canceled).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Apollo" })).toBeTruthy()
})

test("the edit button has an overridable name and starts editing", async () => {
  const user = userEvent.setup()
  render(<InlineEdit label="Tab title" defaultValue="Notes" labels={{ edit: (label) => `Renombrar ${label}` }} />)
  await user.click(screen.getByRole("button", { name: "Renombrar Tab title" }))
  expect(screen.getByRole("textbox", { name: "Tab title" })).toBeTruthy()
})

test("no axe violations, showing or editing", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <ProjectName />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Apollo" }))
  expect(await axeViolations(container)).toEqual([])
})

test("an agent renames by the field's label, and the change says it came from the agent", async () => {
  const onValueChange = vi.fn()
  render(<ProjectName onValueChange={onValueChange} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const entry = components.find((component) => component.component === "inline-edit")
  expect(entry?.label).toBe("Project name")
  expect(entry?.actions).toEqual(expect.arrayContaining(["rename", "cancel"]))
  const result = await act(() => agent.act({ steps: [{ ref: "Project name", action: "rename", args: ["Hermes"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(onValueChange).toHaveBeenLastCalledWith("Hermes", expect.objectContaining({ source: "agent" }))
  expect(screen.getByRole("button", { name: "Hermes" })).toBeTruthy()
})
