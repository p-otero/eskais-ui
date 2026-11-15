import { act, render, renderHook, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { AcceptanceBar, AcceptanceList, countAcceptance } from "@/components/ui/acceptance-list"
import { QuantityValue } from "@/components/ui/quantity-value"
import { RelativeTime, useNow } from "@/components/ui/relative-time"
import { Stat, StatGroup, StatHint, StatLabel, StatValue } from "@/components/ui/stat"

import { axeViolations } from "./axe"

const now = "2026-11-15T12:00:00Z"
const criteria = [
  { text: "Builds without warnings", result: "pass", evidence: "CI run 812" },
  { text: "Covers the empty state", result: "pass" },
  { text: "Meets contrast", result: "fail", evidence: "2.8:1 on glass" },
  { text: "Works offline", result: "unverified" },
  { text: "Survives a reload", result: "unverified" },
] as const

let originalTimeZone: string | undefined
beforeEach(() => {
  originalTimeZone = process.env.TZ
  process.env.TZ = "Europe/Madrid"
})
afterEach(() => {
  vi.useRealTimers()
  if (originalTimeZone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimeZone
})

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event("visibilitychange"))
}

test("useNow with a fixed now never ticks", () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useNow({ now, intervalMs: 1000 }))
  expect(result.current).toBe(Date.parse(now))
  act(() => vi.advanceTimersByTime(10_000))
  expect(result.current).toBe(Date.parse(now))
  expect(vi.getTimerCount()).toBe(0)
})

test("useNow ticks on its interval and pauses while the page is hidden", () => {
  vi.useFakeTimers({ now: Date.parse(now) })
  const { result, unmount } = renderHook(() => useNow({ intervalMs: 1000 }))
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current).toBe(Date.parse(now) + 1000)

  act(() => setHidden(true))
  act(() => vi.advanceTimersByTime(5000))
  expect(result.current).toBe(Date.parse(now) + 1000)
  expect(vi.getTimerCount()).toBe(0)

  act(() => setHidden(false))
  expect(result.current).toBe(Date.parse(now) + 6000)
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current).toBe(Date.parse(now) + 7000)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

test("quantity values show honest text, screen reader text and a title", () => {
  render(
    <>
      <QuantityValue data-testid="measured" value={{ value: 1200, quality: "measured" }} locale="en-US" />
      <QuantityValue
        data-testid="estimated"
        value={{ value: 3.5, quality: "estimated", source: "tokenizer" }}
        locale="en-US"
      />
      <QuantityValue
        data-testid="unknown"
        value={{ value: null, quality: "unknown" }}
        labels={{ unknown: "sin dato" }}
      />
    </>,
  )
  const measured = screen.getByTestId("measured")
  expect(measured.textContent).toBe("1,2001,200")
  expect(measured.title).toBe("")
  const estimated = screen.getByTestId("estimated")
  expect(estimated.dataset.quality).toBe("estimated")
  expect(estimated.querySelector('[aria-hidden="true"]')?.textContent).toBe("~3.5")
  expect(estimated.querySelector(".sr-only")?.textContent).toBe("3.5 (estimated)")
  expect(estimated.title).toBe("estimated: tokenizer")
  expect(estimated.tabIndex).toBe(-1)
  const unknown = screen.getByTestId("unknown")
  expect(unknown.querySelector('[aria-hidden="true"]')?.textContent).toBe("—")
  expect(unknown.querySelector(".sr-only")?.textContent).toBe("sin dato")
})

test("relative time renders a time element with the absolute instant in its title", () => {
  render(
    <>
      <RelativeTime value="2026-11-15T09:00:00Z" now={now} locale="es-ES" timeZone="UTC" />
      <RelativeTime value="2026-11-15T11:55:00Z" now={now} locale="en-US" timeZone="Europe/Madrid" />
    </>,
  )
  const utc = screen.getByText("hace 3 horas")
  expect(utc.tagName).toBe("TIME")
  expect(utc.getAttribute("datetime")).toBe("2026-11-15T09:00:00.000Z")
  expect(utc.title).toBe("15 nov 2026, 9:00 UTC")
  expect(screen.getByText("5 minutes ago").title).toBe("Nov 15, 2026, 12:55 PM")
})

test("acceptance list and bar expose results to screen readers", () => {
  render(
    <>
      <AcceptanceList criteria={criteria} labels={{ unverified: "Sin verificar" }} />
      <AcceptanceBar counts={countAcceptance(criteria)} />
      <AcceptanceBar
        counts={{ pass: 1, fail: 0, unverified: 0 }}
        labels={{ bar: "Criterios" }}
        formatSummary={({ pass }) => `${pass} superado`}
      />
    </>,
  )
  const items = screen.getAllByRole("listitem")
  expect(items.map((item) => item.dataset.result)).toEqual(["pass", "pass", "fail", "unverified", "unverified"])
  expect(items[0]?.textContent).toBe("PassedBuilds without warningsCI run 812")
  expect(items[3]?.textContent).toBe("Sin verificarWorks offline")
  expect(screen.getByText("2.8:1 on glass").className).toContain("text-muted-foreground")

  const bar = screen.getByRole("meter", { name: "Acceptance criteria" })
  expect(bar.getAttribute("aria-valuetext")).toBe("2 of 5 passed, 1 failed")
  const segments = [...bar.querySelectorAll<HTMLElement>('[data-slot="acceptance-segment"]')]
  expect(segments.map((segment) => [segment.dataset.result, segment.style.flexGrow])).toEqual([
    ["pass", "2"],
    ["fail", "1"],
    ["unverified", "2"],
  ])
  expect(screen.getByRole("meter", { name: "Criterios" }).getAttribute("aria-valuetext")).toBe("1 superado")
})

test("stat group renders a list of figures from numbers, quantities and nodes", () => {
  render(
    <StatGroup aria-label="Summary">
      <Stat>
        <StatLabel>Done</StatLabel>
        <StatValue value={1234} locale="en-US" />
      </Stat>
      <Stat>
        <StatLabel>Cost</StatLabel>
        <StatValue value={{ value: 4.2, quality: "estimated" }} format={(n) => `$${n.toFixed(2)}`} />
        <StatHint>Last 24 hours</StatHint>
      </Stat>
      <Stat>
        <StatLabel>Status</StatLabel>
        <StatValue>
          <strong>Live</strong>
        </StatValue>
      </Stat>
    </StatGroup>,
  )
  const group = screen.getByRole("list", { name: "Summary" })
  expect(group.dataset.slot).toBe("stat-group")
  expect(screen.getAllByRole("listitem")).toHaveLength(3)
  expect(screen.getByText("1,234").dataset.slot).toBe("stat-value")
  expect(screen.getByText("~$4.20")).toBeDefined()
  expect(screen.getByText("Live").tagName).toBe("STRONG")
})

test("a page of values has no axe violations and offers agents nothing to operate", async () => {
  const { container } = render(
    <main>
      <h1>Summary</h1>
      <StatGroup aria-label="Summary">
        <Stat>
          <StatLabel>Tokens</StatLabel>
          <StatValue value={{ value: 1200, quality: "estimated" }} />
          <StatHint>
            Updated <RelativeTime value="2026-11-15T11:00:00Z" now={now} timeZone="UTC" />
          </StatHint>
        </Stat>
      </StatGroup>
      <AcceptanceBar counts={countAcceptance(criteria)} />
      <AcceptanceList criteria={criteria} />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  const operable = createAgent()
    .snapshot()
    .filter((entry) => entry.actions.length > 0)
  expect(operable).toEqual([])
})
