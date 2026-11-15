import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldLabel } from "@/components/ui/field"
import { Toggle, ToggleIcon } from "@/components/ui/toggle"
import { ToggleGroup } from "@/components/ui/toggle-group"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function Formatting({ onValueChange }: { onValueChange?: (value: string[]) => void }) {
  return (
    <Field>
      <FieldLabel>Text formatting</FieldLabel>
      <ToggleGroup multiple defaultValue={["bold"]} onValueChange={onValueChange}>
        <Toggle value="bold">Bold</Toggle>
        <Toggle value="italic">Italic</Toggle>
        <Toggle value="underline" disabled>
          Underline
        </Toggle>
      </ToggleGroup>
    </Field>
  )
}

test("a toggle keeps its name, reports aria-pressed and data-pressed, and Enter presses it", async () => {
  const user = userEvent.setup()
  const onPressedChange = vi.fn()
  render(
    <Toggle variant="outline" aria-label="Pin" onPressedChange={onPressedChange}>
      <ToggleIcon>
        <svg viewBox="0 0 24 24" />
      </ToggleIcon>
    </Toggle>,
  )
  const pin = screen.getByRole("button", { name: "Pin" })
  expect(pin.getAttribute("aria-pressed")).toBe("false")
  expect(pin.dataset.variant).toBe("outline")
  await user.tab()
  await user.keyboard("{Enter}")
  expect(pin.getAttribute("aria-pressed")).toBe("true")
  expect(pin.hasAttribute("data-pressed")).toBe(true)
  expect(onPressedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: "press" }))
})

test("the field label names the group; arrows move focus and Space presses", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<Formatting onValueChange={onValueChange} />)
  expect(screen.getByRole("group", { name: "Text formatting" }).dataset.slot).toBe("toggle-group")
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Bold" }))
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Italic" }))
  expect(onValueChange).not.toHaveBeenCalled()
  await user.keyboard(" ")
  expect(onValueChange).toHaveBeenLastCalledWith(["bold", "italic"], expect.objectContaining({ reason: "item-press" }))

  await user.click(screen.getByRole("button", { name: "Underline" }))
  expect(screen.getByRole("button", { name: "Underline" }).getAttribute("aria-pressed")).toBe("false")
})

test("a single-choice group with deselectable false keeps one pressed", async () => {
  const user = userEvent.setup()
  render(
    <ToggleGroup aria-label="Alignment" defaultValue={["start"]} deselectable={false}>
      <Toggle value="start">Start</Toggle>
      <Toggle value="end">End</Toggle>
    </ToggleGroup>,
  )
  await user.click(screen.getByRole("button", { name: "End" }))
  expect(screen.getByRole("button", { name: "Start" }).getAttribute("aria-pressed")).toBe("false")
  await user.click(screen.getByRole("button", { name: "End" }))
  expect(screen.getByRole("button", { name: "End" }).getAttribute("aria-pressed")).toBe("true")
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <Formatting />
      <Toggle>Pin</Toggle>
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the group and a lone toggle by name and changes both", async () => {
  const onValueChange = vi.fn()
  render(
    <>
      <Formatting onValueChange={onValueChange} />
      <Toggle>Pin message</Toggle>
    </>,
  )
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const labels = components.map((entry) => entry.label)
  for (const label of ["Text formatting", "Pin message"]) expect(labels).toContain(label)

  const result = await act(() =>
    agent.act({
      steps: [
        { ref: "Text formatting", action: "setValue", args: [["italic"]] },
        { ref: "Pin message", action: "setPressed", args: [true] },
      ],
    }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(onValueChange).toHaveBeenLastCalledWith(["italic"], expect.objectContaining({ source: "agent" }))
  expect(screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed")).toBe("false")
  expect(screen.getByRole("button", { name: "Pin message" }).getAttribute("aria-pressed")).toBe("true")
})
