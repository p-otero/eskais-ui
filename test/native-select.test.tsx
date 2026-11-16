import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { Field, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField } from "@/components/ui/form"
import { NativeSelect, type NativeSelectOptionList } from "@/components/ui/native-select"
import { nativeSelect } from "@/components/ui/native-select-primitive"

import { axeViolations } from "./axe"

const agent = createAgent()

const countries: NativeSelectOptionList = [
  {
    label: "Europe",
    options: [
      { value: "es", label: "Spain" },
      { value: "pt", label: "Portugal" },
    ],
  },
  { value: "mx", label: "Mexico" },
  { value: "aq", label: "Antarctica", disabled: true },
]

test("primitive: renders on the server", () => {
  checkServer(nativeSelect, { items: [{ value: "es", label: "Spain" }] }, `<root aria-label="Country"></root>`)
})

test("a Field label names it; the placeholder shows until a choice", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  const { container } = render(
    <Field>
      <FieldLabel>Country</FieldLabel>
      <NativeSelect options={countries} placeholder="Choose a country" onValueChange={onValueChange} />
    </Field>,
  )
  const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Country" })
  expect(select.value).toBe("")
  expect(screen.getByRole("group", { name: "Europe" })).toBeTruthy()
  await user.selectOptions(select, "pt")
  expect(onValueChange).toHaveBeenLastCalledWith("pt", expect.objectContaining({ reason: "input-change" }))
  expect(select.value).toBe("pt")
  expect(await axeViolations(container)).toEqual([])
})

function Controlled() {
  const [value, setValue] = useState<string | null>("es")
  return (
    <NativeSelect
      aria-label="Country"
      options={countries}
      clearable="No country"
      value={value}
      onValueChange={(next) => {
        if (next !== "mx") setValue(next)
      }}
    />
  )
}

test("controlled: a refused change keeps the old value, clearable sets null", async () => {
  const user = userEvent.setup()
  render(<Controlled />)
  const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Country" })
  await user.selectOptions(select, "mx")
  await waitFor(() => expect(select.value).toBe("es"))
  await user.selectOptions(select, "")
  await waitFor(() => expect(select.value).toBe(""))
})

test("agents see it and set it by label; it binds inside a FormField", async () => {
  const onSubmit = vi.fn()
  render(
    <Form schema={z.object({ country: z.string() })} defaultValues={{ country: "es" }} onSubmit={onSubmit} label="Ship">
      <FormField name="country" label="Ship to">
        <NativeSelect options={countries} />
      </FormField>
      <FormActions submitLabel="Ship order" />
    </Form>,
  )
  const entry = agent.snapshot().find((item) => item.label === "Ship to")
  expect(entry?.component).toBe("native-select")
  expect(entry?.actions).toContain("setValue")
  const refused = await agent.act({ steps: [{ ref: "Ship to", action: "setValue", args: ["Atlantis"] }] })
  expect(refused.ok).toBe(false)
  const result = await agent.act({
    steps: [
      { ref: "Ship to", action: "setValue", args: ["Mexico"] },
      { ref: "Ship", action: "submit" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall?.[0]).toEqual({ country: "mx" })
  expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Ship to" }).value).toBe("mx")
})
