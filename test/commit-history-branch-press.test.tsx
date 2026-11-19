import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { describe, expect, test, vi } from "vitest"

import { CommitHistory, WORKING_TREE } from "@/components/ui/commit-history"
import type { CommitBranch } from "@/lib/commit-branches"
import type { Commit } from "@/lib/commit-graph"

const NOW = Date.parse("2026-11-18T12:00:00Z")
const ago = (minutes: number) => NOW - minutes * 60_000

const commits: Commit[] = [
  { id: "c3", parents: ["c2"], message: "Bump version", date: ago(10) },
  { id: "c2", parents: ["c1"], message: "Add the feature", date: ago(20) },
  { id: "c1", parents: [], message: "Initial commit", date: ago(30) },
]

const branches: CommitBranch[] = [
  { name: "main", head: "c2" },
  { name: "feature", head: "c3" },
]

const labelOf = (row: HTMLElement) => row.querySelector("[data-slot=tree-label]") as HTMLElement
const rowNamed = (name: RegExp) => screen.getByRole("treeitem", { name })

// The root carries `data-branch` for the branch it shows; a row press must not read it as a press on a pill.
async function pressWithoutErrors(press: () => Promise<void>) {
  const errors: unknown[] = []
  const onError = (event: ErrorEvent) => {
    errors.push(event.error)
    event.preventDefault()
  }
  window.addEventListener("error", onError)
  try {
    await press()
  } finally {
    window.removeEventListener("error", onError)
  }
  expect(errors).toEqual([])
}

function Selectable({ onSelect, workingTree }: { onSelect: (id: string | null) => void; workingTree?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <CommitHistory
      aria-label="History"
      commits={commits}
      now={NOW}
      branch="main"
      branches={["main", "feature"]}
      onBranchChange={() => {}}
      workingTree={workingTree ? { staged: 1, unstaged: 1 } : undefined}
      selected={selected}
      onSelect={(id) => {
        setSelected(id)
        onSelect(id)
      }}
    />
  )
}

describe("a row press with branch set, in the trail view", () => {
  test("a pointer press opens the commit's details", async () => {
    const user = userEvent.setup()
    render(<CommitHistory aria-label="History" branch="main" commits={commits} now={NOW} />)
    expect(screen.getByRole("region", { name: "History" }).getAttribute("data-branch")).toBe("main")
    await pressWithoutErrors(() => user.click(labelOf(rowNamed(/^Initial commit/))))
    expect(rowNamed(/^Initial commit/).hasAttribute("data-details-open")).toBe(true)
  })

  test("Enter opens the commit with onOpenCommit", async () => {
    const user = userEvent.setup()
    const onOpenCommit = vi.fn()
    render(<CommitHistory aria-label="History" branch="main" commits={commits} now={NOW} onOpenCommit={onOpenCommit} />)
    rowNamed(/^Bump version/).focus()
    await pressWithoutErrors(() => user.keyboard("{Enter}"))
    expect(onOpenCommit).toHaveBeenLastCalledWith(expect.objectContaining({ id: "c3" }), expect.anything())
    await pressWithoutErrors(() => user.keyboard("{ArrowDown}{Enter}"))
    expect(onOpenCommit).toHaveBeenLastCalledWith(expect.objectContaining({ id: "c2" }), expect.anything())
  })

  test("with selected and a working tree, a press or Space selects and a second press or Enter opens", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Selectable onSelect={onSelect} workingTree />)
    await pressWithoutErrors(() => user.click(labelOf(rowNamed(/^Add the feature/))))
    expect(onSelect).toHaveBeenLastCalledWith("c2")
    await pressWithoutErrors(() => user.click(labelOf(rowNamed(/^Add the feature/))))
    expect(rowNamed(/^Add the feature/).hasAttribute("data-details-open")).toBe(true)
    await pressWithoutErrors(() => user.click(labelOf(rowNamed(/^Uncommitted changes/))))
    expect(onSelect).toHaveBeenLastCalledWith(WORKING_TREE)
    rowNamed(/^Initial commit/).focus()
    await pressWithoutErrors(() => user.keyboard(" "))
    expect(onSelect).toHaveBeenLastCalledWith("c1")
    await pressWithoutErrors(() => user.keyboard("{Enter}"))
    expect(rowNamed(/^Initial commit/).hasAttribute("data-details-open")).toBe(true)
  })

  test("agents select and open commits", async () => {
    const agent = createAgent()
    const onSelect = vi.fn()
    render(<Selectable onSelect={onSelect} />)
    let result = await agent.act({
      steps: [{ ref: "History", action: "select", args: ["Initial commit"] }],
    })
    expect(result.ok).toBe(true)
    expect(onSelect).toHaveBeenLastCalledWith("c1")
    result = await agent.act({
      steps: [{ ref: "History", action: "expandDetails", args: ["c1"] }],
    })
    expect(result.ok).toBe(true)
    expect(rowNamed(/^Initial commit/).hasAttribute("data-details-open")).toBe(true)
    await act(async () => {})
  })
})

describe("in the branches view, with branch set", () => {
  test("a pill press still focuses its branch, and a row press beside it opens the commit", async () => {
    const user = userEvent.setup()
    const onFocusedBranchChange = vi.fn()
    render(
      <CommitHistory
        aria-label="History"
        view="branches"
        branch="main"
        branches={branches}
        commits={commits}
        now={NOW}
        onFocusedBranchChange={onFocusedBranchChange}
      />,
    )
    const pill = rowNamed(/^Bump version/).querySelector<HTMLElement>(
      "[data-slot=commit-branch-pill][data-branch=feature]",
    ) as HTMLElement
    await pressWithoutErrors(() => user.click(pill))
    expect(onFocusedBranchChange).toHaveBeenLastCalledWith("feature", expect.objectContaining({ reason: "item-press" }))
    await pressWithoutErrors(() => user.click(labelOf(rowNamed(/^Initial commit/))))
    expect(onFocusedBranchChange).toHaveBeenCalledTimes(1)
    expect(rowNamed(/^Initial commit/).hasAttribute("data-details-open")).toBe(true)
  })
})
