import { readFileSync } from "node:fs"
import { join } from "node:path"

import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterAll, beforeAll, expect, test, vi } from "vitest"

import { GitDiff } from "@/components/ui/git-diff"

const patch = readFileSync(join(import.meta.dirname, "fixtures", "diff", "real.patch"), "utf8")

const staged = `diff --git a/src/onboarding/step-indicator.tsx b/src/onboarding/step-indicator.tsx
new file mode 100644
--- /dev/null
+++ b/src/onboarding/step-indicator.tsx
@@ -0,0 +1,2 @@
+export function StepIndicator() {
+}
diff --git a/src/onboarding/steps.tsx b/src/onboarding/steps.tsx
--- a/src/onboarding/steps.tsx
+++ b/src/onboarding/steps.tsx
@@ -3,2 +3,3 @@
 import { PlanPicker } from "./plan-picker"
+import { StepIndicator } from "./step-indicator"
 import { WorkspaceForm } from "./workspace-form"
`
const unstaged = `diff --git a/src/onboarding/steps.tsx b/src/onboarding/steps.tsx
--- a/src/onboarding/steps.tsx
+++ b/src/onboarding/steps.tsx
@@ -18,2 +18,2 @@
-  "Create a workspace",
+  "Name your workspace",
   "Invite your team",
diff --git a/src/i18n/en.json b/src/i18n/en.json
--- a/src/i18n/en.json
+++ b/src/i18n/en.json
@@ -1,1 +1,1 @@
-  "title": "Set up",
+  "title": "Welcome",
`

const height = Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight")!
beforeAll(() => {
  Element.prototype.scrollTo = () => {}
  Object.defineProperty(Element.prototype, "clientHeight", {
    configurable: true,
    get(this: Element) {
      return this instanceof HTMLElement && this.dataset.slot === "diff-view-viewport" ? 4000 : 0
    },
  })
})
afterAll(() => {
  Object.defineProperty(Element.prototype, "clientHeight", height)
})

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)))

test("the file tree is --diff-tree-width wide, 13rem by default", async () => {
  render(<GitDiff aria-label="Review" patch={patch} />)
  await settle()
  expect(screen.getByRole("tree", { name: "Changed files" }).className).toContain("w-[var(--diff-tree-width,13rem)]")
})

test("a collapsible tree has a toggle at the start of the toolbar", async () => {
  const user = userEvent.setup()
  const onFileTreeOpenChange = vi.fn()
  render(
    <GitDiff aria-label="Review" patch={patch} fileTree="collapsible" onFileTreeOpenChange={onFileTreeOpenChange} />,
  )
  await settle()
  const toggle = screen.getByRole("button", { name: "Changed files" })
  expect(toggle.getAttribute("aria-pressed")).toBe("true")
  await user.click(toggle)
  expect(onFileTreeOpenChange).toHaveBeenLastCalledWith(false)
  expect(screen.queryByRole("tree", { name: "Changed files" })).toBeNull()
  await user.click(toggle)
  expect(screen.getByRole("tree", { name: "Changed files" })).toBeTruthy()
})

test("groups show as tree sections with their counts, and a file in either opens", async () => {
  const user = userEvent.setup()
  const onCurrentFileChange = vi.fn()
  render(
    <GitDiff
      aria-label="Uncommitted changes"
      groups={[
        { label: "Staged", patch: staged },
        { label: "Unstaged", patch: unstaged },
      ]}
      onCurrentFileChange={onCurrentFileChange}
    />,
  )
  await settle()
  const tree = screen.getByRole("tree", { name: "Changed files" })
  const sections = within(tree)
    .getAllByRole("treeitem")
    .filter((item) => item.getAttribute("aria-level") === "1")
  expect(sections.map((section) => section.textContent)).toEqual([
    expect.stringMatching(/^Staged.*2 files/),
    expect.stringMatching(/^Unstaged.*2 files/),
  ])
  const unstagedSection = sections[1] as HTMLElement
  expect(within(unstagedSection).getByText("en.json")).toBeTruthy()
  expect(within(unstagedSection).getByText("steps.tsx")).toBeTruthy()
  const badges = [...document.querySelectorAll("[data-slot=diff-file-group]")].map((badge) => badge.textContent)
  expect(badges).toEqual(["Staged", "Staged", "Unstaged", "Unstaged"])
  expect(screen.getAllByText("src/onboarding/steps.tsx, Unstaged")).toHaveLength(1)
  await user.click(within(unstagedSection).getByText("en.json"))
  expect(onCurrentFileChange).toHaveBeenLastCalledWith("src/i18n/en.json", expect.anything())
  expect(screen.getAllByRole("grid").length).toBe(4)
})

test("agents open files in either group", async () => {
  const agent = createAgent()
  render(
    <GitDiff
      aria-label="Uncommitted changes"
      groups={[
        { label: "Staged", patch: staged },
        { label: "Unstaged", patch: unstaged },
      ]}
    />,
  )
  await settle()
  const result = await agent.act({
    steps: [{ ref: "Uncommitted changes", action: "openFile", args: ["src/i18n/en.json"] }],
  })
  expect(result.ok, result.error?.message).toBe(true)
})

test('height="auto" keeps its height in a flex column and caps the tree like the diff', async () => {
  const { container } = render(<GitDiff aria-label="Review" patch={patch} height="auto" />)
  await settle()
  const root = container.querySelector("[data-slot=git-diff]") as HTMLElement
  expect(root.className).toContain("shrink-0")
  expect(root.className).not.toContain("min-h-0")
  expect(screen.getByRole("tree", { name: "Changed files" }).className).toContain(
    "max-h-[var(--diff-max-height,40rem)]",
  )
  expect(screen.getByRole("group", { name: "Review" }).className).toContain("max-h-[var(--diff-max-height,40rem)]")
})
