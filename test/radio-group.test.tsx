import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Radio, RadioGroup, RadioIndicator } from "@/components/ui/radio-group"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const plans = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "team", label: "Team" },
]

function PlanField({ onValueChange }: { onValueChange?: (value: string | null) => void }) {
  return (
    <Field>
      <FieldLabel>Plan</FieldLabel>
      <RadioGroup defaultValue="free" onValueChange={onValueChange}>
        {plans.map((plan) => (
          <Label key={plan.value}>
            <Radio value={plan.value}>
              <RadioIndicator />
            </Radio>
            {plan.label}
          </Label>
        ))}
      </RadioGroup>
    </Field>
  )
}

test("the field label names the group and each label names its radio", () => {
  render(<PlanField />)
  expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeTruthy()
  const free = screen.getByRole("radio", { name: "Free" })
  expect(free.getAttribute("aria-checked")).toBe("true")
  expect(free.hasAttribute("data-checked")).toBe(true)
})

test("arrows check the next radio and a label press checks its radio, each with its reason", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<PlanField onValueChange={onValueChange} />)
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Free" }))
  await user.keyboard("{ArrowDown}")
  expect(screen.getByRole("radio", { name: "Pro" }).getAttribute("aria-checked")).toBe("true")
  expect(onValueChange).toHaveBeenLastCalledWith("pro", expect.objectContaining({ reason: "list-navigation" }))

  await user.click(screen.getByText("Team"))
  expect(screen.getByRole("radio", { name: "Team" }).getAttribute("aria-checked")).toBe("true")
  expect(onValueChange).toHaveBeenLastCalledWith("team", expect.objectContaining({ reason: "item-press" }))
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <PlanField />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the group with its options and picks one", async () => {
  const onValueChange = vi.fn()
  render(<PlanField onValueChange={onValueChange} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const group = components.find((entry) => entry.component === "radio")
  expect(group?.label).toBe("Plan")
  expect(group?.items?.map((item) => item.label)).toEqual(["Free", "Pro", "Team"])

  const result = await act(() => agent.act({ steps: [{ ref: "Plan", action: "setValue", args: ["team"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("radio", { name: "Team" }).getAttribute("aria-checked")).toBe("true")
  expect(onValueChange).toHaveBeenLastCalledWith("team", expect.objectContaining({ source: "agent" }))
})
