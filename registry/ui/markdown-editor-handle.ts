import { EditorSelection, type EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

import {
  FORMATS,
  insertAtCaret,
  insertLink,
  insertWikilink,
  toggleFormat,
  wrapSelection,
  type MarkdownFormat,
} from "@/components/ui/markdown-editor-commands"
import { setHeading } from "@/components/ui/markdown-editor-lines"

const LEVELS = ["paragraph", "heading1", "heading2", "heading3", "heading4", "heading5", "heading6"] as const

/** The toolbar's commands: its formats and the levels of its text style menu. */
type MarkdownEditorCommand = MarkdownFormat | (typeof LEVELS)[number]

const COMMANDS: readonly MarkdownEditorCommand[] = [...FORMATS, ...LEVELS]

/** Offsets count characters of the Markdown string, as `getValue()` returns it, line breaks included. */
type MarkdownSelection = { anchor: number; head: number; from: number; to: number; text: string }

/**
 * What a `ref` on `MarkdownEditor` holds once the editor has mounted (`null` before). Writes return `false` when
 * the editor is read-only.
 */
type MarkdownEditorHandle = {
  focus: () => void
  getValue: () => string
  getSelection: () => MarkdownSelection
  /** Selects from `anchor` to `head` (a caret when `head` is left out), clamped to the text, and scrolls to it. */
  setSelection: (anchor: number, head?: number) => void
  /** Inserts at the caret without replacing the selection, and puts the caret after it. */
  insertText: (text: string) => boolean
  insertWikilink: (target: string, alias?: string) => boolean
  /** Replaces the selection with `[text](href)`; without `text`, the selected text or the address is the label. */
  insertLink: (href: string, text?: string) => boolean
  /** Puts `before` and `after` (`before` again when left out) around the selection, which stays on the text. */
  wrapSelection: (before: string, after?: string) => boolean
  /** Runs a toolbar command: a format (`bold`, `quote`, `taskList`…) or a level (`paragraph`, `heading1`…). */
  runCommand: (name: MarkdownEditorCommand) => boolean
  /** Scrolls a line (from 1) to the top of the editor, without moving the caret. */
  scrollToLine: (line: number) => void
  /** The first line in view, from 1. */
  getScrollLine: () => number
}

/** String offsets and editor positions differ only in a CRLF document, where a line break is one position. */
function lineBreakSize(state: EditorState) {
  return state.lineBreak.length - 1
}

function toEditorPos(state: EditorState, offset: number) {
  const extra = lineBreakSize(state)
  const { doc } = state
  const length = doc.length + extra * (doc.lines - 1)
  const clamped = Math.max(0, Math.min(Math.trunc(Number(offset)) || 0, length))
  if (!extra) return clamped
  let low = 1
  let high = doc.lines
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (doc.line(middle).from + extra * (middle - 1) <= clamped) low = middle
    else high = middle - 1
  }
  const line = doc.line(low)
  return Math.min(line.to, clamped - extra * (low - 1))
}

function toOffset(state: EditorState, pos: number) {
  const extra = lineBreakSize(state)
  return extra ? pos + extra * (state.doc.lineAt(pos).number - 1) : pos
}

function runCommand(view: EditorView, name: MarkdownEditorCommand) {
  if (!COMMANDS.includes(name)) {
    throw new RangeError(`Unknown command "${String(name)}". Commands: ${COMMANDS.join(", ")}.`)
  }
  const level = (LEVELS as readonly string[]).indexOf(name)
  return level >= 0 ? setHeading(view, level) : toggleFormat(view, name as MarkdownFormat)
}

function createEditorHandle(view: EditorView): MarkdownEditorHandle {
  return {
    focus: () => view.focus(),
    getValue: () => view.state.sliceDoc(),
    getSelection: () => {
      const { state } = view
      const { anchor, head, from, to } = state.selection.main
      return {
        anchor: toOffset(state, anchor),
        head: toOffset(state, head),
        from: toOffset(state, from),
        to: toOffset(state, to),
        text: state.sliceDoc(from, to),
      }
    },
    setSelection: (anchor, head) => {
      const { state } = view
      const from = toEditorPos(state, anchor)
      view.dispatch({
        selection: EditorSelection.single(from, head === undefined ? from : toEditorPos(state, head)),
        scrollIntoView: true,
      })
    },
    insertText: (text) => insertAtCaret(view, String(text)),
    insertWikilink: (target, alias) => insertWikilink(view, String(target), alias),
    insertLink: (href, text) => insertLink(view, String(href), text),
    wrapSelection: (before, after) => wrapSelection(view, String(before), after),
    runCommand: (name) => runCommand(view, name),
    scrollToLine: (line) => {
      const { doc } = view.state
      const number = Math.max(1, Math.min(Math.trunc(Number(line)) || 1, doc.lines))
      view.dispatch({ effects: EditorView.scrollIntoView(doc.line(number).from, { y: "start" }) })
    },
    getScrollLine: () => {
      const top = view.scrollDOM.getBoundingClientRect().top
      const block = view.lineBlockAtHeight(Math.max(0, top - view.documentTop))
      return view.state.doc.lineAt(block.from).number
    },
  }
}

export { createEditorHandle, runCommand, toEditorPos, toOffset }
export type { MarkdownEditorCommand, MarkdownEditorHandle, MarkdownSelection }
