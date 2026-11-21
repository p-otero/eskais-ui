import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { parseActionRefusal } from "@/lib/action-refusal"

import { angleAt, positionAtAngle, readingAt } from "../apps/showcase/src/prism/prism-dial"
import {
  colourAtHue,
  exitAngle,
  hueAtWavelength,
  maxWavelength,
  minWavelength,
  rotationForWavelength,
  slitDirection,
  wavelengthAtHue,
} from "../apps/showcase/src/prism/prism-optics"
import { PrismPicker } from "../apps/showcase/src/prism/prism-picker"

const agent = createAgent()

window.matchMedia ??= ((media: string) => ({
  matches: false,
  media,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})) as unknown as typeof window.matchMedia

const wavelengths = Array.from({ length: maxWavelength - minWavelength + 1 }, (_, index) => minWavelength + index)

test("every wavelength leaves the prism along the slit at the rotation the dial sets", () => {
  for (const wavelength of wavelengths.filter((nm) => nm % 5 === 0)) {
    expect(exitAngle(rotationForWavelength(wavelength), wavelength)).toBeCloseTo(slitDirection, 2)
  }
})

test("hue falls with the wavelength, and a spectral hue finds its wavelength back", () => {
  for (const wavelength of wavelengths.slice(1)) {
    expect(hueAtWavelength(wavelength)).toBeLessThanOrEqual(hueAtWavelength(wavelength - 1))
  }
  for (const wavelength of [450, 480, 500, 520, 560, 590, 620]) {
    expect(wavelengthAtHue(hueAtWavelength(wavelength))).toBeCloseTo(wavelength, 0)
  }
  expect(wavelengthAtHue(330)).toBeUndefined()
})

test("the shown hex has the hue the readout names", () => {
  for (const hue of [25, 60, 110, 150, 200, 260, 300, 330]) {
    const { hex } = colourAtHue(hue)
    const [red, green, blue] = [1, 3, 5].map((start) => {
      const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
      return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]
    const l = Math.cbrt(0.412_221_470_8 * red + 0.536_332_536_3 * green + 0.051_445_992_9 * blue)
    const m = Math.cbrt(0.211_903_498_2 * red + 0.680_699_545_1 * green + 0.107_396_956_6 * blue)
    const s = Math.cbrt(0.088_302_461_9 * red + 0.281_718_837_6 * green + 0.629_978_700_5 * blue)
    const a = 1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s
    const b = 0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s
    const shown = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
    expect(Math.abs(((shown - hue + 540) % 360) - 180)).toBeLessThan(1.5)
  }
})

test("the dial's angle and position agree, and a drag through the gap holds the end it came from", () => {
  for (const position of [380, 450, 520, 610, 700]) {
    expect(positionAtAngle(angleAt(position), false, position)).toBe(position)
  }
  for (const position of [720, 760, 790]) expect(positionAtAngle(angleAt(position), true, position)).toBe(position)
  expect(positionAtAngle(angleAt(760), false, 690)).toBe(700)
  expect(positionAtAngle(angleAt(760), false, 390)).toBe(380)
  expect(readingAt(760).wavelength).toBeUndefined()
})

test("the dial is a slider with arrows, Page Up and Down, Home and End, and a value text", async () => {
  const user = userEvent.setup()
  render(<PrismPicker label="Prism colour" />)
  const dial = screen.getByRole("slider", { name: "Wavelength" })
  expect(dial.getAttribute("aria-valuetext")).toBe("520 nm, green")

  dial.focus()
  await user.keyboard("{ArrowRight}")
  expect((dial as HTMLInputElement).value).toBe("521")
  await user.keyboard("{PageUp}")
  expect((dial as HTMLInputElement).value).toBe("531")
  await user.keyboard("{End}")
  expect(dial.getAttribute("aria-valuetext")).toBe("700 nm, red")
  await user.keyboard("{Home}")
  expect((dial as HTMLInputElement).value).toBe("380")
})

test("an agent sets the wavelength or the hue, and a purple it can't reach fails with why", async () => {
  const { rerender } = render(<PrismPicker label="Prism colour" />)
  const labels = agent
    .snapshot()
    .filter((entry) => !entry.offPage)
    .map((entry) => entry.label)
  expect(labels).toEqual(expect.arrayContaining(["Prism colour", "Wavelength"]))
  const dial = screen.getByRole("slider", { name: "Wavelength" })

  let result = await act(() => agent.act({ steps: [{ ref: "Prism colour", action: "setWavelength", args: [470] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(dial.getAttribute("aria-valuetext")).toBe("470 nm, blue")

  result = await act(() => agent.act({ steps: [{ ref: "Prism colour", action: "setHue", args: [200] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect((dial as HTMLInputElement).value).toBe("486")

  result = await act(() => agent.act({ steps: [{ ref: "Prism colour", action: "setHue", args: [330] }] }))
  expect(result.ok).toBe(false)
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "setHue", kind: "unavailable" })
  expect((dial as HTMLInputElement).value).toBe("486")

  result = await act(() => agent.act({ steps: [{ ref: "Prism colour", action: "setWavelength", args: [900] }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "setWavelength", kind: "unavailable" })

  rerender(<PrismPicker label="Prism colour" purples />)
  result = await act(() => agent.act({ steps: [{ ref: "Prism colour", action: "setHue", args: [330] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(dial.getAttribute("aria-valuetext")).toMatch(/non-spectral$/)
})
