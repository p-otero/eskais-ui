import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from "@/components/ui/tooltip"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function ModelId() {
  return (
    <>
      <Tooltip delay={0}>
        <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="Copy model ID" />}>
          <svg aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Copy model ID</TooltipContent>
      </Tooltip>
      <Tooltip shortcut="mod+s" delay={0}>
        <TooltipTrigger render={<Button variant="outline" />}>Save</TooltipTrigger>
        <TooltipContent>
          Saves the draft
          <TooltipShortcut />
        </TooltipContent>
      </Tooltip>
    </>
  )
}

test("names an icon-only trigger and describes a labelled one", async () => {
  render(<ModelId />)
  await settle()
  const copy = screen.getByRole("button", { name: "Copy model ID" })
  expect(copy.dataset.slot).toBe("button")
  const save = screen.getByRole("button", { name: "Save" })
  expect(save).toHaveProperty("ariaKeyShortcuts", expect.stringMatching(/s$/i))
  expect(save.getAttribute("aria-describedby")).toBeTruthy()
})

test("keyboard focus opens it, Escape closes it and keeps focus on the trigger", async () => {
  const user = userEvent.setup()
  render(<ModelId />)
  await user.tab()
  const copy = screen.getByRole("button", { name: "Copy model ID" })
  expect(document.activeElement).toBe(copy)
  const content = screen.getByRole("tooltip", { name: "Copy model ID" })
  expect(content.dataset.open).toBe("")
  expect(content.className).toContain("bg-primary")

  await user.keyboard("{Escape}")
  await settle()
  expect(content.hasAttribute("data-open")).toBe(false)
  expect(document.activeElement).toBe(copy)
})

test("resting the pointer on the trigger opens it", async () => {
  const user = userEvent.setup()
  render(<ModelId />)
  const save = screen.getByRole("button", { name: "Save" })
  await user.hover(save)
  await settle(10)
  expect(screen.getByRole("tooltip", { name: /Saves the draft/ }).dataset.open).toBe("")
})

test("has no axe violations closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <ModelId />
    </main>,
  )
  await settle()
  expect(await axeViolations(container)).toEqual([])
  await user.tab()
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds each tooltip by name and can open it", async () => {
  render(<ModelId />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).toEqual(expect.arrayContaining(["Copy model ID", "Save"]))

  const result = await agent.act({ steps: [{ ref: "Copy model ID", action: "setOpen", args: [true] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("tooltip", { name: "Copy model ID" }).dataset.open).toBe("")
})
