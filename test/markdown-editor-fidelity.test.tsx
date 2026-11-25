import { EditorSelection } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { act, cleanup, render } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeAll, expect, test, vi } from "vitest"

import { MarkdownEditor } from "@/components/ui/markdown-editor"
import { MarkdownView } from "@/components/ui/markdown-view"

import { markdownNotes } from "./fixtures/markdown-notes"
import spec from "./fixtures/markdown-spec-examples.json"

type Example = { source: string; example: number; section: string; markdown: string }

const corpus: [string, string][] = [
  ...(spec.examples as Example[]).map((entry): [string, string] => [
    `${entry.source} #${entry.example} (${entry.section})`,
    entry.markdown,
  ]),
  ...Object.entries(markdownNotes).map(([name, markdown]): [string, string] => [`note: ${name}`, markdown]),
  ...(spec.examples as Example[])
    .filter((entry) => entry.markdown.includes("\n"))
    .slice(0, 100)
    .map((entry): [string, string] => [
      `${entry.source} #${entry.example} as CRLF`,
      entry.markdown.replace(/\n/g, "\r\n"),
    ]),
]

beforeAll(() => {
  // Workaround: jsdom has no layout, and CodeMirror measures text through ranges.
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)))

function check(markdown: string) {
  const onChange = vi.fn()
  const onDirtyChange = vi.fn()
  render(
    <MarkdownEditor
      label="Note"
      value={markdown}
      onChange={onChange}
      onDirtyChange={onDirtyChange}
      changeDelay={0}
      resolveWikilink={(slug) => ({ exists: slug.length % 2 === 0, label: slug.toUpperCase() })}
    />,
  )
  const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)
  if (!view) throw new Error("no editor")
  const transactions: boolean[] = []
  const unchanged = view.state.doc
  for (let number = 1; number <= view.state.doc.lines; number++) {
    const line = view.state.doc.line(number)
    view.dispatch({ selection: EditorSelection.cursor(line.from) })
    view.dispatch({ selection: EditorSelection.range(line.from, line.to) })
    transactions.push(view.state.doc !== unchanged)
  }
  view.dispatch({ selection: EditorSelection.cursor(0) })
  return { view, onChange, onDirtyChange, transactions }
}

test(`load then serialize is byte-identical across ${corpus.length} documents, with no onChange`, async () => {
  const failures: string[] = []
  for (const [name, markdown] of corpus) {
    let result: ReturnType<typeof check>
    try {
      result = check(markdown)
    } catch (error) {
      failures.push(`${name}: ${(error as Error).message}`)
      cleanup()
      continue
    }
    const { view, onChange, onDirtyChange, transactions } = result
    await tick()
    const out = view.state.sliceDoc()
    if (out !== markdown) failures.push(`${name}: bytes differ`)
    if (onChange.mock.calls.length) failures.push(`${name}: onChange fired`)
    if (onDirtyChange.mock.calls.length) failures.push(`${name}: onDirtyChange fired`)
    if (transactions.some(Boolean)) failures.push(`${name}: a decoration pass changed the text`)
    cleanup()
  }
  expect(failures).toEqual([])
}, 120_000)

test("MarkdownView renders every document without throwing and never emits raw HTML", () => {
  for (const [name, markdown] of corpus) {
    let html = ""
    expect(() => (html = renderToStaticMarkup(<MarkdownView markdown={markdown} />)), name).not.toThrow()
    expect(html, name).not.toMatch(/<(script|details|div class=|iframe|style)[\s>]/i)
  }
  const html = renderToStaticMarkup(<MarkdownView markdown={markdownNotes.project ?? ""} />)
  expect(html).toContain("&lt;script&gt;alert(&quot;not run&quot;)&lt;/script&gt;")
  expect(
    renderToStaticMarkup(<MarkdownView markdown="[x](javascript:alert(1)) [y](JaVa&#x09;script:1)" />),
  ).not.toContain("href")
})
