import type { SyntaxNode } from "@lezer/common"

import { frontmatterBounds } from "@/components/ui/markdown-frontmatter"
import { markdownParser } from "@/components/ui/markdown-syntax"

type MarkdownHeading = {
  level: number
  /** The heading as plain text: marks dropped, a wikilink as its label. */
  text: string
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

/** Every heading of a Markdown document in order, frontmatter left out, for an outline or a table of contents. */
function extractHeadings(markdown: string): MarkdownHeading[] {
  const tree = markdownParser.parse(markdown)
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
      if (!match) return ref.name === "FencedCode" || ref.name === "CodeBlock" ? false : undefined
      if (ref.from < start) return false
      const node = ref.node
      const marks = node.getChildren("HeaderMark")
      const atx = match[1] === "ATX"
      const textFrom = atx ? (marks[0]?.to ?? node.from) : node.from
      const textTo = atx ? (marks[1]?.from ?? node.to) : (marks[0]?.from ?? node.to)
      const contentStart = atx
        ? textFrom + (/^[ \t]*/.exec(markdown.slice(textFrom, textTo))?.[0].length ?? 0)
        : textFrom
      headings.push({
        level: Number(match[2]),
        text: plainText(markdown, node, textFrom, textTo).replace(/\s+/g, " ").trim(),
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

export { extractHeadings }
export type { MarkdownHeading }
