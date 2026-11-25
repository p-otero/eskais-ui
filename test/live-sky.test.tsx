import { readFileSync } from "node:fs"
import { join } from "node:path"

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { afterEach, expect, test, vi } from "vitest"

import { LiveSky, type LiveSkySimulation } from "@/components/ui/live-sky"
import { moonPhase, sunPosition } from "@/components/ui/live-sky-astronomy"
import { skyConditions } from "@/components/ui/live-sky-conditions"
import { createGlass } from "@/components/ui/live-sky-glass"
import { skyPaletteDefaults } from "@/components/ui/live-sky-palette"
import { liveSky } from "@/components/ui/live-sky-primitive"
import { seededRandom } from "@/components/ui/live-sky-street"
import { createOpenMeteo, parseForecast, type SkyWeather } from "@/components/ui/live-sky-weather"

import { axeViolations } from "./axe"

const agent = createAgent()

window.matchMedia ??= ((media: string) => ({
  matches: false,
  media,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})) as unknown as typeof window.matchMedia

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const degrees = (radians: number) => (radians * 180) / Math.PI
const coruna = { latitude: 43.3713, longitude: -8.3959, name: "A Coruña" }

const weather = (overrides: Partial<SkyWeather> = {}): SkyWeather => ({
  time: Date.UTC(2026, 10, 25, 12),
  temperature: 12,
  precipitation: 0,
  rain: 0,
  showers: 0,
  snowfall: 0,
  cloudCover: 40,
  weatherCode: 2,
  windSpeed: 10,
  windDirection: 240,
  visibility: 24_000,
  isDay: true,
  nextHours: [],
  ...overrides,
})

const simulation = (overrides: Partial<SkyWeather> = {}): LiveSkySimulation => ({
  location: coruna,
  time: Date.UTC(2026, 10, 25, 11),
  weather: { cloudCover: 100, weatherCode: 63, precipitation: 2.4, rain: 2.4, temperature: 12, ...overrides },
})

const forecastBody = {
  current: {
    time: 1_795_600_800,
    interval: 900,
    temperature_2m: 12.4,
    precipitation: 0.6,
    rain: 0.6,
    showers: 0,
    snowfall: 0,
    cloud_cover: 100,
    weather_code: 63,
    wind_speed_10m: 21.6,
    wind_direction_10m: 250,
    is_day: 1,
    visibility: 9000,
  },
  hourly: { time: [1_795_600_800, 1_795_604_400], precipitation: [2.1, 3.4] },
}

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })

test("the sun stands where it should over A Coruña: about 26° up at noon in late November, below the horizon at night", () => {
  const noon = sunPosition(new Date(Date.UTC(2026, 10, 25, 12, 40)), coruna.latitude, coruna.longitude)
  expect(degrees(noon.altitude)).toBeGreaterThan(24)
  expect(degrees(noon.altitude)).toBeLessThan(27)
  expect(degrees(noon.azimuth)).toBeGreaterThan(170)
  expect(degrees(noon.azimuth)).toBeLessThan(190)
  const night = sunPosition(new Date(Date.UTC(2026, 10, 25, 23)), coruna.latitude, coruna.longitude)
  expect(degrees(night.altitude)).toBeLessThan(-30)
})

test("the moon is full on 24 November 2026 and new on 9 November", () => {
  expect(moonPhase(new Date(Date.UTC(2026, 10, 24, 15))).fraction).toBeGreaterThan(0.98)
  expect(moonPhase(new Date(Date.UTC(2026, 10, 9, 12))).fraction).toBeLessThan(0.03)
})

test("Open-Meteo's current amounts, summed over 15 minutes, become rates per hour", () => {
  const parsed = parseForecast(forecastBody)
  expect(parsed.precipitation).toBeCloseTo(2.4)
  expect(parsed.rain).toBeCloseTo(2.4)
  expect(parsed.weatherCode).toBe(63)
  expect(parsed.isDay).toBe(true)
  expect(parsed.nextHours).toEqual([
    { time: 1_795_600_800_000, precipitation: 2.1 },
    { time: 1_795_604_400_000, precipitation: 3.4 },
  ])
  expect(() => parseForecast({})).toThrow("Open-Meteo sent no current weather.")
})

test("the fetchers round coordinates to 2 decimals and send the key to a configured host", async () => {
  const fetch = vi.fn((url: URL) =>
    Promise.resolve(
      json(
        url.pathname.endsWith("search")
          ? {
              results: [
                {
                  id: 3_119_841,
                  name: "A Coruña",
                  latitude: 43.37135,
                  longitude: -8.396,
                  admin1: "Galicia",
                  country: "Spain",
                },
              ],
            }
          : forecastBody,
      ),
    ),
  )
  const meteo = createOpenMeteo({
    forecastUrl: "https://customer-api.open-meteo.com/v1/forecast",
    geocodingUrl: "https://customer-geocoding-api.open-meteo.com/v1/search",
    apiKey: "secret",
    fetch: fetch as unknown as typeof globalThis.fetch,
  })
  await meteo.fetchWeather(coruna, { signal: new AbortController().signal })
  const forecastUrl = fetch.mock.calls[0]![0]
  expect(forecastUrl.host).toBe("customer-api.open-meteo.com")
  expect(forecastUrl.searchParams.get("latitude")).toBe("43.37")
  expect(forecastUrl.searchParams.get("longitude")).toBe("-8.4")
  expect(forecastUrl.searchParams.get("apikey")).toBe("secret")
  expect(forecastUrl.searchParams.get("current")).toContain("weather_code")
  const places = await meteo.searchPlaces("Coruña", { signal: new AbortController().signal })
  expect(places).toEqual([
    { id: "3119841", name: "A Coruña", latitude: 43.37, longitude: -8.4, region: "Galicia", country: "Spain" },
  ])
  expect(await meteo.searchPlaces("A", { signal: new AbortController().signal })).toEqual([])
  expect(fetch).toHaveBeenCalledTimes(2)
})

test("drizzle, rain and downpour are told apart by code and rate; snow and fog by code and visibility", () => {
  const at = new Date(Date.UTC(2026, 10, 25, 12))
  const kind = (overrides: Partial<SkyWeather>) => skyConditions(weather(overrides), coruna, at)
  expect(kind({ weatherCode: 53, precipitation: 0.2 }).rainKind).toBe("drizzle")
  expect(kind({ weatherCode: 63, precipitation: 2.4, rain: 2.4 }).rainKind).toBe("rain")
  expect(kind({ weatherCode: 65, precipitation: 9, rain: 9 }).rainKind).toBe("downpour")
  expect(kind({ weatherCode: 61, precipitation: 12, rain: 12 }).rainKind).toBe("downpour")
  expect(kind({ weatherCode: 2 }).rainKind).toBe("none")
  const snow = kind({ weatherCode: 73, snowfall: 1.2 })
  expect(snow.snowRate).toBeGreaterThan(0)
  expect(snow.rainKind).toBe("none")
  expect(kind({ weatherCode: 45, visibility: 200 }).fog).toBeGreaterThan(0.9)
  expect(kind({ weatherCode: 1, visibility: 30_000 }).fog).toBe(0)
  const windy = kind({ windSpeed: 36, windDirection: 270 })
  expect(windy.wind.east).toBeCloseTo(10)
})

test("drops land on the glass in rain, the heavy ones run down, and they dry once it stops", () => {
  const glass = createGlass(seededRandom(7))
  const rain = skyConditions(weather({ weatherCode: 65, precipitation: 12, rain: 12 }), coruna, new Date())
  glass.setRain(rain, 800, 500, 1)
  let ran = false
  for (let step = 0; step < 300; step++) {
    glass.step(1 / 30)
    ran ||= glass.drops.some((drop) => drop.speed > 0)
  }
  expect(glass.drops.length).toBeGreaterThan(20)
  expect(ran).toBe(true)
  glass.setRain(skyConditions(weather(), coruna, new Date()), 800, 500, 1)
  for (let step = 0; step < 3000; step++) glass.step(1 / 30)
  expect(glass.drops).toEqual([])
})

test("the item's css holds every palette colour with its default", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "registry", "styles", "live-sky.css"), "utf8")
  for (const [key, value] of Object.entries(skyPaletteDefaults)) expect(css).toContain(`--live-sky-${key}: ${value};`)
})

test("primitive: renders on the server", () => {
  checkServer(liveSky, {}, `<root aria-label="Sky"></root>`)
})

test("it renders on the server with its readout and an aria-hidden scene", () => {
  const html = renderToString(<LiveSky label="Sky" simulate={simulation()} />)
  expect(html).toContain('data-slot="live-sky-scene"')
  expect(html).toContain("Moderate rain")
  expect(html).toContain("A Coruña")
})

test("simulated, it shows the weather and a summary for screen readers without fetching", () => {
  const fetchWeather = vi.fn()
  render(<LiveSky label="Sky" simulate={simulation()} fetchWeather={fetchWeather} />)
  const sky = screen.getByRole("group", { name: "Sky" })
  expect(sky.querySelector('[data-slot="live-sky-scene"]')?.getAttribute("aria-hidden")).toBe("true")
  expect(screen.getByText("Moderate rain")).toBeTruthy()
  const summary = document.getElementById(sky.getAttribute("aria-describedby") ?? "")
  expect(summary?.textContent).toMatch(/^Moderate rain, 12\s?°C, sun behind clouds$/)
  expect(fetchWeather).not.toHaveBeenCalled()
})

test("labels translate the descriptions and the summary", () => {
  render(
    <LiveSky
      label="Ceo"
      simulate={simulation()}
      labels={{
        conditions: { rain: "Choiva moderada" },
        sun: { behindClouds: "sol tras as nubes" },
        summary: ({ condition, sun }) => `${condition}; ${sun}`,
      }}
    />,
  )
  expect(screen.getByText("Choiva moderada")).toBeTruthy()
  expect(screen.getByText("Choiva moderada; sol tras as nubes")).toBeTruthy()
})

test("a place fetches its weather, rounded, shows it and calls onWeather; refresh fetches again", async () => {
  const fetchWeather = vi.fn(() => Promise.resolve(weather({ weatherCode: 61, precipitation: 0.8, rain: 0.8 })))
  const onWeather = vi.fn()
  render(
    <LiveSky label="Sky" location={coruna} fetchWeather={fetchWeather} searchPlaces={false} onWeather={onWeather} />,
  )
  await screen.findByText("Light rain")
  expect(fetchWeather).toHaveBeenCalledWith({ ...coruna, latitude: 43.37, longitude: -8.4 }, expect.anything())
  expect(onWeather).toHaveBeenCalledOnce()
  const result = await act(() => agent.act({ steps: [{ ref: "Sky", action: "refresh" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(fetchWeather).toHaveBeenCalledTimes(2))
})

test("it fetches again every refreshMs while visible", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] })
  const fetchWeather = vi.fn(() => Promise.resolve(weather()))
  render(<LiveSky label="Sky" location={coruna} fetchWeather={fetchWeather} searchPlaces={false} refreshMs={60_000} />)
  await act(() => vi.advanceTimersByTimeAsync(10))
  expect(fetchWeather).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(60_000))
  expect(fetchWeather).toHaveBeenCalledTimes(2)
})

test("a failed fetch says so and offers a retry", async () => {
  const user = userEvent.setup()
  const fetchWeather = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(weather({ weatherCode: 0 }))
  render(<LiveSky label="Sky" location={coruna} fetchWeather={fetchWeather} searchPlaces={false} />)
  await user.click(await screen.findByRole("button", { name: "Try again" }))
  expect(await screen.findByText("Clear sky")).toBeTruthy()
  expect(fetchWeather).toHaveBeenCalledTimes(2)
})

test("the place search waits for typing to pause, then a chosen place shows its sky", async () => {
  const user = userEvent.setup()
  const searchPlaces = vi.fn(() =>
    Promise.resolve([
      { id: "1", name: "A Coruña", latitude: 43.37, longitude: -8.4, region: "Galicia", country: "Spain" },
    ]),
  )
  const fetchWeather = vi.fn(() => Promise.resolve(weather({ weatherCode: 3 })))
  const onLocationChange = vi.fn()
  render(
    <LiveSky label="Sky" searchPlaces={searchPlaces} fetchWeather={fetchWeather} onLocationChange={onLocationChange} />,
  )
  await user.type(screen.getByRole("combobox", { name: "Search for a place" }), "Coruña")
  await user.click(await screen.findByRole("option", { name: /A Coruña/ }))
  expect(searchPlaces).toHaveBeenCalledTimes(1)
  expect(onLocationChange).toHaveBeenCalledWith(expect.objectContaining({ name: "A Coruña", latitude: 43.37 }))
  await screen.findByText("Overcast")
})

test("the location button asks the browser, and an agent's geolocate fails with why once access is denied", async () => {
  const user = userEvent.setup()
  const getCurrentPosition = vi.fn((_found: PositionCallback, failed?: PositionErrorCallback | null) =>
    failed?.({
      code: 1,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
      message: "denied",
    } as GeolocationPositionError),
  )
  vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } })
  render(<LiveSky label="Sky" searchPlaces={false} fetchWeather={vi.fn()} />)
  await user.click(screen.getByRole("button", { name: "Use my location" }))
  expect(getCurrentPosition).toHaveBeenCalledOnce()
  await screen.findByText("Location access is blocked in this browser.")
  expect(
    screen.getByRole("button", { name: "Use my location" }).hasAttribute("disabled") ||
      screen.getByRole("button", { name: "Use my location" }).getAttribute("aria-disabled") === "true",
  ).toBe(true)
  const result = await act(() => agent.act({ steps: [{ ref: "Sky", action: "geolocate" }] }))
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("denied location access")
})

test("geolocated, it rounds the position and names it", async () => {
  const user = userEvent.setup()
  const getCurrentPosition = vi.fn((found: PositionCallback) =>
    found({ coords: { latitude: 43.371_234, longitude: -8.395_678 } } as GeolocationPosition),
  )
  vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } })
  const fetchWeather = vi.fn(() => Promise.resolve(weather({ weatherCode: 1 })))
  const onLocationChange = vi.fn()
  render(<LiveSky label="Sky" searchPlaces={false} fetchWeather={fetchWeather} onLocationChange={onLocationChange} />)
  await user.click(screen.getByRole("button", { name: "Use my location" }))
  expect(onLocationChange).toHaveBeenCalledWith({ latitude: 43.37, longitude: -8.4, name: "Your location" })
  await screen.findByText("Mainly clear")
})

test("an agent reads the summary and moves the sky by coordinates or by name", async () => {
  const fetchWeather = vi.fn(() => Promise.resolve(weather({ weatherCode: 63, precipitation: 2, rain: 2 })))
  const searchPlaces = vi.fn(() => Promise.resolve([{ id: "2", name: "Vigo", latitude: 42.24, longitude: -8.72 }]))
  const onLocationChange = vi.fn()
  render(
    <LiveSky label="Sky" fetchWeather={fetchWeather} searchPlaces={searchPlaces} onLocationChange={onLocationChange} />,
  )
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const sky = entries.find((entry) => entry.label === "Sky")
  expect(sky?.actions).toEqual(expect.arrayContaining(["setLocation", "geolocate", "refresh"]))
  expect(entries.map((entry) => entry.label)).toEqual(expect.arrayContaining(["Search for a place", "Use my location"]))

  let result = await act(() =>
    agent.act({ steps: [{ ref: "Sky", action: "setLocation", args: [43.3713, -8.3959, "A Coruña"] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  await screen.findByText("Moderate rain")
  expect(fetchWeather).toHaveBeenLastCalledWith(
    { latitude: 43.37, longitude: -8.4, name: "A Coruña" },
    expect.anything(),
  )
  await waitFor(() =>
    expect(agent.snapshot().find((entry) => entry.label === "Sky")?.value).toMatch(/^Moderate rain, 12\s?°C/),
  )

  result = await act(() => agent.act({ steps: [{ ref: "Sky", action: "setLocation", args: ["Vigo"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(onLocationChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Vigo" })))

  result = await act(() => agent.act({ steps: [{ ref: "Sky", action: "setLocation", args: [120, 0] }] }))
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("takes a latitude from -90 to 90")
})

test("simulated, an agent's actions fail with why", async () => {
  render(<LiveSky label="Sky" simulate={simulation()} />)
  for (const action of ["refresh", "geolocate"]) {
    const result = await act(() => agent.act({ steps: [{ ref: "Sky", action }] }))
    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain("isn't available while the sky shows simulated weather")
  }
})

test("it has no axe violations", async () => {
  const { container } = render(
    <LiveSky label="Sky" location={coruna} fetchWeather={() => Promise.resolve(weather())} />,
  )
  await screen.findByText("Partly cloudy")
  expect(await axeViolations(container)).toEqual([])
})
