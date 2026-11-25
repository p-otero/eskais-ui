import { syntaxTree } from "@codemirror/language"
import { EditorSelection, type ChangeSet, type ChangeSpec, type EditorState, type Line } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import type { SyntaxNode } from "@lezer/common"

import { lineStructure } from "@/components/ui/markdown-editor-structure"

function selectedLines(state: EditorState) {
  const lines = new Map<number, Line>()
  for (const range of state.selection.ranges) {
    for (let pos = range.from; pos <= range.to;) {
      const current = state.doc.lineAt(pos)
      lines.set(current.number, current)
      pos = current.to + 1
    }
  }
  return [...lines.values()]
}

function selectionAfterMarkers(state: EditorState, changes: ChangeSet) {
  const map = (pos: number) => {
    const start = lineStructure(state, state.doc.lineAt(pos)).contentStart
    return pos <= start ? changes.mapPos(start, 1) : changes.mapPos(pos)
  }
  const ranges = state.selection.ranges.map((range) => EditorSelection.range(map(range.anchor), map(range.head)))
  return EditorSelection.create(ranges, state.selection.mainIndex)
}

function dispatchLineChanges(view: EditorView, specs: readonly ChangeSpec[]) {
  const { state } = view
  const changes = state.changes(specs)
  view.dispatch({
    changes,
    selection: selectionAfterMarkers(state, changes),
    userEvent: "input.format",
    scrollIntoView: true,
  })
}

function headingAt(state: EditorState, line: Line): SyntaxNode | null {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(line.to, -1); node; node = node.parent) {
    if (/^(ATX|Setext)Heading\d$/.test(node.name)) return node
  }
  return null
}

function headingLevel(state: EditorState, pos = state.selection.main.head) {
  const heading = headingAt(state, state.doc.lineAt(pos))
  return heading ? Number(heading.name.slice(-1)) : 0
}

/** Level 0 turns the line into a paragraph. A setext heading keeps its underline for levels 1 and 2. */
function setHeading(view: EditorView, level: number) {
  if (!Number.isInteger(level) || level < 0 || level > 6) {
    throw new RangeError(`Heading level must be 0 to 6, got ${String(level)}.`)
  }
  const { state } = view
  if (state.readOnly) return false
  const changes: ChangeSpec[] = []
  const done = new Set<number>()
  for (const line of selectedLines(state)) {
    const heading = headingAt(state, line)
    if (heading && done.has(heading.from)) continue
    if (heading?.name.startsWith("Setext")) {
      done.add(heading.from)
      const underline = heading.lastChild
      if (!underline) continue
      const underlineLine = state.doc.lineAt(underline.from)
      if (level === 1 || level === 2) {
        const insert = (level === 1 ? "=" : "-").repeat(underline.to - underline.from)
        changes.push({ from: underline.from, to: underline.to, insert })
      } else {
        changes.push({ from: underlineLine.from - 1, to: underlineLine.to })
        if (level > 2) changes.push({ from: heading.from, insert: `${"#".repeat(level)} ` })
      }
      continue
    }
    const structure = lineStructure(state, line)
    const prefix = level ? `${"#".repeat(level)} ` : ""
    if (heading) {
      done.add(heading.from)
      const mark = heading.firstChild
      if (!mark || mark.name !== "HeaderMark") continue
      changes.push({ from: mark.from, to: structure.contentStart, insert: prefix })
    } else if (level) {
      changes.push({ from: structure.contentStart, insert: prefix })
    }
  }
  if (changes.length) dispatchLineChanges(view, changes)
  return true
}

const column = (state: EditorState, pos: number) => pos - state.doc.lineAt(pos).from

function listItems(state: EditorState) {
  const items: SyntaxNode[] = []
  for (const line of selectedLines(state)) {
    const item = lineStructure(state, line).listItem
    if (item && !items.some((other) => other.from <= item.from && other.to >= item.to)) items.push(item)
  }
  return items
}

function shiftItem(state: EditorState, item: SyntaxNode, delta: number, changes: ChangeSpec[]) {
  const first = state.doc.lineAt(item.from)
  let quoted = false
  for (let node = item.parent; node; node = node.parent) if (node.name === "Blockquote") quoted = true
  const quotePrefix = (text: string) => (quoted ? (/^(?:\s*>\s?)*/.exec(text)?.[0].length ?? 0) : 0)
  for (let pos = item.from; pos <= item.to;) {
    const current = state.doc.lineAt(pos)
    pos = current.to + 1
    if (!current.text.trim()) continue
    const isFirst = current.number === first.number
    const at = isFirst ? item.from : current.from + quotePrefix(current.text)
    if (delta > 0) {
      changes.push({ from: at, insert: " ".repeat(delta) })
      continue
    }
    const spaces = isFirst
      ? (/ *$/.exec(state.sliceDoc(current.from, at))?.[0].length ?? 0)
      : (/^ */.exec(state.sliceDoc(at, current.to))?.[0].length ?? 0)
    const count = Math.min(-delta, spaces)
    if (count > 0) changes.push(isFirst ? { from: at - count, to: at } : { from: at, to: at + count })
  }
}

function contentColumn(state: EditorState, item: SyntaxNode) {
  const mark = item.getChild("ListMark")
  if (!mark) return column(state, item.from)
  const line = state.doc.lineAt(mark.from)
  let end = mark.to
  while (end < line.to && state.sliceDoc(end, end + 1) === " ") end++
  return end - line.from
}

function indentList(view: EditorView) {
  const { state } = view
  const items = listItems(state)
  if (!items.length || state.readOnly) return false
  const changes: ChangeSpec[] = []
  for (const item of items) {
    const previous = item.prevSibling
    if (previous?.name !== "ListItem") continue
    const delta = contentColumn(state, previous) - column(state, item.from)
    if (delta > 0) shiftItem(state, item, delta, changes)
  }
  if (changes.length) view.dispatch({ changes, userEvent: "input.indent" })
  return true
}

function outdentList(view: EditorView) {
  const { state } = view
  const items = listItems(state)
  if (!items.length || state.readOnly) return false
  const changes: ChangeSpec[] = []
  for (const item of items) {
    const parent = item.parent?.parent
    if (parent?.name !== "ListItem") continue
    const delta = column(state, item.from) - column(state, parent.from)
    if (delta > 0) shiftItem(state, item, -delta, changes)
  }
  if (changes.length) view.dispatch({ changes, userEvent: "delete.dedent" })
  return true
}

/**
 * Backspace at the start of a line's text removes its innermost marker: a task box, then a nested item's
 * indentation, a list marker, a heading or a quote, instead of deleting the hidden marks all at once.
 */
function deleteMarker(view: EditorView) {
  const { state } = view
  const range = state.selection.main
  if (state.readOnly || !range.empty || state.selection.ranges.length > 1) return false
  const line = state.doc.lineAt(range.head)
  const structure = lineStructure(state, line)
  if (range.head !== structure.contentStart || structure.contentStart === line.from || structure.continuation) {
    return false
  }
  const dispatch = (from: number, to: number) => {
    view.dispatch({ changes: { from, to }, userEvent: "delete.marker", scrollIntoView: true })
    return true
  }
  if (structure.task) return dispatch(structure.task.from, structure.contentStart)
  if (structure.listItem) {
    if (structure.depth > 1) return outdentList(view)
    return dispatch((structure.bullet ?? structure.ordered)!.from, structure.contentStart)
  }
  if (structure.heading) return setHeading(view, 0)
  const quote = structure.hidden.at(-1)
  return quote ? dispatch(quote.from, quote.to) : false
}

export { deleteMarker, dispatchLineChanges, headingLevel, indentList, outdentList, setHeading }
