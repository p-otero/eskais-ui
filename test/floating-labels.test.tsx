import { render, screen, waitFor } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { readFileSync } from "node:fs"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox"
import { Combobox, ComboboxControl, ComboboxInput } from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldError, FieldLabel, type FieldLabelPlacement } from "@/components/ui/field"
import { Form, FormField } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { NumberInput, NumberInputControl, NumberInputGroup } from "@/components/ui/number-input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { axeViolations } from "./axe"

const agent = createAgent()
const teams = [
  { value: "web", label: "Web" },
  { value: "data", label: "Data" },
]

function Fields({ placement }: { placement: FieldLabelPlacement }) {
  return (
    <form aria-label="Profile">
      <Field labelPlacement={placement}>
        <FieldLabel>Full name</FieldLabel>
        <Input placeholder="Ada Lovelace" />
      </Field>
      <Field labelPlacement={placement} invalid>
        <FieldLabel>Company</FieldLabel>
        <Input defaultValue="A" />
        <FieldError>Too short.</FieldError>
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Team</FieldLabel>
        <Select options={teams} />
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Country</FieldLabel>
        <NativeSelect options={teams} placeholder="Choose" />
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Seats</FieldLabel>
        <NumberInput>
          <NumberInputGroup>
            <NumberInputControl />
          </NumberInputGroup>
        </NumberInput>
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Start date</FieldLabel>
        <DatePicker hint={false} />
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Owner</FieldLabel>
        <Combobox items={teams}>
          <ComboboxControl>
            <ComboboxInput />
          </ComboboxControl>
        </Combobox>
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Notes</FieldLabel>
        <Textarea />
      </Field>
    </form>
  )
}

test.each(["in", "on"] as const)("labelPlacement=%s keeps a real label that names every control", async (placement) => {
  const { container } = render(<Fields placement={placement} />)
  for (const field of container.querySelectorAll('[data-slot="field"][data-label-placement]'))
    expect(field.getAttribute("data-label-placement")).toBe(placement)
  for (const label of container.querySelectorAll('[data-slot="field-label"]')) expect(label.tagName).toBe("LABEL")
  expect(screen.getByRole("textbox", { name: "Full name" })).toBeTruthy()
  expect(screen.getByRole("textbox", { name: "Company" }).getAttribute("aria-invalid")).toBe("true")
  expect(screen.getByRole("combobox", { name: "Team" })).toBeTruthy()
  expect(screen.getByRole("combobox", { name: "Country" })).toBeTruthy()
  expect(screen.getByRole("textbox", { name: "Seats" })).toBeTruthy()
  expect(screen.getByRole("textbox", { name: "Start date" })).toBeTruthy()
  expect(screen.getByRole("combobox", { name: "Owner" })).toBeTruthy()
  expect(screen.getByRole("textbox", { name: "Notes" })).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])

  const labels = agent.snapshot().map((entry) => entry.label)
  for (const label of ["Full name", "Company", "Team", "Country", "Seats", "Start date", "Owner", "Notes"])
    expect(labels, `${label} is missing for agents`).toContain(label)
})

test("labelPlacement=in gives inputs a blank placeholder to float on, and keeps one you pass", () => {
  render(<Fields placement="in" />)
  expect(screen.getByRole("textbox", { name: "Seats" }).getAttribute("placeholder")).toBe(" ")
  expect(screen.getByRole("textbox", { name: "Start date" }).getAttribute("placeholder")).toBe(" ")
  expect(screen.getByRole("combobox", { name: "Owner" }).getAttribute("placeholder")).toBe(" ")
  expect(screen.getByRole("textbox", { name: "Full name" }).getAttribute("placeholder")).toBe("Ada Lovelace")
})

test("top and on placements add no placeholder", () => {
  const { unmount } = render(<Fields placement="on" />)
  expect(screen.getByRole("textbox", { name: "Seats" }).hasAttribute("placeholder")).toBe(false)
  unmount()
  render(<Fields placement="top" />)
  expect(screen.getByRole("textbox", { name: "Seats" }).hasAttribute("placeholder")).toBe(false)
})

const schema = z.object({ email: z.email(), team: z.string().nullable(), notes: z.string(), terms: z.boolean() })

function InviteForm({ onSubmit }: { onSubmit: (values: z.output<typeof schema>) => void }) {
  return (
    <Form
      label="Invite"
      labelPlacement="in"
      schema={schema}
      defaultValues={{ email: "", team: null, notes: "", terms: false }}
      onSubmit={onSubmit}
    >
      <FormField name="email" label="Email" required>
        <Input type="email" />
      </FormField>
      <FormField name="team" label="Team">
        <Select options={teams} />
      </FormField>
      <FormField name="notes" label="Notes" labelPlacement="on">
        <Textarea />
      </FormField>
      <FormField name="terms" label="I agree">
        <Checkbox>
          <CheckboxIndicator />
        </Checkbox>
      </FormField>
    </Form>
  )
}

const placementOf = (name: string) =>
  screen.getByText(name, { selector: "label" }).closest('[data-slot="field"]')?.getAttribute("data-label-placement")

test("Form's labelPlacement reaches text controls; a field's own wins, and a checkbox keeps its label on top", () => {
  render(<InviteForm onSubmit={() => undefined} />)
  expect(placementOf("Email")).toBe("in")
  expect(placementOf("Team")).toBe("in")
  expect(placementOf("Notes")).toBe("on")
  expect(placementOf("I agree")).toBe("top")
})

test("agents fill a floating-label form by its labels, and errors mark the label invalid", async () => {
  const onSubmit = vi.fn()
  render(<InviteForm onSubmit={onSubmit} />)
  const invalid = await agent.act({ steps: [{ ref: "Invite", action: "submit" }] })
  expect(invalid.ok, invalid.error?.message).toBe(true)
  await waitFor(() => expect(screen.getByText("Email", { selector: "label" }).hasAttribute("data-invalid")).toBe(true))

  const result = await agent.act({
    steps: [
      { ref: "Email", action: "setValue", args: ["ada@example.dev"] },
      { ref: "Team", action: "setValue", args: ["Data"] },
      { ref: "Notes", action: "setValue", args: ["Welcome"] },
      { ref: "Invite", action: "submit" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.calls[0]![0]).toEqual({ email: "ada@example.dev", team: "data", notes: "Welcome", terms: false })
})

test("the floating label states live in the theme's field-floated variant and respect the field's own state", () => {
  const theme = readFileSync("registry/styles/theme.css", "utf8")
  expect(theme).toContain("@custom-variant field-floated")
  for (const condition of [
    ":focus-within > &",
    ":has([data-filled], [data-open]) > &",
    ":has(input[placeholder]:not(:placeholder-shown)) > &",
    ':has([data-slot="select-trigger"]:not([data-placeholder])) > &',
    ':has(option:checked:not([value=""])) > &',
  ])
    expect(theme).toContain(condition)
})
