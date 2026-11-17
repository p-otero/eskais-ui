import { syntaxTree } from "@codemirror/language"
import { EditorSelection, StateField, type EditorState, type Range, type Transaction } from "@codemirror/state"
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view"

import { previewConfig } from "@/components/ui/markdown-editor-preview"
import { frontmatterEnd, type Span } from "@/components/ui/markdown-editor-structure"
import { TableWidget } from "@/components/ui/markdown-editor-widgets"

type Block = Span & { table: boolean }
type Blocks = { tables: Span[]; underlines: Span[]; shown: Block[]; decorations: DecorationSet }

const CONTAINERS = new Set(["Document", "Blockquote", "BulletList", "OrderedList", "ListItem"])
const hideUnderline = Decoration.replace({})

function scan(state: EditorState, from = 0, to = state.doc.length) {
  const tables: Span[] = []
  const underlines: Span[] = []
  syntaxTree(state).iterate({
    from,
    to,
    enter(ref) {
      if (CONTAINERS.has(ref.name)) return undefined
      if (ref.from < from || ref.to > to) return false
      if (ref.name === "Table" && ref.node.parent?.name === "Document") tables.push({ from: ref.from, to: ref.to })
      else if (ref.name.startsWith("SetextHeading")) {
        const underline = ref.node.lastChild
        if (underline?.name === "HeaderMark") underlines.push({ from: underline.from, to: underline.to })
      }
      return false
    },
  })
  return { tables, underlines }
}

/** Start and end of the top-level blocks around `from` and `to`. */
function topLevel(state: EditorState, from: number, to: number) {
  const tree = syntaxTree(state)
  const outer = (pos: number, side: -1 | 1) => {
    let node = tree.resolve(pos, side)
    while (node.parent && node.parent.parent) node = node.parent
    return node.parent ? node : null
  }
  return { from: Math.min(from, outer(from, -1)?.from ?? from), to: Math.max(to, outer(to, 1)?.to ?? to) }
}

/**
 * Rescans only the top-level blocks an edit touched, in the old tree and the new one, so an edit that opens or
 * closes a fence still rescans everything the fence swallowed or let go.
 */
function rescan(blocks: Blocks, transaction: Transaction) {
  const { state, startState, changes } = transaction
  if (!changes.empty && syntaxTree(state).length < state.doc.length) return scan(state)
  let from = state.doc.length
  let to = 0
  changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    const before = topLevel(startState, fromA, toA)
    const after = topLevel(state, fromB, toB)
    from = Math.min(from, after.from, changes.mapPos(before.from, -1))
    to = Math.max(to, after.to, changes.mapPos(before.to, 1))
  })
  if (from > to) return scan(state)
  const outside = (span: Span) => span.to < from || span.from > to
  const map = (span: Span) => ({ from: changes.mapPos(span.from, 1), to: changes.mapPos(span.to, -1) })
  const found = scan(state, from, to)
  const merge = (old: Span[], fresh: Span[]) =>
    [...old.map(map).filter(outside), ...fresh].toSorted((a, b) => a.from - b.from)
  return { tables: merge(blocks.tables, found.tables), underlines: merge(blocks.underlines, found.underlines) }
}

/** The tables to render and the underlines to hide, given where the selection is. */
function plan(state: EditorState, tables: Span[], underlines: Span[]) {
  const ranges = state.readOnly ? [] : state.selection.ranges
  const touched = (from: number, to: number) => ranges.some((range) => range.from <= to && range.to >= from)
  const shown: Block[] = []
  const yamlEnd = frontmatterEnd(state)
  if (state.facet(previewConfig).portals) {
    for (const table of tables) {
      if (table.from > yamlEnd && !touched(table.from, table.to)) shown.push({ ...table, table: true })
    }
  }
  for (const underline of underlines) {
    if (underline.from <= yamlEnd) continue
    const current = state.doc.lineAt(underline.from)
    if (current.number > 1 && !touched(current.from, current.to)) {
      shown.push({ from: current.from - 1, to: current.to, table: false })
    }
  }
  return shown.toSorted((a, b) => a.from - b.from)
}

// Block widgets and hidden line breaks may only come from a state field, not from a view plugin.
function decorate(state: EditorState, shown: Block[]) {
  const portals = state.facet(previewConfig).portals
  const decorations: Range<Decoration>[] = shown.map((block) => {
    if (!block.table || !portals) return hideUnderline.range(block.from, block.to)
    const rows = state.doc.lineAt(block.to).number - state.doc.lineAt(block.from).number
    const widget = new TableWidget(state.sliceDoc(block.from, block.to), portals, rows)
    return Decoration.replace({ widget, block: true }).range(block.from, block.to)
  })
  return Decoration.set(decorations)
}

const blockPreview = StateField.define<Blocks>({
  create(state) {
    const { tables, underlines } = scan(state)
    const shown = plan(state, tables, underlines)
    return { tables, underlines, shown, decorations: decorate(state, shown) }
  },
  update(blocks, transaction: Transaction) {
    const { state, startState } = transaction
    if (transaction.isUserEvent("input.type.compose")) {
      return { ...blocks, decorations: blocks.decorations.map(transaction.changes) }
    }
    const reparsed = syntaxTree(startState) !== syntaxTree(state)
    const reconfigured = startState.facet(previewConfig) !== state.facet(previewConfig)
    if (!reparsed && !transaction.docChanged && !reconfigured && !transaction.selection) {
      if (startState.readOnly === state.readOnly) return blocks
    }
    // A parse that moved on without an edit can change structure anywhere, so it gets a full scan.
    const { tables, underlines } = transaction.docChanged
      ? rescan(blocks, transaction)
      : reparsed
        ? scan(state)
        : blocks
    const shown = plan(state, tables, underlines)
    // Most transactions leave every rendered block as it was, so the widgets are mapped instead of rebuilt.
    const { changes } = transaction
    const same =
      !reconfigured &&
      shown.length === blocks.shown.length &&
      blocks.shown.every((block, index) => {
        const next = shown[index]!
        if (block.table && changes.touchesRange(block.from, block.to)) return false
        return (
          next.table === block.table && next.from === changes.mapPos(block.from) && next.to === changes.mapPos(block.to)
        )
      })
    const decorations = same ? blocks.decorations.map(changes) : decorate(state, shown)
    return { tables, underlines, shown, decorations }
  },
  provide: (field) => [
    EditorView.decorations.from(field, (blocks) => blocks.decorations),
    EditorView.atomicRanges.of((view) => view.state.field(field).decorations),
    EditorView.domEventHandlers({ mousedown: selectTableCell }),
  ],
})

/** A press on a rendered table puts the caret in the cell it hit, which shows the table's source. */
function selectTableCell(event: MouseEvent, view: EditorView) {
  const target = event.target instanceof Element ? event.target : null
  const host = target?.closest<HTMLElement>("[data-slot=markdown-table-widget]")
  if (!host || event.button !== 0) return false
  const cell = target?.closest<HTMLElement>("[data-source-from]")
  const pos = Math.min(view.posAtDOM(host) + Number(cell?.dataset.sourceFrom ?? 0), view.state.doc.length)
  view.dispatch({ selection: EditorSelection.cursor(pos), userEvent: "select.pointer" })
  view.focus()
  event.preventDefault()
  return true
}

export { blockPreview }
