import { undo } from "@codemirror/commands"
import { EditorView } from "@codemirror/view"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { beforeAll, expect, test, vi } from "vitest"

import { MarkdownEditor, type MarkdownEditorHandle } from "@/components/ui/markdown-editor"

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const tick = (ms = 0) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))
const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!

async function mount(value: string) {
  const ref = createRef<MarkdownEditorHandle>()
  const onChange = vi.fn()
  const { unmount } = render(
    <MarkdownEditor ref={ref} label="Note" value={value} frontmatter="readonly" onChange={onChange} changeDelay={0} />,
  )
  await tick()
  if (!ref.current) throw new Error("no handle")
  return { handle: ref.current, onChange, view: editorView(), unmount }
}

function dispatchAtEnd(view: EditorView, insert: string, userEvent: string) {
  act(() => {
    const at = view.state.doc.length
    view.dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length }, userEvent })
  })
}

const bare = "---\na: 1\n---"
const suggest = async () => [{ slug: "roadmap" }]

test("typing after a closing fence that ends the note starts the body on a new line", async () => {
  const { handle, view, onChange } = await mount(bare)
  expect(handle.getSelection().head).toBe(bare.length)
  for (const char of "Hi") dispatchAtEnd(view, char, "input.type")
  expect(handle.getValue()).toBe(`${bare}\nHi`)
  expect(handle.getSelection().head).toBe(handle.getValue().length)
  await tick(10)
  expect(onChange).toHaveBeenLastCalledWith(`${bare}\nHi`)
  act(() => {
    undo(view)
  })
  expect(handle.getValue()).toBe(bare)
})

test.each([
  ["insertText", (handle: MarkdownEditorHandle) => handle.insertText("text"), `${bare}\ntext`],
  ["insertWikilink", (handle: MarkdownEditorHandle) => handle.insertWikilink("roadmap"), `${bare}\n[[roadmap]]`],
  ["an attachment", (handle: MarkdownEditorHandle) => handle.insertText("![[scan.png]]"), `${bare}\n![[scan.png]]`],
  ["insertBlock", (handle: MarkdownEditorHandle) => handle.insertBlock("divider"), `${bare}\n\n---\n`],
  [
    "a table",
    (handle: MarkdownEditorHandle) => handle.runCommand("table"),
    `${bare}\n\n|  |  |\n| --- | --- |\n|  |  |`,
  ],
])("%s right after the fence goes into the body", async (_name, insert, expected) => {
  const { handle } = await mount(bare)
  let inserted = false
  act(() => {
    handle.setSelection(bare.length)
    inserted = insert(handle)
  })
  expect(inserted).toBe(true)
  expect(handle.getValue()).toBe(expected)
  expect(handle.getValue().startsWith(bare)).toBe(true)
})

test("a paste after the fence, and one that already starts on a new line", async () => {
  const { handle, view, unmount } = await mount(bare)
  dispatchAtEnd(view, "pasted\ntext", "input.paste")
  expect(handle.getValue()).toBe(`${bare}\npasted\ntext`)
  unmount()
  const second = await mount(bare)
  dispatchAtEnd(second.view, "\nown line", "input.paste")
  expect(second.handle.getValue()).toBe(`${bare}\nown line`)
})

test("the fence itself still refuses edits, and the start of the note too", async () => {
  const { handle, view } = await mount(bare)
  act(() => {
    view.dispatch({ changes: { from: bare.length - 1, to: bare.length }, userEvent: "delete.backward" })
    view.dispatch({ changes: { from: 0, insert: "x" }, userEvent: "input.type" })
    view.dispatch({ changes: { from: 4, to: 5, insert: "b" }, userEvent: "input.type" })
  })
  expect(handle.getValue()).toBe(bare)
})

test.each([
  ["a trailing newline", "---\na: 1\n---\n"],
  ["CRLF", "---\r\na: 1\r\n---\r\n"],
  ["CRLF without a trailing newline", "---\r\na: 1\r\n---"],
])("with %s, the body takes text and the block keeps every byte", async (_name, note) => {
  const { handle, onChange } = await mount(note)
  act(() => {
    handle.setSelection(handle.getValue().length)
    handle.insertText("body")
  })
  const value = handle.getValue()
  const lineBreak = note.includes("\r\n") ? "\r\n" : "\n"
  const block = note.endsWith("---") ? note + lineBreak : note
  expect(value).toBe(`${block}body`)
  await tick(10)
  expect(onChange).toHaveBeenLastCalledWith(value)
})

test("an untouched note round-trips byte for byte", async () => {
  for (const note of [bare, `${bare}\n`, "---\r\na: 1\r\n---", "---\r\na: 1\r\n---\r\n"]) {
    const { handle, onChange, unmount } = await mount(note)
    expect(handle.getValue()).toBe(note)
    await tick(10)
    expect(onChange).not.toHaveBeenCalled()
    unmount()
  }
})

test("wikilink suggestions opened after the fence leave the note as it was when dismissed", async () => {
  const ref = createRef<MarkdownEditorHandle>()
  const onChange = vi.fn()
  render(
    <MarkdownEditor
      ref={ref}
      label="Note"
      value={bare}
      frontmatter="readonly"
      onChange={onChange}
      changeDelay={0}
      suggestWikilinks={suggest}
    />,
  )
  await tick()
  const handle = ref.current!
  act(() => {
    handle.openWikilinkSuggestions()
  })
  await tick(20)
  expect(handle.getValue()).toBe(`${bare}\n[[`)
  fireEvent.keyDown(editorView().contentDOM, { key: "Escape" })
  await tick(20)
  expect(handle.getValue()).toBe(bare)
  act(() => {
    handle.openWikilinkSuggestions()
  })
  await tick(20)
  fireEvent.click(await screen.findByRole("option", { name: "roadmap" }))
  await tick(20)
  expect(handle.getValue()).toBe(`${bare}\n[[roadmap]]`)
  expect(onChange).toHaveBeenCalledTimes(1)
})
