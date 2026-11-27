import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Badge } from "@/components/ui/badge"
import { CheckboxRow } from "@/components/ui/checkbox-row"

import { axeViolations } from "./axe"

const agent = createAgent()

const describedText = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")

test("the label names the checkbox, the description describes it, and the trailing slot sits at the end", () => {
  render(
    <CheckboxRow
      label="OpenAI key"
      description="Used by the build agent"
      trailing={<Badge tone="warning">Replace</Badge>}
    />,
  )
  const checkbox = screen.getByRole("checkbox", { name: "OpenAI key" })
  expect(describedText(checkbox)).toBe("Used by the build agent")
  const row = checkbox.closest("[data-slot=checkbox-row]")
  expect(row?.lastElementChild?.getAttribute("data-slot")).toBe("checkbox-row-trailing")
  expect(row?.lastElementChild?.textContent).toBe("Replace")
  expect(row?.className).toContain("pointer-coarse:min-h-(--control-height-touch)")
  expect(checkbox.className).toContain("touch-target")
})

test("the whole label toggles it, and Space toggles it from the keyboard", async () => {
  const user = userEvent.setup()
  const onCheckedChange = vi.fn()
  render(<CheckboxRow label="Upload the GitHub token" onCheckedChange={onCheckedChange} />)
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "Upload the GitHub token" }))
  await user.keyboard(" ")
  expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: "press" }))
  await user.click(screen.getByText("Upload the GitHub token"))
  expect(onCheckedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: "press" }))
})

test("disabled with a reason turns the checkbox off, shows why and describes the checkbox with it", async () => {
  const user = userEvent.setup()
  const onCheckedChange = vi.fn()
  render(
    <CheckboxRow
      label="Stripe key"
      description="Live mode"
      disabled={{ reason: "Already on your account" }}
      onCheckedChange={onCheckedChange}
    />,
  )
  const checkbox = screen.getByRole("checkbox", { name: "Stripe key" })
  expect(checkbox.getAttribute("aria-disabled")).toBe("true")
  expect(describedText(checkbox)).toBe("Live modeAlready on your account")
  expect(document.querySelector("[data-slot=checkbox-row-reason]")?.textContent).toBe("Already on your account")
  await user.click(screen.getByText("Stripe key"))
  expect(onCheckedChange).not.toHaveBeenCalled()
})

test("disabled without a reason describes nothing", () => {
  render(<CheckboxRow label="Archived" disabled />)
  const checkbox = screen.getByRole("checkbox", { name: "Archived" })
  expect(checkbox.getAttribute("aria-disabled")).toBe("true")
  expect(describedText(checkbox)).toBe("")
})

test("className can be a function of the row's state", () => {
  render(
    // oxlint-disable-next-line shadcn/require-static-classes -- checks that className can be a function of the row's state
    <CheckboxRow label="Archived" disabled className={(state) => (state.disabled ? "is-off" : "is-on")} />,
  )
  expect(screen.getByRole("checkbox").closest("[data-slot=checkbox-row]")?.classList.contains("is-off")).toBe(true)
})

test("an agent checks it by its label", async () => {
  const onCheckedChange = vi.fn()
  render(<CheckboxRow label="Upload the OpenAI key" onCheckedChange={onCheckedChange} />)
  const entry = agent.snapshot().find((candidate) => candidate.label === "Upload the OpenAI key")
  expect(entry?.component).toBe("checkbox")
  const result = await agent.act({ steps: [{ ref: "Upload the OpenAI key", action: "setChecked", args: [true] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything())
})

test("has no axe violations, enabled or disabled", async () => {
  const { container } = render(
    <main>
      <CheckboxRow label="OpenAI key" description="Used by the build agent" trailing="•••• 1a2b" />
      <CheckboxRow label="Stripe key" disabled={{ reason: "Already on your account" }} defaultChecked />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})
