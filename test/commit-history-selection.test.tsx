import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { describe, expect, test, vi } from "vitest"

import { CommitHistory } from "@/components/ui/commit-history"
import { commitHistory, type CommitLookup } from "@/components/ui/commit-history-primitive"
import type { Commit } from "@/lib/commit-graph"

const NOW = Date.parse("2026-11-18T12:00:00Z")
const ago = (minutes: number) => NOW - minutes * 60_000

const commits: Commit[] = [
  { id: "c3", parents: ["m2"], message: "Bump version", date: ago(10), author: "Kai Brandt" },
  { id: "m2", parents: ["c1", "b1"], message: "Merge feature into main", date: ago(20) },
  { id: "b1", parents: ["c1"], message: "Add the feature", date: ago(25) },
  { id: "c1", parents: [], message: "Initial commit", date: ago(30) },
]

const labelOf = (row: HTMLElement) => row.querySelector("[data-slot=tree-label]") as HTMLElement
const rowNamed = (name: RegExp | string) => screen.getByRole("treeitem", { name })

function Controlled({ onSelect }: { onSelect?: (id: string | null) => void }) {
  const [selected, setSelected] = useState<string | null>("c3")
  return (
    <CommitHistory
      aria-label="History"
      commits={commits}
      now={NOW}
      selected={selected}
      onSelect={(id) => {
        setSelected(id)
        onSelect?.(id)
      }}
    />
  )
}

describe("selection", () => {
  test("the selected commit carries aria-selected and the nav-current look", () => {
    render(<CommitHistory aria-label="History" commits={commits} now={NOW} defaultSelected="c3" />)
    const head = rowNamed(/^Bump version/)
    expect(head.getAttribute("aria-selected")).toBe("true")
    expect(rowNamed(/^Initial commit/).getAttribute("aria-selected")).not.toBe("true")
    expect(head.querySelector("[aria-hidden=true]")?.className).toContain("group-data-selected/commit:nav-current")
    expect(labelOf(head).hasAttribute("data-selected")).toBe(true)
    expect(labelOf(head).className).toContain("data-selected:font-medium")
  })

  test("a press selects; a press on the selected row opens its details", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Controlled onSelect={onSelect} />)
    await user.click(labelOf(rowNamed(/^Initial commit/)))
    expect(onSelect).toHaveBeenLastCalledWith("c1")
    expect(rowNamed(/^Initial commit/).getAttribute("aria-selected")).toBe("true")
    expect(rowNamed(/^Initial commit/).hasAttribute("data-details-open")).toBe(false)
    await user.click(labelOf(rowNamed(/^Initial commit/)))
    expect(rowNamed(/^Initial commit/).hasAttribute("data-details-open")).toBe(true)
  })

  test("Enter and Space select; Enter on the selected row opens it; a merge expands the same way", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Controlled onSelect={onSelect} />)
    const head = rowNamed(/^Bump version/)
    head.focus()
    await user.keyboard("{ArrowDown}")
    expect(onSelect).not.toHaveBeenCalled()
    await user.keyboard(" ")
    expect(onSelect).toHaveBeenLastCalledWith("m2")
    const merge = rowNamed(/^Merge feature/)
    expect(merge.getAttribute("aria-expanded")).toBe("false")
    await user.keyboard("{Enter}")
    expect(merge.getAttribute("aria-expanded")).toBe("true")
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}")
    expect(onSelect).toHaveBeenLastCalledWith("c1")
    expect(rowNamed(/^Initial commit/).hasAttribute("data-details-open")).toBe(false)
    await user.keyboard("{Enter}")
    expect(rowNamed(/^Initial commit/).hasAttribute("data-details-open")).toBe(true)
  })

  test("without selection props, rows aren't selectable and a press opens details as before", async () => {
    const user = userEvent.setup()
    render(<CommitHistory aria-label="History" commits={commits} now={NOW} />)
    await user.click(labelOf(rowNamed(/^Initial commit/)))
    expect(rowNamed(/^Initial commit/).hasAttribute("aria-selected")).toBe(false)
    expect(rowNamed(/^Initial commit/).hasAttribute("data-details-open")).toBe(true)
  })

  test("agents select by id, hash or subject", async () => {
    const agent = createAgent()
    const onSelect = vi.fn()
    render(<Controlled onSelect={onSelect} />)
    const history = agent.snapshot().find((entry) => entry.component === "commit-history")
    expect(history).toMatchObject({ selected: "c3" })
    expect(history?.actions).toContain("select")
    let result = await agent.act({ steps: [{ ref: "History", action: "select", args: ["Initial commit"] }] })
    expect(result.ok).toBe(true)
    expect(onSelect).toHaveBeenLastCalledWith("c1")
    expect(rowNamed(/^Initial commit/).getAttribute("aria-selected")).toBe("true")
    result = await agent.act({ steps: [{ ref: "History", action: "select", args: ["nope"] }] })
    expect(result.ok).toBe(false)
    await act(async () => {})
  })
})

const lookup: CommitLookup = {
  find: (ref) =>
    ref === "c1" || ref === "Initial" ? { id: "c1", hash: "c1", subject: "Initial", merge: false } : undefined,
  entries: () => [],
}

test("primitive: select reports a reason, can be canceled, and refuses without selection", () => {
  const onSelectedChange = vi.fn()
  const view = mount(commitHistory, { lookup, onSelectedChange }, `<root aria-label="History"></root>`)
  const off = mount(commitHistory, { lookup }, `<root aria-label="History"></root>`)
  try {
    expect(view.api.select("Initial")).toBe(true)
    expect(onSelectedChange).toHaveBeenCalledWith("c1", expect.objectContaining({ reason: "imperative" }))
    expect(view.state).toMatchObject({ selected: "c1" })
    expect(view.api.select(null)).toBe(true)
    expect(view.state).toMatchObject({ selected: null })
    expect(() => off.api.select("c1")).toThrow(/doesn't select/)
  } finally {
    view.unmount()
    off.unmount()
  }
  const canceled = mount(
    commitHistory,
    { lookup, onSelectedChange: (_id, details) => details.cancel() },
    `<root aria-label="History"></root>`,
  )
  expect(canceled.api.select("c1")).toBe(false)
  canceled.unmount()
})

test("primitive: server markup matches the client's", async () => {
  await checkServer(commitHistory, { lookup, defaultSelected: "c1" }, `<root aria-label="History"></root>`)
})

test("headerStart sits before the branch switcher, actions after it", () => {
  render(
    <CommitHistory
      aria-label="History"
      commits={commits}
      now={NOW}
      branch="main"
      branches={["main", "dev"]}
      onBranchChange={() => {}}
      headerStart={<button type="button">Repository</button>}
      actions={<button type="button">Refresh</button>}
    />,
  )
  const header = document.querySelector("[data-slot=commit-history-header]") as HTMLElement
  const controls = [...header.querySelectorAll("button, [role=combobox]")].map(
    (element) => element.getAttribute("aria-label") ?? element.textContent,
  )
  expect(controls.slice(0, 3)).toEqual(["Repository", "Branch", "Refresh"])
})
