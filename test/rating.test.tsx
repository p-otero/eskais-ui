import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldLabel } from "@/components/ui/field"
import { Rating } from "@/components/ui/rating"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function ReviewField({ onValueChange }: { onValueChange?: (value: number | null) => void }) {
  return (
    <Field>
      <FieldLabel>Your rating</FieldLabel>
      <Rating defaultValue={3} onValueChange={onValueChange} />
    </Field>
  )
}

test("stars are radios in a group the field names, filled up to the score", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<ReviewField onValueChange={onValueChange} />)
  expect(screen.getByRole("radiogroup", { name: "Your rating" })).toBeTruthy()
  const stars = document.querySelectorAll("[data-slot=rating-item]")
  expect(stars).toHaveLength(5)
  expect([...stars].map((star) => star.hasAttribute("data-filled"))).toEqual([true, true, true, false, false])
  expect(stars[0]?.querySelectorAll("svg")).toHaveLength(2)
  await user.click(screen.getAllByRole("radio")[4]!)
  expect(onValueChange).toHaveBeenLastCalledWith(5, expect.objectContaining({ reason: "item-press" }))
  await user.keyboard("{ArrowLeft}")
  expect(onValueChange).toHaveBeenLastCalledWith(4, expect.objectContaining({ reason: "list-navigation" }))
})

test("a read-only average is one image, partly filling the last star", () => {
  render(
    <Rating
      value={4.2}
      readOnly
      size="sm"
      getValueLabel={(value, max) => `Rated ${String(value)} of ${String(max)}`}
    />,
  )
  expect(screen.getByRole("img", { name: "Rated 4.2 of 5" })).toBeTruthy()
  const partial = document.querySelector<HTMLElement>("[data-slot=rating-item][data-partial]")
  expect(partial?.style.getPropertyValue("--rating-fill")).toMatch(/^0\.2/)
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <ReviewField />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

// Workaround: UI SDK 0.1.0-beta.5 keeps aria-hidden radios inside a read-only rating's role="img": nested-interactive.
test.fails("a read-only rating has no axe violations", async () => {
  const { container } = render(
    <main>
      <Rating value={3.5} readOnly getValueLabel={(value) => `${String(value)} stars`} />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the rating by its label and sets a score", async () => {
  const onValueChange = vi.fn()
  render(<ReviewField onValueChange={onValueChange} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const entry = components.find((component) => component.label === "Your rating")
  expect(entry?.actions).toEqual(expect.arrayContaining(["setValue"]))
  const result = await act(() => agent.act({ steps: [{ ref: "Your rating", action: "setValue", args: [2] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(onValueChange).toHaveBeenLastCalledWith(2, expect.objectContaining({ source: "agent" }))
})
