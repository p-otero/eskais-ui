import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Collapsible, CollapsibleIcon, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

const agent = createAgent()

function Board({ onTabChange }: { onTabChange?: (value: string | null) => void }) {
  return (
    <>
      <Tabs defaultValue="board" onValueChange={onTabChange}>
        <TabsList aria-label="View">
          <TabsTab value="board">Board</TabsTab>
          <TabsTab value="table">Table</TabsTab>
          <TabsTab value="archive" disabled>
            Archive
          </TabsTab>
        </TabsList>
        <TabsPanel value="board">Columns</TabsPanel>
        <TabsPanel value="table">Rows</TabsPanel>
        <TabsPanel value="archive">Old tasks</TabsPanel>
      </Tabs>
      <Collapsible>
        <CollapsibleTrigger>
          Done column
          <CollapsibleIcon />
        </CollapsibleTrigger>
        <CollapsiblePanel>Shipped tasks</CollapsiblePanel>
      </Collapsible>
    </>
  )
}

test("arrow keys move between tabs, select them and skip the disabled one", async () => {
  const user = userEvent.setup()
  const onTabChange = vi.fn()
  render(<Board onTabChange={onTabChange} />)
  const board = screen.getByRole("tab", { name: "Board" })
  const table = screen.getByRole("tab", { name: "Table" })

  expect(board.getAttribute("aria-selected")).toBe("true")
  expect(board.dataset.selected).toBe("")
  expect(screen.getByRole("tabpanel").textContent).toBe("Columns")

  await user.click(board)
  await user.keyboard("{ArrowRight}")
  expect(table).toBe(document.activeElement)
  expect(table.getAttribute("aria-selected")).toBe("true")
  expect(board.hasAttribute("data-selected")).toBe(false)
  expect(screen.getByRole("tabpanel", { name: "Table" }).textContent).toBe("Rows")
  expect(onTabChange).toHaveBeenLastCalledWith("table", expect.objectContaining({ reason: "list-navigation" }))

  await user.keyboard("{ArrowLeft}")
  expect(board.getAttribute("aria-selected")).toBe("true")

  await user.click(screen.getByRole("tab", { name: "Archive" }))
  expect(board.getAttribute("aria-selected")).toBe("true")
})

test("only the selected tab is a tab stop", () => {
  render(<Board />)
  const tabbable = screen.getAllByRole("tab").filter((tab) => tab.tabIndex === 0)
  expect(tabbable.map((tab) => tab.textContent)).toEqual(["Board"])
})

test("the collapsible trigger toggles its panel with a click and with Enter", async () => {
  const user = userEvent.setup()
  render(<Board />)
  const trigger = screen.getByRole("button", { name: "Done column" })
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(screen.queryByText("Shipped tasks")).toBeNull()

  await user.click(trigger)
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  expect(trigger.dataset.open).toBe("")
  const panel = screen.getByText("Shipped tasks")
  expect(trigger.getAttribute("aria-controls")).toBe(panel.id)

  await user.keyboard("{Enter}")
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(trigger).toBe(document.activeElement)
})

test("an agent can find the tabs and the collapsible and drive both", async () => {
  render(<Board />)
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const labels = components.map((entry) => entry.label)
  for (const label of ["View", "Done column"]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label)
  }

  const result = await agent.act({
    steps: [
      { ref: "View", action: "setValue", args: ["table"] },
      { ref: "Done column", action: "open" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("tab", { name: "Table" }).getAttribute("aria-selected")).toBe("true")
  expect(screen.getByRole("button", { name: "Done column" }).getAttribute("aria-expanded")).toBe("true")
})
