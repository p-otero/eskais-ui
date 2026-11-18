import { render } from "@testing-library/react"
import { expect, test } from "vitest"

import { Stat, StatDelta, StatLabel, StatValue } from "@/components/ui/stat"

import { axeViolations } from "./axe"

function spoken(root: Element) {
  const clone = root.cloneNode(true) as Element
  for (const hidden of clone.querySelectorAll("[aria-hidden=true]")) hidden.remove()
  return clone.textContent?.replaceAll(/\s+/g, " ").trim()
}

test("the sign gives the direction and the tone, and the text says it without colour or the arrow", async () => {
  const { container } = render(
    <Stat>
      <StatLabel>Signups</StatLabel>
      <StatValue value={1284} />
      <StatDelta value={0.12} comparison="vs. last week" locale="en-US" />
    </Stat>,
  )
  const delta = container.querySelector<HTMLElement>("[data-slot=stat-delta]")!
  expect(delta.dataset.direction).toBe("up")
  expect(delta.dataset.tone).toBe("success")
  expect(delta.querySelector("[aria-hidden=true]")?.textContent).toBe("12%")
  expect(delta.querySelector("svg")?.getAttribute("class")).toContain("rtl:-scale-x-100")
  expect(spoken(delta)).toBe("up 12% vs. last week")
  expect(await axeViolations(container)).toEqual([])
})

test("down is destructive, unless invert says down is good; zero is flat and neutral", () => {
  const { container, rerender } = render(<StatDelta value={-0.034} locale="en-US" />)
  const delta = () => container.querySelector<HTMLElement>("[data-slot=stat-delta]")!
  expect([delta().dataset.direction, delta().dataset.tone]).toEqual(["down", "destructive"])
  expect(spoken(delta())).toBe("down 3.4%")

  rerender(<StatDelta value={-0.034} invert comparison="vs. last month" locale="en-US" />)
  expect([delta().dataset.direction, delta().dataset.tone]).toEqual(["down", "success"])

  rerender(<StatDelta value={0} locale="en-US" />)
  expect([delta().dataset.direction, delta().dataset.tone]).toEqual(["flat", "neutral"])
  expect(spoken(delta())).toBe("no change")
})

test("direction, tone, format and labels can be set", () => {
  const { container } = render(
    <StatDelta
      value={0.0004}
      direction="up"
      tone="info"
      format={(size) => `${(size * 100).toFixed(2)} pts`}
      labels={{ up: (formatted) => `sube ${formatted}` }}
      comparison="frente a ayer"
    />,
  )
  const delta = container.querySelector<HTMLElement>("[data-slot=stat-delta]")!
  expect(delta.dataset.tone).toBe("info")
  expect(spoken(delta)).toBe("sube 0.04 pts frente a ayer")
})

test("format takes Intl options in the given locale", () => {
  const { container } = render(<StatDelta value={-1250} format={{ style: "decimal" }} locale="es-ES" />)
  expect(container.querySelector("[aria-hidden=true]")?.textContent).toBe("1250")
})
