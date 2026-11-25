import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { afterEach, expect, test, vi } from "vitest"

import { LedMatrix } from "@/components/ui/led-matrix"
import { glyphOf, hasGlyph, pagesOf, textColumns } from "@/components/ui/led-matrix-font"
import { ledMatrix } from "@/components/ui/led-matrix-primitive"

import { axeViolations } from "./axe"

const agent = createAgent()

afterEach(() => {
  vi.useRealTimers()
})

const sign = () => screen.getByRole("marquee", { name: "Pharmacy" })
const text = () => sign().querySelector('[data-slot="led-matrix-text"]')?.textContent

test("the font draws every printable Latin-1 character and the euro sign itself", () => {
  const printable = [
    ...Array.from({ length: 95 }, (_, index) => String.fromCodePoint(32 + index)),
    ...Array.from({ length: 96 }, (_, index) => String.fromCodePoint(160 + index)),
    "€",
  ]
  expect(printable.filter((char) => !hasGlyph(char))).toEqual([])
})

const bottom = (char: string) => glyphOf(char).columns.map((column) => column >> 2)

test("an accented letter keeps its letter under the mark, and a character the font lacks falls back", () => {
  expect(bottom("á")).toEqual(bottom("a"))
  expect(bottom("ñ")).toEqual(bottom("n"))
  expect(glyphOf("é").columns).not.toEqual(glyphOf("e").columns)
  expect(glyphOf("ő").columns).toEqual(glyphOf("o").columns)
  expect(glyphOf("漢").columns).toEqual(glyphOf("?").columns)
})

test("text becomes columns of dots, one blank column between characters, scaled for a taller sign", () => {
  expect(textColumns("I").length).toBe(3)
  expect(textColumns("II")).toEqual([...textColumns("I"), 0, ...textColumns("I")])
  expect(textColumns("1").length).toBe(5)
  expect(textColumns("I", 2).length).toBe(6)
  expect(Math.max(...textColumns("I", 2))).toBeGreaterThan(Math.max(...textColumns("I")))
})

test("a message too long for the sign splits into pages at words, and a long word between characters", () => {
  expect(pagesOf("Open until ten", 30)).toEqual(["Open", "until", "ten"])
  for (const page of pagesOf("Pharmacy on duty tonight", 40)) expect(textColumns(page).length).toBeLessThanOrEqual(40)
  expect(pagesOf("Supercalifragilistic", 30).join("")).toBe("Supercalifragilistic")
})

test("primitive: renders on the server as a marquee", () => {
  checkServer(ledMatrix, { defaultMessages: ["Open"] }, `<root aria-label="Sign"></root>`)
})

test("the sign renders on the server with its first message as text", () => {
  const html = renderToString(<LedMatrix label="Pharmacy" defaultMessages={["Open until 22:00"]} />)
  expect(html).toContain('role="marquee"')
  expect(html).toContain("Open until 22:00")
  expect(html).toContain('aria-live="off"')
})

test("held messages take turns, and the text screen readers find follows the sign", async () => {
  vi.useFakeTimers()
  render(<LedMatrix label="Pharmacy" mode="hold" holdMs={1000} defaultMessages={["Open", "Closed Sunday"]} />)
  expect(text()).toBe("Open")
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(text()).toBe("Closed Sunday")
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(text()).toBe("Open")
})

test("the pause toggle stops the sign, and live polite reads each message", async () => {
  const user = userEvent.setup()
  const onPausedChange = vi.fn()
  render(<LedMatrix label="Pharmacy" live="polite" defaultMessages={["Open"]} onPausedChange={onPausedChange} />)
  expect(sign().getAttribute("aria-live")).toBe("polite")
  const pause = screen.getByRole("button", { name: "Pause" })
  await user.click(pause)
  expect(pause.getAttribute("aria-pressed")).toBe("true")
  expect(sign().hasAttribute("data-paused")).toBe(true)
  expect(onPausedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: "trigger-press" }))
})

test("the pause label is overridable and the toggle can be left out", () => {
  const { unmount } = render(<LedMatrix label="Pharmacy" defaultMessages={["Open"]} labels={{ pause: "Pausar" }} />)
  expect(screen.getByRole("button", { name: "Pausar" })).toBeTruthy()
  unmount()
  render(<LedMatrix label="Pharmacy" defaultMessages={["Open"]} controls={false} />)
  expect(screen.queryByRole("button")).toBeNull()
})

test("it has no axe violations", async () => {
  const { container } = render(<LedMatrix label="Pharmacy" defaultMessages={["Open"]} />)
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the sign, sets its messages, pauses and resumes it", async () => {
  render(<LedMatrix label="Pharmacy" defaultMessages={["Open"]} />)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(entries.find((entry) => entry.label === "Pharmacy")?.actions).toEqual(
    expect.arrayContaining(["setMessages", "pause", "resume"]),
  )

  let result = await act(() =>
    agent.act({ steps: [{ ref: "Pharmacy", action: "setMessages", args: [["On duty tonight", "Tel. 555 0142"]] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(text()).toBe("On duty tonight")

  result = await act(() => agent.act({ steps: [{ ref: "Pharmacy", action: "pause" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("button", { name: "Pause" }).getAttribute("aria-pressed")).toBe("true")

  result = await act(() => agent.act({ steps: [{ ref: "Pharmacy", action: "resume" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(sign().hasAttribute("data-paused")).toBe(false)
})
