import { EditorSelection } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeAll, expect, test, vi } from "vitest"

import { MarkdownEditor, markdownEditorLabelsEs } from "@/components/ui/markdown-editor"
import { setHeading } from "@/components/ui/markdown-editor-lines"
import { MarkdownView } from "@/components/ui/markdown-view"

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!
const lineText = (view: EditorView, number: number) =>
  view.contentDOM.querySelectorAll(".cm-line")[number - 1]?.textContent
const caret = (view: EditorView, pos: number) => act(() => view.dispatch({ selection: EditorSelection.cursor(pos) }))
const type = (view: EditorView, at: number, text: string) =>
  act(() =>
    view.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + 1 }, userEvent: "input.type" }),
  )

test("inline marks show only while the selection touches their span; headings never show their #", async () => {
  render(
    <MarkdownEditor
      label="Note"
      defaultValue={"# Title\n\n**bold** and *it* [[known]] [[gone]]\n"}
      resolveWikilink={(slug) => ({ exists: slug === "known", label: slug === "known" ? "Known page" : undefined })}
    />,
  )
  await settle()
  const view = editorView()
  caret(view, view.state.doc.length)
  expect(lineText(view, 1)).toBe("Title")
  expect(lineText(view, 3)).toBe("bold and it Known page gone")
  expect(view.contentDOM.querySelector("[data-unresolved]")?.textContent).toBe("gone")

  caret(view, 3)
  expect(lineText(view, 1)).toBe("Title")
  const line = view.state.doc.line(3)
  caret(view, line.from + 3)
  expect(lineText(view, 3)).toBe("**bold** and it Known page gone")
  caret(view, line.from + 8)
  expect(lineText(view, 3)).toBe("**bold** and it Known page gone")
  caret(view, line.from + 10)
  expect(lineText(view, 3)).toBe("bold and it Known page gone")
  caret(view, line.from + 22)
  expect(lineText(view, 3)).toBe("bold and it [[known]] gone")
})

test("bullets, quotes and tasks render without their marks, and the caret skips them", async () => {
  render(<MarkdownEditor label="Note" defaultValue={"- one\n  - two\n> quoted\n- [ ] task\n1. first\n"} />)
  await settle()
  const view = editorView()
  for (let number = 1; number <= 5; number++) {
    caret(view, view.state.doc.line(number).from + 1)
    expect([1, 2, 3, 4, 5].map((n) => lineText(view, n))).toEqual(["one", "two", "quoted", "task", "1. first"])
  }
  expect(view.contentDOM.querySelectorAll("[data-slot=markdown-bullet]")).toHaveLength(2)
  expect(view.contentDOM.querySelector(".cm-line[data-md-depth='2']")?.textContent).toBe("two")
  caret(view, view.state.doc.line(2).from)
  expect(view.state.selection.main.head).toBe(view.state.doc.line(2).from + 4)

  fireEvent.mouseDown(screen.getByRole("checkbox", { name: "Task done" }))
  expect(view.state.sliceDoc()).toContain("- [x] task")
})

test("a table renders as a table off the caret and as aligned source on it", async () => {
  const markdown = "intro\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nafter\n"
  render(<MarkdownEditor label="Note" defaultValue={markdown} />)
  await settle()
  const view = editorView()
  caret(view, 0)
  await settle()
  expect(view.dom.querySelector("[data-slot=markdown-table-widget] table")).toBeTruthy()
  expect(view.contentDOM.textContent).not.toContain("| --- |")

  caret(view, view.state.doc.line(5).from + 2)
  await settle()
  expect(view.dom.querySelector("[data-slot=markdown-table-widget]")).toBeNull()
  expect(lineText(view, 3)).toBe("| a | b |")
  expect(view.contentDOM.querySelectorAll("[data-slot=markdown-table-cell]")).toHaveLength(6)
  expect(view.state.sliceDoc()).toBe(markdown)
})

test("opening a fence above a table turns the table into code, and closing it brings the table back", async () => {
  render(<MarkdownEditor label="Note" defaultValue={"start\n\nmiddle\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\nend\n"} />)
  await settle()
  const view = editorView()
  const tables = () => view.dom.querySelectorAll("[data-slot=markdown-table-widget]").length
  caret(view, 0)
  await settle()
  expect(tables()).toBe(1)
  act(() => view.dispatch({ changes: { from: 0, insert: "```\n" }, selection: { anchor: 0 } }))
  await settle()
  expect(tables()).toBe(0)
  act(() => view.dispatch({ changes: { from: 0, to: 4 } }))
  await settle()
  expect(tables()).toBe(1)
  act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: "\nTitle\n---\n" } }))
  await settle()
  expect(tables()).toBe(1)
  expect(view.contentDOM.textContent).not.toContain("---")
})

test("a setext underline hides unless the caret is on it", async () => {
  render(<MarkdownEditor label="Note" defaultValue={"Title\n---\n\ntext\n"} />)
  await settle()
  const view = editorView()
  caret(view, view.state.doc.length)
  expect(lineText(view, 1)).toBe("Title")
  expect(view.contentDOM.querySelectorAll(".cm-line")).toHaveLength(4)
  caret(view, view.state.doc.line(2).to)
  expect(lineText(view, 2)).toBe("---")
})

test("a code fence shows a language button off its lines, and the button edits the info string", async () => {
  render(<MarkdownEditor label="Note" defaultValue={"text\n\n```ts\nconst a = 1\n```\n"} />)
  await settle()
  const view = editorView()
  caret(view, 0)
  await settle()
  expect(lineText(view, 3)).toBe("ts")
  expect(lineText(view, 5)).toBe("")
  fireEvent.click(screen.getByRole("button", { name: "Code language: ts" }))
  await settle()
  fireEvent.input(screen.getByRole("textbox", { name: "Code language" }), { target: { value: "js" } })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  await settle()
  expect(view.state.sliceDoc()).toBe("text\n\n```js\nconst a = 1\n```\n")

  caret(view, view.state.doc.line(3).from)
  expect(lineText(view, 3)).toBe("```js")
})

test("Tab and Shift+Tab nest list items, Backspace removes a marker, and the heading level is set", async () => {
  render(<MarkdownEditor label="Note" defaultValue={"- one\n- two\n\ntitle\n"} />)
  await settle()
  const view = editorView()
  const key = (name: string, init: KeyboardEventInit = {}) =>
    act(() => {
      view.contentDOM.dispatchEvent(
        new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true, ...init }),
      )
    })
  caret(view, view.state.doc.line(2).to)
  key("Tab")
  expect(view.state.sliceDoc()).toBe("- one\n  - two\n\ntitle\n")
  key("Tab", { shiftKey: true })
  expect(view.state.sliceDoc()).toBe("- one\n- two\n\ntitle\n")

  caret(view, view.state.doc.line(2).from + 2)
  key("Backspace")
  expect(view.state.sliceDoc()).toBe("- one\ntwo\n\ntitle\n")

  caret(view, view.state.doc.line(4).from)
  act(() => void setHeading(view, 2))
  expect(view.state.sliceDoc()).toBe("- one\ntwo\n\n## title\n")
  expect(lineText(view, 4)).toBe("title")
  act(() => void setHeading(view, 0))
  expect(view.state.sliceDoc()).toBe("- one\ntwo\n\ntitle\n")
  expect(() => setHeading(view, 7)).toThrow(RangeError)
})

test("reveal changes wait while an IME composes", async () => {
  render(<MarkdownEditor label="Note" defaultValue={"**bold** text\n"} />)
  await settle()
  const view = editorView()
  caret(view, 12)
  expect(lineText(view, 1)).toBe("bold text")
  Object.defineProperty(view, "composing", { configurable: true, get: () => true })
  caret(view, 3)
  expect(lineText(view, 1)).toBe("bold text")
  Object.defineProperty(view, "composing", { configurable: true, get: () => false })
  caret(view, 3)
  expect(lineText(view, 1)).toBe("**bold** text")
})

test("an outside value over unsent edits goes to onConflict, or flushes the local text first by default", async () => {
  const onChange = vi.fn()
  const onConflict = vi.fn(({ local }: { local: string; remote: string }) => `${local}+merged`)
  const props = { label: "Note", onChange, onConflict, changeDelay: 1000 }
  const first = render(<MarkdownEditor {...props} value="a" />)
  await settle()
  type(editorView(), 1, "b")
  first.rerender(<MarkdownEditor {...props} value="remote" />)
  await settle()
  expect(onConflict).toHaveBeenCalledWith({ local: "ab", remote: "remote" })
  expect(editorView().state.sliceDoc()).toBe("ab+merged")
  cleanup()

  const onDefault = vi.fn()
  const second = render(<MarkdownEditor label="Note" value="a" onChange={onDefault} changeDelay={1000} />)
  await settle()
  type(editorView(), 1, "b")
  second.rerender(<MarkdownEditor label="Note" value="remote" onChange={onDefault} changeDelay={1000} />)
  await settle()
  expect(onDefault).toHaveBeenCalledWith("ab")
  expect(editorView().state.sliceDoc()).toBe("remote")
})

test("the text box describes how to use it, labels translate, and the style element takes the CSP nonce", async () => {
  render(<MarkdownEditor label="Nota" defaultValue="text" cspNonce="abc123" labels={markdownEditorLabelsEs} />)
  await settle()
  const box = screen.getByRole("textbox", { name: "Nota" })
  const hint = document.getElementById(box.getAttribute("aria-describedby") ?? "")
  expect(hint?.textContent).toBe(markdownEditorLabelsEs.usageHint)
  expect(document.querySelector("style[nonce='abc123']")).toBeTruthy()
  expect(screen.getByRole("toolbar", { name: "Formato" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Estilo de texto" })).toBeTruthy()
})

test("MarkdownView keeps the elements of blocks that didn't change", async () => {
  const { container, rerender } = render(<MarkdownView markdown={"# One\n\nfirst\n\nsecond\n"} />)
  await settle()
  const second = container.querySelectorAll("p")[1]
  rerender(<MarkdownView markdown={"# One\n\nfirst, edited\n\nsecond\n"} />)
  await settle()
  expect(container.querySelectorAll("p")[0]?.textContent).toBe("first, edited")
  expect(container.querySelectorAll("p")[1]).toBe(second)
  expect(renderToStaticMarkup(<MarkdownView markdown={"| a |\n| - |\n| 1 |\n"} sourcePositions />)).toContain(
    'data-source-from="2"',
  )
})
