import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Form, FormActions, FormField, type FormActionsProps } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const agent = createAgent()

const schema = z.object({ name: z.string() })

type BusyProps = Pick<FormActionsProps, "disabled" | "submitDisabled" | "pending">

function NameForm({ onSubmit, ...actions }: BusyProps & { onSubmit: () => unknown }) {
  return (
    <Form schema={schema} defaultValues={{ name: "Ada" }} onSubmit={onSubmit} label="Rename">
      <FormField name="name" label="Name">
        <Input />
      </FormField>
      <FormActions submitLabel="Save" cancel="Cancel" onCancel={() => {}} {...actions} />
    </Form>
  )
}

test("submitDisabled disables only submit, and no submit runs from Enter, code or an agent", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<NameForm onSubmit={onSubmit} submitDisabled />)
  const save = screen.getByRole("button", { name: "Save" })
  expect(save.matches(":disabled") || save.getAttribute("aria-disabled") === "true").toBe(true)
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" }).disabled).toBe(false)
  await user.type(screen.getByRole("textbox", { name: "Name" }), "{Enter}")
  save.closest("form")!.requestSubmit()
  await agent.act({ steps: [{ ref: "Rename", action: "submit" }] })
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(onSubmit).not.toHaveBeenCalled()
})

test("disabled disables submit and cancel for an outside busy state", () => {
  render(<NameForm onSubmit={() => {}} disabled />)
  for (const name of ["Save", "Cancel"]) {
    const button = screen.getByRole("button", { name })
    expect(button.matches(":disabled") || button.getAttribute("aria-disabled") === "true").toBe(true)
  }
})

test("pending forces the pending look and blocks submit", async () => {
  const onSubmit = vi.fn()
  render(<NameForm onSubmit={onSubmit} pending />)
  const save = screen.getByRole("button", { name: "Save" })
  expect(save.getAttribute("aria-busy")).toBe("true")
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" }).disabled).toBe(true)
  save.closest("form")!.requestSubmit()
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(onSubmit).not.toHaveBeenCalled()
})
