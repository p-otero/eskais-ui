import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox"
import { Form, FormActions, FormField, FormRootError, FormServerError, formMessagesEs } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import { axeViolations } from "./axe"

const agent = createAgent()

const schema = z.object({
  name: z.string().min(3),
  email: z.email(),
  plan: z.enum(["hobby", "pro"]),
  terms: z.literal(true),
  digest: z.boolean(),
})

type Values = z.input<typeof schema>

const defaults: Values = { name: "", email: "", plan: "hobby", terms: false as true, digest: false }

function ProjectForm({
  onSubmit,
  messages,
}: {
  onSubmit: (values: z.output<typeof schema>) => unknown
  messages?: Parameters<typeof Form>[0]["messages"]
}) {
  return (
    <Form schema={schema} defaultValues={defaults} onSubmit={onSubmit} messages={messages} label="New project">
      <FormField name="name" label="Project name" required>
        <Input />
      </FormField>
      <FormField name="email" label="Owner email" description="Gets build failures.">
        <Input type="email" />
      </FormField>
      <FormField name="plan" label="Plan">
        <Select
          items={[
            { value: "hobby", label: "Hobby" },
            { value: "pro", label: "Pro" },
          ]}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hobby">Hobby</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField name="terms" label="I accept the terms">
        <Checkbox>
          <CheckboxIndicator />
        </Checkbox>
      </FormField>
      <FormField name="digest" label="Weekly digest">
        <Switch />
      </FormField>
      <FormRootError />
      <FormActions submitLabel="Create project" />
    </Form>
  )
}

test("shows translated errors and focuses the first invalid field", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<ProjectForm onSubmit={onSubmit} messages={formMessagesEs} />)
  await user.click(screen.getByRole("button", { name: "Create project" }))
  const name = screen.getByRole("textbox", { name: "Project name" })
  await waitFor(() => expect(document.activeElement).toBe(name))
  expect(name.getAttribute("aria-invalid")).toBe("true")
  expect(screen.getAllByText("Este campo es obligatorio.").length).toBeGreaterThan(0)
  expect(onSubmit).not.toHaveBeenCalled()

  await user.type(name, "ab")
  expect(await screen.findByText("Escribe al menos 3 caracteres.")).toBeTruthy()
  const email = screen.getByRole("textbox", { name: "Owner email" })
  expect(email.getAttribute("aria-describedby")).toBeTruthy()
})

test("submits parsed values and maps a server error to its field", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn(async () => {
    throw new FormServerError("Could not create the project.", { email: "That owner is already on another plan." })
  })
  render(<ProjectForm onSubmit={onSubmit} />)
  await user.type(screen.getByRole("textbox", { name: "Project name" }), "Atlas")
  await user.type(screen.getByRole("textbox", { name: "Owner email" }), "ada@example.com")
  await user.click(screen.getByRole("checkbox", { name: "I accept the terms" }))
  await user.click(screen.getByRole("button", { name: "Create project" }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall).toEqual([
    {
      name: "Atlas",
      email: "ada@example.com",
      plan: "hobby",
      terms: true,
      digest: false,
    },
    expect.anything(),
  ])
  const email = screen.getByRole("textbox", { name: "Owner email" })
  await waitFor(() => expect(document.activeElement).toBe(email))
  expect(screen.getByText("That owner is already on another plan.")).toBeTruthy()
  expect(screen.getByRole("alert").textContent).toContain("Could not create the project.")
})

test("an agent fills and submits the form", async () => {
  const onSubmit = vi.fn()
  render(<ProjectForm onSubmit={onSubmit} />)
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const result = await agent.act({
    steps: [
      { ref: "Project name", action: "setValue", args: ["Atlas"] },
      { ref: "Owner email", action: "setValue", args: ["ada@example.com"] },
      { ref: "Plan", action: "setValue", args: ["Pro"] },
      { ref: "I accept the terms", action: "setChecked", args: [true] },
      { ref: "New project", action: "submit" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.calls[0]![0]).toMatchObject({ name: "Atlas", plan: "pro", terms: true })
})

test("has no axe violations with errors shown", async () => {
  const user = userEvent.setup()
  const { container } = render(<ProjectForm onSubmit={() => {}} />)
  await user.click(screen.getByRole("button", { name: "Create project" }))
  await screen.findAllByText("This field is required.")
  expect(await axeViolations(container)).toEqual([])
})
