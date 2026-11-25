import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vitest"

import { SafeDial } from "@/components/ui/safe-dial"
import { codeFrom, safeDial } from "@/components/ui/safe-dial-primitive"
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

const dial = () => screen.getByRole<HTMLInputElement>("slider", { name: "Dial" })
const code = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Combination" })

function ControlledVault() {
  const [value, setValue] = useState("")
  return <SafeDial label="Vault" numbers={40} length={3} value={value} onValueChange={setValue} />
}

test("a combination reads from digits, numbers split by dashes or an array, and says why it can't", () => {
  expect(codeFrom("27046133", 4, 100)).toBe("27046133")
  expect(codeFrom("27-4-61-33", 4, 100)).toBe("27046133")
  expect(codeFrom([27, 4, 61, 33], 4, 100)).toBe("27046133")
  expect(codeFrom("12 7 39", 3, 40)).toBe("120739")
  expect(codeFrom("27-04-61", 4, 100)).toEqual({ why: 'takes 4 numbers, not 3 ("27-04-61")' })
  expect(codeFrom("12-45-07", 3, 40)).toEqual({ why: "can't dial 45: the dial runs from 0 to 39" })
  expect(codeFrom("ab", 4, 100)).toEqual({ why: 'takes digits only, not "ab"' })
})

test("primitive: renders on the server", () => {
  checkServer(safeDial, {}, `<root aria-label="Vault"></root>`)
})

test("the dial renders on the server with a slot per digit", () => {
  const html = renderToString(<SafeDial label="Vault" length={3} />)
  expect(html).toContain('data-slot="safe-dial-dial"')
  expect(html.match(/data-slot="otp-input-slot"/g)).toHaveLength(6)
})

test("arrow keys turn the dial and wrap round; Enter enters the number and Backspace takes it back", async () => {
  const user = userEvent.setup()
  const onComplete = vi.fn()
  render(<SafeDial label="Vault" length={2} onComplete={onComplete} />)
  dial().focus()
  await user.keyboard("{ArrowDown}")
  expect(dial().value).toBe("99")
  expect(dial().getAttribute("aria-valuetext")).toBe("99")
  await user.keyboard("{ArrowUp}{ArrowUp}{PageUp}")
  expect(dial().value).toBe("11")
  await user.keyboard("{Enter}")
  expect(code().value).toBe("11")
  await user.keyboard("{Shift>}{ArrowLeft}{/Shift}")
  expect(dial().value).toBe("1")
  await user.keyboard("{Enter}")
  expect(code().value).toBe("1101")
  expect(onComplete).toHaveBeenCalledWith("1101")
  await user.keyboard("{Backspace}")
  expect(code().value).toBe("11")
})

test("digits typed on the dial go straight into the code, and a full code starts over", async () => {
  const user = userEvent.setup()
  render(<SafeDial label="Vault" length={2} defaultValue="1234" />)
  dial().focus()
  await user.keyboard("7")
  expect(code().value).toBe("7")
  await user.keyboard("05")
  expect(code().value).toBe("705")
})

test("releasing a drag that turned the dial enters the number under the index", () => {
  render(<SafeDial label="Vault" />)
  const face = document.querySelector<HTMLElement>('[data-slot="safe-dial-dial"]')!
  face.getBoundingClientRect = () => ({
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
  face.setPointerCapture = () => {}
  fireEvent.pointerDown(face, { pointerId: 1, button: 0, clientX: 100, clientY: 20 })
  fireEvent.pointerMove(face, { pointerId: 1, clientX: 180, clientY: 100 })
  expect(dial().value).toBe("25")
  fireEvent.pointerUp(face, { pointerId: 1, clientX: 180, clientY: 100 })
  expect(code().value).toBe("25")
})

test("controlled, a typed number off the dial is refused", async () => {
  const user = userEvent.setup()
  render(<ControlledVault />)
  await user.click(code())
  await user.keyboard("12")
  expect(code().value).toBe("12")
  await user.keyboard("45")
  expect(code().value).toBe("124")
})

test("mask shows dots for the entered digits", () => {
  render(<SafeDial label="Vault" mask defaultValue="2704" />)
  const slots = [...document.querySelectorAll('[data-slot="otp-input-slot"]')].map((slot) => slot.textContent)
  expect(slots.slice(0, 4)).toEqual(["•", "•", "•", "•"])
})

test("labels are overridable", () => {
  render(<SafeDial label="Caja" labels={{ dial: "Rueda", code: "Clave" }} />)
  expect(screen.getByRole("slider", { name: "Rueda" })).toBeTruthy()
  expect(screen.getByRole("textbox", { name: "Clave" })).toBeTruthy()
})

test("it has no axe violations", async () => {
  const { container } = render(<SafeDial label="Vault" defaultValue="27" />)
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the dial and enters a combination, and a wrong one fails with why", async () => {
  const onComplete = vi.fn()
  render(<SafeDial label="Vault" onComplete={onComplete} />)
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(entries.find((entry) => entry.label === "Vault")?.actions).toContain("enter")
  expect(entries.map((entry) => entry.label)).toEqual(expect.arrayContaining(["Dial", "Combination"]))

  let result = await act(() => agent.act({ steps: [{ ref: "Vault", action: "enter", args: ["27-04-61-33"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(code().value).toBe("27046133")
  expect(onComplete).toHaveBeenCalledWith("27046133")

  result = await act(() => agent.act({ steps: [{ ref: "Vault", action: "enter", args: ["27-04"] }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "enter", kind: "unavailable" })
  expect(code().value).toBe("27046133")
})
