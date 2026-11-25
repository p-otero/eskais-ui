import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vitest"

import { Mixer, type MixerValues } from "@/components/ui/mixer"
import { blocked, evenly, rebalance } from "@/components/ui/mixer-balance"
import { mixer } from "@/components/ui/mixer-primitive"
import { parseActionRefusal } from "@/lib/action-refusal"

import { axeViolations } from "./axe"

const agent = createAgent()

const channels = [
  { id: "sales", label: "Sales" },
  { id: "support", label: "Support" },
  { id: "product", label: "Product" },
  { id: "brand", label: "Brand" },
]
const start = { sales: 35, support: 20, product: 30, brand: 15 }
const ids = channels.map((channel) => channel.id)
const balanceOf = (values: MixerValues, locked: string[] = []) => ({
  ids,
  values,
  locked: new Set(locked),
  total: 100,
  step: 1,
})
const sum = (values: MixerValues) => Object.values(values).reduce((all, value) => all + value, 0)
const fader = (name: string) => screen.getByRole<HTMLInputElement>("slider", { name })

function CancellingMixer() {
  const [values, setValues] = useState<MixerValues>(start)
  return (
    <Mixer
      label="Budget"
      channels={channels}
      value={values}
      onValueChange={(next, details) => {
        if ((next.sales ?? 0) > 40) details.cancel()
        else setValues(next)
      }}
    />
  )
}

test("one channel up moves the unlocked others in proportion, and the total holds", () => {
  const next = rebalance(balanceOf(start, ["brand"]), "sales", 60)
  expect(next).toEqual({ sales: 60, support: 10, product: 15, brand: 15 })
  expect(sum(next)).toBe(100)
})

test("a channel stops at what the locked channels leave, and the shares come back from the drag's start", () => {
  const top = rebalance(balanceOf(start, ["brand"]), "sales", 95)
  expect(top).toEqual({ sales: 85, support: 0, product: 0, brand: 15 })
  expect(rebalance(balanceOf(top, ["brand"]), "sales", 35, start)).toEqual(start)
})

test("rounding keeps the sum exact, by the largest remainder", () => {
  const thirds = evenly(["a", "b", "c"], 100, 1)
  expect(thirds).toEqual({ a: 34, b: 33, c: 33 })
  const next = rebalance({ ids: ["a", "b", "c"], values: thirds, locked: new Set(), total: 100, step: 1 }, "a", 51)
  expect(sum(next)).toBe(100)
})

test("blocked says why a value can't be set", () => {
  expect(blocked(balanceOf(start, ["brand"]), "brand", 10)).toEqual({ kind: "locked" })
  expect(blocked(balanceOf(start, ["brand"]), "sales", 90)).toEqual({ kind: "over", held: 15, most: 85 })
  expect(blocked(balanceOf(start, ["support", "product", "brand"]), "sales", 40)).toEqual({ kind: "alone", held: 65 })
  expect(blocked(balanceOf(start), "nope", 10)).toEqual({ kind: "unknown" })
  expect(blocked(balanceOf(start), "sales", 120)).toEqual({ kind: "range" })
  expect(blocked(balanceOf(start, ["brand"]), "sales", 50)).toBeUndefined()
})

test("primitive: renders on the server", () => {
  checkServer(mixer, {}, `<root aria-label="Budget"></root>`)
})

test("the mixer renders on the server with a fader per channel", () => {
  const html = renderToString(<Mixer label="Budget" channels={channels} defaultValue={start} />)
  expect(html).toContain('data-slot="mixer-desk"')
  expect(html.match(/data-slot="mixer-channel"/g)).toHaveLength(4)
})

test("starts split evenly, and arrow keys move one fader while the others make room", async () => {
  const user = userEvent.setup()
  const onValueCommit = vi.fn()
  render(<Mixer label="Budget" channels={channels} onValueCommit={onValueCommit} />)
  expect(fader("Sales").value).toBe("25")
  fader("Sales").focus()
  await user.keyboard("{PageUp}")
  expect(fader("Sales").value).toBe("35")
  expect([fader("Support").value, fader("Product").value, fader("Brand").value]).toEqual(["22", "22", "21"])
  expect(onValueCommit).toHaveBeenLastCalledWith({ sales: 35, support: 22, product: 22, brand: 21 })
})

test("a locked channel is read-only, and the lock is a named toggle", async () => {
  const user = userEvent.setup()
  const onLockedChange = vi.fn()
  render(<Mixer label="Budget" channels={channels} defaultValue={start} onLockedChange={onLockedChange} />)
  const lock = screen.getByRole("button", { name: "Lock Brand" })
  await user.click(lock)
  expect(lock.getAttribute("aria-pressed")).toBe("true")
  expect(onLockedChange).toHaveBeenLastCalledWith(["brand"], expect.objectContaining({ channel: "brand" }))
  fader("Brand").focus()
  await user.keyboard("{ArrowUp}")
  expect(fader("Brand").value).toBe("15")
  fader("Sales").focus()
  await user.keyboard("{End}")
  expect(fader("Sales").value).toBe("85")
  expect(fader("Brand").value).toBe("15")
})

test("controlled, a change the app cancels keeps the values", async () => {
  const user = userEvent.setup()
  render(<CancellingMixer />)
  fader("Sales").focus()
  await user.keyboard("{ArrowUp}")
  expect(fader("Sales").value).toBe("36")
  await user.keyboard("{PageUp}")
  expect(fader("Sales").value).toBe("36")
})

test("labels and the value format are overridable", () => {
  render(
    <Mixer
      label="Presupuesto"
      channels={channels}
      defaultValue={start}
      format={{ style: "unit", unit: "percent" }}
      locale="es-ES"
      labels={{ lock: (channel) => `Bloquear ${channel}`, total: "Suma" }}
    />,
  )
  expect(screen.getByRole("button", { name: "Bloquear Sales" })).toBeTruthy()
  expect(fader("Sales").getAttribute("aria-valuetext")).toMatch(/^35\s%$/)
  expect(screen.getByText("Suma")).toBeTruthy()
})

test("it has no axe violations", async () => {
  const { container } = render(<Mixer label="Budget" channels={channels} defaultValue={start} />)
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the mixer, its faders and locks, and sets, splits and locks channels", async () => {
  render(<Mixer label="Budget" channels={channels} defaultValue={start} defaultLocked={["brand"]} />)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(entries.find((entry) => entry.label === "Budget")?.actions).toEqual(
    expect.arrayContaining(["setChannel", "setAll", "lock"]),
  )
  expect(entries.map((entry) => entry.label)).toEqual(expect.arrayContaining(["Sales", "Lock Sales"]))

  let result = await act(() => agent.act({ steps: [{ ref: "Budget", action: "setChannel", args: ["sales", 60] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect([fader("Sales").value, fader("Support").value, fader("Product").value]).toEqual(["60", "10", "15"])

  result = await act(() =>
    agent.act({
      steps: [{ ref: "Budget", action: "setAll", args: [{ sales: 25, support: 30, product: 30, brand: 15 }] }],
    }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(fader("Support").value).toBe("30")

  result = await act(() => agent.act({ steps: [{ ref: "Budget", action: "setChannel", args: ["sales", 90] }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "setChannel", kind: "unavailable" })
  expect(result.error?.message).toContain("locked channels hold 15 of 100, so it can take at most 85")
  expect(fader("Sales").value).toBe("25")

  result = await act(() => agent.act({ steps: [{ ref: "Budget", action: "lock", args: ["brand", false] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("button", { name: "Lock Brand" }).getAttribute("aria-pressed")).toBe("false")
})
