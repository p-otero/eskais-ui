import { convertColor, isInGamut, toGamut, type Color } from "@ui-sdk/react/color"
import { expect, test } from "vitest"

import {
  areaChromaMax,
  areaColor,
  areaPoint,
  isOklchInGamut,
  maxChroma,
  oklchToLinear,
  paintArea,
} from "@/lib/oklch-gamut"

const hues = [0, 29, 90, 110, 142, 200, 250, 264, 300, 330]
const lightnesses = [0.05, 0.2, 0.4, 0.5, 0.62, 0.75, 0.9, 0.97]
const oklch = (l: number, c: number, h: number) => ({
  space: "oklch" as const,
  coords: [l, c, h] as [number, number, number],
  alpha: 1,
})

const lab = (lightness: number, chroma: number, hue: number) => [
  lightness,
  chroma * Math.cos((hue * Math.PI) / 180),
  chroma * Math.sin((hue * Math.PI) / 180),
]

function deltaE(a: { l: number; c: number; h: number }, b: Color) {
  const [l, c, h] = convertColor(b, "oklch").coords as [number, number, number | null]
  const [l1, a1, b1] = lab(a.l, a.c, a.h)
  const [l2, a2, b2] = lab(l, c, h ?? a.h)
  return Math.hypot(l1! - l2!, a1! - a2!, b1! - b2!)
}

test("the OKLab matrices agree with UI SDK's conversion to sRGB", () => {
  for (const h of hues) {
    for (const l of lightnesses) {
      const [r, g, b] = oklchToLinear(l, 0.08, h, "srgb")
      const reference = convertColor(oklch(l, 0.08, h), "srgb-linear").coords as number[]
      expect(r).toBeCloseTo(reference[0]!, 4)
      expect(g).toBeCloseTo(reference[1]!, 4)
      expect(b).toBeCloseTo(reference[2]!, 4)
    }
  }
})

test("maxChroma is the gamut's edge: inside at it, outside just past it, in sRGB and P3", () => {
  for (const gamut of ["srgb", "p3"] as const) {
    for (const h of hues) {
      for (const l of lightnesses) {
        const edge = maxChroma(l, h, gamut)
        expect(edge).toBeGreaterThan(0)
        expect(isOklchInGamut(l, edge, h, gamut)).toBe(true)
        expect(isInGamut(oklch(l, edge * 0.999, h), gamut)).toBe(true)
        // Near black a channel sits within UI SDK's rounding of 0 for a while past the edge.
        const past = edge < areaChromaMax && l >= 0.1 && isInGamut(oklch(l, edge + 0.002, h), gamut)
        expect(past, `${gamut} oklch(${String(l)} ${String(edge)} ${String(h)})`).toBe(false)
      }
    }
  }
  for (const h of hues) {
    for (const l of lightnesses) expect(maxChroma(l, h, "p3")).toBeGreaterThanOrEqual(maxChroma(l, h, "srgb") - 1e-6)
  }
  expect(maxChroma(0, 250)).toBe(0)
  expect(maxChroma(1, 250)).toBe(0)
})

test("a point past the edge paints the colour UI SDK holds there, in sRGB and P3", () => {
  for (const gamut of ["srgb", "p3"] as const) {
    for (const h of hues) {
      for (const l of lightnesses) {
        for (const x of [0.5, 0.8, 1]) {
          const painted = areaColor(x, l, h, gamut)
          const held = toGamut(oklch(l, x * areaChromaMax, h), gamut)
          expect(deltaE(painted, held)).toBeLessThan(0.001)
        }
      }
    }
  }
})

test("area points and colours round-trip: the point of a painted colour paints that colour again", () => {
  for (const h of hues) {
    for (const l of lightnesses) {
      for (const x of [0, 0.1, 0.3, 0.6, 1]) {
        const colour = areaColor(x, l, h)
        const point = areaPoint(colour)
        const again = areaColor(point.x, point.y, colour.h)
        expect(deltaE(again, oklch(colour.l, colour.c, colour.h))).toBeLessThan(0.001)
      }
      const half = maxChroma(l, h) / 2
      expect(areaColor(half / areaChromaMax, l, h)).toEqual({ l, c: expect.closeTo(half, 9), h })
    }
  }
})

test("paintArea fills every pixel opaquely: white at the top, black at the bottom, the edge colour past it", () => {
  const width = 40
  const height = 20
  const pixels = paintArea(width, height, 264)
  expect(pixels).toHaveLength(width * height * 4)
  for (let index = 3; index < pixels.length; index += 4) expect(pixels[index]).toBe(255)
  expect(Array.from(pixels.slice(0, 3))).toEqual([255, 255, 255])
  const bottom = ((height - 1) * width + width - 1) * 4
  expect(Array.from(pixels.slice(bottom, bottom + 3))).toEqual([0, 0, 0])
  // Mid row: the last two pixels are both past sRGB's edge for this hue, so they hold the same colour.
  const row = Math.round(height / 2) * width * 4
  const last = row + (width - 1) * 4
  expect(Array.from(pixels.slice(last - 4, last - 1))).toEqual(Array.from(pixels.slice(last, last + 3)))
})
