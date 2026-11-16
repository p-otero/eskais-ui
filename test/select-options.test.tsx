import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Field, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField } from "@/components/ui/form"
import { Select, type SelectOptions } from "@/components/ui/select"

import { axeViolations } from "./axe"

const agent = createAgent()

const teams: SelectOptions = [
  {
    label: "Product",
    options: [
      { value: "web", label: "Web", description: "Site and dashboard" },
      { value: "mobile", label: "Mobile" },
    ],
  },
  { label: "Platform", options: [{ value: "infra", label: "Infrastructure", disabled: true }] },
]

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

test("renders the trigger and grouped options from data", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <Field>
      <FieldLabel>Team</FieldLabel>
      <Select options={teams} placeholder="Choose a team" />
    </Field>,
  )
  const trigger = screen.getByRole("combobox", { name: "Team" })
  expect(trigger.textContent).toContain("Choose a team")
  await user.click(trigger)
  await settle()
  expect(screen.getByRole("group", { name: "Product" })).toBeTruthy()
  expect(screen.getByRole("option", { name: /Web/ }).textContent).toContain("Site and dashboard")
  expect(screen.getByRole("option", { name: "Infrastructure" }).getAttribute("aria-disabled")).toBe("true")
  await user.click(screen.getByRole("option", { name: /Mobile/ }))
  expect(trigger.textContent).toContain("Mobile")
  expect(await axeViolations(container)).toEqual([])
})

test("clearable adds a none choice that sets null", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  function Controlled() {
    const [value, setValue] = useState<string | null>("web")
    return (
      <Select
        aria-label="Team"
        options={teams}
        placeholder="No team"
        clearable="No team"
        value={value}
        onValueChange={(next) => {
          onValueChange(next)
          setValue(next)
        }}
      />
    )
  }
  render(<Controlled />)
  const trigger = screen.getByRole("combobox", { name: "Team" })
  expect(trigger.textContent).toContain("Web")
  await user.click(trigger)
  await settle()
  await user.click(screen.getByRole("option", { name: "No team" }))
  expect(onValueChange).toHaveBeenLastCalledWith(null)
  expect(trigger.textContent).toContain("No team")
})

test("uncontrolled clearable, agents choose by label, and it binds inside a FormField", async () => {
  const onSubmit = vi.fn()
  const schema = z.object({ team: z.string().nullable() })
  render(
    <Form schema={schema} defaultValues={{ team: "web" }} onSubmit={onSubmit} label="Assign">
      <FormField name="team" label="Owning team">
        <Select options={teams} clearable="Unassigned" />
      </FormField>
      <FormActions submitLabel="Assign" />
    </Form>,
  )
  const result = await agent.act({
    steps: [
      { ref: "Owning team", action: "setValue", args: ["Mobile"] },
      { ref: "Owning team", action: "setValue", args: ["Unassigned"] },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("combobox", { name: "Owning team" }).textContent).not.toContain("Mobile")
  screen.getByRole("button", { name: "Assign" }).click()
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall?.[0]).toEqual({ team: null })
})

test("triggerProps and size reach the trigger when rendering from options", () => {
  render(
    <Field>
      <FieldLabel>Team</FieldLabel>
      <Select
        options={teams}
        placeholder="Choose a team"
        size="sm"
        triggerProps={{ id: "team-trigger", className: "w-48", "data-testid": "team" }}
      />
    </Field>,
  )
  const trigger = screen.getByRole("combobox", { name: "Team" })
  expect(trigger.id).toBe("team-trigger")
  expect(trigger.getAttribute("data-testid")).toBe("team")
  expect(trigger.getAttribute("data-size")).toBe("sm")
  expect(trigger.className).toContain("w-48")
  expect(trigger.className).toContain("h-control-sm")
  expect(trigger.className).not.toContain("w-full")
})

test("triggerProps.size wins over size; default size keeps the field height", () => {
  render(
    <>
      <Select options={teams} aria-label="First" size="sm" triggerProps={{ size: "default" }} />
      <Select options={teams} aria-label="Second" />
    </>,
  )
  for (const name of ["First", "Second"]) {
    const trigger = screen.getByRole("combobox", { name })
    expect(trigger.getAttribute("data-size")).toBe("default")
    expect(trigger.className).toContain("h-field-control")
  }
})
