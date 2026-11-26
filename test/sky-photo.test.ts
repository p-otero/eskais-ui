import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, test } from "vitest"

import { readSkyPhotoExif } from "@/lib/sky-photo-exif"
import { findClouds, findWindows } from "@/lib/sky-photo-features"
import { findSky, type Pixels } from "@/lib/sky-photo-mask"
import { calibrateSkyView, fovFromFocalLength35mm, projectSky, unprojectSky } from "@/lib/sky-photo-projection"

type Field = { tag: number; type: number; values: number[] | string }

function tiff(little: boolean, main: Field[], exif: Field[], gps: Field[]) {
  const bytes: number[] = []
  const u16 = (value: number) => (little ? [value & 0xff, value >> 8] : [value >> 8, value & 0xff])
  const u32 = (value: number) =>
    little
      ? [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, value >>> 24]
      : [value >>> 24, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
  const write = (at: number, values: number[]) => values.forEach((value, index) => (bytes[at + index] = value))
  bytes.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8))
  const directory = (fields: Field[], pointers: { tag: number; target: () => number }[] = []) => {
    const at = bytes.length
    const all = [...fields, ...pointers.map((pointer) => ({ tag: pointer.tag, type: 4, values: [0] }))].toSorted(
      (a, b) => a.tag - b.tag,
    )
    bytes.push(...u16(all.length))
    const slots = all.map(() => {
      const slot = bytes.length
      bytes.push(...Array.from({ length: 12 }, () => 0))
      return slot
    })
    bytes.push(...u32(0))
    const patches: (() => void)[] = []
    all.forEach((field, index) => {
      const slot = slots[index]!
      const pointer = pointers.find((entry) => entry.tag === field.tag)
      let payload: number[]
      let count: number
      if (typeof field.values === "string") {
        payload = [...field.values].map((char) => char.charCodeAt(0)).concat(0)
        count = payload.length
      } else if (field.type === 5) {
        payload = field.values.flatMap((value) => [...u32(Math.round(value * 1000)), ...u32(1000)])
        count = field.values.length
      } else if (field.type === 3) {
        payload = field.values.flatMap(u16)
        count = field.values.length
      } else {
        payload = field.values.flatMap(u32)
        count = field.values.length
      }
      write(slot, [...u16(field.tag), ...u16(field.type), ...u32(count)])
      if (pointer) patches.push(() => write(slot + 8, u32(pointer.target())))
      else if (payload.length <= 4) write(slot + 8, payload)
      else {
        const offset = bytes.length
        bytes.push(...payload)
        write(slot + 8, u32(offset))
      }
    })
    return { at, patch: () => patches.forEach((patch) => patch()) }
  }
  let exifAt = 0
  let gpsAt = 0
  const top = directory(main, [
    { tag: 0x8769, target: () => exifAt },
    { tag: 0x8825, target: () => gpsAt },
  ])
  exifAt = directory(exif).at
  gpsAt = directory(gps).at
  top.patch()
  return new Uint8Array(bytes)
}

function jpegWith(tiffBytes: Uint8Array) {
  const length = tiffBytes.length + 8
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    0xff,
    0xe1,
    length >> 8,
    length & 0xff,
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00,
    ...tiffBytes,
    0xff,
    0xda,
  ])
}

const sample = (little: boolean) =>
  tiff(
    little,
    [{ tag: 0x0112, type: 3, values: [6] }],
    [
      { tag: 0x9003, type: 2, values: "2026:11:25 17:38:04" },
      { tag: 0x9011, type: 2, values: "+01:00" },
      { tag: 0x920a, type: 5, values: [4.25] },
      { tag: 0xa405, type: 3, values: [26] },
    ],
    [
      { tag: 0x0001, type: 2, values: "N" },
      { tag: 0x0002, type: 5, values: [43, 22, 12] },
      { tag: 0x0003, type: 2, values: "W" },
      { tag: 0x0004, type: 5, values: [8, 24, 0] },
      { tag: 0x0010, type: 2, values: "T" },
      { tag: 0x0011, type: 5, values: [231.5] },
    ],
  )

describe("EXIF", () => {
  test.each([
    ["little-endian", true],
    ["big-endian", false],
  ])("reads orientation, capture time, GPS, heading and focal length from a %s JPEG", (_name, little) => {
    expect(readSkyPhotoExif(jpegWith(sample(little)))).toEqual({
      orientation: 6,
      capturedAt: "2026-11-25T17:38:04",
      utcOffset: "+01:00",
      focalLength: 4.25,
      focalLength35mm: 26,
      latitude: 43 + 22 / 60 + 12 / 3600,
      longitude: -8.4,
      heading: 231.5,
      headingReference: "true",
    })
  })

  test("reads a bare TIFF too", () => {
    expect(readSkyPhotoExif(sample(true)).heading).toBe(231.5)
  })

  test("reads the CC0 demo photo's camera data", () => {
    const photo = readFileSync(resolve(import.meta.dirname, "../apps/showcase/src/assets/cebu-skyline.jpg"))
    expect(readSkyPhotoExif(photo)).toMatchObject({
      capturedAt: "2025-04-14T06:43:28",
      focalLength35mm: 26,
      latitude: 10.326725,
    })
  })

  test("gives nothing for a file without EXIF, garbage or a cut-off file, and never throws", () => {
    expect(readSkyPhotoExif(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 0, 0, 0]))).toEqual({})
    expect(readSkyPhotoExif(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toEqual({})
    const whole = jpegWith(sample(true))
    expect(() => readSkyPhotoExif(whole.slice(0, 40))).not.toThrow()
    expect(readSkyPhotoExif(new ArrayBuffer(2))).toEqual({})
  })
})

describe("projection", () => {
  const view = { heading: 200, fov: 70, horizon: 0.55, aspect: 4 / 3 }

  test("the photo's centre column on the horizon looks along the heading", () => {
    const point = projectSky(view, 200, 0)
    expect(point.behind).toBe(false)
    expect(point.x).toBeCloseTo(0.5, 6)
    expect(point.y).toBeCloseTo(0.55, 6)
  })

  test("half the field of view to the right reaches the edge; higher suns stand higher; behind is behind", () => {
    expect(projectSky({ ...view, horizon: 0.5 }, 235, 0).x).toBeCloseTo(1, 6)
    expect(projectSky(view, 200, 20).y).toBeLessThan(projectSky(view, 200, 10).y)
    expect(projectSky(view, 20, 10).behind).toBe(true)
  })

  test("unprojecting a projected direction gives it back", () => {
    for (const [azimuth, altitude] of [
      [190, 5],
      [225, 30],
      [170, -4],
    ] as const) {
      const point = projectSky(view, azimuth, altitude)
      const back = unprojectSky(view, point.x, point.y)
      expect(back.azimuth).toBeCloseTo(azimuth, 6)
      expect(back.altitude).toBeCloseTo(altitude, 6)
    }
  })

  test("one marked point gives back the heading and horizon that put the sun there", () => {
    const sun = { azimuth: 241, altitude: 6 }
    const point = projectSky(view, sun.azimuth, sun.altitude)
    const found = calibrateSkyView({ fov: view.fov, aspect: view.aspect }, sun, point)
    expect(found.heading).toBeCloseTo(view.heading, 4)
    expect(found.horizon).toBeCloseTo(view.horizon, 4)
  })

  test("a 26 mm equivalent on a 4:3 phone sees about 67° across", () => {
    expect(fovFromFocalLength35mm(26, 4 / 3)).toBeCloseTo(67.3, 1)
    expect(fovFromFocalLength35mm(13, 4 / 3)).toBeGreaterThan(100)
  })
})

const skyline = (x: number) => (x < 60 ? 100 : x < 130 ? 70 : x < 200 ? 90 : 110)
const tower = (x: number, y: number) => x >= 160 && x < 172 && y >= 30 && y < 90
const towerBar = (x: number, y: number) => tower(x, y) && (x < 162 || x > 169 || y % 8 < 2)
const mast = (x: number, y: number) => (x === 95 || x === 96) && y >= 40 && y < 70

function syntheticSkyline() {
  const width = 240
  const height = 160
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4
      const ground = y >= skyline(x)
      const window = ground && x % 6 < 3 && y % 7 < 3
      const solid = ground || towerBar(x, y) || mast(x, y)
      data[at] = solid ? (window ? 200 : 70) : 70 + y * 0.4
      data[at + 1] = solid ? (window ? 190 : 72) : 130 + y * 0.3
      data[at + 2] = solid ? (window ? 120 : 80) : 225
      data[at + 3] = 255
    }
  }
  return { data, width, height } satisfies Pixels
}

describe("sky finder", () => {
  const pixels = syntheticSkyline()
  const mask = findSky(pixels)
  const alphaAt = (x: number, y: number) => mask.alpha[y * pixels.width + x]!

  test("finds the skyline within a few rows in nearly every column", () => {
    let close = 0
    for (let x = 0; x < pixels.width; x++) {
      if (Math.abs(mask.skyline[x]! * pixels.height - skyline(x)) <= 3) close++
    }
    expect(close / pixels.width).toBeGreaterThan(0.9)
  })

  test("sky is opaque, buildings are clear, and the edge is feathered", () => {
    expect(alphaAt(20, 20)).toBeGreaterThan(240)
    expect(alphaAt(20, 140)).toBeLessThan(10)
    const edge = alphaAt(20, 100)
    expect(edge).toBeGreaterThan(10)
    expect(edge).toBeLessThan(245)
  })

  test("sky shows through a lattice tower, and a mast standing above the skyline stays foreground", () => {
    expect(towerBar(164, 35)).toBe(false)
    expect(alphaAt(165, 36)).toBeGreaterThan(200)
    expect(alphaAt(160, 50)).toBeLessThan(120)
    expect(alphaAt(95, 50)).toBeLessThan(120)
  })

  test("the default horizon is the skyline's lowest band", () => {
    expect(mask.horizon * pixels.height).toBeGreaterThanOrEqual(98)
    expect(mask.horizon * pixels.height).toBeLessThanOrEqual(112)
  })
})

type Paint = (x: number, y: number) => [number, number, number]

function painted(width: number, height: number, paint: Paint): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [red, green, blue] = paint(x, y)
      data.set([red, green, blue, 255], (y * width + x) * 4)
    }
  }
  return { data, width, height }
}

const cloudyRoof = 120
const cloudy = (x: number, y: number): [number, number, number] => {
  const puff = 40 * Math.sin(x / 9) * Math.cos(y / 7)
  return [175 + puff, 190 + puff, 210 + puff * 0.8]
}

const lattice = (x: number, y: number) =>
  x >= 140 && x < 146 && y >= 40 && y < cloudyRoof && (x === 140 || x === 145 || y % 6 < 2)

describe("thin structures against cloud", () => {
  const pixels = painted(300, 180, (x, y) => {
    if (y >= cloudyRoof) return [90, 92, 96]
    if (lattice(x, y)) return [215, 215, 210]
    return cloudy(x, y)
  })
  const mask = findSky(pixels)
  const alphaAt = (x: number, y: number) => mask.alpha[y * pixels.width + x]!

  test("a light lattice tower over grey cloud stays foreground, and the cloud beside it stays sky", () => {
    expect(alphaAt(140, 60)).toBeLessThan(128)
    expect(alphaAt(145, 90)).toBeLessThan(128)
    expect(alphaAt(120, 60)).toBeGreaterThan(200)
    expect(alphaAt(170, 90)).toBeGreaterThan(200)
  })

  test("no foreground speck floats in the sky", () => {
    let specks = 0
    for (let y = 0; y < 30; y++) for (let x = 0; x < pixels.width; x++) if (alphaAt(x, y) < 128) specks++
    expect(specks).toBe(0)
  })
})

describe("clouds", () => {
  const pixels = painted(200, 120, (x, y) => {
    if (y >= 90) return [80, 80, 80]
    const inCloud = (x - 60) ** 2 / 900 + (y - 40) ** 2 / 225 < 1
    return inCloud ? [235, 237, 240] : [70, 120, 210]
  })
  const mask = findSky(pixels)
  const clouds = findClouds(pixels, mask)
  const at = (x: number, y: number) => y * pixels.width + x

  test("a white cloud is covered and lit, clear blue sky and the ground carry none", () => {
    expect(clouds.shade[at(60, 40)]).toBeGreaterThan(200)
    expect(clouds.light[at(60, 40)]).toBeGreaterThan(200)
    expect(clouds.shade[at(160, 30)]).toBeLessThan(20)
    expect(clouds.shade[at(100, 110)]).toBe(0)
  })
})

const facade = (x: number, y: number) => x >= 20 && x < 140 && y >= 40
const pane = (x: number, y: number) => facade(x, y) && x % 10 >= 4 && x % 10 < 8 && y % 12 >= 4 && y % 12 < 9

describe("windows", () => {
  const pixels = painted(240, 200, (x, y) => {
    if (y < 40) return [90, 140, 215]
    if (pane(x, y)) return [70, 78, 90]
    if (facade(x, y)) return [205, 200, 190]
    return x % 7 < 3 && y % 5 < 2 ? [40, 90, 40] : [60, 120, 50]
  })
  const mask = findSky(pixels)

  test("finds the grid of panes on the wall, none in the foliage, and lights the same seeded share each time", () => {
    const first = findWindows(pixels, mask)
    const again = findWindows(pixels, mask)
    expect(first.found).toBeGreaterThan(50)
    expect(first.lit).toBeGreaterThan(first.found * 0.15)
    expect(first.lit).toBeLessThan(first.found * 0.45)
    expect(again.glow).toEqual(first.glow)
    let inFoliage = 0
    for (let y = 40; y < 200; y++) for (let x = 150; x < 240; x++) if (first.glow[y * 240 + x]! > 0) inFoliage++
    expect(inFoliage).toBe(0)
  })

  test("another seed lights another share", () => {
    expect(findWindows(pixels, mask, { seed: 99 }).glow).not.toEqual(findWindows(pixels, mask).glow)
  })
})
