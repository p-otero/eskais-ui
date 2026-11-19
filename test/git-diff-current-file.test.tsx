import { readFileSync } from "node:fs"
import { join } from "node:path"

import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { afterAll, beforeAll, expect, test, vi } from "vitest"

import { createDiffViewController, GitDiff } from "@/components/ui/git-diff"

const patch = readFileSync(join(import.meta.dirname, "fixtures", "diff", "real.patch"), "utf8")

const height = Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight")!
const scrollTo = vi.fn()
beforeAll(() => {
  Element.prototype.scrollTo = scrollTo
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

function Outside({ onChange }: { onChange: (path: string | null) => void }) {
  const [file, setFile] = useState<string | null>(null)
  return (
    <>
      <button type="button" onClick={() => setFile("modify.txt")}>
        Show modify.txt
      </button>
      <output aria-label="In view">{file}</output>
      <GitDiff
        aria-label="Review"
        patch={patch}
        currentFile={file}
        onCurrentFileChange={(path) => {
          setFile(path)
          onChange(path)
        }}
      />
    </>
  )
}

test("the diff reports the file in view, and setting currentFile scrolls to it", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<Outside onChange={onChange} />)
  await settle()
  expect(onChange).toHaveBeenCalledWith("added.txt")
  expect(screen.getByRole("status", { name: "In view" }).textContent).toBe("added.txt")
  scrollTo.mockClear()
  await user.click(screen.getByRole("button", { name: "Show modify.txt" }))
  await settle()
  expect(scrollTo).toHaveBeenCalled()
  expect(onChange).toHaveBeenLastCalledWith("modify.txt")
  const tree = screen.getByRole("tree", { name: "Changed files" })
  expect(
    within(tree)
      .getByRole("treeitem", { name: /^modify\.txt/ })
      .getAttribute("aria-selected"),
  ).toBe("true")
})

test("the tree beside the diff opens a file and reports it", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<GitDiff aria-label="Review" patch={patch} onCurrentFileChange={onChange} />)
  await settle()
  const tree = screen.getByRole("tree", { name: "Changed files" })
  await user.click(within(tree).getByText("math.js"))
  expect(onChange).toHaveBeenLastCalledWith("math.js", expect.objectContaining({ reason: "imperative" }))
})

test("createDiffViewController comes from git-diff and reads the current file", async () => {
  const controller = createDiffViewController()
  render(<GitDiff aria-label="Review" patch={patch} controller={controller} />)
  await settle()
  expect(controller.currentFile()).toBe("added.txt")
  act(() => {
    controller.openFile("gone.txt")
  })
  expect(controller.currentFile()).toBe("gone.txt")
})

test("agents read the current file", async () => {
  const agent = createAgent()
  render(<GitDiff aria-label="Review" patch={patch} />)
  await settle()
  const result = await agent.act({
    steps: [
      { ref: "Review", action: "openFile", args: ["math.js"] },
      { ref: "Review", action: "currentFile" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  expect(JSON.stringify(result)).toContain("math.js")
})
