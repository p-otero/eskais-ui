import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { createPasswordInputController } from "@ui-sdk/react/password-input"
import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { z } from "zod"

import { Field, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField, FormRootError } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { StepForm } from "@/components/ui/step-form"
import { ignoreAnnouncer, resetAnnouncer } from "@/lib/test-utils"

import { axeViolations } from "./axe"

const SECRET = "sk-live-4f9a71c2e8d3b6"

const agent = createAgent()

afterEach(() => {
  cleanup()
  resetAnnouncer()
})

const schema = z.object({ name: z.string().min(1), apiKey: z.string().min(12) })

function KeyForm({
  onSubmit,
  show = true,
}: {
  onSubmit: (values: z.output<typeof schema>) => unknown
  show?: boolean
}) {
  return (
    <Form schema={schema} defaultValues={{ name: "", apiKey: "" }} onSubmit={onSubmit} label="Add key">
      <FormField name="name" label="Key name">
        <Input />
      </FormField>
      {show ? (
        <FormField name="apiKey" label="API key">
          <Input sensitive revealable />
        </FormField>
      ) : null}
      <FormRootError />
      <FormActions submitLabel="Save key" />
    </Form>
  )
}

const keyField = () => screen.getByLabelText<HTMLInputElement>(/^API key/)

function leaks(root: Element = document.documentElement) {
  return {
    markup: root.outerHTML.includes(SECRET),
    storage: JSON.stringify({ ...localStorage, ...sessionStorage }).includes(SECRET),
    snapshot: JSON.stringify(agent.snapshot()).includes(SECRET),
  }
}

const noLeaks = { markup: false, storage: false, snapshot: false }

test("a sensitive Input is an uncontrolled password field that opts out of fills and corrections", () => {
  render(
    <Field>
      <FieldLabel>Token</FieldLabel>
      <Input sensitive />
    </Field>,
  )
  const input = screen.getByLabelText<HTMLInputElement>("Token")
  expect(input.type).toBe("password")
  expect(input.getAttribute("autocomplete")).toBe("new-password")
  expect(input.getAttribute("spellcheck")).toBe("false")
  expect(input.getAttribute("autocapitalize")).toBe("off")
  expect(input.getAttribute("autocorrect")).toBe("off")
  expect(input.hasAttribute("data-1p-ignore")).toBe(true)
  expect(input.closest("[data-agent-secret]")).not.toBeNull()
})

test("typing keeps the value out of attributes, storage and the agent snapshot, shown or hidden", async () => {
  const user = userEvent.setup()
  render(
    <Field>
      <FieldLabel>Token</FieldLabel>
      <Input sensitive revealable />
    </Field>,
  )
  const input = screen.getByLabelText<HTMLInputElement>("Token")
  await user.type(input, SECRET)
  expect(input.value).toBe(SECRET)
  expect(leaks()).toEqual(noLeaks)
  await user.click(screen.getByRole("button", { name: "Show" }))
  expect(input.type).toBe("text")
  expect(leaks()).toEqual(noLeaks)
  expect(agent.snapshot().find((entry) => entry.label === "Token")?.value).toBe("[redacted]")
})

function Controlled() {
  const [value, setValue] = useState("")
  return <Input aria-label="Plain" value={value} onValueChange={setValue} />
}

test("a controlled Input does mirror its value into the DOM, which is why sensitive exists", async () => {
  render(<Controlled />)
  fireEvent.input(screen.getByLabelText("Plain"), { target: { value: SECRET } })
  expect(document.body.innerHTML).toContain(SECRET)
})

test("a sensitive Input refuses value and defaultValue", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  expect(() => render(<Input sensitive aria-label="Token" defaultValue={SECRET} />)).toThrow(/uncontrolled/)
  vi.restoreAllMocks()
})

test("an agent can fill a sensitive Input but never read it back", async () => {
  render(
    <Field>
      <FieldLabel>Token</FieldLabel>
      <Input sensitive />
    </Field>,
  )
  const result = await agent.act({ steps: [{ ref: "Token", action: "setValue", args: [SECRET] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByLabelText<HTMLInputElement>("Token").value).toBe(SECRET)
  expect(JSON.stringify(result)).not.toContain(SECRET)
  expect(leaks()).toEqual(noLeaks)
})

test("a controller reads and clears it without putting it anywhere", async () => {
  const controller = createPasswordInputController()
  const user = userEvent.setup()
  render(<Input sensitive aria-label="Token" sensitiveController={controller} />)
  await user.type(screen.getByLabelText("Token"), SECRET)
  expect(controller.getValue()).toBe(SECRET)
  controller.clear()
  expect(screen.getByLabelText<HTMLInputElement>("Token").value).toBe("")
})

test("FormField: submit delivers the secret to onSubmit, then the field and the form's values are empty", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<KeyForm onSubmit={onSubmit} />)
  await user.type(screen.getByLabelText(/^Key name/), "Billing")
  await user.type(keyField(), SECRET)
  expect(leaks()).toEqual(noLeaks)
  await user.click(screen.getByRole("button", { name: "Save key" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Billing", apiKey: SECRET }, expect.anything()))
  await waitFor(() => expect(keyField().value).toBe(""))
  const [, helpers] = onSubmit.mock.calls[0] as [unknown, { form: { getValues: () => unknown } }]
  expect(JSON.stringify(helpers.form.getValues())).not.toContain(SECRET)
  expect(leaks()).toEqual(noLeaks)
})

test("FormField: the schema validates the secret on submit, and a failed submit keeps what's typed but not in the form's values", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<KeyForm onSubmit={onSubmit} />)
  await user.type(screen.getByLabelText(/^Key name/), "Billing")
  await user.type(keyField(), "short")
  await user.click(screen.getByRole("button", { name: "Save key" }))
  await screen.findByText(/at least 12/i, { ignore: ignoreAnnouncer })
  expect(onSubmit).not.toHaveBeenCalled()
  expect(keyField().value).toBe("short")
  expect(keyField().getAttribute("aria-invalid")).toBe("true")
  expect(document.body.innerHTML).not.toContain('value="short"')
  await user.type(keyField(), "-but-longer-now")
  expect(screen.queryByText(/at least 12/i, { ignore: ignoreAnnouncer })).toBeNull()
  await user.click(screen.getByRole("button", { name: "Save key" }))
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({ name: "Billing", apiKey: "short-but-longer-now" }, expect.anything()),
  )
})

test("FormField: a failed onSubmit keeps the typed secret so the person can retry", async () => {
  const user = userEvent.setup()
  render(<KeyForm onSubmit={() => Promise.reject(new Error("The key was rejected."))} />)
  await user.type(screen.getByLabelText(/^Key name/), "Billing")
  await user.type(keyField(), SECRET)
  await user.click(screen.getByRole("button", { name: "Save key" }))
  await screen.findByText("The key was rejected.")
  expect(keyField().value).toBe(SECRET)
  expect(leaks()).toEqual(noLeaks)
})

test("FormField: unmounting the field drops the secret from the form", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  const { rerender } = render(<KeyForm onSubmit={onSubmit} />)
  await user.type(keyField(), SECRET)
  rerender(<KeyForm onSubmit={onSubmit} show={false} />)
  expect(screen.queryByLabelText(/^API key/)).toBeNull()
  rerender(<KeyForm onSubmit={onSubmit} />)
  expect(keyField().value).toBe("")
  expect(leaks()).toEqual(noLeaks)
})

test("FormField: a reset empties it", async () => {
  const user = userEvent.setup()
  render(<KeyForm onSubmit={vi.fn()} />)
  await user.type(keyField(), SECRET)
  fireEvent.reset(keyField().form!)
  await waitFor(() => expect(keyField().value).toBe(""))
})

test("FormField sensitive also binds a PasswordInput without its value", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <Form schema={z.object({ secret: z.string().min(1) })} onSubmit={onSubmit} label="Vault">
      <FormField name="secret" label="Secret" sensitive>
        <PasswordInput />
      </FormField>
      <FormActions submitLabel="Store" />
    </Form>,
  )
  await user.type(screen.getByLabelText(/^Secret/), SECRET)
  expect(leaks()).toEqual(noLeaks)
  await user.click(screen.getByRole("button", { name: "Store" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ secret: SECRET }, expect.anything()))
})

test("an agent fills a sensitive FormField and submits, and no step result holds the secret", async () => {
  const onSubmit = vi.fn()
  render(<KeyForm onSubmit={onSubmit} />)
  const result = await agent.act({
    steps: [
      { ref: "Key name", action: "setValue", args: ["Billing"] },
      { ref: "API key", action: "setValue", args: [SECRET] },
      { ref: "Add key", action: "submit" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Billing", apiKey: SECRET }, expect.anything()))
  expect(JSON.stringify(result)).not.toContain(SECRET)
  expect(leaks()).toEqual(noLeaks)
})

test("StepForm validates a sensitive field on Next without keeping it in the form's values", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <StepForm
      schema={schema}
      defaultValues={{ name: "", apiKey: "" }}
      onSubmit={onSubmit}
      label="Connect"
      steps={[
        {
          id: "key",
          title: "Key",
          render: () => (
            <FormField name="apiKey" label="API key">
              <Input sensitive />
            </FormField>
          ),
        },
        {
          id: "name",
          title: "Name",
          render: () => (
            <FormField name="name" label="Key name">
              <Input />
            </FormField>
          ),
        },
      ]}
    />,
  )
  await user.type(keyField(), "short")
  await user.click(screen.getByRole("button", { name: "Next" }))
  await screen.findByText(/at least 12/i, { ignore: ignoreAnnouncer })
  await user.clear(keyField())
  await user.type(keyField(), SECRET)
  await user.click(screen.getByRole("button", { name: "Next" }))
  await screen.findByLabelText(/^Key name/)
  expect(leaks()).toEqual(noLeaks)
})

test("has no axe violations, empty, filled and shown", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <KeyForm onSubmit={vi.fn()} />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.type(keyField(), SECRET)
  await user.click(screen.getByRole("button", { name: "Show" }))
  expect(await axeViolations(container)).toEqual([])
})
