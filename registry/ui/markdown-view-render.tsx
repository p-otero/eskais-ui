import { TreeFragment, type SyntaxNode, type Tree } from "@lezer/common"
import type { ReactNode } from "react"

import { markdownParser, type WikilinkResolver } from "@/components/ui/markdown-syntax"

type RenderOptions = {
  resolveWikilink?: WikilinkResolver
  wikilinkHref?: (slug: string) => string | undefined
  taskLabel: string
  /** Puts each table cell's offset in the source on `data-source-from`. */
  sourcePositions?: boolean
}

type Context = RenderOptions & { src: string; refs: Map<string, { href: string; title?: string }> }

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  hellip: "…",
  mdash: "—",
  ndash: "–",
}

function decodeEntity(entity: string) {
  const numeric = /^&#(x?)([0-9a-f]+);$/i.exec(entity)
  if (numeric) {
    const code = Number.parseInt(numeric[2] ?? "", numeric[1] ? 16 : 10)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "�"
  }
  return ENTITIES[entity.slice(1, -1)] ?? entity
}

const unescape = (text: string) =>
  text.replace(/\\([!-/:-@[-`{-~])/g, "$1").replace(/&(?:#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, decodeEntity)

/** Only these schemes become links; anything else, like `javascript:`, renders as plain text. */
function safeHref(raw: string) {
  const href = unescape(raw.trim().replace(/^<|>$/g, ""))
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec([...href].filter((char) => char > " ").join(""))?.[1]?.toLowerCase()
  return !scheme || ["http", "https", "mailto", "tel"].includes(scheme) ? href : undefined
}

const normalizeLabel = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase()
const slice = (cx: Context, node: { from: number; to: number }) => cx.src.slice(node.from, node.to)
const children = (node: SyntaxNode) => {
  const list: SyntaxNode[] = []
  for (let child = node.firstChild; child; child = child.nextSibling) list.push(child)
  return list
}

function inline(cx: Context, node: SyntaxNode, from = node.from, to = node.to, skip = new Set<string>()): ReactNode[] {
  const out: ReactNode[] = []
  let pos = from
  for (const child of children(node)) {
    if (child.to <= from || child.from >= to) continue
    if (child.from > pos) out.push(cx.src.slice(pos, child.from))
    if (!skip.has(child.name) && child.name !== "QuoteMark") out.push(renderInline(cx, child))
    pos = child.to
  }
  if (pos < to) out.push(cx.src.slice(pos, to))
  return out
}

function linkParts(cx: Context, node: SyntaxNode) {
  const marks = node.getChildren("LinkMark")
  const labelFrom = marks[0]?.to ?? node.from
  const labelTo = marks[1]?.from ?? node.to
  const url = node.getChild("URL")
  const title = node.getChild("LinkTitle")
  if (url)
    return {
      labelFrom,
      labelTo,
      href: safeHref(slice(cx, url)),
      title: title ? unescape(slice(cx, title).slice(1, -1)) : undefined,
      found: true,
    }
  const reference = node.getChild("LinkLabel")
  const key = normalizeLabel(
    reference && reference.to - reference.from > 2
      ? slice(cx, reference).slice(1, -1)
      : cx.src.slice(labelFrom, labelTo),
  )
  const ref = cx.refs.get(key)
  return { labelFrom, labelTo, href: ref ? safeHref(ref.href) : undefined, title: ref?.title, found: Boolean(ref) }
}

function renderInline(cx: Context, node: SyntaxNode): ReactNode {
  const key = node.from
  switch (node.name) {
    case "Emphasis":
      return <em key={key}>{inline(cx, node, node.from, node.to, new Set(["EmphasisMark"]))}</em>
    case "StrongEmphasis":
      return <strong key={key}>{inline(cx, node, node.from, node.to, new Set(["EmphasisMark"]))}</strong>
    case "Strikethrough":
      return <del key={key}>{inline(cx, node, node.from, node.to, new Set(["StrikethroughMark"]))}</del>
    case "InlineCode": {
      const marks = node.getChildren("CodeMark")
      let text = cx.src.slice(marks[0]?.to ?? node.from, marks[1]?.from ?? node.to).replace(/\r?\n/g, " ")
      if (/^ .*[^ ].* $/s.test(text)) text = text.slice(1, -1)
      return <code key={key}>{text}</code>
    }
    case "Link":
    case "Image": {
      const parts = linkParts(cx, node)
      if (!parts.found) return slice(cx, node)
      const label = inline(
        cx,
        node,
        parts.labelFrom,
        parts.labelTo,
        new Set(["LinkMark", "URL", "LinkTitle", "LinkLabel"]),
      )
      if (node.name === "Image") {
        return (
          <img
            key={key}
            src={parts.href}
            alt={cx.src.slice(parts.labelFrom, parts.labelTo)}
            title={parts.title}
            loading="lazy"
          />
        )
      }
      return parts.href === undefined ? (
        <span key={key}>{label}</span>
      ) : (
        <a key={key} href={parts.href} title={parts.title}>
          {label}
        </a>
      )
    }
    case "Autolink": {
      const url = node.getChild("URL")
      const text = url ? slice(cx, url) : slice(cx, node)
      const href = safeHref(/^[^\s@:]+@/.test(text) ? `mailto:${text}` : text)
      return href ? (
        <a key={key} href={href}>
          {text}
        </a>
      ) : (
        text
      )
    }
    case "Escape":
      return cx.src.slice(node.from + 1, node.to)
    case "Entity":
      return decodeEntity(slice(cx, node))
    case "HardBreak":
      return <br key={key} />
    case "Wikilink": {
      const target = node.getChild("WikilinkTarget")
      const slug = target ? slice(cx, target).trim() : ""
      const labelNode = node.getChild("WikilinkLabel")
      const resolution = cx.resolveWikilink?.(slug) ?? { exists: true }
      const text = labelNode ? slice(cx, labelNode) : (resolution.label ?? slug)
      const href = resolution.exists ? cx.wikilinkHref?.(slug) : undefined
      const props = { "data-slot": "markdown-wikilink", "data-unresolved": resolution.exists ? undefined : "" }
      return href ? (
        <a key={key} href={href} {...props}>
          {text}
        </a>
      ) : (
        <span key={key} {...props}>
          {text}
        </span>
      )
    }
    default:
      return slice(cx, node)
  }
}

function isTight(cx: Context, list: SyntaxNode) {
  const items = children(list)
  return items.every((item, index) => {
    const next = items[index + 1]
    if (next && /\n[ \t]*\r?\n/.test(cx.src.slice(item.to, next.from))) return false
    const parts = children(item).filter((child) => child.name !== "ListMark")
    return parts.every((part, i) => !parts[i + 1] || !/\n[ \t]*\r?\n/.test(cx.src.slice(part.to, parts[i + 1]!.from)))
  })
}

function blocks(cx: Context, node: SyntaxNode, tight = false): ReactNode[] {
  return children(node).map((child) => renderBlock(cx, child, tight))
}

function renderBlock(cx: Context, node: SyntaxNode, tight = false): ReactNode {
  const key = node.from
  const heading = /^(ATX|Setext)Heading(\d)$/.exec(node.name)
  if (heading) {
    const Tag = `h${heading[2]}` as "h1"
    const marks = node.getChildren("HeaderMark")
    const from = heading[1] === "ATX" ? (marks[0]?.to ?? node.from) : node.from
    const to = heading[1] === "ATX" ? (marks[1]?.from ?? node.to) : (marks[0]?.from ?? node.to)
    return <Tag key={key}>{trim(inline(cx, node, from, to, new Set(["HeaderMark"])))}</Tag>
  }
  switch (node.name) {
    case "Paragraph":
      return tight ? <span key={key}>{trim(inline(cx, node))}</span> : <p key={key}>{trim(inline(cx, node))}</p>
    case "Blockquote":
      return <blockquote key={key}>{blocks(cx, node)}</blockquote>
    case "BulletList":
      return <ul key={key}>{blocks(cx, node, isTight(cx, node))}</ul>
    case "OrderedList": {
      const start = Number.parseInt(slice(cx, node.getChild("ListItem")?.getChild("ListMark") ?? node), 10)
      return (
        <ol key={key} start={start === 1 || Number.isNaN(start) ? undefined : start}>
          {blocks(cx, node, isTight(cx, node))}
        </ol>
      )
    }
    case "ListItem":
      return <li key={key}>{blocks(cx, node, tight)}</li>
    case "Task": {
      const marker = node.getChild("TaskMarker")
      const checked = marker ? /x/i.test(slice(cx, marker)) : false
      return (
        <span key={key} data-slot="markdown-view-task">
          <input type="checkbox" checked={checked} readOnly disabled aria-label={cx.taskLabel} />
          <span>{trim(inline(cx, node, marker?.to ?? node.from, node.to, new Set(["TaskMarker"])))}</span>
        </span>
      )
    }
    case "FencedCode": {
      const info = node.getChild("CodeInfo")
      const text = node.getChild("CodeText")
      return (
        <pre key={key}>
          <code data-language={info ? slice(cx, info) : undefined}>{text ? slice(cx, text) + "\n" : ""}</code>
        </pre>
      )
    }
    case "CodeBlock":
      return (
        <pre key={key}>
          <code>{slice(cx, node).replace(/^( {1,4}|\t)/gm, "") + "\n"}</code>
        </pre>
      )
    case "HorizontalRule":
      return <hr key={key} />
    case "Table":
      return renderTable(cx, node)
    case "LinkReference":
    case "ListMark":
    case "QuoteMark":
      return null
    default:
      return (
        <pre key={key} data-slot="markdown-view-raw">
          {slice(cx, node)}
        </pre>
      )
  }
}

function renderTable(cx: Context, node: SyntaxNode) {
  const header = node.getChild("TableHeader")
  const delimiter = node.getChild("TableDelimiter")
  const delimiterLine = delimiter ? slice(cx, delimiter) : ""
  const align = delimiterLine
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => {
      const value = cell.trim()
      if (value.startsWith(":") && value.endsWith(":")) return "center" as const
      if (value.endsWith(":")) return "right" as const
      return value.startsWith(":") ? ("left" as const) : undefined
    })
  const columns = align.map((textAlign, column) => ({ textAlign, column }))
  const cells = (row: SyntaxNode, Tag: "th" | "td") => {
    const list = row.getChildren("TableCell")
    return columns.map(({ textAlign, column }) => {
      const cell = list[column]
      return (
        <Tag
          key={column}
          style={textAlign ? { textAlign } : undefined}
          data-source-from={cx.sourcePositions ? (cell?.from ?? row.from) : undefined}
        >
          {cell ? trim(inline(cx, cell)) : null}
        </Tag>
      )
    })
  }
  return (
    <table key={node.from}>
      {header && (
        <thead>
          <tr>{cells(header, "th")}</tr>
        </thead>
      )}
      <tbody>
        {node.getChildren("TableRow").map((row) => (
          <tr key={row.from}>{cells(row, "td")}</tr>
        ))}
      </tbody>
    </table>
  )
}

function trim(nodes: ReactNode[]) {
  const first = nodes[0]
  if (typeof first === "string") nodes[0] = first.trimStart()
  const last = nodes.at(-1)
  if (typeof last === "string") nodes[nodes.length - 1] = last.trimEnd()
  return nodes
}

function collectReferences(cx: Context, top: SyntaxNode) {
  top.cursor().iterate((ref) => {
    if (ref.name !== "LinkReference") return
    const node = ref.node
    const label = node.getChild("LinkLabel")
    const url = node.getChild("URL")
    const title = node.getChild("LinkTitle")
    if (!label || !url) return false
    const key = normalizeLabel(slice(cx, label).slice(1, -1))
    if (!cx.refs.has(key))
      cx.refs.set(key, { href: slice(cx, url), title: title ? unescape(slice(cx, title).slice(1, -1)) : undefined })
    return false
  })
}

function hash(text: string) {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 0x01000193)
  return (value >>> 0).toString(36)
}

type MarkdownBlock = { key: string; text: string; render: () => ReactNode }

/**
 * Parses once and returns the top-level blocks, each keyed by a hash of its source and how many identical
 * blocks came before it, so a key survives edits elsewhere in the document.
 */
type Parsed = { src: string; tree: Tree }

/** Reuses the previous parse for everything outside the one edited range, as an editor's parse does. */
function parse(src: string, previous?: Parsed) {
  if (!previous) return markdownParser.parse(src)
  const old = previous.src
  const max = Math.min(old.length, src.length)
  let start = 0
  while (start < max && old.charCodeAt(start) === src.charCodeAt(start)) start++
  let end = 0
  while (end < max - start && old.charCodeAt(old.length - 1 - end) === src.charCodeAt(src.length - 1 - end)) end++
  const change = { fromA: start, toA: old.length - end, fromB: start, toB: src.length - end }
  const fragments = TreeFragment.applyChanges(TreeFragment.addTree(previous.tree), [change])
  return markdownParser.parse(src, fragments)
}

function markdownBlocks(src: string, options: RenderOptions, previous?: Parsed) {
  const tree = previous?.src === src ? previous.tree : parse(src, previous)
  const cx: Context = { ...options, src, refs: new Map() }
  collectReferences(cx, tree.topNode)
  const seen = new Map<string, number>()
  const list: MarkdownBlock[] = children(tree.topNode).map((node) => {
    const text = slice(cx, node)
    const digest = hash(text)
    const count = seen.get(digest) ?? 0
    seen.set(digest, count + 1)
    return { key: `${digest}.${count}`, text, render: () => renderBlock(cx, node) }
  })
  const references = hash(JSON.stringify([...cx.refs]))
  return { blocks: list, references, parsed: { src, tree } satisfies Parsed }
}

function renderMarkdown(src: string, options: RenderOptions): ReactNode[] {
  return markdownBlocks(src, options).blocks.map((block) => block.render())
}

export { markdownBlocks, renderMarkdown, safeHref }
export type { MarkdownBlock, Parsed, RenderOptions }
