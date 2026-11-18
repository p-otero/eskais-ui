import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  ColorPicker,
  ColorPickerChannelInput,
  ColorPickerEyeDropper,
  ColorPickerSwatches,
  ColorPickerSwatchItem,
} from "@/components/ui/color-picker"
import { Field, FieldLabel } from "@/components/ui/field"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function BrandField({ onValueChange }: { onValueChange?: (value: string) => void }) {
  return (
    <Field>
      <FieldLabel>Brand colour</FieldLabel>
      <ColorPicker defaultValue="#0ea5e9" onValueChange={onValueChange} />
    </Field>
  )
}

test("the default layout is an area, a hue slider, a swatch and a named text field", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<BrandField onValueChange={onValueChange} />)
  expect(screen.getByRole("group", { name: "Brand colour" })).toBeTruthy()
  expect(screen.getAllByRole("slider").length).toBeGreaterThanOrEqual(2)
  const value = screen.getByRole<HTMLInputElement>("textbox", { name: "Colour value" })
  await user.clear(value)
  await user.type(value, "#ff0000{Enter}")
  expect(onValueChange).toHaveBeenLastCalledWith("#ff0000", expect.objectContaining({ reason: "input-commit" }))
})

test("an oklch picker paints its area on a canvas, and labels translate the text field", () => {
  render(
    <ColorPicker aria-label="Accent" space="oklch" defaultValue="oklch(0.62 0.19 259)" labels={{ value: "Valor" }} />,
  )
  expect(document.querySelector("canvas[data-slot=color-picker-area-canvas]")).not.toBeNull()
  expect(screen.getByRole("textbox", { name: "Valor" })).toBeTruthy()
})

test("presets select the matching colour, and channel inputs edit one channel", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(
    <ColorPicker
      aria-label="Label colour"
      space="srgb"
      format="hex"
      defaultValue="#0000ff"
      onValueChange={onValueChange}
    >
      <ColorPickerSwatches aria-label="Presets">
        {["#ef4444", "#0000ff"].map((preset) => (
          <ColorPickerSwatchItem key={preset} value={preset} />
        ))}
      </ColorPickerSwatches>
      <ColorPickerChannelInput channel="red" />
      <ColorPickerEyeDropper />
    </ColorPicker>,
  )
  const items = document.querySelectorAll("[data-slot=color-picker-swatch-item]")
  expect(items[1]?.hasAttribute("data-selected")).toBe(true)
  await user.click(items[0]!)
  expect(onValueChange).toHaveBeenLastCalledWith("#ef4444", expect.objectContaining({ reason: "item-press" }))
  expect(screen.getByRole("button", { name: "Pick a colour from the screen", hidden: true })).toBeTruthy()
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <BrandField />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the picker by its label and sets a colour", async () => {
  const onValueChange = vi.fn()
  render(<BrandField onValueChange={onValueChange} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const entry = components.find((component) => component.label === "Brand colour")
  expect(entry?.actions).toEqual(expect.arrayContaining(["setValue"]))
  const result = await act(() => agent.act({ steps: [{ ref: "Brand colour", action: "setValue", args: ["#22c55e"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(onValueChange).toHaveBeenLastCalledWith("#22c55e", expect.objectContaining({ source: "agent" }))
})
