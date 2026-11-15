import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { axeViolations } from "./axe"

const agent = createAgent()

const models = [
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku", disabled: true },
]

type ModelSelectProps = {
  defaultValue?: string
  onValueChange?: (value: string | null, details: { cancel: () => void }) => void
  invalid?: boolean
}

function ModelSelect({ invalid, ...selectProps }: ModelSelectProps) {
  return (
    <Field invalid={invalid}>
      <FieldLabel>Model</FieldLabel>
      <Select items={models} placeholder="Any model" {...selectProps}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.value} value={model.value} disabled={model.disabled}>
              {model.label}
              <SelectItemIndicator />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>Filters the board.</FieldDescription>
      <FieldError match>Choose a model.</FieldError>
    </Field>
  )
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

test("the field label names the trigger and the placeholder shows until a choice", () => {
  render(<ModelSelect />)
  const trigger = screen.getByRole("combobox", { name: "Model" })
  expect(trigger.dataset.slot).toBe("select-trigger")
  expect(trigger.textContent).toBe("Any model")
  expect(trigger.hasAttribute("data-placeholder")).toBe(true)
  expect(trigger.hasAttribute("aria-invalid")).toBe(false)
})

test("keyboard: arrows move the highlight, Enter chooses, disabled items are skipped", async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  render(<ModelSelect onValueChange={onValueChange} />)
  const trigger = screen.getByRole("combobox", { name: "Model" })

  await user.tab()
  expect(document.activeElement).toBe(trigger)
  await user.keyboard("{ArrowDown}")
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  await user.keyboard("{End}")
  expect(screen.getByRole("option", { name: "Sonnet" }).hasAttribute("data-highlighted")).toBe(true)
  await user.keyboard("{Enter}")

  expect(onValueChange).toHaveBeenLastCalledWith("sonnet", expect.objectContaining({ reason: "item-press" }))
  expect(trigger.textContent).toBe("Sonnet")
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(document.activeElement).toBe(trigger)
})

test("a pointer choice marks the item selected and a canceled change keeps the value", async () => {
  const user = userEvent.setup()
  render(<ModelSelect defaultValue="opus" onValueChange={(_value, details) => details.cancel()} />)
  const trigger = screen.getByRole("combobox", { name: "Model" })
  await user.click(trigger)
  expect(screen.getByRole("option", { name: "Opus" }).getAttribute("aria-selected")).toBe("true")
  await user.click(screen.getByRole("option", { name: "Sonnet" }))
  expect(trigger.textContent).toBe("Opus")
})

test("an invalid field marks the trigger", () => {
  render(<ModelSelect invalid />)
  expect(screen.getByRole("combobox", { name: "Model" }).getAttribute("aria-invalid")).toBe("true")
})

test("no axe violations, closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <ModelSelect defaultValue="opus" />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("combobox", { name: "Model" }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent can find the select and choose a model by its label", async () => {
  const onValueChange = vi.fn()
  render(<ModelSelect onValueChange={onValueChange} />)
  await settle()

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const select = components.find((entry) => entry.component === "select")
  expect(select?.label).toBe("Model")
  expect(select?.actions).toContain("setValue")

  const result = await act(() => agent.act({ steps: [{ ref: "Model", action: "setValue", args: ["Sonnet"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("combobox", { name: "Model" }).textContent).toBe("Sonnet")
  expect(onValueChange).toHaveBeenLastCalledWith("sonnet", expect.objectContaining({ source: "agent" }))
})
