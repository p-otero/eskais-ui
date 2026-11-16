import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useAsyncOptions } from "@ui-sdk/react/async-options"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandStatus } from "@/components/ui/command"
import {
  CommandDialog,
  CommandDialogContent,
  CommandDialogShortcut,
  CommandDialogTrigger,
  createCommandDialogController,
} from "@/components/ui/command-dialog"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

type Result = { value: string; label: string }

const index: Result[] = [
  { value: "apollo", label: "Apollo" },
  { value: "atlas", label: "Atlas" },
  { value: "deploy-1482", label: "Deploy 1482" },
]

const search = vi.fn((query: string, { signal }: { signal: AbortSignal }) => {
  return new Promise<Result[]>((resolve, reject) => {
    const timer = setTimeout(() => resolve(index.filter((item) => item.label.toLowerCase().includes(query))), 20)
    signal.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    })
  })
})

function GlobalSearch({
  onAction,
  onOpenChange,
}: {
  onAction: (value: string) => void
  onOpenChange?: (open: boolean) => void
}) {
  const [controller] = useState(() => createCommandDialogController())
  const results = useAsyncOptions(search, { debounce: 0, immediate: true })
  return (
    <main>
      <CommandDialog controller={controller} onOpenChange={onOpenChange}>
        <CommandDialogTrigger shortcut="mod+k">
          Search the workspace
          <CommandDialogShortcut />
        </CommandDialogTrigger>
        <CommandDialogContent title="Search the workspace">
          <Command
            filter={false}
            status={results.status}
            onQueryChange={(query) => results.setQuery(query)}
            onAction={(value) => {
              onAction(value)
              controller.close()
            }}
          >
            <CommandInput aria-label="Search the workspace" />
            <CommandStatus>{(state) => (state.loading ? "Searching" : `${state.count} results`)}</CommandStatus>
            <CommandEmpty>
              {(state) => (state.empty && !state.loading ? `Nothing matches ${state.query}` : null)}
            </CommandEmpty>
            <CommandList>
              {results.items.map((item) => (
                <CommandItem key={item.value} value={item.value} label={item.label}>
                  {item.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </CommandDialogContent>
      </CommandDialog>
      <CommandDialogTrigger controller={controller} variant="ghost" size="icon" aria-label="Search" />
    </main>
  )
}

test("global search: mod+K opens it, results load as you type, Enter runs one and focus returns", async () => {
  const user = userEvent.setup()
  const onAction = vi.fn()
  const onOpenChange = vi.fn()
  render(<GlobalSearch onAction={onAction} onOpenChange={onOpenChange} />)
  const trigger = screen.getByRole("button", { name: /Search the workspace/ })
  trigger.focus()
  await user.keyboard("{Control>}k{/Control}")
  expect(screen.getByRole("dialog", { name: "Search the workspace" })).toBeTruthy()
  expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.anything())

  await user.keyboard("at")
  await settle(60)
  expect(screen.getByText("1 results")).toBeTruthy()
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Atlas"])
  expect(await axeViolations(document.body)).toEqual([])

  await user.keyboard("zz")
  await settle(60)
  expect(screen.getByText("Nothing matches atzz")).toBeTruthy()

  await user.keyboard("{Backspace}{Backspace}")
  await settle(60)
  await user.keyboard("{Enter}")
  expect(onAction).toHaveBeenCalledWith("atlas")
  await settle(20)
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.anything())
  expect(document.activeElement).toBe(trigger)
})

test("a second trigger on the same controller, like a narrow-screen icon, gets the focus back itself", async () => {
  const user = userEvent.setup()
  render(<GlobalSearch onAction={vi.fn()} />)
  const compact = screen.getByRole("button", { name: "Search" })
  await user.click(compact)
  expect(screen.getByRole("dialog", { name: "Search the workspace" })).toBeTruthy()
  await user.keyboard("{Escape}")
  await settle(20)
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(compact)
})

test("an agent opens the search from the trigger inside the dialog root and queries it by name", async () => {
  render(<GlobalSearch onAction={vi.fn()} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  // With two triggers the dialog takes no single label; agents reach it by either trigger's name.
  for (const entry of components) {
    expect(entry.label ?? entry.buttons?.join(", "), `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const dialog = components.find((entry) => entry.component === "dialog")
  expect(dialog?.buttons).toEqual(["Search the workspace", "Search"])
  const opened = await act(() =>
    agent.act({ steps: [{ ref: dialog?.ref ?? "", action: "press", args: ["Search the workspace"] }] }),
  )
  expect(opened.ok, opened.error?.message).toBe(true)
  await settle()
  const searched = await act(() =>
    agent.act({ steps: [{ ref: "Search the workspace", action: "setQuery", args: ["apo"] }] }),
  )
  expect(searched.ok, searched.error?.message).toBe(true)
  await settle(60)
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Apollo"])
})

// UI SDK 0.1.0-beta.5 drops a dialog's label once a second trigger joins it through the controller.
test.fails("the dialog keeps its trigger's name as its label with a second trigger", async () => {
  render(<GlobalSearch onAction={vi.fn()} />)
  await settle()
  expect(agent.snapshot().find((entry) => entry.component === "dialog")?.label).toBe("Search the workspace")
})
