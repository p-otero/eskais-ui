import type { SyntaxNode, Tree } from "@lezer/common"

import { frontmatterBounds } from "@/components/ui/markdown-frontmatter"
import { markdownParser } from "@/components/ui/markdown-syntax"

type MarkdownHeading = {
  level: number
  /** The heading as plain text: marks dropped, a wikilink as its label. */
  text: string
  /**
   * Its anchor, unique in the document: the text lowercased, punctuation dropped, spaces as `-`, and `-1`, `-2`…
   * after a repeat. `MarkdownView` puts it on the rendered heading as `data-slug`.
   */
  slug: string
  /** The line it starts on, from 1, as the editor counts lines. */
  line: number
  /** Offsets in the Markdown: the heading's start and end, and where its text starts after the `#` marks. */
  from: number
  to: number
  textFrom: number
}

const MARKS = new Set([
  "HeaderMark",
  "EmphasisMark",
  "CodeMark",
  "LinkMark",
  "URL",
  "LinkTitle",
  "LinkLabel",
  "StrikethroughMark",
  "WikilinkMark",
  "WikilinkPipe",
  "EmbedMark",
])

function plainText(src: string, node: SyntaxNode, from = node.from, to = node.to): string {
  if (node.name === "Wikilink" || node.name === "Embed") {
    const label = node.getChild("WikilinkLabel") ?? node.getChild("WikilinkTarget")
    return label ? src.slice(label.from, label.to) : ""
  }
  if (node.name === "Escape") return src.slice(node.from + 1, node.to)
  let text = ""
  let pos = from
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.to <= from || child.from >= to) continue
    text += src.slice(pos, child.from)
    if (!MARKS.has(child.name)) text += plainText(src, child)
    pos = child.to
  }
  return text + src.slice(pos, to)
}

const HEADING_CONTAINERS = new Set(["Document", "Blockquote", "BulletList", "OrderedList", "ListItem"])

function slugify(text: string) {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-")
  return slug || "heading"
}

// Spec: GitHub's anchors: a slug already taken gets `-1`, `-2`… after it, in document order.
function createSlugger() {
  const counts = new Map<string, number>()
  return (text: string) => {
    const base = slugify(text)
    let slug = base
    while (counts.has(slug)) {
      const count = (counts.get(base) ?? 0) + 1
      counts.set(base, count)
      slug = `${base}-${String(count)}`
    }
    counts.set(slug, 0)
    return slug
  }
}

/** Every heading of a Markdown document in order, frontmatter left out, for an outline or a table of contents. */
function extractHeadings(markdown: string): MarkdownHeading[] {
  return headingsOf(markdown, markdownParser.parse(markdown))
}

/** The headings of `markdown` from its parse tree, as `extractHeadings` gives them. */
function headingsOf(markdown: string, tree: Tree): MarkdownHeading[] {
  const slug = createSlugger()
  const start = frontmatterBounds(markdown)?.to ?? 0
  const headings: MarkdownHeading[] = []
  let line = 1
  let counted = 0
  const lineAt = (pos: number) => {
    for (
      let index = markdown.indexOf("\n", counted);
      index >= 0 && index < pos;
      index = markdown.indexOf("\n", index + 1)
    ) {
      line++
      counted = index + 1
    }
    if (counted < pos) counted = pos
    return line
  }
  tree.iterate({
    from: start,
    enter(ref) {
      const match = /^(ATX|Setext)Heading(\d)$/.exec(ref.name)
      if (!match) return HEADING_CONTAINERS.has(ref.name) ? undefined : false
      if (ref.from < start) return false
      const node = ref.node
      const marks = node.getChildren("HeaderMark")
      const atx = match[1] === "ATX"
      const textFrom = atx ? (marks[0]?.to ?? node.from) : node.from
      const textTo = atx ? (marks[1]?.from ?? node.to) : (marks[0]?.from ?? node.to)
      const contentStart = atx
        ? textFrom + (/^[ \t]*/.exec(markdown.slice(textFrom, textTo))?.[0].length ?? 0)
        : textFrom
      const text = plainText(markdown, node, textFrom, textTo).replace(/\s+/g, " ").trim()
      headings.push({
        level: Number(match[2]),
        text,
        slug: slug(text),
        line: lineAt(node.from),
        from: node.from,
        to: node.to,
        textFrom: contentStart,
      })
      return false
    },
  })
  return headings
}

export { extractHeadings, headingsOf }
export type { MarkdownHeading }
