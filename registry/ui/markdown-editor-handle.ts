import { EditorSelection, type EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

import {
  BLOCK_KINDS,
  FORMATS,
  insertAtCaret,
  insertBlock,
  insertLink,
  insertWikilink,
  toggleFormat,
  wrapSelection,
  type MarkdownBlockKind,
  type MarkdownFormat,
} from "@/components/ui/markdown-editor-commands"
import { setHeading } from "@/components/ui/markdown-editor-lines"
import { activeProvisional, committedDoc, committedSelection } from "@/components/ui/markdown-editor-provisional"

const LEVELS = ["paragraph", "heading1", "heading2", "heading3", "heading4", "heading5", "heading6"] as const

/** The toolbar's and the slash menu's commands: formats, levels (`paragraph`, `heading1`…) and blocks. */
type MarkdownEditorCommand = MarkdownFormat | (typeof LEVELS)[number] | MarkdownBlockKind

const COMMANDS: readonly MarkdownEditorCommand[] = [...FORMATS, ...LEVELS, ...BLOCK_KINDS]

/** How `insertText` reports the edit. `"input.type"` counts as typing, so a trigger such as `[[` opens its menu. */
type InsertTextOptions = { userEvent?: string }

/** What the handle needs from the editor's menus. */
type HandleMenus = {
  /** Opens the wikilink listbox with a provisional `[[` at the caret unless one is there; false without `suggestWikilinks`. */
  openWikilinkSuggestions: () => boolean
}

/** Offsets count characters of the Markdown string, as `getValue()` returns it, line breaks included. */
type MarkdownSelection = { anchor: number; head: number; from: number; to: number; text: string }

/**
 * What a `ref` on `MarkdownEditor` holds once the editor has mounted (`null` before). Writes return `false` when
 * the editor is read-only.
 */
type MarkdownEditorHandle = {
  focus: () => void
  /**
   * The note as `onChange` sends it. While wikilink suggestions are open behind a provisional `[[`, that `[[` and
   * its query aren't in it: it is the text dismissing them would restore.
   */
  getValue: () => string
  /** The selection in `getValue()`'s offsets: during a provisional session, the one dismissing would restore. */
  getSelection: () => MarkdownSelection
  /**
   * True while wikilink suggestions are open behind a provisional `[[`: a choice is pending and the text on screen
   * isn't the note yet. False once an item is chosen or the list is dismissed.
   */
  isComposing: () => boolean
  /** Selects from `anchor` to `head` (a caret when `head` is left out), clamped to the text, and scrolls to it. */
  setSelection: (anchor: number, head?: number) => void
  /**
   * Inserts at the caret without replacing the selection, and puts the caret after it. The edit is a plain
   * `"input"` unless `userEvent` says otherwise: `{ userEvent: "input.type" }` counts as typing, so a trigger such
   * as `[[` or `/` opens its menu.
   */
  insertText: (text: string, options?: InsertTextOptions) => boolean
  /**
   * Opens the wikilink suggestions at the caret behind a provisional `[[` (unless one is there): `getValue()`,
   * `onChange` and undo skip it, dismissing puts the note back byte for byte, and a choice is one undoable edit. From a slash command's
   * `run`, it opens once the slash menu has closed. False when read-only or without `suggestWikilinks`.
   */
  openWikilinkSuggestions: () => boolean
  insertWikilink: (target: string, alias?: string) => boolean
  /** Replaces the selection with `[text](href)`; without `text`, the selected text or the address is the label. */
  insertLink: (href: string, text?: string) => boolean
  /** Puts `before` and `after` (`before` again when left out) around the selection, which stays on the text. */
  wrapSelection: (before: string, after?: string) => boolean
  /**
   * Runs a command of the toolbar or the slash menu: a format (`bold`, `quote`, `taskList`…), a level
   * (`paragraph`, `heading1`…) or a block (`codeBlock`, `table`, `divider`). Throws a RangeError on any other name.
   */
  runCommand: (name: MarkdownEditorCommand) => boolean
  /**
   * Inserts a block as the slash menu does, in place of the selection: after a blank line when text comes before
   * it, with the caret in the code fence, the first cell, or after the rule.
   */
  insertBlock: (kind: MarkdownBlockKind) => boolean
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
  if ((BLOCK_KINDS as readonly string[]).includes(name)) return insertBlock(view, name as MarkdownBlockKind)
  const level = (LEVELS as readonly string[]).indexOf(name)
  return level >= 0 ? setHeading(view, level) : toggleFormat(view, name as MarkdownFormat)
}

function createEditorHandle(view: EditorView, menus: HandleMenus): MarkdownEditorHandle {
  return {
    focus: () => view.focus(),
    getValue: () => committedDoc(view.state),
    getSelection: () => {
      const { state } = view
      const { anchor, head, from, to } = committedSelection(state)
      const active = activeProvisional(state)
      // The selection a dismissal restores covers at most the text the trigger replaced.
      const text = active ? active.original.slice(from - active.from, to - active.from) : state.sliceDoc(from, to)
      return {
        anchor: toOffset(state, anchor),
        head: toOffset(state, head),
        from: toOffset(state, from),
        to: toOffset(state, to),
        text,
      }
    },
    isComposing: () => activeProvisional(view.state) !== null,
    setSelection: (anchor, head) => {
      const { state } = view
      const from = toEditorPos(state, anchor)
      view.dispatch({
        selection: EditorSelection.single(from, head === undefined ? from : toEditorPos(state, head)),
        scrollIntoView: true,
      })
    },
    insertText: (text, options) => insertAtCaret(view, String(text), options?.userEvent ?? "input"),
    openWikilinkSuggestions: () => menus.openWikilinkSuggestions(),
    insertWikilink: (target, alias) => insertWikilink(view, String(target), alias),
    insertLink: (href, text) => insertLink(view, String(href), text),
    wrapSelection: (before, after) => wrapSelection(view, String(before), after),
    runCommand: (name) => runCommand(view, name),
    insertBlock: (kind) => insertBlock(view, kind),
    scrollToLine: (line) => {
      const { doc } = view.state
      const number = Math.max(1, Math.min(Math.trunc(Number(line)) || 1, doc.lines))
      view.dispatch({ effects: EditorView.scrollIntoView(doc.line(number).from, { y: "start" }) })
    },
    getScrollLine: () => {
      const scroller = view.dom.closest("[data-slot=markdown-editor-viewport]") ?? view.scrollDOM
      const top = scroller.getBoundingClientRect().top
      const block = view.lineBlockAtHeight(Math.max(0, top - view.documentTop))
      return view.state.doc.lineAt(block.from).number
    },
  }
}

export { createEditorHandle, runCommand, toEditorPos, toOffset }
export type { MarkdownBlockKind }
export type { HandleMenus, InsertTextOptions, MarkdownEditorCommand, MarkdownEditorHandle, MarkdownSelection }
