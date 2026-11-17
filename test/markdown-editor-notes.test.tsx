import { EditorSelection } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, expect, test, vi } from "vitest"

import { MarkdownEditor } from "@/components/ui/markdown-editor"

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const editorView = () => EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!
const lines = (view: EditorView) => [...view.contentDOM.querySelectorAll<HTMLElement>(".cm-line")]
const caret = (view: EditorView, pos: number) => act(() => view.dispatch({ selection: EditorSelection.cursor(pos) }))

const renderEmbed = (target: string, alias?: string) => <span data-testid="preview">{`${target}:${alias ?? ""}`}</span>

const note = "---\ntitle: Atlas\ntags:\n  - plan\n---\n# Atlas\n\nSee ![[diagram|the diagram]] and [[roadmap]].\n"

test("frontmatter shows as written, not as a rule and a heading, and round-trips byte for byte", async () => {
  const onChange = vi.fn()
  render(<MarkdownEditor label="Note" defaultValue={note} onChange={onChange} changeDelay={0} />)
  await settle()
  const view = editorView()
  caret(view, view.state.doc.length)
  const rendered = lines(view)
  expect(rendered.slice(0, 5).map((line) => line.textContent)).toEqual([
    "---",
    "title: Atlas",
    "tags:",
    "  - plan",
    "---",
  ])
  expect(rendered.slice(0, 5).map((line) => line.dataset.mdFrontmatter)).toEqual(["open", "", "", "", "close"])
  expect(rendered.slice(0, 5).some((line) => line.dataset.mdHeading || line.dataset.mdRule)).toBe(false)
  expect(rendered[5]?.dataset.mdHeading).toBe("1")
  expect(rendered[5]?.textContent).toBe("Atlas")

  // The caret rests anywhere in it: the list item's "- " isn't a hidden prefix there.
  const item = view.state.doc.line(4)
  caret(view, item.from)
  expect(view.state.selection.main.head).toBe(item.from)
  await settle()
  expect(view.state.sliceDoc()).toBe(note)
  expect(onChange).not.toHaveBeenCalled()
})

test("an embed off the caret hides its marks; embedPreview renders renderEmbed in its place", async () => {
  const { unmount } = render(<MarkdownEditor label="Note" defaultValue={note} />)
  await settle()
  let view = editorView()
  caret(view, 0)
  expect(lines(view)[7]?.textContent).toBe("See the diagram and roadmap.")
  expect(view.contentDOM.querySelector("[data-slot=markdown-embed]")?.textContent).toBe("the diagram")
  const embedFrom = note.indexOf("![[")
  caret(view, embedFrom + 4)
  expect(lines(view)[7]?.textContent).toBe("See ![[diagram|the diagram]] and roadmap.")
  unmount()

  render(<MarkdownEditor label="Note" defaultValue={note} embedPreview renderEmbed={renderEmbed} />)
  await settle()
  view = editorView()
  caret(view, 0)
  await settle()
  expect(screen.getByTestId("preview").textContent).toBe("diagram:the diagram")
  expect(screen.getByTestId("preview").closest("[data-slot=markdown-embed-widget]")).not.toBeNull()
  caret(view, embedFrom + 4)
  await settle()
  expect(screen.queryByTestId("preview")).toBeNull()
  expect(view.state.sliceDoc()).toBe(note)
})

test("embedPreview without renderEmbed shows a link-like placeholder", async () => {
  render(<MarkdownEditor label="Note" defaultValue="![[plan]]\n\ntext\n" embedPreview />)
  await settle()
  const view = editorView()
  caret(view, view.state.doc.length)
  await settle()
  const placeholder = view.contentDOM.querySelector("[data-slot=markdown-embed-widget] [data-slot=markdown-embed]")
  expect(placeholder?.textContent).toBe("plan")
})

test("Ctrl/Cmd+click on a wikilink or an embed calls onWikilinkClick with the click", async () => {
  const onWikilinkClick = vi.fn()
  const onOpenWikilink = vi.fn()
  render(
    <MarkdownEditor
      label="Note"
      defaultValue={note}
      onWikilinkClick={onWikilinkClick}
      onOpenWikilink={onOpenWikilink}
    />,
  )
  await settle()
  const view = editorView()
  const wikilink = note.indexOf("[[roadmap") + 3
  const embed = note.indexOf("![[") + 4
  const at = vi.spyOn(view, "posAtCoords")
  at.mockReturnValueOnce(wikilink)
  fireEvent.mouseDown(view.contentDOM, { button: 0, ctrlKey: true, clientX: 1, clientY: 1 })
  expect(onWikilinkClick).toHaveBeenCalledWith("roadmap", expect.any(MouseEvent))
  expect(onOpenWikilink).toHaveBeenCalledWith("roadmap")
  at.mockReturnValueOnce(embed)
  fireEvent.mouseDown(view.contentDOM, { button: 0, metaKey: true, clientX: 1, clientY: 1 })
  expect(onWikilinkClick).toHaveBeenLastCalledWith("diagram", expect.any(MouseEvent))

  caret(view, wikilink)
  fireEvent.keyDown(view.contentDOM, { key: "Enter" })
  expect(onWikilinkClick).toHaveBeenLastCalledWith("roadmap", undefined)
  expect(view.state.sliceDoc()).toBe(note)
})
