import { EditorSelection } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, test } from "vitest"

import { MarkdownEditor, markdownSlashCommands } from "@/components/ui/markdown-editor"
import { toggleFormat, type MarkdownFormat } from "@/components/ui/markdown-editor-commands"
import { setHeading } from "@/components/ui/markdown-editor-lines"

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!

async function editor(doc: string) {
  render(<MarkdownEditor label="Note" defaultValue={doc} />)
  await settle()
  return editorView()
}

const select = (view: EditorView, anchor: number, head = anchor) =>
  act(() => view.dispatch({ selection: EditorSelection.single(anchor, head) }))
const typeText = (view: EditorView, text: string) =>
  act(() => view.dispatch(view.state.replaceSelection(text), { userEvent: "input.type" }))
const line = (view: EditorView, number: number) => view.state.doc.line(number)

type Command = { name: string; marker: string; run: (view: EditorView) => unknown }

const lineFormat = (format: MarkdownFormat, marker: string): Command => ({
  name: format,
  marker,
  run: (view) => toggleFormat(view, format),
})

const commands: Command[] = [
  lineFormat("heading", "## "),
  { name: "setHeading(1)", marker: "# ", run: (view) => setHeading(view, 1) },
  { name: "setHeading(3)", marker: "### ", run: (view) => setHeading(view, 3) },
  lineFormat("quote", "> "),
  lineFormat("bulletList", "- "),
  lineFormat("orderedList", "1. "),
  lineFormat("taskList", "- [ ] "),
]

describe.each(commands)("$name", ({ marker, run }) => {
  test("on an empty line, typing lands after the marker", async () => {
    const view = await editor("intro\n\n\nend\n")
    select(view, line(view, 3).from)
    act(() => {
      run(view)
    })
    typeText(view, "Hola")
    expect(line(view, 3).text).toBe(`${marker}Hola`)
  })

  test("at the start of a non-empty line mid-document, typing lands after the marker", async () => {
    const view = await editor("# Title\n\nworld\n\nend\n")
    select(view, line(view, 3).from)
    act(() => {
      run(view)
    })
    typeText(view, "Hola ")
    expect(line(view, 3).text).toBe(`${marker}Hola world`)
    expect(view.state.sliceDoc()).toBe(`# Title\n\n${marker}Hola world\n\nend\n`)
  })

  test("over several lines, every line gets the marker and the selection keeps their text", async () => {
    const view = await editor("one\ntwo\nthree\n")
    select(view, line(view, 1).from, line(view, 2).to)
    act(() => {
      run(view)
    })
    expect([1, 2, 3].map((number) => line(view, number).text)).toEqual([`${marker}one`, `${marker}two`, "three"])
    const { anchor, head } = view.state.selection.main
    expect(view.state.sliceDoc(anchor, head)).toBe(`one\n${marker}two`)
  })
})

test("toggling a marker off keeps the caret at the text", async () => {
  const view = await editor("> quoted\n")
  select(view, 2)
  act(() => {
    toggleFormat(view, "quote")
  })
  typeText(view, "re")
  expect(view.state.sliceDoc()).toBe("requoted\n")
})

test("the toolbar's line buttons leave the caret after the marker", async () => {
  const view = await editor("intro\n\n\n")
  for (const [name, marker] of [
    ["Quote", "> "],
    ["Bulleted list", "- "],
    ["Numbered list", "1. "],
    ["Task list", "- [ ] "],
  ] as const) {
    act(() => view.dispatch({ changes: { from: line(view, 3).from, to: line(view, 3).to } }))
    select(view, line(view, 3).from)
    fireEvent.click(screen.getByRole("button", { name }))
    typeText(view, "Hola")
    expect(line(view, 3).text, name).toBe(`${marker}Hola`)
  }
})

test("a slash command removes the typed query and leaves the caret after the marker", async () => {
  const view = await editor("intro\n\n/tít\n")
  const commandsByValue = new Map(markdownSlashCommands().map((command) => [command.value, command]))
  for (const [value, marker] of [
    ["h1", "# "],
    ["h2", "## "],
    ["quote", "> "],
    ["bullet", "- "],
    ["ordered", "1. "],
    ["task", "- [ ] "],
  ] as const) {
    act(() => view.dispatch({ changes: { from: line(view, 3).from, to: line(view, 3).to, insert: "/tít" } }))
    const { from, to } = line(view, 3)
    select(view, to)
    act(() => commandsByValue.get(value)!.run(view, { from, to }))
    typeText(view, "Hola")
    expect(line(view, 3).text, value).toBe(`${marker}Hola`)
  }
})
