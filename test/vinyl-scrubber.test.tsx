import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vitest"

import { VinylScrubber } from "@/components/ui/vinyl-scrubber"
import { secondsOf, vinylScrubber } from "@/components/ui/vinyl-scrubber-primitive"
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

const position = () => screen.getByRole<HTMLInputElement>("slider", { name: "Position" })
const play = () => screen.getByRole("button", { name: "Play" })

function fakeMedia(duration: number) {
  const element = document.createElement("audio")
  let time = 0
  let paused = true
  Object.defineProperties(element, {
    duration: { get: () => duration },
    paused: { get: () => paused },
    currentTime: {
      get: () => time,
      set: (next: number) => {
        time = next
        element.dispatchEvent(new Event("timeupdate"))
      },
    },
  })
  element.play = vi.fn(() => {
    paused = false
    element.dispatchEvent(new Event("play"))
    return Promise.resolve()
  })
  element.pause = vi.fn(() => {
    paused = true
    element.dispatchEvent(new Event("pause"))
  })
  return element
}

function ControlledPlayer() {
  const [time, setTime] = useState(10)
  const [playing, setPlaying] = useState(false)
  return (
    <VinylScrubber
      label="Track"
      value={time}
      duration={60}
      onValueChange={setTime}
      playing={playing}
      onPlayingChange={setPlaying}
    />
  )
}

test("a time reads from seconds, m:ss or h:mm:ss", () => {
  expect(secondsOf(72)).toBe(72)
  expect(secondsOf("1:12")).toBe(72)
  expect(secondsOf("1:01:12")).toBe(3672)
  expect(secondsOf("1:2")).toBeUndefined()
})

test("primitive: renders on the server", () => {
  checkServer(vinylScrubber, {}, `<root aria-label="Track"></root>`)
})

test("the scrubber renders on the server with the record and the time", () => {
  const html = renderToString(<VinylScrubber label="Track" duration={400} defaultValue={72} title="Side A" />)
  expect(html).toContain('data-slot="vinyl-record"')
  expect(html).toContain("1:12")
  expect(html).toContain("Side A")
})

test("the timeline is a slider in seconds: arrows by the step, Page Up 30 s, Home and End", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<VinylScrubber label="Track" duration={400} defaultValue={72} onValueChange={onValueChange} />)
  expect(position().getAttribute("aria-valuetext")).toBe("1:12 / 6:40")
  position().focus()
  await user.keyboard("{ArrowRight}")
  expect(position().value).toBe("75")
  await user.keyboard("{PageUp}")
  expect(position().value).toBe("105")
  expect(onValueChange).toHaveBeenLastCalledWith(105, expect.objectContaining({ reason: "step-key" }))
  await user.keyboard("{End}")
  expect(position().value).toBe("400")
})

test("with media, it follows the element and seeks, plays and pauses it", async () => {
  const user = userEvent.setup()
  const element = fakeMedia(240)
  const media = { current: element }
  render(<VinylScrubber label="Track" media={media} />)
  act(() => {
    element.currentTime = 30
  })
  expect(position().value).toBe("30")
  position().focus()
  await user.keyboard("{ArrowRight}")
  expect(element.currentTime).toBe(35)
  await user.click(play())
  expect(element.play).toHaveBeenCalledOnce()
  expect(play().getAttribute("aria-pressed")).toBe("true")
  await user.click(play())
  expect(element.pause).toHaveBeenCalledOnce()
  expect(play().getAttribute("aria-pressed")).toBe("false")
})

test("a drag on the record scratches: a quarter turn forward moves 0.45 s", () => {
  const onValueChange = vi.fn()
  render(<VinylScrubber label="Track" duration={400} defaultValue={72} onValueChange={onValueChange} />)
  const table = document.querySelector<HTMLElement>('[data-slot="vinyl-turntable"]')!
  table.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 200,
    height: 200,
    right: 200,
    bottom: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  table.setPointerCapture = () => {}
  fireEvent.pointerDown(table, { pointerId: 1, button: 0, clientX: 100, clientY: 20 })
  fireEvent.pointerMove(table, { pointerId: 1, clientX: 180, clientY: 100 })
  fireEvent.pointerUp(table, { pointerId: 1, clientX: 180, clientY: 100 })
  const [seconds, details] = onValueChange.mock.lastCall as [number, { reason: string }]
  expect(seconds).toBeCloseTo(72.45, 5)
  expect(details.reason).toBe("scratch")
})

test("controlled, it shows the value and playing it is given", async () => {
  const user = userEvent.setup()
  render(<ControlledPlayer />)
  position().focus()
  await user.keyboard("{ArrowLeft}")
  expect(position().value).toBe("5")
  await user.click(play())
  expect(play().getAttribute("aria-pressed")).toBe("true")
})

test("labels are overridable", () => {
  render(<VinylScrubber label="Pista" duration={60} labels={{ position: "Posición", play: "Reproducir" }} />)
  expect(screen.getByRole("slider", { name: "Posición" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Reproducir" })).toBeTruthy()
})

test("it has no axe violations", async () => {
  const { container } = render(<VinylScrubber label="Track" duration={400} peaks={[0.2, 0.8, 0.5]} />)
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the player and seeks, plays and pauses; a seek past the end fails with why", async () => {
  const element = fakeMedia(240)
  render(<VinylScrubber label="Track" media={{ current: element }} />)
  act(() => {
    element.currentTime = 0
  })
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(entries.find((entry) => entry.label === "Track")?.actions).toEqual(
    expect.arrayContaining(["seek", "play", "pause"]),
  )
  expect(entries.map((entry) => entry.label)).toEqual(expect.arrayContaining(["Position", "Play"]))

  let result = await act(() => agent.act({ steps: [{ ref: "Track", action: "seek", args: ["2:05"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(element.currentTime).toBe(125)

  result = await act(() => agent.act({ steps: [{ ref: "Track", action: "play" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(element.play).toHaveBeenCalledOnce()

  result = await act(() => agent.act({ steps: [{ ref: "Track", action: "pause" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(element.pause).toHaveBeenCalledOnce()

  result = await act(() => agent.act({ steps: [{ ref: "Track", action: "seek", args: [900] }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "seek", kind: "unavailable" })
  expect(result.error?.message).toContain("takes 0 to 240 seconds")
  expect(element.currentTime).toBe(125)
})

test("before the duration is known, play and seek fail with why", async () => {
  render(<VinylScrubber label="Loading track" />)
  const result = await act(() => agent.act({ steps: [{ ref: "Loading track", action: "play" }] }))
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("isn't available until the media's duration is known")
})
