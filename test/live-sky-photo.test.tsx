import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { act, fireEvent, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, expect, test, vi } from "vitest"

import { LiveSky, type LiveSkySimulation } from "@/components/ui/live-sky"
import { cameraFor, projectDirection, skyDirection } from "@/components/ui/live-sky-camera"
import { lightPhotoInto } from "@/components/ui/live-sky-canvas-light"
import { skyConditions } from "@/components/ui/live-sky-conditions"
import { lightFor } from "@/components/ui/live-sky-light"
import { readPalette } from "@/components/ui/live-sky-palette"
import { photoCamera } from "@/components/ui/live-sky-photo"
import { LiveSkyPhotoUpload } from "@/components/ui/live-sky-photo-controls"
import { photoLightingFor } from "@/components/ui/live-sky-photo-light"
import { fallsFor } from "@/components/ui/live-sky-precipitation"
import type { SkyWeather } from "@/components/ui/live-sky-weather"
import { captureDate } from "@/components/ui/use-live-sky-photo"
import { projectSky } from "@/lib/sky-photo-projection"

const agent = createAgent()
const palette = readPalette(null)
const coruna = { latitude: 43.37, longitude: -8.4, name: "A Coruña" }

window.matchMedia ??= ((media: string) => ({
  matches: false,
  media,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})) as unknown as typeof window.matchMedia

afterEach(() => vi.unstubAllGlobals())

const weather = (overrides: Partial<SkyWeather> = {}): SkyWeather => ({
  time: 0,
  temperature: 12,
  precipitation: 0,
  rain: 0,
  showers: 0,
  snowfall: 0,
  cloudCover: 20,
  weatherCode: 1,
  windSpeed: 10,
  windDirection: 240,
  visibility: 30_000,
  isDay: true,
  nextHours: [],
  ...overrides,
})

const lightingAt = (hourUtc: number, overrides: Partial<SkyWeather> = {}) => {
  const conditions = skyConditions(weather(overrides), coruna, new Date(Date.UTC(2026, 10, 25, hourUtc)))
  return photoLightingFor(conditions, lightFor(conditions, palette), palette)
}

test("the photo's camera puts a sky direction where the sky-photo projection does", () => {
  const view = { heading: 225, fov: 100, horizon: 0.46 }
  const camera = photoCamera(800, 600, view)
  for (const [azimuth, altitude] of [
    [225, 0],
    [250, 12],
    [190, 30],
    [270, 5],
  ] as const) {
    const expected = projectSky({ ...view, aspect: 800 / 600 }, azimuth, altitude)
    const radians = Math.PI / 180
    const point = projectDirection(camera, skyDirection(altitude * radians, azimuth * radians))
    expect(point?.x).toBeCloseTo(expected.x * 800, 3)
    expect(point?.y).toBeCloseTo(expected.y * 600, 3)
  }
})

test("a capture time with an offset is that instant; without one it is the place's solar time", () => {
  expect(captureDate("2025-04-14T06:43:28+08:00", 123.9)?.toISOString()).toBe("2025-04-13T22:43:28.000Z")
  expect(captureDate("2026-11-25T12:00:00Z", 0)?.toISOString()).toBe("2026-11-25T12:00:00.000Z")
  expect(captureDate("2026-11-25T12:00:00", -15)?.toISOString()).toBe("2026-11-25T13:00:00.000Z")
  expect(captureDate("not a date", 0)).toBeUndefined()
})

test("overcast flattens and cools, rain wets, dusk and night dim and light the windows, fog hazes", () => {
  const clear = lightingAt(12)
  const overcast = lightingAt(12, { cloudCover: 100, weatherCode: 3 })
  const raining = lightingAt(12, { cloudCover: 100, weatherCode: 63, precipitation: 3, rain: 3 })
  const golden = lightingAt(16.4)
  const night = lightingAt(22)
  const fog = lightingAt(12, { weatherCode: 45, visibility: 250, cloudCover: 90 })
  expect(overcast.overcast).toBeGreaterThan(clear.overcast + 0.5)
  expect(raining.wetness).toBeGreaterThan(0.5)
  expect(golden.warmth).toBeGreaterThan(0.4)
  expect(clear.warmth).toBeLessThan(0.1)
  expect(night.night).toBeGreaterThan(0.95)
  expect(night.windowsOn).toBeGreaterThan(0.95)
  expect(clear.windowsOn).toBe(0)
  expect(fog.haze).toBeGreaterThan(clear.haze + 0.5)
})

function imageOf(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4)
  return { data, width, height, colorSpace: "srgb" } as ImageData
}

const redAt = (data: Uint8ClampedArray, x: number, y: number) => data[(y * 4 + x) * 4]!

test("the canvas relighting keeps the sky clear, dims the photo at night and lights its windows", () => {
  const photo = imageOf(4, 4, () => [180, 170, 160, 255])
  const sky = imageOf(4, 4, (_x, y) => [255, 255, 255, y === 0 ? 255 : 0])
  const windows = imageOf(4, 4, (x, y) => [0, 0, 0, x === 2 && y === 2 ? 255 : 0])
  const target = () => imageOf(4, 4, () => [0, 0, 0, 0])
  const noon = lightPhotoInto(target(), { photo, sky, windows }, lightingAt(12), 0.4).data
  const night = lightPhotoInto(target(), { photo, sky, windows }, lightingAt(22), 0.4).data
  expect(noon[3]).toBe(0)
  expect(noon[(1 * 4 + 1) * 4 + 3]).toBe(255)
  expect(redAt(night, 1, 1)).toBeLessThan(redAt(noon, 1, 1) * 0.3)
  expect(redAt(night, 2, 2)).toBeGreaterThan(redAt(night, 1, 2) + 80)
})

const simulation: LiveSkySimulation = {
  location: coruna,
  time: Date.UTC(2026, 10, 25, 12),
  weather: { weatherCode: 3, cloudCover: 100 },
}

test("an agent calibrates the photo, and a heading off the compass or no photo fails the step with why", async () => {
  const onPhotoChange = vi.fn()
  const { rerender } = render(
    <LiveSky
      label="Photo sky"
      simulate={simulation}
      photo={{ src: "/sky/cebu-skyline.jpg" }}
      onPhotoChange={onPhotoChange}
    />,
  )
  const entry = agent.snapshot().find((found) => found.label === "Photo sky")
  expect(entry?.actions).toContain("calibrate")
  let result = await act(() => agent.act({ steps: [{ ref: "Photo sky", action: "calibrate", args: [230, 95, 0.47] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(onPhotoChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ src: "/sky/cebu-skyline.jpg", heading: 230, fov: 95, horizon: 0.47 }),
  )
  result = await act(() => agent.act({ steps: [{ ref: "Photo sky", action: "calibrate", args: [400] }] }))
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("takes a heading from 0 to 360°, not 400")
  rerender(<LiveSky label="Photo sky" simulate={simulation} />)
  result = await act(() => agent.act({ steps: [{ ref: "Photo sky", action: "calibrate", args: [90] }] }))
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("calibrate isn't available without a photo")
})

test("with a photo, the stage takes its aspect and says so; a photo it can't read says why", async () => {
  render(<LiveSky label="Photo sky" simulate={simulation} photo={{ src: "/missing.jpg" }} />)
  const stage = document.querySelector<HTMLElement>('[data-slot="live-sky-scene"]')
  expect(stage?.hasAttribute("data-photo")).toBe(true)
  expect(stage?.style.getPropertyValue("--live-sky-aspect")).not.toBe("")
  expect(await screen.findByText("The photo couldn't be read.")).toBeTruthy()
})

test("the upload reads the file locally and offers its EXIF position, rounded", async () => {
  const createObjectURL = vi.fn(() => "blob:local-photo")
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
  const onPhoto = vi.fn()
  render(<LiveSkyPhotoUpload label="Use a photo" onPhoto={onPhoto} />)
  const bytes = readFileSync(resolve(import.meta.dirname, "../apps/showcase/src/assets/cebu-skyline.jpg"))
  const file = new File([bytes], "cebu.jpg", { type: "image/jpeg" })
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
    await new Promise((done) => setTimeout(done, 50))
  })
  expect(createObjectURL).toHaveBeenCalledWith(file)
  expect(onPhoto).toHaveBeenCalledWith({ src: "blob:local-photo" }, { latitude: 10.33, longitude: 123.9 })
})

test("over a photo rain falls past the view, slanted only by the wind across it; overhead it still comes down, capped", () => {
  const conditions = skyConditions(
    weather({ weatherCode: 65, precipitation: 12, rain: 12, cloudCover: 100, windSpeed: 36, windDirection: 225 }),
    coruna,
    new Date(Date.UTC(2026, 10, 25, 12)),
  )
  const light = lightFor(conditions, palette)
  const facing = photoCamera(800, 600, { heading: 225, fov: 100, horizon: 0.46 })
  const [curtain] = fallsFor(facing, conditions, light, palette, 1, "facing")
  expect(curtain?.velocity.z).toBe(0)
  expect(Math.abs(curtain!.velocity.y)).toBeGreaterThan(Math.abs(curtain!.velocity.x))
  const across = photoCamera(800, 600, { heading: 135, fov: 100, horizon: 0.46 })
  const [slanted] = fallsFor(across, conditions, light, palette, 1, "facing")
  expect(Math.abs(slanted!.velocity.x)).toBeGreaterThan(4)
  const [overhead] = fallsFor(cameraFor(800, 500), conditions, light, palette, 1, "overhead")
  const onScreen = Math.hypot(overhead!.velocity.x, overhead!.velocity.y)
  expect(Math.abs(overhead!.velocity.z)).toBeLessThanOrEqual(onScreen * 2.2 + 1e-9)
  expect(curtain!.depth).toBeGreaterThan(overhead!.depth)
})

const rowOf = (data: Uint8ClampedArray, y: number) => Array.from(data.slice(y * 4, y * 4 + 3))

test("rain's wet sheen stays on dark ground near the bottom, never on a façade just below the horizon", () => {
  const bronze: [number, number, number, number] = [150, 110, 60, 255]
  const asphalt: [number, number, number, number] = [60, 62, 64, 255]
  const photo = imageOf(1, 10, (_x, y) => (y < 7 ? bronze : asphalt))
  const sky = imageOf(1, 10, () => [0, 0, 0, 0])
  const rain = lightingAt(12, { cloudCover: 100, weatherCode: 63, precipitation: 3, rain: 3 })
  const relit = (sheen: readonly [number, number, number]) =>
    lightPhotoInto(
      imageOf(1, 10, () => [0, 0, 0, 0]),
      { photo, sky, windows: null },
      { ...rain, sheen },
      0.5,
    ).data
  const plain = relit([0, 0, 0])
  const shiny = relit([1, 1, 1])
  expect(rowOf(shiny, 6)).toEqual(rowOf(plain, 6))
  expect(rowOf(shiny, 9)[0]).toBeGreaterThan(rowOf(plain, 9)[0]! + 10)
})
