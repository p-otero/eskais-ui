import { act, fireEvent, render, screen } from "@testing-library/react"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, expect, test, vi } from "vitest"

import { NeonSign } from "@/components/ui/neon-sign"
import { neonSign } from "@/components/ui/neon-sign-primitive"

import { axeViolations } from "./axe"

const agent = createAgent()

const endAnimationAsReactHearsItInJsdom = (element: Element) =>
  fireEvent(element, new Event("webkitAnimationEnd", { bubbles: true }))

afterEach(() => {
  vi.useRealTimers()
})

const status = () => screen.getByRole("status", { name: "Studio" })

test("primitive: renders on the server as a status", () => {
  checkServer(neonSign, {}, `<root aria-label="Studio"></root>`)
})

test("the sign renders on the server lit, with its words for screen readers", () => {
  const html = renderToString(<NeonSign label="Studio" text="On air" sub="Studio 2" />)
  expect(html).toContain('role="status"')
  expect(html).toContain('data-state="on"')
  expect(html).toContain("On air, Studio 2")
})

test("it is a status named by its label that says its words, and says it's off while dark", () => {
  const { rerender } = render(<NeonSign label="Studio" text="On air" on />)
  expect(status().textContent).toContain("On air")
  expect(status().textContent).not.toContain("off")
  rerender(<NeonSign label="Studio" text="On air" on={false} labels={{ off: "apagado" }} />)
  expect(status().getAttribute("data-state")).toBe("off")
  expect(status().textContent).toContain("On air, apagado")
})

test("each letter is its own tube, hidden from screen readers, so the words aren't read twice", () => {
  render(<NeonSign label="Studio" text="Open" />)
  const tube = status().querySelector('[data-slot="neon-sign-tube"]')
  expect(tube?.getAttribute("aria-hidden")).toBe("true")
  expect(tube?.querySelectorAll('[data-letter="lit"]')).toHaveLength(4)
})

function Switchable() {
  const [on, setOn] = useState(false)
  return (
    <>
      <NeonSign label="Studio" text="On air" on={on} onOnChange={setOn} />
      <input type="checkbox" aria-label="Power" checked={on} onChange={() => setOn(!on)} />
    </>
  )
}

test("turning it on strikes the tubes until the flicker ends; turning it off doesn't", () => {
  render(<Switchable />)
  expect(status().hasAttribute("data-striking")).toBe(false)
  fireEvent.click(screen.getByLabelText("Power"))
  expect(status().hasAttribute("data-striking")).toBe(true)
  endAnimationAsReactHearsItInJsdom(status())
  expect(status().hasAttribute("data-striking")).toBe(false)
  fireEvent.click(screen.getByLabelText("Power"))
  expect(status().hasAttribute("data-striking")).toBe(false)
})

test("a lit sign buzzes now and then by itself, a letter at a time, and stops when switched off", () => {
  vi.useFakeTimers()
  const { rerender } = render(<NeonSign label="Studio" text="Open" />)
  vi.advanceTimersByTime(10_000)
  expect(status().querySelectorAll("[data-buzz]").length).toBeGreaterThan(0)
  rerender(<NeonSign label="Studio" text="Open" buzz={false} />)
  for (const letter of status().querySelectorAll<HTMLElement>("[data-buzz]")) fireEvent.animationEnd(letter)
  vi.advanceTimersByTime(20_000)
  expect(status().querySelectorAll("[data-buzz]")).toHaveLength(0)
})

test("it has no axe violations", async () => {
  const { container } = render(<NeonSign label="Studio" text="On air" sub="Studio 2" />)
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the sign by its label and turns it off and on", async () => {
  const onOnChange = vi.fn()
  render(<NeonSign label="Studio" text="On air" onOnChange={onOnChange} />)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(entries.find((entry) => entry.label === "Studio")?.actions).toEqual(
    expect.arrayContaining(["turnOn", "turnOff"]),
  )

  let result = await act(() => agent.act({ steps: [{ ref: "Studio", action: "turnOff" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(status().getAttribute("data-state")).toBe("off")
  expect(onOnChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ source: "agent" }))

  result = await act(() => agent.act({ steps: [{ ref: "Studio", action: "turnOn" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(status().getAttribute("data-state")).toBe("on")
  expect(status().hasAttribute("data-striking")).toBe(true)

  result = await act(() => agent.act({ steps: [{ ref: "Studio", action: "turnOn" }] }))
  expect(result.ok, result.error?.message).toBe(true)
})
