import { readFileSync } from "node:fs"
import { join } from "node:path"

import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"

import { diffView } from "@/components/ui/diff-view-primitive"
import { createDocumentBuilder, toViewFiles } from "@/components/ui/diff-view-model"
import { GitDiff } from "@/components/ui/git-diff"
import { TextDiff } from "@/components/ui/text-diff"
import { diffFile } from "@/lib/diff-lines"
import { parsePatch } from "@/lib/diff-patch"

const agent = createAgent()
const patch = readFileSync(join(import.meta.dirname, "fixtures", "diff", "real.patch"), "utf8")

// jsdom lays nothing out: give the diff's scroller a height, so the virtualizer renders a screen of rows.
function noScroll() {}

const height = Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight")!
beforeAll(() => {
  Element.prototype.scrollTo = noScroll
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

const lines = (count: number) =>
  `${Array.from({ length: count }, (_, index) => `line ${String(index + 1)}`).join("\n")}\n`
const before = lines(40)
const after = before.replace("line 5\n", "line five\n").replace("line 30\n", "line thirty\nline 30b\n")

describe("TextDiff", () => {
  test("shows changed lines with signs, numbers and words for screen readers", async () => {
    render(<TextDiff aria-label="Notes diff" oldText={before} newText={after} />)
    await settle()
    const grid = screen.getByRole("grid", { name: "Diff" })
    expect(within(grid).getByText("Removed, line 5")).toBeTruthy()
    expect(within(grid).getByText("Added, line 5")).toBeTruthy()
    expect(within(grid).getByText("Added, line 31")).toBeTruthy()
    const removed = within(grid).getByText("Removed, line 5").closest('[role="gridcell"]')!
    expect(removed.textContent).toContain("-")
    expect(removed.className).toContain("bg-diff-removed")
  })

  test("highlights the changed words of a paired line", async () => {
    const { container } = render(<TextDiff oldText={"const ratio = 100\n"} newText={"const ratio = 1000\n"} />)
    await settle()
    const strong = [...container.querySelectorAll(".bg-diff-added-strong")].map((node) => node.textContent)
    expect(strong).toEqual(["1000"])
    expect([...container.querySelectorAll(".bg-diff-removed-strong")].map((node) => node.textContent)).toEqual(["100"])
  })

  test("folds unchanged lines behind Expand and opens them", async () => {
    const user = userEvent.setup()
    render(<TextDiff oldText={before} newText={after} />)
    await settle()
    expect(screen.queryByText("Line 15")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Expand 18 lines" }))
    await settle()
    expect(screen.getByText("Line 15")).toBeTruthy()
  })

  test("one tab stop; arrows move, j jumps to the next hunk, Enter selects a line, Shift extends it", async () => {
    const user = userEvent.setup()
    const onLineSelect = vi.fn()
    render(<TextDiff oldText={before} newText={after} onLineSelect={onLineSelect} />)
    await settle()
    const stops = screen.getAllByRole("gridcell").filter((cell) => cell.tabIndex === 0)
    expect(stops).toHaveLength(1)
    stops.at(0)!.focus()
    await user.keyboard("j")
    expect(document.activeElement?.textContent).toContain("Removed, line 5")
    await user.keyboard("j")
    expect(document.activeElement?.textContent).toContain("Removed, line 30")
    await user.keyboard("k")
    expect(document.activeElement?.textContent).toContain("Removed, line 5")
    await user.keyboard("{ArrowDown}")
    expect(document.activeElement?.textContent).toContain("Added, line 5")
    await user.keyboard("{Enter}")
    expect(onLineSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: { side: "new", line: 5 }, end: { side: "new", line: 5 } }),
      expect.objectContaining({ reason: "list-navigation" }),
    )
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}")
    expect(onLineSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: { side: "new", line: 5 }, end: { side: "new", line: 6 } }),
      expect.anything(),
    )
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}")
    expect(onLineSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: { side: "new", line: 5 }, end: { side: "new", line: 7 } }),
      expect.anything(),
    )
    expect(
      screen.getAllByRole("gridcell").filter((cell) => cell.getAttribute("aria-selected") === "true"),
    ).toHaveLength(3)
    await user.keyboard("{Escape}")
    expect(onLineSelect).toHaveBeenLastCalledWith(null, expect.objectContaining({ reason: "escape-key" }))
    await user.keyboard("j")
    expect(document.activeElement?.textContent).toContain("Removed, line 30")
    await user.keyboard("k")
    expect(document.activeElement?.textContent).toContain("Removed, line 5")
  })

  test("a click on a line number selects it; Shift-click extends", async () => {
    const onLineSelect = vi.fn()
    const { container } = render(<TextDiff oldText={before} newText={after} onLineSelect={onLineSelect} />)
    await settle()
    // Line numbers are pseudo-elements: a press left of the code (jsdom lays the code out at 0) lands on them.
    const cells = [...container.querySelectorAll<HTMLElement>('[role="gridcell"][data-new]')]
    const lineFour = cells.find((cell) => cell.dataset.new === "4")!
    fireEvent.pointerDown(lineFour, { button: 0, clientX: -1 })
    expect(onLineSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: { side: "new", line: 4 } }),
      expect.anything(),
    )
    const lineSix = cells.findLast((cell) => cell.dataset.new === "6")!
    fireEvent.pointerDown(lineSix, { button: 0, shiftKey: true, clientX: -1 })
    expect(onLineSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ start: { side: "new", line: 4 }, end: { side: "new", line: 6 } }),
      expect.anything(),
    )
  })

  test("a press on the code doesn't select the line", async () => {
    const onLineSelect = vi.fn()
    const { container } = render(<TextDiff oldText={before} newText={after} onLineSelect={onLineSelect} />)
    await settle()
    const cell = container.querySelector<HTMLElement>('[role="gridcell"][data-new="4"]')!
    fireEvent.pointerDown(cell, { button: 0, clientX: 10 })
    expect(onLineSelect).not.toHaveBeenCalled()
    expect(cell.dataset.old).toBe("4")
  })

  test("split layout puts old and new side by side", async () => {
    render(<TextDiff oldText={before} newText={after} defaultLayout="split" />)
    await settle()
    const grid = screen.getByRole("grid")
    expect(grid.getAttribute("aria-colcount")).toBe("2")
    const row = within(grid).getByText("Removed, line 5").closest('[role="row"]')!
    expect(within(row as HTMLElement).getByText("Added, line 5")).toBeTruthy()
  })

  test("grows to its content up to --diff-max-height by default, or fills its parent", async () => {
    const { container, rerender } = render(<TextDiff oldText={before} newText={after} />)
    await settle()
    const root = () => container.querySelector<HTMLElement>('[data-slot="diff-view"]')!
    const viewport = () => container.querySelector<HTMLElement>('[data-slot="diff-view-viewport"]')!
    expect(root().className).toContain("max-h-[var(--diff-max-height,40rem)]")
    expect(viewport().className).not.toContain("flex-1")
    rerender(<TextDiff oldText={before} newText={after} height="fill" />)
    await settle()
    expect(root().className).not.toContain("max-h-")
    expect(viewport().className).toContain("flex-1")
  })

  test("identical texts show the empty state", async () => {
    render(<TextDiff oldText="same\n" newText="same\n" empty="Nothing changed" />)
    await settle()
    expect(screen.getByText("Nothing changed")).toBeTruthy()
  })
})

describe("GitDiff", () => {
  test("a header per file: status, rename, mode change and counts", async () => {
    render(<GitDiff aria-label="Review" patch={patch} />)
    await settle()
    const tree = screen.getByRole("tree", { name: "Changed files" })
    expect(within(tree).getByText("math.js")).toBeTruthy()
    expect(screen.getByText("renamed-new.txt, renamed from renamed-old.txt")).toBeTruthy()
    expect(screen.getAllByText("Mode changed from 100644 to 100755").length).toBeGreaterThan(0)
    expect(screen.getByText("Binary file not shown")).toBeTruthy()
    expect(screen.getAllByText("2 additions, 0 deletions").length).toBeGreaterThan(0)
    expect(screen.getByRole("grid", { name: "Changes in math.js" })).toBeTruthy()
  })

  test("binary and mode-only files show what changed, not +0 −0", async () => {
    const { container } = render(<GitDiff patch={patch} />)
    await settle()
    const header = (path: string) =>
      [...container.querySelectorAll<HTMLElement>('[data-slot="diff-file-header"]')].find((node) =>
        node.textContent?.includes(path),
      )!
    const image = header("image.bin")
    expect(image.textContent).toContain("Binary")
    expect(image.querySelector('[data-slot="diff-stat"]')).toBeNull()
    const script = header("script.sh")
    expect(script.textContent).toContain("Mode 100644 → 100755")
    expect(script.querySelector('[data-slot="diff-stat"]')).toBeNull()
    const pure = header("pure-new.txt")
    expect(pure.querySelector('[data-slot="diff-stat"]')).toBeNull()
    expect(pure.textContent).not.toContain("+0")
    const tree = screen.getByRole("tree", { name: "Changed files" })
    const row = (name: string) => within(tree).getByText(name).closest('[data-slot="tree-label"]')!
    expect(row("image.bin").textContent).toContain("Binary")
    expect(row("script.sh").textContent).toContain("Mode 100644 → 100755")
    expect(row("image.bin").textContent).not.toContain("+0")
    expect(row("math.js").querySelector('[data-slot="diff-stat-bar"]')).toBeNull()
  })

  test("a rename folds the shared folders and keeps both paths whole for the tooltip and screen readers", async () => {
    const renamed = parsePatch(
      "diff --git a/docs/old-name.md b/docs/new-name.md\nsimilarity index 90%\nrename from docs/old-name.md\nrename to docs/new-name.md\n",
    )
    const { container } = render(<GitDiff files={renamed} fileTree={false} />)
    await settle()
    const path = container.querySelector<HTMLElement>('[data-slot="diff-file-path"]')!
    expect(path.title).toBe("docs/old-name.md → docs/new-name.md")
    expect(path.querySelector('[aria-hidden="true"]')!.textContent).toBe("docs/{old-name.md → new-name.md}")
    expect(within(path).getByText("docs/new-name.md, renamed from docs/old-name.md")).toBeTruthy()
  })

  test("the stat bar is decorative: the counts are visible beside it and read out in words", async () => {
    const { container } = render(<GitDiff patch={patch} fileTree={false} />)
    await settle()
    const stat = [...container.querySelectorAll<HTMLElement>('[data-slot="diff-file-header"]')]
      .find((node) => node.textContent?.includes("modify.txt"))!
      .querySelector<HTMLElement>('[data-slot="diff-stat"]')!
    const bar = stat.querySelector<HTMLElement>('[data-slot="diff-stat-bar"]')!
    expect(bar.getAttribute("aria-hidden")).toBe("true")
    expect(within(stat).getByText("2 additions, 1 deletion")).toBeTruthy()
    expect(stat.textContent).toContain("+2")
    expect(stat.textContent).toContain("−1")
    const colours = [...bar.children].map((block) =>
      block.className.includes("added") ? "+" : block.className.includes("removed") ? "-" : "·",
    )
    expect(colours.join("")).toBe("++-··")
  })

  test("viewed folds a file away; the toggle opens it again", async () => {
    const user = userEvent.setup()
    const onViewedChange = vi.fn()
    render(<GitDiff patch={patch} onViewedChange={onViewedChange} />)
    await settle()
    await user.click(screen.getByRole("checkbox", { name: "Viewed math.js" }))
    expect(onViewedChange).toHaveBeenLastCalledWith(["math.js"], expect.anything())
    await settle()
    expect(screen.queryByRole("grid", { name: "Changes in math.js" })).toBeNull()
    const toggle = screen.getByRole("button", { name: "Show changes in math.js" })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    await user.click(toggle)
    await settle()
    expect(screen.getByRole("grid", { name: "Changes in math.js" })).toBeTruthy()
  })

  test("the layout control switches to split", async () => {
    const user = userEvent.setup()
    render(<GitDiff patch={patch} />)
    await settle()
    await user.click(screen.getByRole("radio", { name: "Split" }))
    await settle()
    expect(screen.getByRole("grid", { name: "Changes in math.js" }).getAttribute("aria-colcount")).toBe("2")
  })

  test("an agent opens files, moves between hunks, reads one and marks a file viewed", async () => {
    const onViewedChange = vi.fn()
    render(<GitDiff aria-label="Pull request" patch={patch} onViewedChange={onViewedChange} />)
    await settle()
    const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
    for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
    const diff = components.find((entry) => entry.label === "Pull request")!
    expect(diff.actions).toEqual(
      expect.arrayContaining(["openFile", "nextHunk", "previousHunk", "markViewed", "getHunk"]),
    )
    const result = await agent.act({
      steps: [
        { ref: "Pull request", action: "openFile", args: ["modify.txt"] },
        { ref: "Pull request", action: "getHunk", args: ["math.js", 0] },
        { ref: "Pull request", action: "nextHunk" },
        { ref: "Pull request", action: "markViewed", args: ["gone.txt"] },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
    expect(JSON.stringify(result)).toContain("export function subtract(a, b) {")
    expect(onViewedChange).toHaveBeenLastCalledWith(["gone.txt"], expect.objectContaining({ source: "agent" }))
    const missing = await agent.act({ steps: [{ ref: "Pull request", action: "openFile", args: ["nope.ts"] }] })
    expect(missing.ok).toBe(false)
    expect(missing.error?.message).toContain("No file")
  })
})

describe("diff view model", () => {
  test("gaps between hunks know their lines when both texts are given", () => {
    const [file] = toViewFiles([diffFile(before, after, { oldPath: "a" }, { context: 1 })])
    expect(file!.gaps.map((gap) => [gap.oldStart, gap.count, gap.expandable])).toEqual([
      [1, 3, true],
      [7, 22, true],
      [32, 9, true],
    ])
  })

  test("split pairs removed and added lines; a patch alone can't expand", () => {
    const files = toViewFiles(parsePatch(patch))
    const build = createDocumentBuilder()
    const doc = build(files, { layout: "split", collapsed: new Set(), expanded: new Map(), headers: true })
    const math = files.findIndex((file) => file.path === "math.js")
    const pairs = doc.rows.filter((row) => row.kind === "pair" && row.file === math)
    const changed = pairs.find((row) => row.kind === "pair" && row.left !== row.right)
    expect(changed?.kind === "pair" && [changed.left?.text, changed.right?.text]).toEqual([
      "export function sub(a, b) {",
      "export function subtract(a, b) {",
    ])
    expect(files[math]!.gaps.every((gap) => !gap.expandable)).toBe(true)
    expect(doc.hunkRows[math]).toHaveLength(1)
  })

  test("a collapsed file keeps its header only", () => {
    const files = toViewFiles(parsePatch(patch))
    const build = createDocumentBuilder()
    const doc = build(files, { layout: "unified", collapsed: new Set(["math.js"]), expanded: new Map(), headers: true })
    const math = files.findIndex((file) => file.path === "math.js")
    expect(doc.rows.filter((row) => row.file === math).map((row) => row.kind)).toEqual(["file"])
  })
})

test("the primitive renders on the server", () => {
  checkServer(diffView, {}, "<root><viewport></viewport></root>")
})

test("split layout: an added or deleted file's one side spans the row", async () => {
  const added = diffFile("", "one\ntwo\n", { oldPath: "a.txt", newPath: "a.txt" })
  render(<GitDiff aria-label="Added" files={[{ ...added, status: "added" }]} defaultLayout="split" fileTree={false} />)
  await settle()
  const grid = screen.getByRole("grid", { name: "Changes in a.txt" })
  expect(grid.getAttribute("aria-colcount")).toBe("1")
  const rows = within(grid).getAllByRole("row")
  for (const row of rows) {
    expect(row.className).toContain("grid-cols-1")
    expect(within(row).getAllByRole("gridcell")).toHaveLength(1)
  }
  expect(grid.querySelector('[role=gridcell][data-old="1"]')).not.toBeNull()
})
