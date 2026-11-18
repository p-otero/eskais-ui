import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Field, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField } from "@/components/ui/form"
import { PasswordInput, PasswordInputControl, PasswordInputToggle } from "@/components/ui/password-input"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function PasswordField({ onValueChange }: { onValueChange?: (value: string) => void }) {
  return (
    <Field>
      <FieldLabel>Password</FieldLabel>
      <PasswordInput autoComplete="current-password" onValueChange={onValueChange} />
    </Field>
  )
}

const password = () => screen.getByLabelText<HTMLInputElement>(/^Password/, { selector: "input" })

test("the toggle shows and hides the password and keeps its name", async () => {
  const user = userEvent.setup()
  render(<PasswordField />)
  await user.type(password(), "hunter2")
  expect(password().type).toBe("password")
  const toggle = screen.getByRole("button", { name: "Show password" })
  expect(toggle.getAttribute("aria-pressed")).toBe("false")
  await user.click(toggle)
  expect(password().type).toBe("text")
  expect(toggle.getAttribute("aria-pressed")).toBe("true")
  expect(screen.getByRole("button", { name: "Show password" })).toBe(toggle)
  expect(document.activeElement).toBe(password())
})

test("the toggle's name is overridable, and composed parts take a placeholder", () => {
  render(
    <PasswordInput>
      <PasswordInputControl aria-label="Contraseña" placeholder="••••" />
      <PasswordInputToggle aria-label="Mostrar contraseña" />
    </PasswordInput>,
  )
  expect(screen.getByRole("button", { name: "Mostrar contraseña" })).toBeTruthy()
  expect(screen.getByLabelText<HTMLInputElement>("Contraseña").placeholder).toBe("••••")
})

test("FormField binds the value and floats the label", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <Form
      schema={z.object({ password: z.string().min(8) })}
      defaultValues={{ password: "" }}
      onSubmit={onSubmit}
      label="Sign in"
    >
      <FormField name="password" label="Password" labelPlacement="in">
        <PasswordInput autoComplete="new-password" />
      </FormField>
      <FormActions submitLabel="Sign in" />
    </Form>,
  )
  expect(document.querySelector("[data-slot=field]")?.getAttribute("data-label-placement")).toBe("in")
  await user.type(password(), "correct horse")
  await user.click(screen.getByRole("button", { name: "Sign in" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ password: "correct horse" }, expect.anything()))
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <PasswordField />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the password field by its label and shows it", async () => {
  render(<PasswordField />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const entry = components.find((component) => component.label === "Password")
  expect(entry?.actions).toEqual(expect.arrayContaining(["setValue", "toggleVisible"]))
  const result = await act(() => agent.act({ steps: [{ ref: "Password", action: "toggleVisible" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(password().type).toBe("text")
})
