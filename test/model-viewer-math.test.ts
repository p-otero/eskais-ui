import { describe, expect, test } from "vitest"

import {
  clampPitch,
  clampZoom,
  damp,
  dampInto,
  fieldOfView,
  fitBoxDistance,
  fitSize,
  fitSphereDistance,
  nearestAngle,
  orbitPosition,
  viewAngles,
  viewSizeAt,
  wrapDegrees,
  writeTargets,
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

  test("weights ease in place to their targets and settle exactly; negative components stay negative", () => {
    const current = new Float32Array([1, 0, 0])
    const target = new Float32Array([0, 1, -0.8])
    const active = new Uint8Array([1, 1, 1])
    const before = current
    let frames = 0
    let settled = false
    while (!settled && frames < 600) {
      settled = dampInto(current, target, active, 10, 1 / 60)
      frames += 1
    }
    expect(current).toBe(before)
    expect([...current]).toEqual([0, 1, expect.closeTo(-0.8, 6)])
    expect(frames).toBeGreaterThan(30)
    expect(frames).toBeLessThan(60)
  })

  test("a tenth of a second in, a weight is most of the way there; an inactive one is left alone", () => {
    const current = new Float32Array([0, 0.5])
    expect(dampInto(current, new Float32Array([1, 1]), new Uint8Array([1, 0]), 10, 0.1)).toBe(false)
    expect(current[0]).toBeCloseTo(1 - Math.exp(-1), 6)
    expect(current[1]).toBe(0.5)
  })

  test("targets come aligned, by name, or as expressions; a target set before and missing now goes back to 0", () => {
    const names = ["body.pc00", "expr.mouthSmileLeft", "expr.eyeBlinkLeft"]
    const index = new Map(names.map((name, i) => [name, i]))
    const target = new Float32Array(3)
    const active = new Uint8Array(3)
    writeTargets(index, target, active, new Float32Array([-1.5, 0.25]), undefined)
    expect([...target, ...active]).toEqual([-1.5, 0.25, 0, 1, 1, 0])
    writeTargets(
      index,
      target,
      active,
      { "body.pc00": 0.5, unknown: 1 },
      { eyeBlinkLeft: 1, "expr.mouthSmileLeft": 0.75 },
    )
    expect([...target, ...active]).toEqual([0.5, 0.75, 1, 1, 1, 1])
    writeTargets(index, target, active, { "body.pc00": Number.NaN }, undefined)
    expect([...target]).toEqual([0, 0, 0])
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

  test("contain keeps the ratio inside the box, cover fills it", () => {
    expect(fitSize(0.75, { width: 300, height: 300 })).toEqual({ width: 225, height: 300 })
    expect(fitSize(2, { width: 300, height: 300 })).toEqual({ width: 300, height: 150 })
    expect(fitSize(0.75, { width: 300, height: 300 }, "cover")).toEqual({ width: 300, height: 400 })
    expect(fitSize(2, { width: 300, height: 300 }, "cover")).toEqual({ width: 600, height: 300 })
  })
})
