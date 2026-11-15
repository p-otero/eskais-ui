import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldLabel } from "@/components/ui/field"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function VolumeField({ onValueChange }: { onValueChange?: (value: number) => void }) {
  return (
    <Field>
      <Slider defaultValue={40} step={10} format={(value) => `${value}%`} onValueChange={onValueChange}>
        <div className="flex justify-between">
          <FieldLabel>Volume</FieldLabel>
          <SliderValue />
        </div>
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb />
          </SliderTrack>
        </SliderControl>
      </Slider>
    </Field>
  )
}

const thumbValue = (name: string) => screen.getByRole<HTMLInputElement>("slider", { name }).value

test("the field label names the thumb and the value part shows the formatted value", () => {
  render(<VolumeField />)
  expect(screen.getByRole("slider", { name: "Volume" }).getAttribute("aria-valuetext")).toBe("40%")
  expect(document.querySelector("[data-slot=slider-value]")?.textContent).toBe("40%")
})

test("arrows step, Home and End jump, and each change reports step-key", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<VolumeField onValueChange={onValueChange} />)
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("slider", { name: "Volume" }))
  await user.keyboard("{ArrowRight}")
  expect(onValueChange).toHaveBeenLastCalledWith(50, expect.objectContaining({ reason: "step-key" }))
  await user.keyboard("{End}")
  expect(onValueChange).toHaveBeenLastCalledWith(100, expect.objectContaining({ reason: "step-key" }))
  await user.keyboard("{Home}")
  expect(thumbValue("Volume")).toBe("0")
})

test("a range names each thumb on its own", () => {
  render(
    <Slider aria-label="Price" defaultValue={[20, 80]}>
      <SliderControl>
        <SliderTrack>
          <SliderIndicator />
          <SliderThumb index={0} aria-label="Minimum price" />
          <SliderThumb index={1} aria-label="Maximum price" />
        </SliderTrack>
      </SliderControl>
    </Slider>,
  )
  expect(thumbValue("Minimum price")).toBe("20")
  expect(thumbValue("Maximum price")).toBe("80")
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <VolumeField />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the slider and sets it", async () => {
  const onValueChange = vi.fn()
  render(<VolumeField onValueChange={onValueChange} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(components.map((entry) => entry.label)).toContain("Volume")

  const result = await act(() => agent.act({ steps: [{ ref: "Volume", action: "setValue", args: [70] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(thumbValue("Volume")).toBe("70")
  expect(onValueChange).toHaveBeenLastCalledWith(70, expect.objectContaining({ source: "agent" }))
})
