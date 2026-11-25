import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { CommitHistory } from "@/components/ui/commit-history"
import { GitTree } from "@/components/ui/git-tree"
import type { Commit } from "@/lib/commit-graph"

const COUNT = 400
const commits: Commit[] = Array.from({ length: COUNT }, (_, index) => ({
  id: `c${String(index)}`,
  parents: index === COUNT - 1 ? [] : [`c${String(index + 1)}`],
  message: `Change ${String(index)} in \`file-${String(index)}.ts\``,
  date: 0,
}))

function scrollTo(this: Element, options?: ScrollToOptions | number) {
  if (typeof options === "object") this.scrollTop = options.top ?? this.scrollTop
  this.dispatchEvent(new Event("scroll"))
}

// Workaround: jsdom has no layout and no hidden="until-found": the scroller gets a height, and the browser is said to find hidden text.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("overflow-y-auto") ? 320 : 0
  })
  Object.defineProperty(document.body, "onbeforematch", { configurable: true, value: null, writable: true })
  vi.stubGlobal("requestIdleCallback", (run: () => void) => setTimeout(run, 0))
  vi.stubGlobal("cancelIdleCallback", (handle: number) => clearTimeout(handle))
  Element.prototype.scrollTo = scrollTo as Element["scrollTo"]
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document.body, "onbeforematch")
})

const standIns = () => [...document.querySelectorAll("[data-findable-layer] [hidden=until-found] [hidden=until-found]")]

test("off by default: no findable layers", async () => {
  render(<CommitHistory aria-label="History" commits={commits} now={0} />)
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
  expect(document.querySelector("[data-findable-layer]")).toBeNull()
})

// Workaround: jsdom's accessible names drop the space that ends a piece in its own element; browsers keep it.
test("findable: rows show their subject through findableText, and the layers hold every other row once idle", async () => {
  render(<CommitHistory aria-label="History" commits={commits} now={0} findable />)
  const first = screen.getByRole("treeitem", { name: /^Change 0 in ?file-0\.ts/ })
  expect(first.querySelector("[data-slot=git-file-chip]")?.textContent).toBe("file-0.ts")
  expect(screen.getAllByRole("treeitem").length).toBeLessThan(60)
  expect(standIns()).toHaveLength(0)

  await waitFor(() => expect(standIns().length).toBeGreaterThan(COUNT - 60))
  const last = standIns().find((el) => el.textContent?.includes("Change 399"))
  expect(last?.textContent).toBe("Change 399 in  file-399.ts")
})

test("findable: a match renders its row", async () => {
  render(<CommitHistory aria-label="History" commits={commits} now={0} findable />)
  await waitFor(() => expect(standIns().length).toBeGreaterThan(COUNT - 60))
  const target = standIns().find((el) => el.textContent?.startsWith("Change 300 "))
  await act(async () => {
    target?.dispatchEvent(new Event("beforematch", { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
  expect(screen.getByRole("treeitem", { name: /^Change 300 in ?file-300\.ts/ })).toBeTruthy()
})

test("findable={false} on GitTree, and findable on: names fill the rows, the layers fill once idle", async () => {
  const files = Array.from({ length: COUNT }, (_, index) => `src/file-${String(index).padStart(3, "0")}.ts`)
  const { unmount } = render(<GitTree aria-label="Files" files={files} defaultExpanded={["src"]} />)
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
  expect(document.querySelector("[data-findable-layer]")).toBeNull()
  unmount()

  render(<GitTree aria-label="Files" files={files} defaultExpanded={["src"]} findable />)
  expect(screen.getByRole("treeitem", { name: "file-000.ts" })).toBeTruthy()
  await waitFor(() => expect(standIns().some((el) => el.textContent === "file-399.ts")).toBe(true))
})
