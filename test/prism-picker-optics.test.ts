import { expect, test } from "vitest"

import { angleAt, colourAt, readingAt, wavelengthAtAngle } from "@/components/ui/prism-picker-dial"
import {
  colourAtHue,
  exitAngle,
  hueAtWavelength,
  maxWavelength,
  minWavelength,
  refractiveIndex,
  rotationForWavelength,
  slitDirection,
  trace,
  wavelengthAtHue,
} from "@/components/ui/prism-picker-optics"

const wavelengths = Array.from({ length: maxWavelength - minWavelength + 1 }, (_, index) => minWavelength + index)

function oklabHueOf(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const l = Math.cbrt(0.412_221_470_8 * red + 0.536_332_536_3 * green + 0.051_445_992_9 * blue)
  const m = Math.cbrt(0.211_903_498_2 * red + 0.680_699_545_1 * green + 0.107_396_956_6 * blue)
  const s = Math.cbrt(0.088_302_461_9 * red + 0.281_718_837_6 * green + 0.629_978_700_5 * blue)
  const a = 1.977_998_495_1 * l - 2.428_592_205 * m + 0.450_593_709_9 * s
  const b = 0.025_904_037_1 * l + 0.782_771_766_2 * m - 0.808_675_766 * s
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
}

const hueDistance = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

test("glass disperses: blue bends more than red", () => {
  for (const wavelength of wavelengths.slice(1)) {
    expect(refractiveIndex(wavelength)).toBeLessThan(refractiveIndex(wavelength - 1))
  }
})

test("every wavelength leaves the prism along the slit at the rotation the dial sets", () => {
  for (const wavelength of wavelengths.filter((nm) => nm % 5 === 0)) {
    expect(exitAngle(rotationForWavelength(wavelength), wavelength)).toBeCloseTo(slitDirection, 2)
  }
})

test("the prism turns one way through the spectrum, and blue reflects inside the glass near the red end", () => {
  for (const wavelength of wavelengths.filter((nm) => nm % 10 === 0).slice(1)) {
    expect(rotationForWavelength(wavelength)).toBeGreaterThan(rotationForWavelength(wavelength - 10))
  }
  expect(trace(rotationForWavelength(700), 400)?.reflected).toBe(true)
  expect(trace(rotationForWavelength(380), 700)?.reflected).toBe(false)
})

test("hue falls with the wavelength, and a spectral hue finds its wavelength back", () => {
  for (const wavelength of wavelengths.slice(1)) {
    expect(hueAtWavelength(wavelength)).toBeLessThanOrEqual(hueAtWavelength(wavelength - 1))
  }
  for (const wavelength of [450, 480, 500, 520, 560, 590, 620]) {
    expect(wavelengthAtHue(hueAtWavelength(wavelength))).toBeCloseTo(wavelength, 0)
  }
  for (const purple of [320, 340, 0, 10]) expect(wavelengthAtHue(purple)).toBeUndefined()
})

test("the shown hex carries the hue the readout names, and the red end is pure red", () => {
  for (const hue of [30, 60, 110, 150, 200, 260, 299]) {
    expect(hueDistance(oklabHueOf(colourAtHue(hue).hex), hue)).toBeLessThan(1.5)
  }
  for (const wavelength of [400, 470, 520, 580, 610]) {
    const colour = colourAt(wavelength)
    expect(hueDistance(oklabHueOf(colour.hex), colour.hue)).toBeLessThan(1.5)
  }
  expect(colourAt(700).hex).toBe("#ff0000")
  expect(colourAt(650).hex).toBe("#ff0000")
  expect(colourAt(380).hex).toBe("#9000ff")
})

test("the dial's angle and wavelength agree, and the open top keeps the end the drag came from", () => {
  for (const wavelength of [380, 450, 520, 610, 700]) {
    expect(wavelengthAtAngle(angleAt(wavelength), wavelength)).toBe(wavelength)
  }
  expect(wavelengthAtAngle(-90, 690)).toBe(700)
  expect(wavelengthAtAngle(-90, 390)).toBe(380)
  expect(readingAt(900).wavelength).toBe(700)
})
