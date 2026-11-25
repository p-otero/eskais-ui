import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { CommitHistory, WORKING_TREE } from "@/components/ui/commit-history"
import { commitHistory } from "@/components/ui/commit-history-primitive"
import type { Commit } from "@/lib/commit-graph"

const NOW = Date.parse("2026-11-18T12:00:00Z")
const ago = (minutes: number) => NOW - minutes * 60_000

const commits: Commit[] = [
  { id: "c2", parents: ["c1"], message: "Bump version", date: ago(10) },
  { id: "c1", parents: [], message: "Initial commit", date: ago(30) },
]

const labelOf = (row: HTMLElement) => row.querySelector("[data-slot=tree-label]") as HTMLElement

function Dirty({ onSelect }: { onSelect?: (id: string | null) => void }) {
  const [selected, setSelected] = useState<string | null>(WORKING_TREE)
  return (
    <CommitHistory
      aria-label="History"
      commits={commits}
      now={NOW}
      workingTree={{ staged: 2, unstaged: 3 }}
      selected={selected}
      onSelect={(id) => {
        setSelected(id)
        onSelect?.(id)
      }}
    />
  )
}

test("the working tree comes first, named with its counts, with a hollow dashed node", () => {
  render(<Dirty />)
  const rows = within(screen.getByRole("tree", { name: "History" })).getAllByRole("treeitem")
  expect(rows).toHaveLength(3)
  const row = rows[0] as HTMLElement
  expect(row.textContent).toContain("Uncommitted changes")
  expect(screen.getByRole("treeitem", { name: "Uncommitted changes, 2 staged, 3 unstaged" })).toBe(row)
  expect(row.getAttribute("aria-selected")).toBe("true")
  const node = row.querySelector("[data-node=working-tree]")
  expect(node?.className).toContain("border-dashed")
  expect(node?.className).toContain("bg-card")
})

test("its label and counts take overrides", () => {
  render(
    <CommitHistory
      aria-label="History"
      commits={commits}
      now={NOW}
      workingTree={{ staged: 1, unstaged: 0, label: "Cambios sin confirmar" }}
      labels={{ staged: (n) => `${String(n)} preparados`, unstaged: (n) => `${String(n)} sin preparar` }}
    />,
  )
  expect(screen.getByRole("treeitem", { name: "Cambios sin confirmar, 1 preparados, 0 sin preparar" })).toBeTruthy()
})

test("it shares roving focus and selection with the commits", async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  render(<Dirty onSelect={onSelect} />)
  await user.tab()
  const working = screen.getByRole("treeitem", { name: /^Uncommitted changes/ })
  expect(document.activeElement).toBe(working)
  await user.keyboard("{ArrowDown}{Enter}")
  expect(onSelect).toHaveBeenLastCalledWith("c2")
  await user.keyboard("{ArrowUp}")
  expect(document.activeElement).toBe(working)
  await user.click(labelOf(working))
  expect(onSelect).toHaveBeenLastCalledWith(WORKING_TREE)
  await user.click(labelOf(working))
  expect(working.hasAttribute("data-details-open")).toBe(false)
})

test("agents see it as an item and select it by its id", async () => {
  const agent = createAgent()
  const onSelect = vi.fn()
  render(<Dirty onSelect={onSelect} />)
  await act(async () => {
    await agent.act({ steps: [{ ref: "History", action: "select", args: ["c1"] }] })
  })
  const found = await agent.query({ within: "History", text: "Uncommitted" })
  expect(Array.isArray(found) && found[0]?.items).toContainEqual({
    value: WORKING_TREE,
    label: "Uncommitted changes, 2 staged, 3 unstaged",
  })
  const result = await agent.act({ steps: [{ ref: "History", action: "select", args: [WORKING_TREE] }] })
  expect(result.ok).toBe(true)
  expect(onSelect).toHaveBeenLastCalledWith(WORKING_TREE)
})

test("without a working tree, its id selects nothing", async () => {
  const agent = createAgent()
  render(<CommitHistory aria-label="History" commits={commits} now={NOW} onSelect={() => {}} />)
  const result = await agent.act({ steps: [{ ref: "History", action: "select", args: [WORKING_TREE] }] })
  expect(result.ok).toBe(false)
})

test("primitive: server markup with a working tree matches", () => {
  checkServer(
    commitHistory,
    { workingTree: true, defaultSelected: WORKING_TREE, lookup: { find: () => undefined, entries: () => [] } },
    `<root aria-label="History"></root>`,
  )
})
