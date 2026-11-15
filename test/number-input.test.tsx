import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldLabel } from "@/components/ui/field"
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from "@/components/ui/number-input"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function SeatsField({ onValueChange }: { onValueChange?: (value: number | null) => void }) {
  return (
    <Field>
      <FieldLabel>Seats</FieldLabel>
      <NumberInput defaultValue={2} min={1} max={10} onValueChange={onValueChange}>
        <NumberInputGroup>
          <NumberInputDecrement />
          <NumberInputControl />
          <NumberInputIncrement />
        </NumberInputGroup>
      </NumberInput>
    </Field>
  )
}

const seats = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Seats" })

test("the field label names the input and the step buttons have overridable names", () => {
  render(
    <>
      <SeatsField />
      <NumberInput defaultValue={1}>
        <NumberInputGroup>
          <NumberInputDecrement aria-label="Menos" />
          <NumberInputControl aria-label="Copias" />
          <NumberInputIncrement aria-label="Más" />
        </NumberInputGroup>
      </NumberInput>
    </>,
  )
  expect(seats().value).toBe("2")
  expect(screen.getByRole("button", { name: "Decrease" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Increase" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Más" })).toBeTruthy()
})

test("arrows step, the buttons step, and min stops it, each with its reason", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<SeatsField onValueChange={onValueChange} />)
  await user.tab()
  expect(document.activeElement).toBe(seats())
  await user.keyboard("{ArrowUp}")
  expect(onValueChange).toHaveBeenLastCalledWith(3, expect.objectContaining({ reason: "step-key" }))
  await user.click(screen.getByRole("button", { name: "Decrease" }))
  expect(onValueChange).toHaveBeenLastCalledWith(2, expect.objectContaining({ reason: "decrement-press" }))
  await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
  expect(seats().value).toBe("1")
  expect(screen.getByRole("button", { name: "Decrease" }).hasAttribute("data-disabled")).toBe(true)
})

test("typed text commits clamped on Enter", async () => {
  const user = userEvent.setup()
  render(<SeatsField />)
  await user.clear(seats())
  await user.type(seats(), "42{Enter}")
  expect(seats().value).toBe("10")
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <SeatsField />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the number input and sets it", async () => {
  const onValueChange = vi.fn()
  render(<SeatsField onValueChange={onValueChange} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const entry = components.find((component) => component.label === "Seats")
  expect(entry?.actions).toEqual(expect.arrayContaining(["setValue", "increment", "decrement"]))

  const result = await act(() => agent.act({ steps: [{ ref: "Seats", action: "setValue", args: [5] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(seats().value).toBe("5")
  expect(onValueChange).toHaveBeenLastCalledWith(5, expect.objectContaining({ source: "agent" }))
})
