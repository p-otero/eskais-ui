import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useAsyncOptions } from "@ui-sdk/react/async-options"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPage,
  CommandStatus,
} from "@/components/ui/command"
import {
  CommandDialog,
  CommandDialogContent,
  CommandDialogOpenButton,
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
      <CommandDialogOpenButton controller={controller} variant="ghost" size="icon" aria-label="Search" />
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

test("a second way in, like a narrow-screen icon, opens the same dialog and gets the focus back", async () => {
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

test("with a second way in, the dialog keeps its trigger's name as its agent label", async () => {
  render(<GlobalSearch onAction={vi.fn()} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(components.find((entry) => entry.component === "dialog")?.label).toBe("Search the workspace")
  expect(components.map((entry) => entry.label)).not.toContain("Search")
})

test("an agent opens the search by its name and queries it", async () => {
  render(<GlobalSearch onAction={vi.fn()} />)
  await settle()
  const opened = await act(() => agent.act({ steps: [{ ref: "Search the workspace", action: "open" }] }))
  expect(opened.ok, opened.error?.message).toBe(true)
  await settle()
  expect(screen.getByRole("dialog", { name: "Search the workspace" })).toBeTruthy()
  const searched = await act(() =>
    agent.act({ steps: [{ ref: "Search the workspace", action: "setQuery", args: ["apo"] }] }),
  )
  expect(searched.ok, searched.error?.message).toBe(true)
  await settle(60)
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Apollo"])
})

function Palette({
  escapeKey,
  dismissible,
  open,
  onOpenChange,
}: {
  escapeKey?: "close" | "clear"
  dismissible?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  return (
    <CommandDialog escapeKey={escapeKey} dismissible={dismissible} open={open} onOpenChange={onOpenChange}>
      <CommandDialogTrigger>Open palette</CommandDialogTrigger>
      <CommandDialogContent title="Palette">
        <Command>
          <CommandInput aria-label="Find a command" />
          <CommandList>
            <CommandItem value="apollo">Apollo</CommandItem>
            <CommandItem value="atlas">Atlas</CommandItem>
          </CommandList>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  )
}

test("one Escape closes the palette while the search holds text, and focus returns to the trigger", async () => {
  const user = userEvent.setup()
  render(<Palette />)
  const trigger = screen.getByRole("button", { name: "Open palette" })
  await user.click(trigger)
  await user.keyboard("atl")
  expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Find a command" }).value).toBe("atl")
  await user.keyboard("{Escape}")
  await settle(20)
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

function ReopenPalette({ keepMounted, onAction }: { keepMounted: boolean; onAction: (value: string) => void }) {
  const [controller] = useState(() => createCommandDialogController())
  return (
    <CommandDialog controller={controller}>
      <CommandDialogTrigger shortcut="mod+k">Open palette</CommandDialogTrigger>
      <CommandDialogContent title="Palette" keepMounted={keepMounted}>
        <Command
          onAction={(value) => {
            onAction(value)
            controller.close()
          }}
        >
          <CommandInput aria-label="Find a command" />
          <CommandList>
            <CommandPage>
              <CommandItem value="apollo">Apollo</CommandItem>
              <CommandItem value="atlas">Atlas</CommandItem>
              <CommandItem value="moons" page="moons">
                Moons
              </CommandItem>
            </CommandPage>
            <CommandPage value="moons">
              <CommandItem value="io">Io</CommandItem>
              <CommandItem value="europa">Europa</CommandItem>
            </CommandPage>
          </CommandList>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  )
}

const highlighted = () => document.querySelector("[data-slot=command-item][data-highlighted]")?.textContent

for (const keepMounted of [false, true]) {
  const how = keepMounted ? "with the content kept mounted" : "with the content unmounted"

  test(`after a command runs, the palette reopens empty, first command highlighted, focus in the search (${how})`, async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()
    render(<ReopenPalette keepMounted={keepMounted} onAction={onAction} />)
    const trigger = screen.getByRole("button", { name: "Open palette" })
    await user.keyboard("{Control>}k{/Control}")
    const first = screen.getByRole("combobox", { name: "Find a command" })
    await user.keyboard("atl{Enter}")
    await settle(20)
    expect(onAction).toHaveBeenCalledWith("atlas")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)

    await user.keyboard("{Control>}k{/Control}")
    await settle(20)
    const input = screen.getByRole<HTMLInputElement>("combobox", { name: "Find a command" })
    expect(document.activeElement).toBe(input)
    // Workaround: Electron loses focus when the dialog replaces the search field it focused on open.
    expect(keepMounted ? input : first).toBe(first)
    expect(input.value).toBe("")
    expect(highlighted()).toBe("Apollo")
    await user.keyboard("{Enter}")
    expect(onAction).toHaveBeenLastCalledWith("apollo")
  })

  test(`a moved highlight and an open page don't survive a reopen (${how})`, async () => {
    const user = userEvent.setup()
    render(<ReopenPalette keepMounted={keepMounted} onAction={vi.fn()} />)
    await user.keyboard("{Control>}k{/Control}")
    await user.keyboard("{ArrowDown}")
    expect(highlighted()).toBe("Atlas")
    await user.keyboard("{Escape}")
    await settle(20)
    await user.keyboard("{Control>}k{/Control}")
    await settle(20)
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Find a command" }))
    expect(highlighted()).toBe("Apollo")

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}")
    await settle(20)
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Io", "Europa"])
    await user.keyboard("{Escape}")
    await settle(20)
    expect(screen.queryByRole("dialog")).toBeNull()
    await user.keyboard("{Control>}k{/Control}")
    await settle(20)
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Find a command" }))
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Apollo", "Atlas", "Moons"])
    expect(highlighted()).toBe("Apollo")
  })
}

test("escapeKey clear keeps UI SDK's order: the first Escape clears the search, the second closes", async () => {
  const user = userEvent.setup()
  render(<Palette escapeKey="clear" />)
  await user.click(screen.getByRole("button", { name: "Open palette" }))
  await user.keyboard("atl{Escape}")
  await settle(20)
  expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Find a command" }).value).toBe("")
  expect(screen.getByRole("dialog")).toBeTruthy()
  await user.keyboard("{Escape}")
  await settle(20)
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("a palette that isn't dismissible keeps Escape for the search", async () => {
  const user = userEvent.setup()
  render(<Palette dismissible={false} />)
  await user.click(screen.getByRole("button", { name: "Open palette" }))
  await user.keyboard("atl{Escape}")
  await settle(20)
  expect(screen.getByRole("dialog")).toBeTruthy()
  expect(screen.getByRole<HTMLInputElement>("combobox", { name: "Find a command" }).value).toBe("")
})

function ControlledPalette() {
  const [open, setOpen] = useState(false)
  return <Palette open={open} onOpenChange={setOpen} />
}

test("a controlled palette hears the Escape close through onOpenChange", async () => {
  const user = userEvent.setup()
  render(<ControlledPalette />)
  const trigger = screen.getByRole("button", { name: "Open palette" })
  await user.click(trigger)
  await user.keyboard("atl{Escape}")
  await settle(20)
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
