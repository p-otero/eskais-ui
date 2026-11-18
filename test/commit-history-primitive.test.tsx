import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer, mount } from "@ui-sdk/core/testing"
import { expect, test, vi } from "vitest"

import { CommitHistory } from "@/components/ui/commit-history"
import { commitHistory, type CommitLookup } from "@/components/ui/commit-history-primitive"
import { GitTree } from "@/components/ui/git-tree"
import { gitTree, type GitTreeLookup } from "@/components/ui/git-tree-primitive"
import type { Commit } from "@/lib/commit-graph"

import { axeViolations } from "./axe"

const markup = `<root aria-label="History"></root>`

const lookup: CommitLookup = {
  find: (ref) =>
    ref === "m1" || ref === "Merge a into main"
      ? { id: "m1", hash: "m1", subject: "Merge a into main", merge: true }
      : ref === "c2"
        ? { id: "c2", hash: "c2abc12", subject: "Fix", merge: false }
        : undefined,
  entries: () => [],
}

test("primitive: expand, details and branch change with a reason, and a callback can cancel", () => {
  const onExpandedChange = vi.fn()
  const view = mount(
    commitHistory,
    {
      lookup,
      onExpandedChange,
      onDetailsChange: (_open, details) => details.cancel(),
      branches: ["main", "dev"],
      branch: "main",
      onBranchChange: () => {},
    },
    markup,
  )
  try {
    expect(view.api.expand("Merge a into main")).toBe(true)
    expect(onExpandedChange).toHaveBeenCalledWith(["m1"], expect.objectContaining({ reason: "imperative" }))
    expect(view.api.expandDetails("c2")).toBe(false)
    expect(() => view.api.expand("c2")).toThrow(/no merged commits/)
    expect(() => view.api.expandDetails("nope")).toThrow(/No commit "nope"/)
    expect(() => view.api.selectBranch("feature")).toThrow(/Branches: main, dev/)
    expect(() => view.api.openCommit("c2")).toThrow(/expandDetails/)
  } finally {
    view.unmount()
  }
})

test("primitive: single details mode replaces, multiple adds", () => {
  const single = mount(commitHistory, { lookup }, markup)
  const multiple = mount(commitHistory, { lookup, detailsMode: "multiple" }, markup)
  try {
    single.api.expandDetails("m1")
    single.api.expandDetails("c2")
    expect(single.state).toMatchObject({ details: ["c2"] })
    multiple.api.expandDetails("m1")
    multiple.api.expandDetails("c2")
    expect(multiple.state).toMatchObject({ details: ["m1", "c2"] })
  } finally {
    single.unmount()
    multiple.unmount()
  }
})

test("primitives render on the server", () => {
  checkServer(commitHistory, { lookup, defaultExpanded: ["m1"] }, markup)
  const treeLookup: GitTreeLookup = { kind: () => "file", entries: () => [] }
  checkServer(gitTree, { lookup: treeLookup }, `<root aria-label="Files"></root>`)
})

const commits: Commit[] = [
  { id: "c3", parents: ["m1"], message: "Bump `package.json`", date: 0, tags: [{ label: "Release", tone: "violet" }] },
  { id: "m1", parents: ["c1", "f1"], message: "Merge a into main", date: 0 },
  { id: "f1", parents: ["c1"], message: "Feature", date: 0 },
  {
    id: "c1",
    parents: [],
    message: "Start",
    date: 0,
    hash: "c1abcde",
    stats: { files: 1, additions: 2, deletions: 0 },
  },
]

test("no axe violations, collapsed, expanded and with details open", async () => {
  const { container } = render(
    <CommitHistory aria-label="History" commits={commits} now={0} defaultExpanded={["m1"]} defaultDetails={["c1"]} />,
  )
  expect(await axeViolations(container)).toEqual([])
  const tree = render(<GitTree aria-label="Files" files={["a/b.ts", { path: "c.ts", status: "added" }]} />)
  expect(await axeViolations(tree.container)).toEqual([])
})

test("Enter and Space on the copy button stay in the details", async () => {
  const user = userEvent.setup()
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.resolve() } })
  render(<CommitHistory aria-label="History" commits={commits} now={0} defaultDetails={["c1"]} />)
  const row = screen.getByRole("treeitem", { name: /^Start/ })
  screen.getByRole("button", { name: "Copy hash" }).focus()
  await user.keyboard("{Enter}")
  expect(row.hasAttribute("data-details-open")).toBe(true)
  expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy()
})
