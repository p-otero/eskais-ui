import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Field, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField, formMessagesEs } from "@/components/ui/form"

import { axeViolations } from "./axe"

const agent = createAgent()

test("the date takes the field's label, the time its own, and the zone describes the time", async () => {
  const { container } = render(
    <Field>
      <FieldLabel>Departure</FieldLabel>
      <DateTimePicker
        defaultValue="2026-11-02T14:30"
        locale="en-US"
        timeZone="UTC"
        labels={{ time: "Departure time" }}
      />
    </Field>,
  )
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Departure" }).value).toBe("11/02/2026")
  const time = screen.getByRole("group", { name: "Departure time" })
  expect(time.getAttribute("aria-describedby")).toBeTruthy()
  expect(document.getElementById(time.getAttribute("aria-describedby")!)?.textContent).toBe("UTC")
  expect(screen.getByRole("spinbutton", { name: "hour" }).getAttribute("aria-valuetext")).toBe("02")
  expect(new Set([...container.querySelectorAll("[id]")].map((el) => el.id)).size).toBe(
    container.querySelectorAll("[id]").length,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("follows the locale: a 24-hour clock and day-first dates in Spanish", () => {
  render(
    <DateTimePicker
      label="Salida"
      labels={{ time: "Hora de salida" }}
      defaultValue="2026-11-02T14:30"
      locale="es-ES"
    />,
  )
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Salida" }).value).toBe("02/11/2026")
  expect(screen.getByRole("spinbutton", { name: /hora/i }).getAttribute("aria-valuetext")).toBe("14")
})

function Controlled({ onValueChange }: { onValueChange: (value: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null)
  return (
    <>
      <DateTimePicker
        label="Starts"
        labels={{ time: "Start time" }}
        locale="en-US"
        hourCycle={24}
        value={value}
        min="2026-11-02T09:00"
        onValueChange={(next) => {
          onValueChange(next)
          setValue(next)
        }}
      />
      <output aria-label="Chosen">{value ?? "none"}</output>
    </>
  )
}

test("reports a value once both parts are set, by keyboard", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Controlled onValueChange={onValueChange} />)
  await user.type(screen.getByRole("textbox", { name: "Starts" }), "11/03/2026{Enter}")
  expect(onValueChange).not.toHaveBeenCalled()
  await user.click(screen.getByRole("spinbutton", { name: /hour/i }))
  await user.keyboard("1030")
  await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith("2026-11-03T10:30"))
  expect(screen.getByRole("status", { name: "Chosen" }).textContent).toBe("2026-11-03T10:30")
})

test("an agent sets the date and the time; it binds inside a FormField", async () => {
  const onSubmit = vi.fn()
  const schema = z.object({
    departure: z
      .string()
      .nullable()
      .refine((value) => value !== null),
  })
  render(
    <Form
      schema={schema}
      defaultValues={{ departure: null }}
      onSubmit={onSubmit}
      messages={formMessagesEs}
      label="Trip"
    >
      <FormField name="departure" label="Departure">
        <DateTimePicker locale="en-US" />
      </FormField>
      <FormActions submitLabel="Book" />
    </Form>,
  )
  screen.getByRole("button", { name: "Book" }).click()
  expect(await screen.findByText("Este campo es obligatorio.")).toBeTruthy()

  const result = await agent.act({
    steps: [
      { ref: "Departure", action: "setValue", args: ["2026-12-24"] },
      { ref: "Time", action: "setValue", args: ["18:45"] },
      { ref: "Trip", action: "submit" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.lastCall?.[0]).toEqual({ departure: "2026-12-24T18:45" })
})
