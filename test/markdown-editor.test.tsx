import { undo } from "@codemirror/commands"
import { EditorSelection } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { beforeAll, expect, test, vi } from "vitest"

import { MarkdownEditor, type MarkdownEditorProps } from "@/components/ui/markdown-editor"
import { minimalChange } from "@/components/ui/markdown-editor-commands"

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!
const type = (view: EditorView, at: number, text: string) =>
  act(() =>
    view.dispatch({
      changes: { from: at, insert: text },
      selection: { anchor: at + text.length },
      userEvent: "input.type",
    }),
  )

test("minimalChange keeps the common prefix and suffix and never splits a surrogate pair", () => {
  expect(minimalChange("hello world", "hello brave world")).toEqual({ from: 6, to: 6, insert: "brave " })
  expect(minimalChange("abc", "abc")).toEqual({ from: 3, to: 3, insert: "" })
  expect(minimalChange("aaa", "aa")).toEqual({ from: 2, to: 3, insert: "" })
  expect(minimalChange("x😀y", "x😃y")).toEqual({ from: 1, to: 3, insert: "😃" })
})

function Controlled(props: Partial<MarkdownEditorProps> & { initial: string; onValue?: (value: string) => void }) {
  const [value, setValue] = useState(props.initial)
  return (
    <>
      <MarkdownEditor
        label="Note"
        value={value}
        changeDelay={0}
        {...props}
        onChange={(next) => {
          setValue(next)
          props.onChange?.(next)
        }}
      />
      <button type="button" onClick={() => setValue((current) => `# Reloaded\n${current}`)}>
        Reload
      </button>
    </>
  )
}

test("opening fires nothing; a typed edit is dirty at once and reaches onChange debounced", async () => {
  const onChange = vi.fn()
  const onDirtyChange = vi.fn()
  render(<Controlled initial={"one\n"} onChange={onChange} onDirtyChange={onDirtyChange} changeDelay={20} />)
  await settle()
  expect(onChange).not.toHaveBeenCalled()
  expect(onDirtyChange).not.toHaveBeenCalled()

  type(editorView(), 3, "!")
  expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  expect(onChange).not.toHaveBeenCalled()
  await act(() => new Promise((resolve) => setTimeout(resolve, 40)))
  expect(onChange).toHaveBeenCalledWith("one!\n")
  expect(onDirtyChange).toHaveBeenLastCalledWith(false)
})

test("a value from outside is applied as a minimal change: the caret moves with it and undo keeps the user's edits", async () => {
  const onChange = vi.fn()
  render(<Controlled initial={"alpha\nbeta\n"} onChange={onChange} />)
  const view = editorView()
  type(view, 10, "!")
  await settle()
  expect(onChange).toHaveBeenCalledTimes(1)
  onChange.mockClear()

  fireEvent.click(screen.getByRole("button", { name: "Reload" }))
  await settle()
  expect(view.state.sliceDoc()).toBe("# Reloaded\nalpha\nbeta!\n")
  expect(view.state.selection.main.head).toBe(22)
  expect(onChange).not.toHaveBeenCalled()

  act(() => {
    undo(view)
  })
  expect(view.state.sliceDoc()).toBe("# Reloaded\nalpha\nbeta\n")
})

test("the content is a labeled multiline text box, read-only when asked", async () => {
  const { rerender } = render(<MarkdownEditor label="Note" defaultValue="text" />)
  await settle()
  const box = screen.getByRole("textbox", { name: "Note" })
  expect(box.getAttribute("aria-multiline")).toBe("true")
  expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeTruthy()
  rerender(<MarkdownEditor label="Note" defaultValue="text" readOnly />)
  await settle()
  expect(box.getAttribute("aria-readonly")).toBe("true")
  expect(screen.queryByRole("toolbar")).toBeNull()
})

test("an agent reads and edits the document, and replacing all of it needs a person", async () => {
  const onChange = vi.fn()
  render(
    <MarkdownEditor label="Release notes" defaultValue={"# Notes\n\nfirst\n"} onChange={onChange} changeDelay={0} />,
  )
  await settle()

  const refused = createAgent()
  const entries = refused.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const editor = entries.find((entry) => entry.component === "markdown-editor")
  expect(editor?.label).toBe("Release notes")
  expect(editor?.actions).toEqual(
    expect.arrayContaining([
      "getMarkdown",
      "insertText",
      "replaceSelection",
      "insertWikilink",
      "toggleFormat",
      "setHeading",
    ]),
  )
  const documentEntry = entries.find((entry) => entry.component === "markdown-document")
  expect(documentEntry?.confirm).toBe("Replaces the whole document")

  const read = await refused.act({ steps: [{ ref: "Release notes", action: "getMarkdown" }] })
  expect(read.ok, read.error?.message).toBe(true)
  expect(read.steps[0]?.result).toBe("# Notes\n\nfirst\n")

  const view = editorView()
  act(() => view.dispatch({ selection: EditorSelection.range(9, 14) }))
  const edit = await refused.act({
    steps: [
      { ref: "Release notes", action: "toggleFormat", args: ["bold"] },
      { ref: "Release notes", action: "insertWikilink", args: ["roadmap", "Roadmap"] },
    ],
  })
  expect(edit.ok, edit.error?.message).toBe(true)
  expect(view.state.sliceDoc()).toBe("# Notes\n\n**first[[roadmap|Roadmap]]**\n")
  const heading = await refused.act({ steps: [{ ref: "Release notes", action: "setHeading", args: [3] }] })
  expect(heading.ok, heading.error?.message).toBe(true)
  expect(view.state.sliceDoc()).toBe("# Notes\n\n### **first[[roadmap|Roadmap]]**\n")

  const denied = await refused.act({ steps: [{ ref: "Document", action: "setMarkdown", args: ["gone"] }] })
  expect(denied.ok).toBe(false)
  expect(view.state.sliceDoc()).not.toBe("gone")

  const allow = vi.fn(() => true)
  const approved = await createAgent({ allow }).act({
    steps: [{ ref: "Document", action: "setMarkdown", args: ["# New\n"] }],
  })
  expect(approved.ok, approved.error?.message).toBe(true)
  expect(allow).toHaveBeenCalledWith(
    expect.objectContaining({ confirm: "Replaces the whole document" }),
    expect.anything(),
  )
  expect(view.state.sliceDoc()).toBe("# New\n")
  await settle()
  expect(onChange).toHaveBeenLastCalledWith("# New\n")
})
