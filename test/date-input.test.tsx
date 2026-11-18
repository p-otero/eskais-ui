import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { DateInput } from "@/components/ui/date-input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField } from "@/components/ui/form"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function StartField({ onValueChange }: { onValueChange?: (value: string | null) => void }) {
  return (
    <Field>
      <FieldLabel>Start date</FieldLabel>
      <DateInput locale="en-US" min="2026-01-01" onValueChange={onValueChange} />
    </Field>
  )
}

test("typing fills each segment in the locale's order and reports an ISO date", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<StartField onValueChange={onValueChange} />)
  expect(screen.getByRole("group", { name: "Start date" })).toBeTruthy()
  await user.click(screen.getAllByRole("spinbutton")[0]!)
  await user.keyboard("11022026")
  expect(onValueChange).toHaveBeenLastCalledWith("2026-11-02", expect.anything())
})

test("a date before min marks the field invalid", async () => {
  const user = userEvent.setup()
  render(<StartField />)
  await user.click(screen.getAllByRole("spinbutton")[0]!)
  await user.keyboard("01022020")
  expect(document.querySelector("[data-slot=date-input]")?.hasAttribute("data-invalid")).toBe(true)
})

test("FormField binds the ISO value and floats the label", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <Form
      schema={z.object({ start: z.string().nullable() })}
      defaultValues={{ start: "2026-03-04" }}
      onSubmit={onSubmit}
      label="Trip"
    >
      <FormField name="start" label="Start" labelPlacement="in">
        <DateInput locale="en-US" />
      </FormField>
      <FormActions submitLabel="Save" />
    </Form>,
  )
  expect(document.querySelector("[data-slot=field]")?.getAttribute("data-label-placement")).toBe("in")
  await user.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ start: "2026-03-04" }, expect.anything()))
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <StartField />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the date input by its label and sets a date", async () => {
  const onValueChange = vi.fn()
  render(<StartField onValueChange={onValueChange} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const entry = components.find((component) => component.label === "Start date")
  expect(entry?.actions).toEqual(expect.arrayContaining(["setValue"]))
  const result = await act(() =>
    agent.act({ steps: [{ ref: "Start date", action: "setValue", args: ["2026-12-24"] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(onValueChange).toHaveBeenLastCalledWith("2026-12-24", expect.objectContaining({ source: "agent" }))
})
