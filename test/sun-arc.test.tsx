import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vitest"

import { SunArc } from "@/components/ui/sun-arc"
import { sunArc } from "@/components/ui/sun-arc-primitive"
import { calendarIn, skyAt, solarDay, sunAltitude } from "@/components/ui/sun-arc-solar"
import { parseActionRefusal } from "@/lib/action-refusal"

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

const coruna = { latitude: 43.37, longitude: -8.4, timeZone: "Europe/Madrid", date: new Date("2026-11-25T12:00:00Z") }
const placeOf = (latitude: number, longitude: number, timeZone: string, iso: string) => ({
  latitude,
  longitude,
  ...calendarIn(new Date(iso), timeZone),
})
const clock = (minutes: number | undefined) =>
  minutes === undefined
    ? "none"
    : `${String(Math.floor(minutes / 60))}:${String(Math.round(minutes % 60)).padStart(2, "0")}`

const arc = () => screen.getByRole<HTMLInputElement>("slider", { name: "Time" })

test("sunrise, solar noon and sunset match the almanac within two minutes", () => {
  const cases = [
    { place: placeOf(43.37, -8.4, "Europe/Madrid", "2026-11-25T12:00:00Z"), rise: 519, noon: 801, set: 1083 },
    { place: placeOf(40.71, -74.0, "America/New_York", "2026-06-21T12:00:00Z"), rise: 325, noon: 777, set: 1231 },
    { place: placeOf(-33.87, 151.2, "Australia/Sydney", "2026-01-10T00:00:00Z"), rise: 354, noon: 782, set: 1210 },
  ]
  for (const { place, rise, noon, set } of cases) {
    const day = solarDay(place)
    expect(day.kind).toBe("day")
    expect(Math.abs((day.sunrise ?? 0) - rise), `sunrise ${clock(day.sunrise)}`).toBeLessThanOrEqual(2)
    expect(Math.abs(day.noon - noon), `noon ${clock(day.noon)}`).toBeLessThanOrEqual(2)
    expect(Math.abs((day.sunset ?? 0) - set), `sunset ${clock(day.sunset)}`).toBeLessThanOrEqual(2)
  }
})

test("a polar night and a polar day have no sunrise or sunset", () => {
  const night = solarDay(placeOf(78.2, 15.6, "Arctic/Longyearbyen", "2026-12-21T12:00:00Z"))
  const day = solarDay(placeOf(78.2, 15.6, "Arctic/Longyearbyen", "2026-06-21T12:00:00Z"))
  expect(night).toMatchObject({ kind: "polar-night", sunrise: undefined, sunset: undefined })
  expect(day).toMatchObject({ kind: "polar-day", sunrise: undefined, sunset: undefined })
})

test("the sun stands at about 0° at sunrise and highest at noon; the sky darkens as it sets", () => {
  const place = placeOf(43.37, -8.4, "Europe/Madrid", "2026-11-25T12:00:00Z")
  const day = solarDay(place)
  expect(Math.abs(sunAltitude(place, day.sunrise ?? 0))).toBeLessThan(1)
  expect(sunAltitude(place, day.noon)).toBeGreaterThan(sunAltitude(place, day.noon - 60))
  expect(sunAltitude(place, day.noon)).toBeGreaterThan(sunAltitude(place, day.noon + 60))
  expect(skyAt(40).night).toBe(0)
  expect(skyAt(-20).night).toBe(1)
  expect(skyAt(1).dusk).toBeGreaterThan(0.9)
})

test("primitive: renders on the server", () => {
  checkServer(sunArc, {}, `<root aria-label="Meeting time"></root>`)
})

test("the picker renders on the server with the sky and the sun at its value", () => {
  const html = renderToString(<SunArc label="Meeting time" {...coruna} defaultValue={860} locale="en-US" />)
  expect(html).toContain('data-slot="sun-arc-stage"')
  expect(html).toContain("--sun-arc-zenith")
  expect(html).toContain("2:20")
})

test("the arc is a slider in minutes: arrows by the step, Page Up an hour, Home and End the day's ends", async () => {
  const user = userEvent.setup()
  render(<SunArc label="Meeting time" {...coruna} defaultValue={860} locale="en-US" />)
  expect(arc().getAttribute("aria-valuetext")).toBe("2:20 PM")
  arc().focus()
  await user.keyboard("{ArrowRight}")
  expect(arc().value).toBe("865")
  await user.keyboard("{PageUp}")
  expect(arc().value).toBe("925")
  await user.keyboard("{Home}")
  expect(arc().value).toBe("0")
  await user.keyboard("{End}")
  expect(arc().value).toBe("1435")
})

test("the time and the altitude are written in the locale", () => {
  render(<SunArc label="Meeting time" {...coruna} defaultValue={860} locale="de-DE" />)
  expect(arc().getAttribute("aria-valuetext")).toBe("14:20")
  expect(screen.getByText(/^2\d°$/)).toBeTruthy()
})

test("the presets move the sun to sunrise, solar noon and sunset, controlled", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  function Controlled() {
    const [minutes, setMinutes] = useState(600)
    return (
      <SunArc
        label="Meeting time"
        {...coruna}
        value={minutes}
        onValueChange={(next, details) => {
          onValueChange(next, details)
          setMinutes(next)
        }}
        step={1}
        locale="en-US"
      />
    )
  }
  render(<Controlled />)
  await user.click(screen.getByRole("button", { name: /Sunrise/ }))
  expect(arc().value).toBe("519")
  await user.click(screen.getByRole("button", { name: /Sunset/ }))
  expect(arc().value).toBe("1083")
  await user.click(screen.getByRole("button", { name: /Solar noon/ }))
  expect(arc().value).toBe("801")
  expect(onValueChange).toHaveBeenLastCalledWith(801, expect.objectContaining({ reason: "imperative" }))
})

test("labels are overridable", () => {
  render(<SunArc label="Hora" {...coruna} labels={{ time: "Hora del día", sunrise: "Amanecer" }} />)
  expect(screen.getByRole("slider", { name: "Hora del día" })).toBeTruthy()
  expect(screen.getByRole("button", { name: /Amanecer/ })).toBeTruthy()
})

test("disabled, the arc can't be moved and an agent is told why", async () => {
  render(<SunArc label="Meeting time" {...coruna} defaultValue={600} disabled />)
  expect(arc().disabled).toBe(true)
  const result = await act(() => agent.act({ steps: [{ ref: "Meeting time", action: "setTime", args: [700] }] }))
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("isn't available while the picker is disabled")
  expect(arc().value).toBe("600")
})

test("it has no axe violations", async () => {
  const { container } = render(<SunArc label="Meeting time" {...coruna} />)
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the picker and its arc, and sets a time or a preset", async () => {
  render(<SunArc label="Meeting time" {...coruna} defaultValue={600} step={1} />)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const picker = entries.find((entry) => entry.label === "Meeting time")
  expect(picker?.actions).toEqual(expect.arrayContaining(["setTime", "sunrise", "sunset", "solarNoon"]))
  expect(entries.map((entry) => entry.label)).toContain("Time")

  let result = await act(() => agent.act({ steps: [{ ref: "Meeting time", action: "setTime", args: ["17:45"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(arc().value).toBe("1065")

  result = await act(() => agent.act({ steps: [{ ref: "Meeting time", action: "sunrise" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(arc().value).toBe("519")

  result = await act(() => agent.act({ steps: [{ ref: "Meeting time", action: "setTime", args: ["25:00"] }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "setTime", kind: "unavailable" })
  expect(arc().value).toBe("519")
})

test("in a polar night the sunrise and sunset buttons are disabled and an agent's sunrise fails with why", async () => {
  render(
    <SunArc
      label="Arctic time"
      latitude={78.2}
      longitude={15.6}
      timeZone="Arctic/Longyearbyen"
      date={new Date("2026-12-21T12:00:00Z")}
    />,
  )
  expect(screen.getByRole<HTMLButtonElement>("button", { name: /Sunrise/ }).disabled).toBe(true)
  const result = await act(() => agent.act({ steps: [{ ref: "Arctic time", action: "sunrise" }] }))
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("the sun doesn't rise on this day here (polar night)")
})
