import { syntaxTree } from "@codemirror/language"
import { Facet, StateEffect, type EditorState, type Range } from "@codemirror/state"
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type PluginValue,
  type ViewUpdate,
} from "@codemirror/view"

import { decorateTree, hidden, line, slot } from "@/components/ui/markdown-editor-inline"
import { blockMarks, lineStructure, type Span } from "@/components/ui/markdown-editor-structure"
import { BulletWidget, TaskWidget, type PortalStore } from "@/components/ui/markdown-editor-widgets"
import type { WikilinkResolver } from "@/components/ui/markdown-syntax"

type PreviewConfig = { resolve?: WikilinkResolver; taskLabel: string; portals?: PortalStore }

const previewConfig = Facet.define<PreviewConfig, PreviewConfig>({
  combine: (values) => values[0] ?? { taskLabel: "Task done" },
})

const refreshReveal = StateEffect.define<null>()
const bullet = Decoration.replace({ widget: new BulletWidget() })

function selectionSpans(state: EditorState): Span[] {
  if (state.readOnly) return []
  return state.selection.ranges.map((range) => ({ from: range.from, to: range.to }))
}

function decorateLines(state: EditorState, from: number, to: number, config: PreviewConfig) {
  const ranges: Range<Decoration>[] = []
  const atomic: Range<Decoration>[] = []
  const marks = blockMarks(state, from, to)
  for (let pos = from; pos <= to;) {
    const current = state.doc.lineAt(pos)
    pos = current.to + 1
    const structure = lineStructure(state, current, marks)
    const attributes: Record<string, string> = {}
    if (structure.depth) attributes["data-md-depth"] = String(Math.min(structure.depth, 8))
    if (structure.bullet || structure.ordered || structure.task) attributes["data-md-item"] = ""
    if (structure.quote) attributes["data-md-quote"] = String(Math.min(structure.quote, 4))
    if (Object.keys(attributes).length) ranges.push(line(attributes).range(current.from))
    for (const span of structure.hidden) if (span.to > span.from) ranges.push(hidden.range(span.from, span.to))
    if (structure.bullet) {
      const decoration = structure.task ? hidden : bullet
      ranges.push(decoration.range(structure.bullet.from, structure.bullet.to))
    }
    if (structure.ordered) ranges.push(slot("markdown-list-number").range(structure.ordered.from, structure.ordered.to))
    const { task } = structure
    if (task) {
      const widget = new TaskWidget(task.checked, config.taskLabel)
      ranges.push(Decoration.replace({ widget }).range(task.from, task.to))
      if (task.from >= structure.hiddenEnd) atomic.push(hidden.range(task.from, task.to))
    }
    if (structure.hiddenEnd > current.from) atomic.push(hidden.range(current.from, structure.hiddenEnd))
  }
  return { ranges, atomic }
}

class Preview implements PluginValue {
  decorations: DecorationSet = Decoration.none
  atomic: DecorationSet = Decoration.none
  private reveal: Span[]
  private measuring = false

  constructor(readonly view: EditorView) {
    this.reveal = selectionSpans(view.state)
    this.build()
  }

  update(update: ViewUpdate) {
    const refresh = update.transactions.some((tr) => tr.effects.some((effect) => effect.is(refreshReveal)))
    const configChanged = update.startState.facet(previewConfig) !== update.state.facet(previewConfig)
    // While an IME composes, the decorations around the caret must stay put or the composition breaks.
    if (update.view.composing && !refresh) {
      this.reveal = this.reveal.map((span) => ({
        from: update.changes.mapPos(span.from, -1),
        to: update.changes.mapPos(span.to, 1),
      }))
    } else if (update.selectionSet || update.docChanged || configChanged || refresh) {
      this.reveal = selectionSpans(update.state)
    }
    if (
      update.docChanged ||
      update.viewportChanged ||
      update.selectionSet ||
      refresh ||
      configChanged ||
      syntaxTree(update.startState) !== syntaxTree(update.state)
    ) {
      this.build()
    }
  }

  private build() {
    const { view } = this
    const { state } = view
    const config = state.facet(previewConfig)
    const ranges: Range<Decoration>[] = []
    const atomic: Range<Decoration>[] = []
    const reveal = this.reveal
    const revealed = (from: number, to: number) => reveal.some((span) => span.from <= to && span.to >= from)
    for (const { from, to } of view.visibleRanges) {
      const lines = decorateLines(state, from, to, config)
      ranges.push(...lines.ranges)
      atomic.push(...lines.atomic)
      decorateTree({ state, ranges, revealed, resolve: config.resolve, portals: config.portals }, from, to)
    }
    this.decorations = Decoration.set(ranges, true)
    this.atomic = Decoration.set(atomic, true)
    if (!this.measuring && ranges.some((range) => range.value.spec.attributes?.["data-md-table-id"])) {
      this.measuring = true
      view.requestMeasure({ key: this, read: () => this.readColumns(), write: (widths) => this.alignColumns(widths) })
    }
  }

  // Columns line up by giving every cell its column's widest text, measured from the text itself so the min-width
  // never feeds back; it's set through the CSSOM because a style attribute is blocked under a strict CSP.
  private readColumns() {
    this.measuring = false
    const cells = [...this.view.contentDOM.querySelectorAll<HTMLElement>("[data-md-table-id]")]
    const widths = new Map<string, number>()
    const range = document.createRange()
    for (const cell of cells) {
      range.selectNodeContents(cell)
      const key = `${cell.dataset.mdTableId}:${cell.dataset.mdColumn}`
      widths.set(key, Math.max(widths.get(key) ?? 0, range.getBoundingClientRect().width))
    }
    return { cells, widths }
  }

  private alignColumns({ cells, widths }: ReturnType<Preview["readColumns"]>) {
    for (const cell of cells) {
      const width = widths.get(`${cell.dataset.mdTableId}:${cell.dataset.mdColumn}`) ?? 0
      cell.style.minWidth = width ? `${Math.ceil(width)}px` : ""
    }
  }
}

const livePreview = ViewPlugin.fromClass(Preview, {
  decorations: (plugin) => plugin.decorations,
  provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? Decoration.none),
  eventHandlers: {
    mousedown(event, view) {
      const target = event.target
      if (!(target instanceof HTMLInputElement) || target.dataset.slot !== "markdown-task") return false
      if (view.state.readOnly) return true
      return toggleTaskAt(view, view.posAtDOM(target))
    },
    compositionend(_event, view) {
      setTimeout(() => view.dom.isConnected && view.dispatch({ effects: refreshReveal.of(null) }))
    },
  },
})

function toggleTaskAt(view: EditorView, pos: number) {
  const text = view.state.doc.sliceString(pos, pos + 3)
  const match = /^\[([ xX])\]$/.exec(text)
  if (!match) return false
  view.dispatch({
    changes: { from: pos + 1, to: pos + 2, insert: match[1] === " " ? "x" : " " },
    userEvent: "input.toggle",
  })
  return true
}

export { livePreview, previewConfig, toggleTaskAt }
export type { PreviewConfig }
