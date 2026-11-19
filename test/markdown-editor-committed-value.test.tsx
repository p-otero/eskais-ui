import { EditorView } from "@codemirror/view"
import { act, fireEvent, render, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { createRef } from "react"
import { beforeAll, expect, test, vi } from "vitest"

import { MarkdownEditor, type MarkdownEditorHandle } from "@/components/ui/markdown-editor"

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const tick = (ms = 0) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))
const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!
const suggest = vi.fn(async (query: string) =>
  ["roadmap", "risks"].filter((slug) => slug.includes(query)).map((slug) => ({ slug })),
)

async function mount(value: string) {
  const ref = createRef<MarkdownEditorHandle>()
  const onChange = vi.fn()
  const result = render(
    <MarkdownEditor
      ref={ref}
      label="Note"
      value={value}
      onChange={onChange}
      changeDelay={5}
      suggestWikilinks={suggest}
    />,
  )
  await tick()
  if (!ref.current) throw new Error("no handle")
  return { handle: ref.current, onChange, ...result }
}

const listbox = () => document.querySelector<HTMLElement>("[data-slot=trigger-menu-content][data-open] [role=listbox]")

async function waitForOptions() {
  for (let tries = 0; tries < 20 && !listbox()?.querySelector("[role=option]"); tries++) await tick(10)
  return listbox()
}

async function typeChars(text: string) {
  const view = editorView()
  for (const char of text) {
    act(() => {
      const at = view.state.selection.main.head
      view.dispatch({ changes: { from: at, insert: char }, selection: { anchor: at + 1 }, userEvent: "input.type" })
    })
    await tick()
  }
}

async function openSuggestions(handle: MarkdownEditorHandle) {
  let opened = false
  act(() => {
    opened = handle.openWikilinkSuggestions()
  })
  expect(opened).toBe(true)
  expect(await waitForOptions()).not.toBeNull()
}

const visible = () => editorView().state.sliceDoc()

test("while the list is open, getValue() is the note without the provisional [[ and its query", async () => {
  const { handle, onChange } = await mount("see \n")
  act(() => handle.setSelection(4))
  expect(handle.isComposing()).toBe(false)
  await openSuggestions(handle)
  expect(handle.isComposing()).toBe(true)
  await typeChars("ro")
  expect(visible()).toBe("see [[ro\n")
  expect(handle.getValue()).toBe("see \n")
  expect(handle.getSelection()).toEqual({ anchor: 4, head: 4, from: 4, to: 4, text: "" })
  act(() => editorView().contentDOM.blur())
  await tick(20)
  expect(onChange).not.toHaveBeenCalled()
})

test("isComposing() is false and getValue() has the wikilink after choosing", async () => {
  const { handle, onChange } = await mount("see \n")
  act(() => handle.setSelection(4))
  await openSuggestions(handle)
  const options = await waitForOptions()
  fireEvent.click(within(options!).getByRole("option", { name: "risks" }))
  await tick(20)
  expect(handle.isComposing()).toBe(false)
  expect(handle.getValue()).toBe("see [[risks]]\n")
  expect(onChange).toHaveBeenLastCalledWith("see [[risks]]\n")
})

test("isComposing() is false after dismissing, and the value never changed", async () => {
  const { handle } = await mount("Hola")
  await openSuggestions(handle)
  expect(handle.getValue()).toBe("Hola")
  fireEvent.keyDown(editorView().contentDOM, { key: "Escape" })
  await tick(20)
  expect(handle.isComposing()).toBe(false)
  expect(handle.getValue()).toBe("Hola")
})

test("a CRLF note reads back committed with its own line breaks", async () => {
  const { handle } = await mount("one\r\ntwo\r\n")
  act(() => handle.setSelection(5))
  await openSuggestions(handle)
  expect(visible()).toBe("one\r\n[[two\r\n")
  expect(handle.getValue()).toBe("one\r\ntwo\r\n")
})

test("the dirty state stays clean, and the same value coming back keeps the session", async () => {
  const ref = createRef<MarkdownEditorHandle>()
  const onDirtyChange = vi.fn()
  const { rerender } = render(
    <MarkdownEditor ref={ref} label="Note" value="Hola" onDirtyChange={onDirtyChange} suggestWikilinks={suggest} />,
  )
  await tick()
  await openSuggestions(ref.current!)
  rerender(
    <MarkdownEditor ref={ref} label="Note" value="Hola" onDirtyChange={onDirtyChange} suggestWikilinks={suggest} />,
  )
  await tick(10)
  expect(ref.current!.isComposing()).toBe(true)
  expect(visible()).toBe("[[Hola")
  expect(onDirtyChange).not.toHaveBeenCalledWith(true)
})

test("a slash query is the user's own text: getValue() has it and nothing is composing", async () => {
  const { handle } = await mount("\n")
  act(() => handle.focus())
  await typeChars("/he")
  expect(await waitForOptions()).not.toBeNull()
  expect(handle.isComposing()).toBe(false)
  expect(handle.getValue()).toBe("/he\n")
})

test("agents read the committed note too", async () => {
  const { handle } = await mount("Hola")
  await openSuggestions(handle)
  const agent = createAgent({ allow: () => true })
  const editor = agent.snapshot().find((entry) => entry.component === "markdown-editor")
  const read = await agent.act({ steps: [{ ref: editor!.ref, action: "getMarkdown" }] })
  expect(read.ok, read.error?.message).toBe(true)
  expect(JSON.stringify(read)).toContain('"Hola"')
  expect(JSON.stringify(read)).not.toContain("[[Hola")
})
