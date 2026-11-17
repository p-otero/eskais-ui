import { syntaxTree } from "@codemirror/language"
import { EditorSelection, EditorState, type Line, type Text, type Transaction } from "@codemirror/state"
import type { SyntaxNode } from "@lezer/common"

import { frontmatterBounds } from "@/components/ui/markdown-frontmatter"

type Span = { from: number; to: number }

/** The block syntax at the start of a line, which the preview never shows as text. */
type LineStructure = {
  /** Ranges hidden outright: indentation, `>` marks and a heading's `#`s. */
  hidden: Span[]
  /** End of the hidden run that starts the line; the caret never rests inside it. */
  hiddenEnd: number
  /** Where the line's text starts, after every marker. */
  contentStart: number
  depth: number
  quote: number
  heading?: number
  bullet?: Span
  ordered?: Span
  task?: Span & { checked: boolean }
  listItem?: SyntaxNode
  continuation?: boolean
}

const frontmatterEnds = new WeakMap<Text, number>()
const FRONTMATTER_SCAN = 65_536

/**
 * Where the leading YAML block ends (its closing fence), or -1. It parses as a rule and a setext heading, so the
 * preview leaves that range as written and the caret moves through it freely.
 */
function frontmatterEnd(state: EditorState) {
  const { doc } = state
  let end = frontmatterEnds.get(doc)
  if (end === undefined) {
    const opens = /^\uFEFF?---[ \t]*$/.test(doc.line(1).text)
    end = opens ? (frontmatterBounds(doc.sliceString(0, FRONTMATTER_SCAN))?.to ?? -1) : -1
    frontmatterEnds.set(doc, end)
  }
  return end
}

const MARKS = new Set(["QuoteMark", "ListMark", "TaskMarker", "HeaderMark"])
const isSpace = (char: string | undefined) => char === " " || char === "\t"

function listDepth(node: SyntaxNode | null) {
  let depth = 0
  for (let at = node; at; at = at.parent) if (at.name === "ListItem") depth++
  return depth
}

// Block marks sit in these nodes; inline content never holds one, so the walk skips it.
const HOLDERS = /^(Document|Blockquote|BulletList|OrderedList|ListItem|Task|Paragraph|FencedCode|ATXHeading\d)$/

/** Every block mark that starts between `from` and `to`, by position, in one walk of the tree. */
function blockMarks(state: EditorState, from: number, to: number) {
  const marks = new Map<number, SyntaxNode>()
  syntaxTree(state).iterate({
    from,
    to,
    enter(ref) {
      if (MARKS.has(ref.name)) {
        if (ref.from >= from) marks.set(ref.from, ref.node)
        return false
      }
      return HOLDERS.test(ref.name) ? undefined : false
    },
  })
  return marks
}

function lineStructure(state: EditorState, line: Line, marks = blockMarks(state, line.from, line.to)): LineStructure {
  const result: LineStructure = { hidden: [], hiddenEnd: line.from, contentStart: line.from, depth: 0, quote: 0 }
  const text = line.text
  const charAt = (pos: number) => text[pos - line.from]
  const spacesFrom = (pos: number) => {
    while (pos < line.to && isSpace(charAt(pos))) pos++
    return pos
  }
  let pos = line.from
  let hiddenEnd: number | undefined
  for (;;) {
    const start = spacesFrom(pos)
    const mark = marks.get(start)
    if (!mark) break
    if (mark.name === "QuoteMark") {
      const end = isSpace(charAt(mark.to)) ? mark.to + 1 : mark.to
      result.hidden.push({ from: pos, to: end })
      result.quote++
      pos = end
    } else if (mark.name === "ListMark") {
      const end = Math.min(spacesFrom(mark.to), mark.to + 4)
      if (start > pos) result.hidden.push({ from: pos, to: start })
      result.listItem = mark.parent ?? undefined
      result.depth = listDepth(mark)
      if (mark.parent?.parent?.name === "OrderedList") {
        result.ordered = { from: mark.from, to: mark.to }
        hiddenEnd ??= start
      } else {
        result.bullet = { from: mark.from, to: end }
      }
      pos = end
    } else if (mark.name === "TaskMarker") {
      const checked = /x/i.test(state.sliceDoc(mark.from + 1, mark.to - 1))
      result.task = { from: mark.from, to: mark.to, checked }
      pos = isSpace(charAt(mark.to)) ? mark.to + 1 : mark.to
      if (pos > mark.to) result.hidden.push({ from: mark.to, to: pos })
    } else if (mark.name === "HeaderMark" && mark.parent?.name.startsWith("ATX") && !mark.prevSibling) {
      const end = spacesFrom(mark.to)
      result.hidden.push({ from: pos, to: end })
      result.heading = Number(mark.parent.name.slice(-1))
      pos = end
      break
    } else {
      break
    }
  }
  if (pos === line.from && isSpace(text[0])) {
    const start = spacesFrom(pos)
    const inner = syntaxTree(state).resolveInner(start, 1)
    const depth = listDepth(inner)
    if (depth > 0 && (inner.name === "Paragraph" || inner.name === "Task") && start < line.to) {
      result.hidden.push({ from: line.from, to: start })
      result.depth = depth
      result.continuation = true
      pos = start
    }
  }
  result.contentStart = pos
  result.hiddenEnd = hiddenEnd ?? pos
  return result
}

/**
 * Keeps an empty caret out of a line's hidden prefix, so typing lands in the text. Moving left from the text's
 * start goes on to the previous line instead of stopping at the hidden marks.
 */
const caretOutOfPrefix = EditorState.transactionFilter.of((transaction: Transaction) => {
  const selection = transaction.selection
  if (!selection || selection.ranges.length !== 1 || !selection.main.empty) return transaction
  const state = transaction.state
  const head = selection.main.head
  const line = state.doc.lineAt(head)
  if (head - line.from > 64 || head <= frontmatterEnd(state)) return transaction
  const structure = lineStructure(state, line)
  if (structure.hiddenEnd === line.from || head >= structure.hiddenEnd) return transaction
  const previous = transaction.startState.selection.main
  const movingBack = previous.empty && transaction.changes.mapPos(previous.head) === structure.hiddenEnd
  const target = movingBack && line.number > 1 ? line.from - 1 : structure.hiddenEnd
  return [transaction, { selection: EditorSelection.cursor(target), sequential: true }]
})

export { blockMarks, caretOutOfPrefix, frontmatterEnd, lineStructure, listDepth }
export type { LineStructure, Span }
