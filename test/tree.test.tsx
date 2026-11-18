import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import {
  Tree,
  TreeGroup,
  TreeItem,
  TreeItemIndicator,
  TreeItemLabel,
  toggleTreeItem,
  treeFileIcon,
  treeFromPaths,
  visibleTreeRows,
  type TreeItemData,
} from "@/components/ui/tree"

import { axeViolations } from "./axe"

const agent = createAgent()
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

const paths = ["src/index.ts", "src/lib/format.ts", "docs/", "package.json", "README.md"]

test("paths render as styled rows, folders first, with an icon per node", () => {
  render(<Tree aria-label="Project" paths={paths} defaultExpanded={["src"]} />)
  const tree = screen.getByRole("tree", { name: "Project" })
  const rows = screen.getAllByRole("treeitem").map((item) => item.getAttribute("aria-level"))
  expect(rows[0]).toBe("1")
  expect(screen.getByRole("treeitem", { name: "src" }).getAttribute("aria-expanded")).toBe("true")
  expect(screen.getByRole("treeitem", { name: "index.ts" }).getAttribute("aria-level")).toBe("2")
  expect(tree.querySelectorAll("[data-slot=tree-label] svg").length).toBeGreaterThan(4)
  expect(tree.querySelector("[data-slot=tree-group]")).not.toBeNull()
})

test("treeFileIcon picks folders open or closed and files by extension", () => {
  const state = { branch: false, expanded: false } as Parameters<typeof treeFileIcon>[1]
  const json = treeFileIcon({ value: "a.json", label: "a.json" }, state)
  const plain = treeFileIcon({ value: "LICENSE", label: "LICENSE" }, state)
  const closed = treeFileIcon({ value: "src", label: "src" }, { ...state, branch: true })
  const open = treeFileIcon({ value: "src", label: "src" }, { ...state, branch: true, expanded: true })
  expect(json).not.toBe(plain)
  expect(closed).not.toBe(open)
})

test("arrow keys move and expand, and Enter runs the action", async () => {
  const user = userEvent.setup()
  const onAction = vi.fn()
  render(<Tree aria-label="Project" paths={paths} onAction={onAction} />)
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("treeitem", { name: "src" }))
  await user.keyboard("{ArrowRight}")
  expect(screen.getByRole("treeitem", { name: "src" }).getAttribute("aria-expanded")).toBe("true")
  await user.keyboard("{ArrowRight}{Enter}")
  expect(onAction).toHaveBeenLastCalledWith("src/lib", expect.anything())
})

test("checkable trees cascade and report mixed branches", async () => {
  const user = userEvent.setup()
  const onCheckedChange = vi.fn()
  const items: TreeItemData[] = [
    {
      value: "frontend",
      label: "Frontend",
      children: [
        { value: "react", label: "React" },
        { value: "vue", label: "Vue" },
      ],
    },
  ]
  render(
    <Tree
      aria-label="Stack"
      items={items}
      checkable
      mode="none"
      defaultExpanded={["frontend"]}
      onCheckedChange={onCheckedChange}
    />,
  )
  await user.click(screen.getByRole("treeitem", { name: "React" }).querySelector("[data-slot=tree-checkbox]")!)
  expect(onCheckedChange).toHaveBeenLastCalledWith(["react"], expect.anything())
  expect(screen.getByRole("treeitem", { name: "Frontend" }).getAttribute("aria-checked")).toBe("mixed")
  expect(toggleTreeItem(items, ["react"], "frontend")).toEqual(["react", "vue"])
  expect(toggleTreeItem(items, ["react", "vue"], "frontend")).toEqual([])
})

test("visibleTreeRows flattens the open branches for a virtualized list", () => {
  const items = treeFromPaths(paths)
  expect(visibleTreeRows(items, []).map((row) => row.item.label)).toEqual(["src", "docs", "package.json", "README.md"])
  expect(visibleTreeRows(items, ["src"]).length).toBe(6)
})

test("composed parts take the same styles", () => {
  render(
    <Tree aria-label="Folders" defaultExpanded={["inbox"]}>
      <TreeItem value="inbox">
        <TreeItemLabel>
          <TreeItemIndicator />
          Inbox
        </TreeItemLabel>
        <TreeGroup>
          <TreeItem value="updates">
            <TreeItemLabel>Updates</TreeItemLabel>
          </TreeItem>
        </TreeGroup>
      </TreeItem>
    </Tree>,
  )
  expect(screen.getByRole("treeitem", { name: "Updates" }).getAttribute("aria-level")).toBe("2")
  expect(document.querySelector("[data-slot=tree-indicator] svg")).not.toBeNull()
})

test("no axe violations", async () => {
  const { container } = render(
    <main>
      <Tree aria-label="Project" paths={paths} defaultExpanded={["src"]} checkable mode="none" />
    </main>,
  )
  expect(await axeViolations(container)).toEqual([])
})

test("an agent finds the tree by name and expands and selects an item", async () => {
  render(<Tree aria-label="Project" paths={paths} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const tree = components.find((entry) => entry.label === "Project")
  expect(tree?.actions.length).toBeGreaterThan(0)
  const actions = tree?.actions ?? []
  expect(actions).toEqual(expect.arrayContaining(["expand"]))
  const expanded = await act(() => agent.act({ steps: [{ ref: "Project", action: "expand", args: ["src"] }] }))
  expect(expanded.ok, expanded.error?.message).toBe(true)
  expect(screen.getByRole("treeitem", { name: "src" }).getAttribute("aria-expanded")).toBe("true")
})
