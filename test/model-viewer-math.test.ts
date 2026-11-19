import { describe, expect, test } from "vitest"

import {
  clampPitch,
  clampZoom,
  containSize,
  damp,
  dampWeights,
  fieldOfView,
  fitBoxDistance,
  fitSphereDistance,
  nearestAngle,
  orbitPosition,
  viewAngles,
  viewSizeAt,
  wrapDegrees,
} from "@/components/ui/model-viewer-math"

const rounded = (values: readonly number[]) => values.map((value) => Math.round(value * 1e6) / 1e6 + 0)

describe("angles", () => {
  test("wrap to (-180, 180] and tween the short way round", () => {
    expect([wrapDegrees(190), wrapDegrees(-180), wrapDegrees(540), wrapDegrees(-30)]).toEqual([-170, 180, 180, -30])
    expect(nearestAngle(350, 35)).toBe(395)
    expect(nearestAngle(-170, 180)).toBe(-180)
    expect(nearestAngle(10, 35)).toBe(35)
  })

  test("pitch and zoom stay in range, and the three-quarter view turns and looks down", () => {
    expect([clampPitch(-90), clampPitch(80), clampPitch(Number.NaN)]).toEqual([-60, 75, -60])
    expect([clampZoom(0.1), clampZoom(10), clampZoom(1.5)]).toEqual([0.5, 3, 1.5])
    expect(viewAngles["three-quarter"]).toEqual({ yaw: 35, pitch: 8 })
  })

  test("the camera orbits its target: front on +Z, side on +X, above for a positive pitch", () => {
    expect(rounded(orbitPosition([0, 1, 0], 0, 0, 2))).toEqual([0, 1, 2])
    expect(rounded(orbitPosition([0, 1, 0], 90, 0, 2))).toEqual([2, 1, 0])
    expect(rounded(orbitPosition([0, 0, 0], 0, 90, 3))).toEqual([0, 3, 0])
  })
})

describe("easing", () => {
  test("damp is frame-rate independent", () => {
    const once = damp(0, 1, 4, 0.1)
    const twice = damp(damp(0, 1, 4, 0.05), 1, 4, 0.05)
    expect(once).toBeCloseTo(twice, 10)
    expect(damp(0, 1, 4, 0)).toBe(0)
    expect(damp(0, 1, 4, Number.POSITIVE_INFINITY)).toBe(1)
  })

  test("weights ease to their targets, settle exactly, and missing names ease back to 0", () => {
    let weights: Record<string, number> = { Blink: 1 }
    const target = { Smile: 1, Build: 2 }
    let frames = 0
    let settled = false
    while (!settled && frames < 600) {
      const step = dampWeights(weights, target, 10, 1 / 60)
      expect(Object.values(step.next).every((value) => value >= 0 && value <= 1)).toBe(true)
      weights = step.next
      settled = step.settled
      frames += 1
    }
    expect(weights).toEqual({ Blink: 0, Smile: 1, Build: 1 })
    // About 0.7 s at 60 fps: 1/rate per two thirds of the way, down to a thousandth.
    expect(frames).toBeGreaterThan(30)
    expect(frames).toBeLessThan(60)
  })

  test("half a second in, a weight is most of the way there", () => {
    const { next, settled } = dampWeights({ Smile: 0 }, { Smile: 1 }, 10, 0.1)
    expect(next.Smile).toBeCloseTo(1 - Math.exp(-1), 6)
    expect(settled).toBe(false)
  })
})

describe("framing", () => {
  test("a box fits by its height in a portrait stage, with the margin, from in front of it", () => {
    const distance = fitBoxDistance([0.7, 1.7, 0.4], fieldOfView, 3 / 4)
    const view = viewSizeAt(distance - 0.2, fieldOfView, 3 / 4)
    expect(view.height).toBeCloseTo(1.7 * 1.1, 6)
    expect(view.width).toBeGreaterThan(0.7 * 1.1)
  })

  test("a wide box fits by its width", () => {
    const distance = fitBoxDistance([4, 1, 0], fieldOfView, 1)
    expect(viewSizeAt(distance, fieldOfView, 1).width).toBeCloseTo(4 * 1.1, 6)
  })

  test("a sphere fits the narrower side", () => {
    const distance = fitSphereDistance(0.2, fieldOfView, 0.75)
    expect(viewSizeAt(distance, fieldOfView, 0.75).width).toBeCloseTo(0.4 * 1.1, 6)
  })

  test("contain keeps the ratio inside the box", () => {
    expect(containSize(0.75, { width: 300, height: 300 })).toEqual({ width: 225, height: 300 })
    expect(containSize(2, { width: 300, height: 300 })).toEqual({ width: 300, height: 150 })
  })
})
