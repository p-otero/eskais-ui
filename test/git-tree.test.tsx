import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, describe, expect, test, vi } from "vitest"

import { GitTree } from "@/components/ui/git-tree"
import type { GitTreeFile } from "@/lib/git-status"

const files: (string | GitTreeFile)[] = [
  "package.json",
  "README.md",
  { path: "src/routes.ts", status: "added" },
  { path: "src/billing/proration.ts", status: "modified" },
  { path: "src/billing/legacy.ts", status: "deleted" },
  { path: "src/invoice/pdf.ts", status: "renamed", from: "src/invoice/print.ts" },
  "src/invoice/fonts.ts",
  "docs/guide.md",
  "assets/",
]

afterEach(() => vi.restoreAllMocks())

const item = (name: string | RegExp) => screen.getByRole("treeitem", { name })

describe("GitTree", () => {
  test("folders first, changed folders open, statuses read and marked", () => {
    render(<GitTree aria-label="Files at e02c6d9" files={files} />)
    const tree = screen.getByRole("tree", { name: "Files at e02c6d9" })
    const names = [...tree.querySelectorAll("[role=treeitem]")].map((row) => row.textContent)
    expect(names[0]).toMatch(/^src/)
    expect(item(/^src, Has changes/).getAttribute("aria-expanded")).toBe("true")
    expect(item(/^billing/).getAttribute("aria-expanded")).toBe("true")
    expect(item(/^docs$/).getAttribute("aria-expanded")).toBe("false")
    expect(item("proration.ts, Modified")).toBeTruthy()
    expect(item("pdf.ts, Renamed, from src/invoice/print.ts")).toBeTruthy()
    const deleted = item("legacy.ts, Deleted")
    expect(deleted.querySelector("[data-slot=git-tree-status]")?.textContent).toBe("D")
    expect(deleted.querySelector("[data-slot=git-tree-status]")?.className).toContain("text-destructive")
    expect(item("routes.ts, Added").getAttribute("aria-level")).toBe("2")
  })

  test("arrows, typeahead and Left/Right move and fold; Enter opens a file", async () => {
    const user = userEvent.setup()
    const onOpenFile = vi.fn()
    render(<GitTree aria-label="Files" files={files} onOpenFile={onOpenFile} />)
    item(/^src, Has changes/).focus()
    await user.keyboard("{ArrowLeft}")
    expect(item(/^src, Has changes/).getAttribute("aria-expanded")).toBe("false")
    await user.keyboard("{ArrowRight}{ArrowDown}")
    expect(document.activeElement?.textContent).toMatch(/^billing/)
    await user.keyboard("r")
    expect(document.activeElement?.textContent).toMatch(/^routes\.ts/)
    await user.keyboard("{Enter}")
    expect(onOpenFile).toHaveBeenCalledWith("src/routes.ts", expect.objectContaining({ reason: "item-press" }))
  })

  test("the current file is marked", () => {
    render(<GitTree aria-label="Files" files={files} current="src/routes.ts" />)
    expect(item("routes.ts, Added").getAttribute("aria-current")).toBe("page")
  })

  test("agents open, expand and collapse by path", async () => {
    const agent = createAgent()
    const onOpenFile = vi.fn()
    render(<GitTree aria-label="Files" files={files} onOpenFile={onOpenFile} />)
    const entry = agent.snapshot().find((component) => component.component === "git-tree")
    expect(entry?.actions).toEqual(["open", "expand", "collapse"])
    expect(agent.snapshot().some((component) => component.component === "tree")).toBe(false)

    const found = await agent.query({ within: "Files", text: "proration" })
    expect(Array.isArray(found) && found[0]?.items).toContainEqual({
      value: "src/billing/proration.ts",
      label: "src/billing/proration.ts, Modified",
    })

    expect((await agent.act({ steps: [{ ref: "Files", action: "expand", args: ["docs"] }] })).ok).toBe(true)
    expect(item(/^docs$/).getAttribute("aria-expanded")).toBe("true")
    expect((await agent.act({ steps: [{ ref: "Files", action: "collapse", args: ["src"] }] })).ok).toBe(true)
    expect(item(/^src, Has changes/).getAttribute("aria-expanded")).toBe("false")
    expect((await agent.act({ steps: [{ ref: "Files", action: "open", args: ["src/invoice/fonts.ts"] }] })).ok).toBe(
      true,
    )
    expect(onOpenFile).toHaveBeenCalledWith("src/invoice/fonts.ts", expect.objectContaining({ source: "agent" }))
    const refused = await agent.act({ steps: [{ ref: "Files", action: "expand", args: ["README.md"] }] })
    expect(refused.error?.message).toMatch(/is a file/)
  })

  test("20,000 files render only a window (tooling/git-bench.mjs times 100,000 in Chrome)", () => {
    // Workaround: jsdom has no layout, so rendered rows get a height for the virtualizer to measure.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.dataset.index === undefined ? 0 : 28
    })
    const many = Array.from({ length: 20_000 }, (_, index) => `pkg/file-${String(index).padStart(6, "0")}.ts`)
    render(<GitTree aria-label="Files" files={many} defaultExpanded={["pkg"]} />)
    const rendered = screen.getAllByRole("treeitem")
    expect(rendered.length).toBeLessThan(200)
    expect(rendered[1]?.getAttribute("aria-setsize")).toBe("20000")
  })
})
