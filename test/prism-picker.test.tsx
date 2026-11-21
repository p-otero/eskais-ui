import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vitest"

import { PrismPicker } from "@/components/ui/prism-picker"
import { prismPicker } from "@/components/ui/prism-picker-primitive"
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

const dial = () => screen.getByRole<HTMLInputElement>("slider", { name: "Wavelength" })

test("primitive: renders on the server", () => {
  checkServer(prismPicker, {}, `<root aria-label="Prism colour"></root>`)
})

test("the picker renders on the server, with the dial at its value", () => {
  const html = renderToString(<PrismPicker label="Prism colour" defaultValue={470} />)
  expect(html).toContain('data-slot="prism-stage"')
  expect(html).toContain("470 nm")
  expect(html).toContain("--prism-dial")
})

test("the dial is a slider with arrows, Page Up and Down, Home and End, and a value text", async () => {
  const user = userEvent.setup()
  render(<PrismPicker label="Prism colour" />)
  expect(dial().getAttribute("aria-valuetext")).toBe("520 nm, green")
  dial().focus()
  await user.keyboard("{ArrowRight}")
  expect(dial().value).toBe("521")
  await user.keyboard("{PageUp}")
  expect(dial().value).toBe("531")
  await user.keyboard("{End}")
  expect(dial().getAttribute("aria-valuetext")).toBe("700 nm, red")
  expect(screen.getByText("#ff0000")).toBeTruthy()
  await user.keyboard("{Home}")
  expect(dial().value).toBe("380")
})

test("controlled, it reports the value and the colour and shows what it is given", async () => {
  const user = userEvent.setup()
  const onColorChange = vi.fn()
  function Controlled() {
    const [value, setValue] = useState(600)
    return <PrismPicker label="Prism colour" value={value} onValueChange={setValue} onColorChange={onColorChange} />
  }
  render(<Controlled />)
  dial().focus()
  await user.keyboard("{ArrowLeft}")
  expect(dial().value).toBe("599")
  expect(onColorChange).toHaveBeenLastCalledWith(
    expect.objectContaining({ wavelength: 599, hex: expect.stringMatching(/^#[0-9a-f]{6}$/) }),
    expect.objectContaining({ reason: "step-key" }),
  )
  const [color] = onColorChange.mock.lastCall as [{ oklchHue: number; hslHue: number }]
  expect(color.oklchHue).toBeGreaterThan(40)
  expect(color.oklchHue).toBeLessThan(72)
  expect(color.hslHue).toBeGreaterThan(0)
})

test("labels are overridable, colour names included", () => {
  render(
    <PrismPicker
      label="Couleur du prisme"
      defaultValue={470}
      labels={{ dial: "Longueur d'onde", names: { blue: "bleu" } }}
    />,
  )
  const slider = screen.getByRole("slider", { name: "Longueur d'onde" })
  expect(slider.getAttribute("aria-valuetext")).toBe("470 nm, bleu")
})

test("disabled, the dial can't be moved and an agent is told why", async () => {
  render(<PrismPicker label="Prism colour" disabled />)
  expect(dial().disabled).toBe(true)
  const result = await act(() => agent.act({ steps: [{ ref: "Prism colour", action: "setWavelength", args: [470] }] }))
  expect(result.ok).toBe(false)
  expect(result.error?.message).toContain("isn't available while the picker is disabled")
  expect(dial().value).toBe("520")
})

test("it has no axe violations", async () => {
  const { container } = render(<PrismPicker label="Prism colour" />)
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the picker and its dial, and sets a wavelength or a hue", async () => {
  render(<PrismPicker label="Prism colour" />)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const picker = entries.find((entry) => entry.label === "Prism colour")
  expect(picker?.actions).toEqual(expect.arrayContaining(["setWavelength", "setHue"]))
  expect(entries.map((entry) => entry.label)).toContain("Wavelength")

  let result = await act(() => agent.act({ steps: [{ ref: "Prism colour", action: "setWavelength", args: [470] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(dial().getAttribute("aria-valuetext")).toBe("470 nm, blue")

  result = await act(() => agent.act({ steps: [{ ref: "Prism colour", action: "setHue", args: [200] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(dial().value).toBe("486")

  result = await act(() => agent.act({ steps: [{ ref: "Wavelength", action: "setValue", args: [610] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(dial().value).toBe("610")

  result = await act(() => agent.act({ steps: [{ ref: "Prism colour", action: "setHue", args: [330] }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "setHue", kind: "unavailable" })
  expect(dial().value).toBe("610")
})
