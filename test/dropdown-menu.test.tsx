import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { axeViolations, settle } from "./overlay-helpers"

let approve = false
const agent = createAgent({ allow: (step) => !step.confirm || approve })

function noop() {}

function TaskActions({ onAction = noop }: { onAction?: (value: string) => void }) {
  return (
    <DropdownMenu onAction={onAction}>
      <DropdownMenuTrigger aria-label="Actions for Index the docs">Actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Task</DropdownMenuGroupLabel>
          <DropdownMenuItem value="retry" shortcut="mod+r">
            Retry
            <DropdownMenuShortcut />
          </DropdownMenuItem>
          <DropdownMenuItem value="archive">Archive</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem value="watch">
          <DropdownMenuItemIndicator />
          Watch
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="delete" destructive data-agent-confirm="Deletes the Index the docs task">
          Delete forever
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

test("the trigger looks like a button and opens a menu that the arrow keys move through", async () => {
  const user = userEvent.setup()
  const onAction = vi.fn()
  render(<TaskActions onAction={onAction} />)
  const trigger = screen.getByRole("button", { name: "Actions for Index the docs" })
  expect(trigger.className).toContain("border-input")

  trigger.focus()
  await user.keyboard("{Enter}")
  const menu = screen.getByRole("menu")
  expect(menu.className).toContain("bg-popover/(--glass-opacity)")
  const retry = screen.getByRole("menuitem", { name: /Retry/ })
  expect(document.activeElement).toBe(retry)

  await user.keyboard("{ArrowDown}")
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Archive" }))
  await user.keyboard("{Enter}")
  expect(onAction).toHaveBeenCalledWith("archive", expect.anything())
  expect(screen.queryByRole("menu")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test("Escape closes the menu and returns focus to the trigger", async () => {
  const user = userEvent.setup()
  render(<TaskActions />)
  const trigger = screen.getByRole("button", { name: "Actions for Index the docs" })
  await user.click(trigger)
  expect(screen.getByRole("menu")).toBeTruthy()
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("menu")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test("a checkbox item toggles, stays open and shows its indicator", async () => {
  const user = userEvent.setup()
  render(<TaskActions />)
  await user.click(screen.getByRole("button", { name: "Actions for Index the docs" }))
  const watch = screen.getByRole("menuitemcheckbox", { name: "Watch" })
  expect(watch.getAttribute("aria-checked")).toBe("false")
  await user.click(watch)
  expect(watch.getAttribute("aria-checked")).toBe("true")
  expect(watch.querySelector('[data-slot="menu-item-indicator"] svg')).not.toBeNull()
  expect(screen.getByRole("menu")).toBeTruthy()
})

test("the destructive item is styled and marked for agent confirmation", async () => {
  const user = userEvent.setup()
  render(<TaskActions />)
  await user.click(screen.getByRole("button", { name: "Actions for Index the docs" }))
  const remove = screen.getByRole("menuitem", { name: "Delete forever" })
  expect(remove.dataset.destructive).toBe("")
  expect(remove.className).toContain("data-destructive:text-destructive")
  expect(remove.dataset.agentConfirm).toBe("Deletes the Index the docs task")
})

test("has no axe violations closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <main>
      <TaskActions />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Actions for Index the docs" }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent can run an item, and needs a person to delete", async () => {
  const onAction = vi.fn()
  render(<TaskActions onAction={onAction} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).toContain("Actions for Index the docs")

  const archived = await agent.act({
    steps: [{ ref: "Actions for Index the docs", action: "press", args: ["Archive"] }],
  })
  expect(archived.ok, archived.error?.message).toBe(true)
  expect(onAction).toHaveBeenLastCalledWith("archive", expect.anything())

  const remove = { steps: [{ ref: "Actions for Index the docs", action: "press", args: ["Delete forever"] }] }
  approve = false
  expect((await agent.act(remove)).ok).toBe(false)
  expect(onAction).not.toHaveBeenCalledWith("delete", expect.anything())
  approve = true
  const approved = await agent.act(remove)
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(onAction).toHaveBeenLastCalledWith("delete", expect.anything())
})
