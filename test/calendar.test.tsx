import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Calendar } from "@/components/ui/calendar"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldLabel } from "@/components/ui/field"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

test("a calendar moves by day, week and month with the keyboard and selects with Enter", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(
    <Calendar
      defaultValue="2026-10-16"
      today="2026-10-16"
      locale="en-US"
      timeZone="UTC"
      onValueChange={onValueChange}
    />,
  )
  await settle()
  expect(screen.getByRole("heading", { name: "October 2026" })).toBeTruthy()
  const selected = screen.getByRole("gridcell", { name: /October 16, 2026/ })
  expect(selected.getAttribute("aria-selected")).toBe("true")
  expect(selected.hasAttribute("data-selected")).toBe(true)

  await user.tab()
  await user.tab()
  await user.tab()
  expect(document.activeElement).toBe(selected)
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement?.getAttribute("aria-label")).toMatch(/October 17, 2026/)
  await user.keyboard("{ArrowDown}")
  expect(document.activeElement?.getAttribute("aria-label")).toMatch(/October 24, 2026/)
  await user.keyboard("{PageDown}")
  expect(screen.getByRole("heading", { name: "November 2026" })).toBeTruthy()
  expect(document.activeElement?.getAttribute("aria-label")).toMatch(/November 24, 2026/)
  await user.keyboard("{Enter}")
  expect(onValueChange).toHaveBeenLastCalledWith("2026-11-24", expect.objectContaining({ reason: "item-press" }))
})

test("a calendar follows its locale and names its month buttons", async () => {
  render(
    <Calendar
      defaultValue="2026-10-16"
      locale="es-ES"
      labels={{ previousMonth: "Mes anterior", nextMonth: "Mes siguiente" }}
    />,
  )
  await settle()
  expect(screen.getByRole("heading", { name: /octubre/i })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Mes anterior" })).toBeTruthy()
  await userEvent.setup().click(screen.getByRole("button", { name: "Mes siguiente" }))
  expect(screen.getByRole("heading", { name: /noviembre/i })).toBeTruthy()
})

test("a range calendar and two months have no axe violations", async () => {
  const { container } = render(
    <Calendar mode="range" months={2} defaultValue={["2026-10-12", "2026-10-15"]} locale="en-US" />,
  )
  await settle()
  expect(screen.getAllByRole("grid")).toHaveLength(2)
  expect(container.querySelectorAll("[data-range-middle]")).toHaveLength(2)
  expect(await axeViolations(container)).toEqual([])
})

test("a date picker opens from its trigger, picks a day with the keyboard and returns focus", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<DatePicker label="Due date" defaultValue="2026-10-16" locale="en-US" onValueChange={onValueChange} />)
  await settle()
  const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Due date" })
  expect(input.value).toBe("10/16/2026")

  const trigger = screen.getByRole("button", { name: /October 16, 2026/ })
  await user.click(trigger)
  await settle()
  expect(screen.getByRole("dialog")).toBeTruthy()
  expect(document.activeElement?.getAttribute("aria-label")).toMatch(/October 16, 2026/)
  await user.keyboard("{ArrowRight}{ArrowRight}{Enter}")
  await settle()
  expect(onValueChange).toHaveBeenLastCalledWith("2026-10-18", expect.objectContaining({ reason: "item-press" }))
  expect(input.value).toBe("10/18/2026")
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /October 18, 2026/ }))
})

test("a typed date commits on Enter, and Clear empties it", async () => {
  const user = userEvent.setup()
  render(<DatePicker label="Start" locale="en-US" clearable labels={{ clear: "Clear start" }} />)
  await settle()
  const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Start" })
  await user.type(input, "3/4/2027{Enter}")
  expect(input.value).toBe("03/04/2027")
  await user.click(screen.getByRole("button", { name: "Clear start" }))
  expect(input.value).toBe("")
})

test("date pickers in a field and in range mode have no axe violations", async () => {
  const { container } = render(
    <>
      <Field>
        <FieldLabel>Ship date</FieldLabel>
        <DatePicker defaultValue="2026-10-16" />
      </Field>
      <DatePicker
        mode="range"
        labels={{ start: "Check in", end: "Check out" }}
        defaultValue={["2026-10-12", "2026-10-15"]}
      />
    </>,
  )
  await settle()
  expect(screen.getByRole("textbox", { name: "Ship date" })).toBeTruthy()
  expect(screen.getByRole("textbox", { name: "Check out" })).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})

test("an agent sets a date picker by value", async () => {
  render(<DatePicker label="Due date" locale="en-US" />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).toContain("Due date")

  const result = await act(() => agent.act({ steps: [{ ref: "Due date", action: "setValue", args: ["2026-12-24"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Due date" }).value).toBe("12/24/2026")
})
