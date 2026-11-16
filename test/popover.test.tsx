import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function AttemptDetails() {
  return (
    <Popover>
      <PopoverTrigger>Attempt 2 details</PopoverTrigger>
      <PopoverContent>
        <PopoverArrow />
        <PopoverTitle>Attempt 2</PopoverTitle>
        <PopoverDescription>Retried after a rate limit.</PopoverDescription>
        <Field>
          <FieldLabel>Retry note</FieldLabel>
          <Input defaultValue="" />
        </Field>
        <PopoverClose>Done</PopoverClose>
      </PopoverContent>
    </Popover>
  )
}

test("opens named and described with focus inside, and Escape returns focus to the trigger", async () => {
  const user = userEvent.setup()
  render(<AttemptDetails />)
  const trigger = screen.getByRole("button", { name: "Attempt 2 details" })
  expect(trigger.className).toContain("border-input")

  await user.click(trigger)
  const popover = screen.getByRole("dialog", { name: "Attempt 2" })
  expect(popover.getAttribute("aria-describedby")).toBeTruthy()
  expect(popover.className).toContain("surface-floating")
  expect(trigger.dataset.open).toBe("")
  expect(popover.contains(document.activeElement)).toBe(true)

  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test("Enter opens it from the keyboard and the Close part closes it", async () => {
  const user = userEvent.setup()
  render(<AttemptDetails />)
  await user.tab()
  await user.keyboard("{Enter}")
  expect(screen.getByRole("dialog", { name: "Attempt 2" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Done" }))
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Attempt 2 details" }))
})

test("a press outside closes it", async () => {
  const user = userEvent.setup()
  render(
    <>
      <AttemptDetails />
      <p>Elsewhere</p>
    </>,
  )
  await user.click(screen.getByRole("button", { name: "Attempt 2 details" }))
  await user.click(screen.getByText("Elsewhere"))
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("has no axe violations closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <AttemptDetails />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Attempt 2 details" }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent can open the popover and fill its field", async () => {
  render(<AttemptDetails />)
  await settle()
  const opened = await agent.act({ steps: [{ ref: "Attempt 2 details", action: "press" }] })
  expect(opened.ok, opened.error?.message).toBe(true)

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).toContain("Retry note")

  const result = await agent.act({ steps: [{ ref: "Retry note", action: "setValue", args: ["Waited 30s"] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Retry note" }).value).toBe("Waited 30s")
})
