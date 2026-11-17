import { render, screen, waitFor } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { readFileSync } from "node:fs"
import type { ReactNode } from "react"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox"
import { Combobox, ComboboxControl, ComboboxInput } from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  padsItself,
  type FieldLabelPlacement,
} from "@/components/ui/field"
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

test("a plain Field inside a Form takes the form's placement, unless it sets its own or holds a checkbox", () => {
  render(
    <Form
      label="Ticket"
      labelPlacement="on"
      schema={schema}
      defaultValues={{ email: "", team: null, notes: "", terms: false }}
      onSubmit={() => undefined}
    >
      <Field>
        <FieldLabel>Summary</FieldLabel>
        <Textarea readOnly defaultValue="Read-only text" />
      </Field>
      <Field labelPlacement="top">
        <FieldLabel>Reference</FieldLabel>
        <Input readOnly defaultValue="T-12" />
      </Field>
      <Field>
        <Checkbox>
          <CheckboxIndicator />
        </Checkbox>
        <FieldLabel>Urgent</FieldLabel>
      </Field>
    </Form>,
  )
  expect(placementOf("Summary")).toBe("on")
  expect(placementOf("Reference")).toBe("top")
  expect(placementOf("Urgent")).toBe("top")
})

test("outside a Form a plain Field stays on top", () => {
  render(
    <Field>
      <FieldLabel>Summary</FieldLabel>
      <Textarea />
    </Field>,
  )
  expect(placementOf("Summary")).toBe("top")
})

function OnForm({ children }: { children: ReactNode }) {
  return (
    <Form
      label="Ticket"
      labelPlacement="on"
      schema={schema}
      defaultValues={{ email: "", team: "web", notes: "", terms: false }}
      onSubmit={() => undefined}
    >
      {children}
    </Form>
  )
}

test("a Field laid out as its own box keeps the label on top instead of drawing it over the value", () => {
  render(
    <OnForm>
      <Field className="border p-3">
        <FieldLabel>Team</FieldLabel>
        <Select options={teams} defaultValue="web" />
        <p>Who owns it.</p>
      </Field>
    </OnForm>,
  )
  expect(placementOf("Team")).toBe("top")
})

test("only the floating layout inherits the Form's placement: label, control, then a description or error", () => {
  render(
    <OnForm>
      <Field>
        <FieldLabel>Floats</FieldLabel>
        <Select options={teams} />
        <FieldDescription>Who owns it.</FieldDescription>
        <FieldError match>Pick a team.</FieldError>
      </Field>
      <Field className="p-3">
        <FieldLabel>Padded</FieldLabel>
        <Select options={teams} />
      </Field>
      <Field>
        <FieldLabel>Text after</FieldLabel>
        <Select options={teams} />
        <p>Who owns it.</p>
      </Field>
      <Field>
        <Select options={teams} aria-label="Label after" />
        <FieldLabel>Label after</FieldLabel>
      </Field>
      <Field>
        <FieldLabel>Wrapped</FieldLabel>
        <div>
          <Select options={teams} />
        </div>
      </Field>
      <Field className="p-3" labelPlacement="on">
        <FieldLabel>Own choice</FieldLabel>
        <Select options={teams} />
      </Field>
    </OnForm>,
  )
  expect(placementOf("Floats")).toBe("on")
  for (const name of ["Padded", "Text after", "Label after", "Wrapped"]) expect(placementOf(name), name).toBe("top")
  expect(placementOf("Own choice")).toBe("on")
})

test("a padded FormField keeps its label on top unless it sets a placement", () => {
  render(
    <OnForm>
      <FormField name="email" label="Email" className="px-control-x py-inset-item">
        <Input />
      </FormField>
      <FormField name="notes" label="Notes" className="p-3" labelPlacement="on">
        <Textarea />
      </FormField>
    </OnForm>,
  )
  expect(placementOf("Email")).toBe("top")
  expect(placementOf("Notes")).toBe("on")
})

test("padsItself reads padding utilities in any variant, not other classes", () => {
  for (const className of ["border p-3", "md:px-control-x", "!pt-2", "hover:ps-(--x)", "py-[3px]"])
    expect(padsItself(className), className).toBe(true)
  for (const className of ["p-0 border", "pointer-events-none", "place-items-center", "rounded-surface", undefined])
    expect(padsItself(className), String(className)).toBe(false)
})
