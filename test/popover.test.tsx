import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
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

function DialogWithOpenPopover({ open = true }: { open?: boolean }) {
  return (
    <Dialog open={open}>
      <DialogContent initialFocus="content">
        <DialogTitle>Task T-014</DialogTitle>
        <Popover defaultOpen>
          <PopoverTrigger>Acceptance 2/3</PopoverTrigger>
          <PopoverContent>
            <PopoverTitle>Acceptance</PopoverTitle>
            <PopoverClose>Done</PopoverClose>
          </PopoverContent>
        </Popover>
        <button type="button">After</button>
      </DialogContent>
    </Dialog>
  )
}

test("a popover open from the start stays open while its dialog takes initial focus", async () => {
  render(<DialogWithOpenPopover />)
  await settle(20)
  expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Task T-014" }))
  expect(screen.getByRole("dialog", { name: "Acceptance" })).toBeTruthy()
})

test("it also stays open when the dialog opens after mounting", async () => {
  const { rerender } = render(
    <>
      <button type="button">Open task</button>
      <DialogWithOpenPopover open={false} />
    </>,
  )
  screen.getByRole("button", { name: "Open task" }).focus()
  rerender(
    <>
      <button type="button">Open task</button>
      <DialogWithOpenPopover />
    </>,
  )
  await settle(20)
  expect(screen.getByRole("dialog", { name: "Acceptance" })).toBeTruthy()
})

test("after mounting, focus leaving it still closes it", async () => {
  const user = userEvent.setup()
  render(<DialogWithOpenPopover />)
  await settle(20)
  act(() => screen.getByRole("button", { name: "After" }).focus())
  expect(screen.queryByRole("dialog", { name: "Acceptance" })).toBeNull()

  await user.click(screen.getByRole("button", { name: "Acceptance 2/3" }))
  expect(screen.getByRole("dialog", { name: "Acceptance" })).toBeTruthy()
  act(() => screen.getByRole("dialog", { name: "Task T-014" }).focus())
  expect(screen.queryByRole("dialog", { name: "Acceptance" })).toBeNull()
})

test("an agent sees the open popover inside the dialog and can close it", async () => {
  render(<DialogWithOpenPopover />)
  await settle(20)
  const popover = agent.snapshot().find((entry) => entry.component === "popover")
  expect(popover).toMatchObject({ label: "Acceptance", open: true, buttons: ["Done"] })
  const result = await agent.act({ steps: [{ ref: "Acceptance", action: "setOpen", args: [false] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.queryByRole("dialog", { name: "Acceptance" })).toBeNull()
})

function HoverDetails() {
  return (
    <>
      <Popover openOnHover delay={10} closeDelay={10}>
        <PopoverTrigger>Acceptance 2/3</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Acceptance</PopoverTitle>
          <PopoverClose>Done</PopoverClose>
        </PopoverContent>
      </Popover>
      <p>Elsewhere</p>
    </>
  )
}

// Workaround: jsdom has no layout to cross into the content; tooling/popover-check.mjs covers it in Chrome.
test("openOnHover opens it when the pointer rests on the trigger, without moving focus", async () => {
  const user = userEvent.setup()
  render(<HoverDetails />)
  const trigger = screen.getByRole("button", { name: "Acceptance 2/3" })
  await user.hover(trigger)
  await settle(30)
  expect(screen.getByRole("dialog", { name: "Acceptance" })).toBeTruthy()
  expect(document.activeElement).toBe(document.body)
})

test("with openOnHover, Enter and a press still open it and move focus in", async () => {
  const user = userEvent.setup()
  render(<HoverDetails />)
  await user.tab()
  await settle(30)
  expect(screen.queryByRole("dialog", { name: "Acceptance" })).toBeNull()
  await user.keyboard("{Enter}")
  expect(screen.getByRole("dialog", { name: "Acceptance" }).contains(document.activeElement)).toBe(true)
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog", { name: "Acceptance" })).toBeNull()

  await user.pointer({ keys: "[TouchA]", target: screen.getByRole("button", { name: "Acceptance 2/3" }) })
  expect(screen.getByRole("dialog", { name: "Acceptance" })).toBeTruthy()
})

test("an agent opens a hover popover by its trigger and presses inside it", async () => {
  render(<HoverDetails />)
  await settle()
  const opened = await agent.act({ steps: [{ ref: "Acceptance 2/3", action: "press" }] })
  expect(opened.ok, opened.error?.message).toBe(true)
  expect(agent.snapshot().find((entry) => entry.component === "popover")).toMatchObject({ open: true })
  const closed = await agent.act({ steps: [{ ref: "Acceptance", action: "setOpen", args: [false] }] })
  expect(closed.ok, closed.error?.message).toBe(true)
  expect(screen.queryByRole("dialog", { name: "Acceptance" })).toBeNull()
})
