import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function NotifyField({ onCheckedChange }: { onCheckedChange?: (checked: boolean) => void }) {
  return (
    <Field>
      <Switch onCheckedChange={onCheckedChange} />
      <FieldLabel>Email me when a task fails</FieldLabel>
      <FieldDescription>At most one email an hour.</FieldDescription>
    </Field>
  )
}

test("the field label names the switch, which renders its own thumb and lays the field out as a row", () => {
  render(<NotifyField />)
  const control = screen.getByRole("switch", { name: "Email me when a task fails" })
  expect(control.getAttribute("aria-checked")).toBe("false")
  expect(control.querySelector("[data-slot=switch-thumb]")).toBeTruthy()
  expect(control.parentElement!.matches(":has(> [data-slot=switch])")).toBe(true)
  expect(control.parentElement!.className).toContain("has-[>[data-slot=switch]]:flex-row")
})

test("Space and a label press toggle it, each reported as a press", async () => {
  const user = userEvent.setup()
  const onCheckedChange = vi.fn()
  render(<NotifyField onCheckedChange={onCheckedChange} />)
  const control = screen.getByRole("switch", { name: "Email me when a task fails" })
  await user.tab()
  expect(document.activeElement).toBe(control)
  await user.keyboard(" ")
  expect(control.getAttribute("aria-checked")).toBe("true")
  expect(control.querySelector("[data-slot=switch-thumb]")!.hasAttribute("data-checked")).toBe(true)
  expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: "press" }))
  await user.click(screen.getByText("Email me when a task fails"))
  expect(control.getAttribute("aria-checked")).toBe("false")
})

test("a cancelled change keeps it off", async () => {
  const user = userEvent.setup()
  render(<Switch aria-label="Locked" onCheckedChange={(_, details) => details.cancel()} />)
  await user.click(screen.getByRole("switch", { name: "Locked" }))
  expect(screen.getByRole("switch", { name: "Locked" }).getAttribute("aria-checked")).toBe("false")
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <NotifyField />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the switch and turns it on", async () => {
  const onCheckedChange = vi.fn()
  render(<NotifyField onCheckedChange={onCheckedChange} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(components.map((entry) => entry.label)).toContain("Email me when a task fails")

  const result = await act(() =>
    agent.act({ steps: [{ ref: "Email me when a task fails", action: "setChecked", args: [true] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true")
  expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ source: "agent" }))
})
