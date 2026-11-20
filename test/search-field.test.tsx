import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { SearchField } from "@/components/ui/search-field"
import { searchField, type SearchFieldInput } from "@/components/ui/search-field-primitive"

const agent = createAgent()

function fakeInput(initial: string): SearchFieldInput & { value: string } {
  return {
    value: initial,
    getValue() {
      return this.value
    },
    clear() {
      if (this.value === "") return false
      this.value = ""
      return true
    },
    focus: vi.fn(),
  }
}

test("primitive: Enter submits the current value and Escape clears it", async () => {
  const input = fakeInput("atlas")
  const onSearch = vi.fn()
  const view = mount(searchField, { input, onSearch }, `<root><input aria-label="Query" /></root>`)
  try {
    await view.keys("Tab", "Enter")
    expect(onSearch).toHaveBeenCalledWith("atlas", expect.objectContaining({ reason: "submit" }))
    await view.keys("Escape")
    expect(input.value).toBe("")
    expect(input.focus).toHaveBeenCalled()
  } finally {
    view.unmount()
  }
})

test("primitive: a canceled search reports that it did not run", () => {
  const view = mount(
    searchField,
    { input: fakeInput("x"), onSearch: (_query, details) => details.cancel() },
    `<root><input aria-label="Query" /></root>`,
  )
  try {
    expect(() => view.api.submit()).toThrow("submit was refused by the app.")
    expect(view.api.submit(new KeyboardEvent("keydown", { key: "Enter" }))).toBe(false)
  } finally {
    view.unmount()
  }
})

test("primitive: renders on the server", () => {
  checkServer(searchField, { onSearch: () => {} }, `<root><input aria-label="Query" /></root>`)
})

test("Enter searches, Escape clears and keeps focus", async () => {
  const user = userEvent.setup()
  const onSearch = vi.fn()
  render(<SearchField label="Search projects" onSearch={onSearch} />)
  const input = screen.getByRole<HTMLInputElement>("searchbox", { name: "Search projects" })
  expect(screen.getByRole("search", { name: "Search projects" })).toBeTruthy()

  await user.type(input, "atlas")
  await user.keyboard("{Enter}")
  expect(onSearch).toHaveBeenCalledWith("atlas", expect.objectContaining({ reason: "submit" }))

  await user.keyboard("{Escape}")
  expect(input.value).toBe("")
  expect(document.activeElement).toBe(input)
})

test("Escape on an empty field still closes the enclosing dialog", async () => {
  const user = userEvent.setup()
  render(
    <Dialog>
      <DialogTrigger>Find</DialogTrigger>
      <DialogContent>
        <DialogTitle>Find a project</DialogTitle>
        <SearchField label="Search projects" onSearch={() => {}} />
      </DialogContent>
    </Dialog>,
  )
  await user.click(screen.getByRole("button", { name: "Find" }))
  const input = screen.getByRole("searchbox", { name: "Search projects" })
  await user.click(input)
  await user.type(input, "a")
  await user.keyboard("{Escape}")
  expect(screen.getByRole("dialog", { name: "Find a project" })).toBeTruthy()
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("an agent can find the search field, type a query and run it", async () => {
  const onSearch = vi.fn()
  render(<SearchField label="Search projects" onSearch={onSearch} />)
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))

  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const searchEntry = components.find((entry) => entry.component === "search-field")
  expect(searchEntry?.label).toBe("Search projects")
  expect(searchEntry?.actions).toContain("submit")

  const result = await agent.act({
    steps: [
      { ref: "Search projects", action: "setValue", args: ["atlas"] },
      { ref: "Search projects", action: "submit" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole<HTMLInputElement>("searchbox", { name: "Search projects" }).value).toBe("atlas")
  expect(onSearch).toHaveBeenCalledWith("atlas", expect.objectContaining({ source: "agent" }))
})

test("without onSearch the submit action is hidden from agents", async () => {
  render(<SearchField label="Filter rows" />)
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  const entry = agent.snapshot().find((item) => !item.offPage && item.component === "search-field")
  expect(entry?.actions ?? []).not.toContain("submit")
})
