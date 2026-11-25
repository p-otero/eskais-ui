import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { afterEach, expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { RetroTv } from "@/components/ui/retro-tv"
import { retroTv } from "@/components/ui/retro-tv-primitive"
import { useTvPowerOff } from "@/components/ui/tv-power-off"
import { parseActionRefusal } from "@/lib/action-refusal"

import { axeViolations } from "./axe"

const agent = createAgent()

afterEach(() => {
  vi.useRealTimers()
})

const set = () => screen.getByRole("group", { name: "Sales monitor" })
const power = () => screen.getByRole("button", { name: "Power" })
const picture = () => set().querySelector<HTMLElement>('[data-slot="retro-tv-picture"]')!

function SalesMonitor(props: Partial<Parameters<typeof RetroTv>[0]>) {
  return (
    <RetroTv label="Sales monitor" {...props}>
      <p>Sales today: 12,430</p>
    </RetroTv>
  )
}

test("primitive: renders on the server", () => {
  checkServer(retroTv, {}, `<root aria-label="Sales monitor"></root>`)
})

test("the set renders on the server, on, in green, with its screen content", () => {
  const html = renderToString(<SalesMonitor />)
  expect(html).toContain('data-slot="retro-tv-picture"')
  expect(html).toContain('data-phosphor="green"')
  expect(html).toContain('data-power="on"')
  expect(html).toContain("Sales today: 12,430")
})

test("the power button is a toggle that switches the set off and on, and the screen is inert while off", async () => {
  const user = userEvent.setup()
  const onPowerChange = vi.fn()
  render(<SalesMonitor onPowerChange={onPowerChange} />)
  expect(power().getAttribute("aria-pressed")).toBe("true")
  expect(screen.getByText("Sales today: 12,430")).toBeTruthy()

  await user.click(power())
  expect(power().getAttribute("aria-pressed")).toBe("false")
  expect(set().dataset.power).toBe("off")
  expect(set().hasAttribute("data-switched")).toBe(true)
  expect(picture().hasAttribute("inert")).toBe(true)
  expect(onPowerChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "press" }))

  await user.click(power())
  expect(set().dataset.power).toBe("on")
  expect(picture().hasAttribute("inert")).toBe(false)
})

test("a set that mounts off doesn't play the switch-off, and phosphor and perspective show as attributes", () => {
  render(<SalesMonitor defaultPower={false} phosphor="amber" perspective={false} />)
  expect(set().dataset.power).toBe("off")
  expect(set().hasAttribute("data-switched")).toBe(false)
  expect(set().dataset.phosphor).toBe("amber")
  expect(set().hasAttribute("data-perspective")).toBe(false)
})

test("a cancelled change keeps the set as it was", async () => {
  const user = userEvent.setup()
  render(<SalesMonitor onPowerChange={(_power, details) => details.cancel()} />)
  await user.click(power())
  expect(set().dataset.power).toBe("on")
  expect(power().getAttribute("aria-pressed")).toBe("true")
})

test("controlled, it shows the power it's given", () => {
  const { rerender } = render(<SalesMonitor power={false} />)
  expect(set().dataset.power).toBe("off")
  rerender(<SalesMonitor power />)
  expect(set().dataset.power).toBe("on")
})

test("the power button's name can be translated", () => {
  render(<SalesMonitor labels={{ power: "Encendido" }} />)
  expect(screen.getByRole("button", { name: "Encendido" })).toBeTruthy()
})

test("it has no axe violations, on or off", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <SalesMonitor />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(power())
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the set and its power button, and switches it off and on", async () => {
  render(<SalesMonitor />)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const tv = entries.find((entry) => entry.label === "Sales monitor")
  expect(tv?.actions).toEqual(expect.arrayContaining(["powerOn", "powerOff"]))
  expect(entries.map((entry) => entry.label)).toContain("Power")

  let result = await act(() => agent.act({ steps: [{ ref: "Sales monitor", action: "powerOff" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(set().dataset.power).toBe("off")

  result = await act(() => agent.act({ steps: [{ ref: "Sales monitor", action: "powerOff" }] }))
  expect(result.ok, result.error?.message).toBe(true)

  result = await act(() => agent.act({ steps: [{ ref: "Sales monitor", action: "powerOn" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(set().dataset.power).toBe("on")
})

test("an agent's switch the app cancels, or on a disabled set, fails with why", async () => {
  const { rerender } = render(<SalesMonitor onPowerChange={(_power, details) => details.cancel()} />)
  let result = await act(() => agent.act({ steps: [{ ref: "Sales monitor", action: "powerOff" }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "powerOff", kind: "refused" })
  expect(set().dataset.power).toBe("on")

  rerender(<SalesMonitor disabled />)
  result = await act(() => agent.act({ steps: [{ ref: "Sales monitor", action: "powerOff" }] }))
  expect(result.error?.message).toContain("powerOff isn't available while the set is disabled")
  expect(set().dataset.power).toBe("on")
})

test("useTvPowerOff plays over the page and resolves once the screen is black", async () => {
  vi.useFakeTimers()
  const done = vi.fn()
  function LogOut() {
    const tv = useTvPowerOff({ phosphor: "green" })
    return (
      <>
        <p>{tv.playing ? "playing" : "idle"}</p>
        <Button onClick={() => void tv.powerOff().then(done)}>Log out</Button>
        {tv.overlay}
      </>
    )
  }
  render(<LogOut />)
  expect(document.querySelector('[data-slot="tv-power-off"]')).toBeNull()
  act(() => screen.getByText("Log out").click())
  const overlay = document.querySelector<HTMLElement>('[data-slot="tv-power-off"]')
  expect(overlay?.parentElement).toBe(document.body)
  expect(overlay?.dataset.phosphor).toBe("green")
  expect(overlay?.getAttribute("aria-hidden")).toBe("true")
  expect(screen.getByText("playing")).toBeTruthy()
  await act(() => vi.advanceTimersByTimeAsync(1000))
  expect(done).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(500))
  expect(done).toHaveBeenCalledTimes(1)
})
