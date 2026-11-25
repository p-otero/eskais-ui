import { expect, test } from "vitest"

import { cameraFor } from "@/components/ui/live-sky-camera"
import { lightFacadesInto } from "@/components/ui/live-sky-canvas-light"
import { skyConditions } from "@/components/ui/live-sky-conditions"
import { facadeLightingFor, skylineOf } from "@/components/ui/live-sky-facade-light"
import { buildGBuffer } from "@/components/ui/live-sky-gbuffer"
import { lightFor } from "@/components/ui/live-sky-light"
import { createSample, finishes, sampleSurface } from "@/components/ui/live-sky-materials"
import { readPalette } from "@/components/ui/live-sky-palette"
import { streetFor, type Building, type Street } from "@/components/ui/live-sky-street"
import { createHit, indexStreet, surfaces, traceRay, windowRect } from "@/components/ui/live-sky-trace"
import type { SkyWeather } from "@/components/ui/live-sky-weather"

const palette = readPalette(null)
const eye = { x: 0, y: 1.6, z: 0 }

const building = (overrides: Partial<Building> = {}): Building => ({
  side: 1,
  start: 10,
  end: 22,
  height: 20,
  setback: 0,
  floorHeight: 3.2,
  bayWidth: 3,
  style: "render",
  material: "facade",
  tint: [1, 1, 1],
  window: { width: 1.2, height: 1.6, sill: 0.9, recess: 0.2 },
  balconies: "none",
  darkFrames: false,
  cornice: 0.5,
  lamp: null,
  seed: 0.4,
  neighbours: [0, 0],
  ...overrides,
})

const oneBuilding = (overrides: Partial<Building> = {}): Street => ({ halfWidth: 7, buildings: [building(overrides)] })

function aimAt(street: Street, x: number, y: number, z: number) {
  const length = Math.hypot(x - eye.x, y - eye.y, z - eye.z)
  return traceRay(
    indexStreet(street),
    eye,
    (x - eye.x) / length,
    (y - eye.y) / length,
    (z - eye.z) / length,
    createHit(),
  )
}

test("a ray at the middle of a window's glass hits glass, set back by the recess", () => {
  const street = oneBuilding()
  const rect = windowRect(street.buildings[0]!, 2, 11.5, 3)
  const hit = aimAt(street, 7.2, (rect.y0 + rect.y1) / 2, 11.5)
  expect(hit.surface).toBe(surfaces.glass)
  expect(hit.x).toBeCloseTo(7.2, 5)
  expect(hit.floor).toBe(2)
})

test("a ray at the wall between windows hits the wall, and one above the roof sees sky", () => {
  const street = oneBuilding()
  expect(aimAt(street, 7, 2 * 3.2 + 0.4, 13).surface).toBe(surfaces.wall)
  expect(aimAt(street, 7, 40, 16).surface).toBe(0)
  expect(aimAt(street, -7, 10, 16).surface).toBe(0)
})

test("a gallery stands out from the wall and covers its floor with a glazed front", () => {
  const street = oneBuilding({ style: "galeria", material: "facade-gallery" })
  const hit = aimAt(street, 7, 2 * 3.2 + 2, 15)
  expect(hit.surface).toBe(surfaces.galleryFront)
  expect(hit.x).toBeCloseTo(7 - 0.85, 5)
})

test("a balcony's underside faces down and is darker by the wall", () => {
  const street = oneBuilding({ balconies: "continuous", style: "modern", material: "facade-concrete" })
  const hit = aimAt(street, 6.9, 2 * 3.2, 15)
  expect(hit.surface).toBe(surfaces.slabUnder)
  const sample = sampleSurface(hit, palette, createSample())
  const outer = sampleSurface(aimAt(street, 5.8, 2 * 3.2, 15), palette, createSample())
  expect(sample.occlusion).toBeLessThan(outer.occlusion)
})

test("a taller building shows a blank side wall above a lower neighbour", () => {
  const street = oneBuilding({ neighbours: [8, 0] })
  const hit = aimAt(street, 12, 14, 10)
  expect(hit.surface).toBe(surfaces.gable)
})

test("a window's glass carries a rank, so only some windows light up at night", () => {
  const street = oneBuilding()
  const ranks = new Set<number>()
  for (let floor = 1; floor <= 4; floor++) {
    for (const centre of [11.5, 14.5, 17.5, 20.5]) {
      const rect = windowRect(street.buildings[0]!, floor, centre, 3)
      const sample = sampleSurface(aimAt(street, 7.2, rect.y0 + 0.9, centre + 0.15), palette, createSample())
      if (sample.finish === finishes.glass || sample.finish === finishes.translucent) ranks.add(sample.rank)
    }
  }
  expect(ranks.size).toBeGreaterThan(6)
  for (const rank of ranks) expect(rank).toBeGreaterThan(0)
})

test("the G-buffer fills in slices, and marks only the street as covered", () => {
  const camera = cameraFor(64, 40)
  const build = buildGBuffer(streetFor(43.37, -8.4), camera, palette, 64, 40)
  expect(build.step(0)).toBe(false)
  expect(build.done()).toBe(false)
  build.step(Number.POSITIVE_INFINITY)
  expect(build.done()).toBe(true)
  const covered = build.buffer.albedo.filter((_, index) => index % 4 === 3 && build.buffer.albedo[index] === 255).length
  expect(covered).toBeGreaterThan(64 * 40 * 0.3)
  expect(covered).toBeLessThan(64 * 40 * 0.95)
})

test("the canvas lighting darkens the street at night but keeps the lit windows bright", () => {
  const street = streetFor(43.37, -8.4)
  const camera = cameraFor(80, 50)
  const build = buildGBuffer(street, camera, palette, 80, 50)
  build.step(Number.POSITIVE_INFINITY)
  const weather: SkyWeather = {
    time: 0,
    temperature: 10,
    precipitation: 0,
    rain: 0,
    showers: 0,
    snowfall: 0,
    cloudCover: 30,
    weatherCode: 1,
    windSpeed: 5,
    windDirection: 200,
    visibility: 30_000,
    isDay: true,
    nextHours: [],
  }
  const at = (hour: number) => {
    const conditions = skyConditions(
      weather,
      { latitude: 43.37, longitude: -8.4 },
      new Date(Date.UTC(2026, 10, 25, hour)),
    )
    const lighting = facadeLightingFor(conditions, lightFor(conditions, palette), palette)
    const target = { data: new Uint8ClampedArray(80 * 50 * 4), width: 80, height: 50, colorSpace: "srgb" } as ImageData
    const pixels = lightFacadesInto(target, build.buffer, lighting, camera).data
    let total = 0
    let brightest = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] === 0) continue
      const value = pixels[index]! + pixels[index + 1]! + pixels[index + 2]!
      total += value
      brightest = Math.max(brightest, value)
    }
    return { total, brightest }
  }
  const noon = at(12)
  const night = at(23)
  expect(night.total).toBeLessThan(noon.total * 0.4)
  expect(night.brightest).toBeGreaterThan(400)
  expect(skylineOf(street).bytes.some((value) => value > 0)).toBe(true)
})
