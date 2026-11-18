import { EditorView } from "@codemirror/view"
import { act, fireEvent, render, within } from "@testing-library/react"
import { createRef } from "react"
import { beforeAll, expect, test, vi } from "vitest"

import { MarkdownEditor, type MarkdownEditorHandle } from "@/components/ui/markdown-editor"

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!

async function mount(doc: string, props: { readOnly?: boolean } = {}) {
  const ref = createRef<MarkdownEditorHandle>()
  const result = render(<MarkdownEditor ref={ref} label="Note" defaultValue={doc} {...props} />)
  await settle()
  if (!ref.current) throw new Error("no handle")
  return { handle: ref.current, ref, ...result }
}

const run = <T,>(callback: () => T) => {
  let result: T | undefined
  act(() => {
    result = callback()
  })
  return result as T
}

test("the ref gets the handle once the editor mounts, and null when it unmounts", async () => {
  const { ref, unmount } = await mount("text\n")
  expect(typeof ref.current?.getValue).toBe("function")
  unmount()
  expect(ref.current).toBeNull()
})

test("focus, value and selection in string offsets", async () => {
  const { handle } = await mount("# Title\n\nbody text\n")
  run(() => handle.focus())
  expect(editorView().hasFocus).toBe(true)
  expect(handle.getValue()).toBe("# Title\n\nbody text\n")
  run(() => handle.setSelection(9, 13))
  expect(handle.getSelection()).toEqual({ anchor: 9, head: 13, from: 9, to: 13, text: "body" })
  run(() => handle.setSelection(13, 9))
  expect(handle.getSelection()).toMatchObject({ anchor: 13, head: 9, from: 9, to: 13 })
  run(() => handle.setSelection(500))
  expect(handle.getSelection().head).toBe(handle.getValue().length)
})

test("offsets count CRLF line breaks as two characters", async () => {
  const doc = "one\r\ntwo\r\nthree\r\n"
  const { handle } = await mount(doc)
  run(() => handle.setSelection(doc.indexOf("three") + 5, doc.indexOf("three")))
  expect(handle.getSelection()).toMatchObject({ from: 10, to: 15, head: 10, text: "three" })
  run(() => handle.insertText("!"))
  expect(handle.getValue()).toBe("one\r\ntwo\r\n!three\r\n")
})

test("insertText, insertWikilink, insertLink and wrapSelection", async () => {
  const { handle } = await mount("see \n")
  run(() => handle.setSelection(4))
  run(() => handle.insertWikilink("roadmap", "Roadmap"))
  expect(handle.getValue()).toBe("see [[roadmap|Roadmap]]\n")
  run(() => handle.insertText(" and "))
  run(() => handle.insertLink("https://example.com/a b", "the [site]"))
  expect(handle.getValue()).toBe("see [[roadmap|Roadmap]] and [the \\[site\\]](<https://example.com/a b>)\n")

  run(() => handle.setSelection(0, 3))
  run(() => handle.insertLink("https://example.com"))
  expect(handle.getValue()).toMatch(/^\[see\]\(https:\/\/example\.com\) /)

  run(() => handle.setSelection(1, 4))
  run(() => handle.wrapSelection("=="))
  expect(handle.getValue()).toMatch(/^\[==see==\]/)
  expect(handle.getSelection().text).toBe("see")
  run(() => handle.wrapSelection("<kbd>", "</kbd>"))
  expect(handle.getValue()).toMatch(/^\[==<kbd>see<\/kbd>==\]/)
  expect(() => handle.insertWikilink("a|b")).toThrow(RangeError)
  expect(() => handle.insertLink(" ")).toThrow(RangeError)
})

test("runCommand runs the toolbar's formats and levels, and rejects unknown names", async () => {
  const { handle } = await mount("word\n")
  run(() => handle.setSelection(0, 4))
  run(() => handle.runCommand("bold"))
  expect(handle.getValue()).toBe("**word**\n")
  run(() => handle.runCommand("heading3"))
  expect(handle.getValue()).toBe("### **word**\n")
  run(() => handle.runCommand("paragraph"))
  run(() => handle.runCommand("quote"))
  expect(handle.getValue()).toBe("> **word**\n")
  // @ts-expect-error -- not a command
  expect(() => handle.runCommand("explode")).toThrow(/Unknown command "explode"/)
})

test("a read-only editor refuses writes", async () => {
  const { handle } = await mount("text\n", { readOnly: true })
  expect(run(() => handle.insertText("x"))).toBe(false)
  expect(run(() => handle.runCommand("bold"))).toBe(false)
  expect(run(() => handle.wrapSelection("*"))).toBe(false)
  expect(handle.getValue()).toBe("text\n")
})

test("scrollToLine scrolls a line to the top without moving the caret", async () => {
  const { handle } = await mount("a\nb\nc\nd\n")
  const view = editorView()
  const dispatch = vi.spyOn(view, "dispatch")
  run(() => handle.setSelection(2))
  dispatch.mockClear()
  run(() => handle.scrollToLine(3))
  run(() => handle.scrollToLine(99))
  expect(dispatch).toHaveBeenCalledTimes(2)
  for (const [spec] of dispatch.mock.calls) expect(spec).toMatchObject({ effects: expect.anything() })
  expect(handle.getSelection().head).toBe(2)
  expect(handle.getScrollLine()).toBe(1)
})

const suggest = vi.fn(async (query: string) =>
  ["roadmap", "risks"].filter((slug) => slug.includes(query)).map((slug) => ({ slug })),
)

async function mountWithSuggestions(doc: string) {
  const ref = createRef<MarkdownEditorHandle>()
  render(<MarkdownEditor ref={ref} label="Note" defaultValue={doc} suggestWikilinks={suggest} />)
  await settle()
  if (!ref.current) throw new Error("no handle")
  return ref.current
}

const suggestions = () =>
  document.querySelector<HTMLElement>("[data-slot=trigger-menu-content][data-open] [role=listbox]")

const waitForListbox = async () => {
  for (let tries = 0; tries < 20 && !suggestions()?.querySelector("[role=option]"); tries++) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
  }
  return suggestions()
}

test("insertText with a typing userEvent opens the wikilink suggestions; a plain insert doesn't", async () => {
  const handle = await mountWithSuggestions("see \n")
  run(() => handle.focus())
  run(() => handle.setSelection(4))
  run(() => handle.insertText("[["))
  expect(await waitForListbox()).toBeNull()
  run(() => handle.insertText(" [[", { userEvent: "input.type" }))
  const listbox = await waitForListbox()
  expect(listbox).not.toBeNull()
  expect(
    within(listbox!)
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(["roadmap", "risks"])
  expect(handle.getValue()).toBe("see [[ [[\n")
})

test("openWikilinkSuggestions types [[ and opens the listbox, or reuses a [[ before the caret", async () => {
  const handle = await mountWithSuggestions("see \n")
  run(() => handle.setSelection(4))
  expect(run(() => handle.openWikilinkSuggestions())).toBe(true)
  expect(await waitForListbox()).not.toBeNull()
  expect(handle.getValue()).toBe("see [[\n")
  expect(editorView().hasFocus).toBe(true)
  fireEvent.keyDown(editorView().contentDOM, { key: "Escape" })
  await settle()

  run(() => handle.setSelection(6))
  expect(run(() => handle.openWikilinkSuggestions())).toBe(true)
  expect(await waitForListbox()).not.toBeNull()
  expect(handle.getValue()).toBe("see [[\n")
})

test("openWikilinkSuggestions refuses without suggestWikilinks or when read-only", async () => {
  const { handle, unmount } = await mount("text\n")
  expect(run(() => handle.openWikilinkSuggestions())).toBe(false)
  unmount()
  const readOnly = await mount("text\n", { readOnly: true })
  expect(run(() => readOnly.handle.openWikilinkSuggestions())).toBe(false)
  expect(readOnly.handle.getValue()).toBe("text\n")
})
