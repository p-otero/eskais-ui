import { EditorSelection, EditorState, type Annotation, type ChangeSpec, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

import { dispatchLineChanges, headingLevel, setHeading } from "@/components/ui/markdown-editor-lines"
import { wikilinkText } from "@/components/ui/markdown-syntax"

type InlineFormat = "bold" | "italic" | "strikethrough" | "code"
type LineFormat = "heading" | "quote" | "bulletList" | "orderedList" | "taskList"
type MarkdownFormat = InlineFormat | LineFormat | "link"

const INLINE_MARKERS: Record<InlineFormat, string> = { bold: "**", italic: "_", strikethrough: "~~", code: "`" }
const LINE_PREFIXES: Record<LineFormat, { add: string; match: RegExp }> = {
  heading: { add: "## ", match: /^#{1,6} / },
  quote: { add: "> ", match: /^> ?/ },
  bulletList: { add: "- ", match: /^[-*+] (?!\[[ xX]\] )/ },
  orderedList: { add: "1. ", match: /^\d+[.)] / },
  taskList: { add: "- [ ] ", match: /^[-*+] \[[ xX]\] / },
}

const FORMATS = [...Object.keys(INLINE_MARKERS), ...Object.keys(LINE_PREFIXES), "link"] as MarkdownFormat[]

/** The document's line break, so CRLF files keep CRLF; mixed files keep every byte by splitting on "\n" only. */
function lineSeparatorOf(text: string) {
  const crlf = text.split("\r\n").length - 1
  const lf = text.split("\n").length - 1
  return crlf > 0 && crlf === lf && !/\r(?!\n)/.test(text) ? "\r\n" : "\n"
}

function lineSeparatorExtension(text: string): Extension {
  const separator = lineSeparatorOf(text)
  if (separator === "\n") return EditorState.lineSeparator.of("\n")
  return [
    EditorState.lineSeparator.of(separator),
    EditorView.clipboardInputFilter.of((input) => input.replace(/\r\n?|\n/g, separator)),
  ]
}

function toDocText(state: EditorState, text: string) {
  return state.lineBreak === "\n" ? text : text.replace(/\r\n?|\n/g, state.lineBreak)
}

/** Common prefix and suffix, in document positions (one per line break), never splitting a surrogate pair. */
function minimalChange(current: string, next: string) {
  let start = 0
  const max = Math.min(current.length, next.length)
  while (start < max && current.charCodeAt(start) === next.charCodeAt(start)) start++
  if (start > 0 && /[\uD800-\uDBFF]/.test(current.charAt(start - 1))) start--
  let end = 0
  while (end < max - start && current.charCodeAt(current.length - 1 - end) === next.charCodeAt(next.length - 1 - end)) {
    end++
  }
  if (end > 0 && /[\uDC00-\uDFFF]/.test(current.charAt(current.length - end))) end--
  return { from: start, to: current.length - end, insert: next.slice(start, next.length - end) }
}

const flat = (state: EditorState, text: string) =>
  state.lineBreak === "\n" ? text : text.replaceAll(state.lineBreak, "\n")

/** Returns false when `next` needs a different line separator, so the caller must rebuild the state instead. */
function replaceDocument(view: EditorView, next: string, annotations: Annotation<unknown>[] = []) {
  const { state } = view
  if (lineSeparatorOf(next) !== state.lineBreak) return false
  const change = minimalChange(state.doc.sliceString(0, undefined, "\n"), flat(state, next))
  if (change.from === change.to && change.insert === "") return true
  view.dispatch({ changes: { ...change, insert: toDocText(state, change.insert) }, annotations })
  return true
}

function toggleInline(view: EditorView, format: InlineFormat) {
  const marker = INLINE_MARKERS[format]
  const size = marker.length
  const { state } = view
  view.dispatch(
    state.changeByRange((range) => {
      const before = state.sliceDoc(range.from - size, range.from)
      const after = state.sliceDoc(range.to, range.to + size)
      if (before === marker && after === marker) {
        return {
          changes: [
            { from: range.from - size, to: range.from },
            { from: range.to, to: range.to + size },
          ],
          range: EditorSelection.range(range.from - size, range.to - size),
        }
      }
      const inner = state.sliceDoc(range.from, range.to)
      if (inner.length >= size * 2 && inner.startsWith(marker) && inner.endsWith(marker)) {
        return {
          changes: { from: range.from, to: range.to, insert: inner.slice(size, -size) },
          range: EditorSelection.range(range.from, range.to - size * 2),
        }
      }
      return {
        changes: [
          { from: range.from, insert: marker },
          { from: range.to, insert: marker },
        ],
        range: EditorSelection.range(range.from + size, range.to + size),
      }
    }),
    { userEvent: "input.format", scrollIntoView: true },
  )
}

function toggleLines(view: EditorView, format: LineFormat) {
  const { add, match } = LINE_PREFIXES[format]
  const { state } = view
  const lines = new Map<number, { from: number; text: string }>()
  for (const range of state.selection.ranges) {
    for (let pos = range.from; pos <= range.to;) {
      const current = state.doc.lineAt(pos)
      lines.set(current.number, { from: current.from, text: current.text })
      pos = current.to + 1
    }
  }
  const all = [...lines.values()]
  const remove = all.every((entry) => match.test(entry.text))
  const changes: ChangeSpec[] = all.map((entry) => {
    const existing = match.exec(entry.text)?.[0]
    if (remove) return { from: entry.from, to: entry.from + (existing?.length ?? 0) }
    const other = Object.values(LINE_PREFIXES)
      .find((prefix) => prefix.match.test(entry.text))
      ?.match.exec(entry.text)?.[0]
    return { from: entry.from, to: entry.from + (other?.length ?? 0), insert: add }
  })
  dispatchLineChanges(view, changes)
}

function toggleFormat(view: EditorView, format: MarkdownFormat) {
  if (!FORMATS.includes(format))
    throw new RangeError(`Unknown format "${String(format)}". Formats: ${FORMATS.join(", ")}.`)
  if (view.state.readOnly) return false
  if (format === "heading") return setHeading(view, headingLevel(view.state) ? 0 : 2)
  if (format === "link") {
    const range = view.state.selection.main
    const text = view.state.sliceDoc(range.from, range.to)
    const insert = `[${text}](url)`
    const urlStart = range.from + text.length + 3
    view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      selection: EditorSelection.range(urlStart, urlStart + 3),
      userEvent: "input.format",
    })
  } else if (format in INLINE_MARKERS) {
    toggleInline(view, format as InlineFormat)
  } else {
    toggleLines(view, format as LineFormat)
  }
  return true
}

function insertAtSelection(view: EditorView, text: string, userEvent = "input") {
  if (view.state.readOnly) return false
  const insert = toDocText(view.state, text)
  view.dispatch(view.state.replaceSelection(insert), { userEvent, scrollIntoView: true })
  return true
}

/** Inserts at the caret without replacing the selected text, and puts the caret after the insertion. */
function insertAtCaret(view: EditorView, text: string, userEvent = "input") {
  if (view.state.readOnly) return false
  const insert = toDocText(view.state, text)
  const at = view.state.selection.main.head
  view.dispatch({
    changes: { from: at, insert },
    selection: { anchor: at + view.state.toText(insert).length },
    userEvent,
    scrollIntoView: true,
  })
  return true
}

function insertWikilink(view: EditorView, slug: string, label?: string) {
  if (!slug.trim() || /[[\]|\r\n]/.test(slug)) throw new RangeError(`"${slug}" isn't a valid wikilink target.`)
  return insertAtCaret(view, wikilinkText(slug, label), "input.wikilink")
}

/** Puts `before` and `after` around every selection range and keeps the wrapped text selected. */
function wrapSelection(view: EditorView, before: string, after = before) {
  const { state } = view
  if (state.readOnly) return false
  const open = toDocText(state, before)
  const close = toDocText(state, after)
  const size = state.toText(open).length
  view.dispatch(
    state.changeByRange((range) => ({
      changes: [
        { from: range.from, insert: open },
        { from: range.to, insert: close },
      ],
      range: EditorSelection.range(range.anchor + size, range.head + size),
    })),
    { userEvent: "input.format", scrollIntoView: true },
  )
  return true
}

const linkDestination = (href: string) => (/[\s()<>]/.test(href) ? `<${href.replace(/[<>]/g, encodeURI)}>` : href)
const linkLabel = (text: string) => text.replace(/([[\]\\])/g, "\\$1")

/** Replaces the selection with `[text](href)`; without `text`, the selected text (or the address) is the label. */
function insertLink(view: EditorView, href: string, text?: string) {
  if (!href.trim() || /[\r\n]/.test(href)) throw new RangeError(`"${href}" isn't a valid link address.`)
  const { state } = view
  if (state.readOnly) return false
  const range = state.selection.main
  const label = text ?? (state.sliceDoc(range.from, range.to) || href)
  return insertAtSelection(view, `[${linkLabel(label)}](${linkDestination(href.trim())})`, "input.link")
}

export {
  FORMATS,
  insertAtCaret,
  insertAtSelection,
  insertLink,
  insertWikilink,
  lineSeparatorExtension,
  lineSeparatorOf,
  minimalChange,
  replaceDocument,
  toDocText,
  toggleFormat,
  wrapSelection,
}
export type { MarkdownFormat }
