import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

import { axeViolations } from "./axe"

const agent = createAgent()

function NotesField({ onValueChange, invalid }: { onValueChange?: (value: string) => void; invalid?: boolean }) {
  return (
    <Field invalid={invalid}>
      <FieldLabel>Task notes</FieldLabel>
      <Textarea placeholder="What should the agent know?" onValueChange={onValueChange} />
      <FieldDescription>Shown on the task card.</FieldDescription>
      <FieldError match>Write at least one line.</FieldError>
    </Field>
  )
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

test("the field label names the textarea and the description describes it", () => {
  render(<NotesField />)
  const textarea = screen.getByRole("textbox", { name: "Task notes" })
  expect(textarea.tagName).toBe("TEXTAREA")
  expect(textarea.dataset.slot).toBe("textarea")
  expect(document.getElementById(textarea.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
    "Shown on the task card.",
  )
  expect(textarea.hasAttribute("aria-invalid")).toBe(false)
})

test("typing reports each change and Enter starts a new line", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<NotesField onValueChange={onValueChange} />)
  const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Task notes" })
  await user.click(textarea)
  await user.keyboard("one{Enter}two")
  expect(textarea.value).toBe("one\ntwo")
  expect(textarea.hasAttribute("data-filled")).toBe(true)
  expect(onValueChange).toHaveBeenLastCalledWith("one\ntwo", expect.objectContaining({ reason: "input-change" }))
})

test("an invalid field marks the textarea", () => {
  render(<NotesField invalid />)
  expect(screen.getByRole("textbox", { name: "Task notes" }).getAttribute("aria-invalid")).toBe("true")
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <NotesField />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent can find the textarea and fill it", async () => {
  const onValueChange = vi.fn()
  render(<NotesField onValueChange={onValueChange} />)
  await settle()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.find((entry) => entry.component === "textarea")?.label).toBe("Task notes")

  const result = await act(() =>
    agent.act({ steps: [{ ref: "Task notes", action: "setValue", args: ["Ship the board view"] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Task notes" }).value).toBe("Ship the board view")
  expect(onValueChange).toHaveBeenLastCalledWith("Ship the board view", expect.objectContaining({ source: "agent" }))
})
