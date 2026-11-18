import { EditorView } from "@codemirror/view"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, expect, test } from "vitest"

import { MarkdownEditor, markdownEditorLabelsEs } from "@/components/ui/markdown-editor"

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)))
const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!

async function typeChars(view: EditorView, text: string) {
  for (const char of text) {
    act(() => {
      const at = view.state.selection.main.head
      view.dispatch({ changes: { from: at, insert: char }, selection: { anchor: at + 1 }, userEvent: "input.type" })
    })
    await settle()
  }
}

const menu = () => document.querySelector<HTMLElement>("[data-slot=trigger-menu-content]")
const isOpen = () => menu()?.hasAttribute("data-open") === true
const emptyState = () => document.querySelector<HTMLElement>("[data-slot=trigger-menu-empty][data-empty]")

async function openEditor(props: Partial<Parameters<typeof MarkdownEditor>[0]> = {}) {
  render(<MarkdownEditor label="Note" defaultValue={"\n"} {...props} />)
  await settle()
  const view = editorView()
  act(() => view.focus())
  return view
}

test.each(["/zz", "/to-do", "/h1)", "/x?y", "/a'b", "/x/y", "/[x", "/€"])(
  "the slash menu stays open with its empty state while %s matches nothing",
  async (query) => {
    const view = await openEditor()
    await typeChars(view, query)
    expect(isOpen()).toBe(true)
    expect(screen.queryAllByRole("option")).toEqual([])
    expect(emptyState()?.textContent).toBe("No matches")
  },
)

test("a space closes the menu that matched nothing", async () => {
  const view = await openEditor()
  await typeChars(view, "/xyz")
  expect(isOpen()).toBe(true)
  await typeChars(view, " ")
  expect(isOpen()).toBe(false)
  expect(view.state.sliceDoc()).toBe("/xyz \n")
})

test("Escape closes the menu that matched nothing, and leaves the text", async () => {
  const view = await openEditor()
  await typeChars(view, "/x?")
  expect(isOpen()).toBe(true)
  fireEvent.keyDown(view.contentDOM, { key: "Escape" })
  await settle()
  expect(isOpen()).toBe(false)
  expect(view.state.sliceDoc()).toBe("/x?\n")
})

test("the empty state's label is overridable, and matches come back as the query changes", async () => {
  const view = await openEditor({ labels: { ...markdownEditorLabelsEs, noMatches: "Nada por aquí" } })
  await typeChars(view, "/tít")
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    "Título 1#",
    "Título 2##",
    "Título 3###",
  ])
  await typeChars(view, "x")
  expect(emptyState()?.textContent).toBe("Nada por aquí")
  act(() => {
    const at = view.state.selection.main.head
    view.dispatch({ changes: { from: at - 1, to: at }, userEvent: "delete.backward" })
  })
  await settle()
  expect(screen.getAllByRole("option")).toHaveLength(3)
})
