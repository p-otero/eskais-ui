import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldLabel } from "@/components/ui/field"
import { OTPInput, OTPInputGroup, OTPInputSeparator, OTPInputSlot } from "@/components/ui/otp-input"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function CodeField({
  onValueChange,
  onValueCommit,
}: {
  onValueChange?: (value: string) => void
  onValueCommit?: (value: string) => void
}) {
  return (
    <Field>
      <FieldLabel>Verification code</FieldLabel>
      <OTPInput maxLength={6} onValueChange={onValueChange} onValueCommit={onValueCommit}>
        <OTPInputGroup>
          {[0, 1, 2].map((index) => (
            <OTPInputSlot key={index} index={index} />
          ))}
        </OTPInputGroup>
        <OTPInputSeparator />
        <OTPInputGroup>
          {[3, 4, 5].map((index) => (
            <OTPInputSlot key={index} index={index} />
          ))}
        </OTPInputGroup>
      </OTPInput>
    </Field>
  )
}

const slots = () => [...document.querySelectorAll("[data-slot=otp-input-slot]")].map((slot) => slot.textContent)

test("the field label names the one input, and typing fills the slots, ignoring letters", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  const onValueCommit = vi.fn()
  render(<CodeField onValueChange={onValueChange} onValueCommit={onValueCommit} />)
  const input = screen.getByRole("textbox", { name: "Verification code" })
  expect(input.getAttribute("autocomplete")).toBe("one-time-code")
  await user.click(input)
  await user.keyboard("12a3")
  expect(slots()).toEqual(["1", "2", "3", "", "", ""])
  expect(onValueChange).toHaveBeenLastCalledWith("123", expect.objectContaining({ reason: "input-change" }))
  await user.keyboard("456")
  expect(onValueCommit).toHaveBeenCalledWith("123456", expect.anything())
  expect(document.querySelector("[data-slot=otp-input]")!.hasAttribute("data-complete")).toBe(true)
})

test("Backspace removes the last character", async () => {
  const user = userEvent.setup()
  render(<CodeField />)
  await user.click(screen.getByRole("textbox", { name: "Verification code" }))
  await user.keyboard("12{Backspace}")
  expect(slots()).toEqual(["1", "", "", "", "", ""])
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <CodeField />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the code field and fills it", async () => {
  const onValueCommit = vi.fn()
  render(<CodeField onValueCommit={onValueCommit} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(components.map((entry) => entry.label)).toContain("Verification code")

  const result = await act(() =>
    agent.act({ steps: [{ ref: "Verification code", action: "setValue", args: ["424242"] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(slots()).toEqual(["4", "2", "4", "2", "4", "2"])
  expect(onValueCommit).toHaveBeenCalledWith("424242", expect.objectContaining({ source: "agent" }))
})
