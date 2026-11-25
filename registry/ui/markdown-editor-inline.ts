import { syntaxTree } from "@codemirror/language"
import type { EditorState, Range } from "@codemirror/state"
import { Decoration } from "@codemirror/view"
import type { SyntaxNode } from "@lezer/common"

import type { Span } from "@/components/ui/markdown-editor-structure"
import { CodeLanguageWidget, EmbedWidget, LabelWidget, type PortalStore } from "@/components/ui/markdown-editor-widgets"
import type { WikilinkResolver } from "@/components/ui/markdown-syntax"

const hidden = Decoration.replace({})
const cache = new Map<string, Decoration>()
function mark(attributes: Record<string, string>) {
  const key = JSON.stringify(attributes)
  let decoration = cache.get(key)
  if (!decoration) cache.set(key, (decoration = Decoration.mark({ attributes })))
  return decoration
}
function line(attributes: Record<string, string>) {
  const key = `line${JSON.stringify(attributes)}`
  let decoration = cache.get(key)
  if (!decoration) cache.set(key, (decoration = Decoration.line({ attributes })))
  return decoration
}
const slot = (name: string, extra: Record<string, string> = {}) => mark({ "data-slot": name, ...extra })
const syntax = slot("markdown-syntax")

const SPANS: Record<string, { slot: string; marks: string[] }> = {
  Emphasis: { slot: "markdown-emphasis", marks: ["EmphasisMark"] },
  StrongEmphasis: { slot: "markdown-strong", marks: ["EmphasisMark"] },
  Strikethrough: { slot: "markdown-strike", marks: ["StrikethroughMark"] },
  InlineCode: { slot: "markdown-code", marks: ["CodeMark"] },
  Link: { slot: "markdown-link", marks: ["LinkMark", "URL", "LinkTitle", "LinkLabel"] },
  Image: { slot: "markdown-link", marks: ["LinkMark", "URL", "LinkTitle", "LinkLabel"] },
  Autolink: { slot: "markdown-link", marks: ["LinkMark"] },
}
const SPAN_MARKS = new Set(Object.values(SPANS).flatMap((span) => span.marks))
const HTML = new Set(["HTMLTag", "HTMLBlock", "Comment", "ProcessingInstruction"])

type TreeContext = {
  state: EditorState
  ranges: Range<Decoration>[]
  revealed: (from: number, to: number) => boolean
  resolve?: WikilinkResolver
  portals?: PortalStore
  /** Whether `![[target]]` off the caret shows a preview widget instead of its text. */
  embeds?: boolean
}

function decorateTree(context: TreeContext, from: number, to: number) {
  const { state, ranges, revealed } = context
  const doc = state.doc
  // Spec: a CodeMirror plugin may not hide a line break, and syntax such as a link title can span lines.
  const hide = (start: number, end: number) => {
    for (let pos = start; pos < end;) {
      const current = doc.lineAt(pos)
      const stop = Math.min(end, current.to)
      if (stop > pos) ranges.push(hidden.range(pos, stop))
      pos = current.to + 1
    }
  }
  const eachLine = (start: number, end: number, decoration: Decoration) => {
    for (let pos = start; pos <= end;) {
      const current = doc.lineAt(pos)
      ranges.push(decoration.range(current.from))
      pos = current.to + 1
    }
  }

  syntaxTree(state).iterate({
    from,
    to,
    enter(ref) {
      const node = ref.node
      const heading = /^(ATX|Setext)Heading(\d)$/.exec(node.name)
      if (heading) {
        const textEnd = heading[1] === "Setext" ? (node.lastChild?.from ?? node.to) - 1 : node.to
        eachLine(node.from, Math.max(node.from, textEnd), line({ "data-md-heading": heading[2] ?? "1" }))
        return undefined
      }
      const span = SPANS[node.name]
      if (span) {
        ranges.push(slot(span.slot).range(node.from, node.to))
        const show = revealed(node.from, node.to)
        for (let child = node.firstChild; child; child = child.nextSibling) {
          if (!span.marks.includes(child.name)) continue
          if (show) ranges.push(syntax.range(child.from, child.to))
          else hide(child.from, child.to)
        }
        return undefined
      }
      switch (node.name) {
        case "HeaderMark":
          if (node.parent?.name.startsWith("Setext")) ranges.push(syntax.range(node.from, node.to))
          else if (node.prevSibling) {
            let start = node.from
            while (start > 0 && doc.sliceString(start - 1, start) === " ") start--
            hide(start, node.to)
          }
          return false
        case "Escape":
          if (!revealed(node.from, node.to)) hide(node.from, node.from + 1)
          return false
        case "Wikilink":
          decorateWikilink(context, node, hide)
          return false
        case "Embed":
          decorateEmbed(context, node, hide)
          return false
        case "FencedCode":
          decorateFence(context, node, hide)
          return false
        case "CodeBlock":
          eachLine(node.from, node.to, line({ "data-md-code": "" }))
          return false
        case "HorizontalRule":
          ranges.push(line({ "data-md-rule": "" }).range(doc.lineAt(node.from).from))
          if (!revealed(node.from, node.to)) hide(node.from, node.to)
          return false
        case "Table":
          decorateTable(context, node)
          return false
        case "LinkReference":
          ranges.push(syntax.range(node.from, node.to))
          return false
        default:
          if (HTML.has(node.name)) {
            ranges.push(slot("markdown-html").range(node.from, node.to))
            return false
          }
          return SPAN_MARKS.has(node.name) ? false : undefined
      }
    },
  })
}

function decorateFence(context: TreeContext, node: SyntaxNode, hide: (from: number, to: number) => void) {
  const { state, ranges, revealed } = context
  const doc = state.doc
  const open = node.firstChild
  const close = node.lastChild?.name === "CodeMark" && node.lastChild !== open ? node.lastChild : null
  const openLine = doc.lineAt(node.from)
  const closeLine = close ? doc.lineAt(close.from) : null
  for (let pos = node.from; pos <= node.to;) {
    const current = doc.lineAt(pos)
    const fence = current.number === openLine.number ? "open" : current.number === closeLine?.number ? "close" : ""
    ranges.push(line({ "data-md-code": fence }).range(current.from))
    pos = current.to + 1
  }
  if (open?.name !== "CodeMark") return
  const info = node.getChild("CodeInfo")
  if (revealed(openLine.from, openLine.to)) {
    ranges.push(syntax.range(open.from, info?.to ?? open.to))
  } else if (context.portals) {
    const widget = new CodeLanguageWidget(info ? state.sliceDoc(info.from, info.to) : "", context.portals)
    ranges.push(Decoration.replace({ widget }).range(open.from, openLine.to))
  } else {
    hide(open.from, openLine.to)
  }
  if (close && closeLine) {
    if (revealed(closeLine.from, closeLine.to)) ranges.push(syntax.range(close.from, close.to))
    else hide(close.from, closeLine.to)
  }
}

function decorateTable(context: TreeContext, table: SyntaxNode) {
  const { state, ranges } = context
  const doc = state.doc
  const cell = (from: number, to: number, column: number) => {
    if (to <= from) return
    const attributes = { "data-slot": "markdown-table-cell", "data-md-table-id": String(table.from) }
    ranges.push(mark({ ...attributes, "data-md-column": String(column) }).range(from, to))
  }
  for (let row = table.firstChild; row; row = row.nextSibling) {
    const current = doc.lineAt(row.from)
    if (row.name === "TableDelimiter") {
      ranges.push(line({ "data-md-table": "delimiter" }).range(current.from))
      const text = state.sliceDoc(row.from, row.to)
      let column = text.startsWith("|") ? -1 : 0
      let start = row.from
      for (let index = 0; index <= text.length; index++) {
        if (index < text.length && text[index] !== "|") continue
        const pos = row.from + index
        if (column >= 0) cell(start, pos, column)
        if (index < text.length) ranges.push(syntax.range(pos, pos + 1))
        column++
        start = pos + 1
      }
      continue
    }
    if (row.name !== "TableHeader" && row.name !== "TableRow") continue
    ranges.push(line({ "data-md-table": row.name === "TableHeader" ? "header" : "row" }).range(current.from))
    const pipes = row.getChildren("TableDelimiter")
    let start = row.from
    let column = pipes[0]?.from === row.from ? -1 : 0
    for (const pipe of [...pipes, null]) {
      const end = pipe ? pipe.from : row.to
      if (column >= 0 && (pipe || end > start)) cell(start, end, column)
      if (pipe) ranges.push(syntax.range(pipe.from, pipe.to))
      column++
      start = pipe ? pipe.to : end
    }
  }
}

function decorateWikilink(context: TreeContext, node: SyntaxNode, hide: (from: number, to: number) => void) {
  const { state, ranges } = context
  const target = node.getChild("WikilinkTarget")
  if (!target) return
  const slug = state.sliceDoc(target.from, target.to).trim()
  const resolution = context.resolve?.(slug) ?? { exists: true }
  ranges.push(slot("markdown-wikilink", resolution.exists ? {} : { "data-unresolved": "" }).range(node.from, node.to))
  const label = node.getChild("WikilinkLabel")
  const show = context.revealed(node.from, node.to)
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const isSyntax = child.name === "WikilinkMark" || child.name === "WikilinkPipe"
    if (show) {
      if (isSyntax) ranges.push(syntax.range(child.from, child.to))
    } else if (isSyntax || (child.name === "WikilinkTarget" && label)) {
      hide(child.from, child.to)
    } else if (child.name === "WikilinkTarget" && resolution.label && resolution.label !== slug) {
      ranges.push(Decoration.replace({ widget: new LabelWidget(resolution.label) }).range(child.from, child.to))
    }
  }
}

function decorateEmbed(context: TreeContext, node: SyntaxNode, hide: (from: number, to: number) => void) {
  const { state, ranges, portals } = context
  const target = node.getChild("WikilinkTarget")
  if (!target) return
  const slug = state.sliceDoc(target.from, target.to).trim()
  const labelNode = node.getChild("WikilinkLabel")
  const alias = labelNode ? state.sliceDoc(labelNode.from, labelNode.to) : undefined
  const show = context.revealed(node.from, node.to)
  if (!show && context.embeds && portals) {
    const widget = new EmbedWidget(slug, alias, portals)
    ranges.push(Decoration.replace({ widget }).range(node.from, node.to))
    return
  }
  const resolution = context.resolve?.(slug) ?? { exists: true }
  ranges.push(slot("markdown-embed", resolution.exists ? {} : { "data-unresolved": "" }).range(node.from, node.to))
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const isSyntax = child.name === "EmbedMark" || child.name === "WikilinkPipe"
    if (show) {
      if (isSyntax) ranges.push(syntax.range(child.from, child.to))
    } else if (isSyntax || (child.name === "WikilinkTarget" && labelNode)) {
      hide(child.from, child.to)
    }
  }
}

export { decorateTree, hidden, line, slot }
export type { Span, TreeContext }
