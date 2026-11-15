import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  CommandDialog,
  CommandDialogContent,
  CommandDialogShortcut,
  CommandDialogTrigger,
} from "@/components/ui/command-dialog"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function Palette({ onAction, shortcut }: { onAction: (value: string) => void; shortcut?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <main>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandDialogTrigger shortcut={shortcut}>
          Search commands
          <CommandDialogShortcut />
        </CommandDialogTrigger>
        <CommandDialogContent>
          <Command
            onAction={(value) => {
              onAction(value)
              setOpen(false)
            }}
          >
            <CommandInput aria-label="Run a command" placeholder="Type a command" />
            <CommandEmpty>No commands found.</CommandEmpty>
            <CommandList>
              <CommandGroup>
                <CommandGroupLabel>Tasks</CommandGroupLabel>
                <CommandItem value="new-task">New task</CommandItem>
                <CommandItem value="retry">Retry failed tasks</CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandGroupLabel>Go to</CommandGroupLabel>
                <CommandItem value="board" shortcut="mod+shift+b">
                  Open board
                  <CommandShortcut />
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </CommandDialogContent>
      </CommandDialog>
    </main>
  )
}

test("opens a named dialog with the search focused; arrows move the highlight and Enter runs it", async () => {
  const user = userEvent.setup()
  const onAction = vi.fn()
  render(<Palette onAction={onAction} />)
  const trigger = screen.getByRole("button", { name: "Search commands" })
  await user.click(trigger)
  const dialog = screen.getByRole("dialog", { name: "Command palette" })
  const input = screen.getByRole("combobox", { name: "Run a command" })
  expect(document.activeElement).toBe(input)
  expect(screen.getByRole("group", { name: "Tasks" })).toBeTruthy()
  expect(dialog.querySelector('[data-slot="command-item"] kbd[data-slot="command-shortcut"]')).not.toBeNull()

  expect(screen.getByRole("option", { name: "New task" }).dataset.highlighted).toBe("")
  await user.keyboard("{ArrowDown}")
  expect(screen.getByRole("option", { name: "Retry failed tasks" }).dataset.highlighted).toBe("")
  await user.keyboard("{Enter}")
  expect(onAction).toHaveBeenCalledWith("retry")
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test("typing filters, shows the empty state, and Escape closes the palette", async () => {
  const user = userEvent.setup()
  render(<Palette onAction={vi.fn()} />)
  const trigger = screen.getByRole("button", { name: "Search commands" })
  await user.click(trigger)
  await user.keyboard("boa")
  expect(screen.getByRole("option", { name: /Open board/ })).toBeTruthy()
  expect(screen.queryByRole("option", { name: "New task" })).toBeNull()
  await user.keyboard("{Control>}a{/Control}zzz")
  expect(screen.getByText("No commands found.")).toBeTruthy()
  await user.keyboard("{Escape}")
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

test("the open shortcut is opt-in on the trigger", async () => {
  const user = userEvent.setup()
  const { unmount } = render(<Palette onAction={vi.fn()} />)
  await user.keyboard("{Control>}k{/Control}")
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(screen.getByRole("button", { name: "Search commands" }).getAttribute("aria-keyshortcuts")).toBeNull()
  unmount()

  render(<Palette onAction={vi.fn()} shortcut="mod+k" />)
  const trigger = screen.getByRole("button", { name: /Search commands/ })
  expect(trigger.getAttribute("aria-keyshortcuts")).toBeTruthy()
  expect(trigger.querySelector('kbd[data-slot="dialog-shortcut"]')?.textContent).toMatch(/K/)
  await user.keyboard("{Control>}k{/Control}")
  expect(screen.getByRole("dialog", { name: "Command palette" })).toBeTruthy()
})

test("has no axe violations closed or open", async () => {
  const user = userEvent.setup()
  const { container } = render(<Palette onAction={vi.fn()} />)
  expect(await axeViolations(container)).toEqual([])
  await user.click(screen.getByRole("button", { name: "Search commands" }))
  expect(await axeViolations(document.body)).toEqual([])
})

test("an agent can open the palette, search and highlight a command by name", async () => {
  render(<Palette onAction={vi.fn()} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).toContain("Search commands")

  const opened = await agent.act({ steps: [{ ref: "Search commands", action: "press" }] })
  expect(opened.ok, opened.error?.message).toBe(true)
  await settle()
  const command = agent.snapshot().find((entry) => entry.label === "Run a command" && !entry.offPage)
  expect(command?.items?.map((item) => item.label)).toEqual(["New task", "Retry failed tasks", "Open board"])

  const chosen = await agent.act({
    steps: [
      { ref: "Run a command", action: "setQuery", args: ["board"] },
      { ref: "Run a command", action: "setValue", args: ["Open board"] },
    ],
  })
  expect(chosen.ok, chosen.error?.message).toBe(true)
  expect(screen.getByRole("option", { name: /Open board/ }).dataset.highlighted).toBe("")
})

// UI SDK 0.1.0-beta.5 offers agents only setValue, setQuery and setPages on a Command: nothing runs a command.
test.fails("an agent can run a command", async () => {
  const onAction = vi.fn()
  render(<Palette onAction={onAction} />)
  await settle()
  await agent.act({ steps: [{ ref: "Search commands", action: "press" }] })
  await settle()
  const ran = await agent.act({ steps: [{ ref: "Run a command", action: "press", args: ["Open board"] }] })
  expect(ran.ok, ran.error?.message).toBe(true)
  expect(onAction).toHaveBeenCalledWith("board")
})
