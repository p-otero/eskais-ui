import { parser as commonmark, Strikethrough, Table, TaskList, type MarkdownConfig } from "@lezer/markdown"

const OPEN_BRACKET = 91
const CLOSE_BRACKET = 93
const PIPE = 124
const NEWLINE = 10

const Wikilink: MarkdownConfig = {
  defineNodes: ["Wikilink", "WikilinkMark", "WikilinkTarget", "WikilinkPipe", "WikilinkLabel"],
  parseInline: [
    {
      name: "Wikilink",
      before: "Link",
      parse(cx, next, start) {
        if (next !== OPEN_BRACKET || cx.char(start + 1) !== OPEN_BRACKET) return -1
        let pipe = -1
        for (let pos = start + 2; pos < cx.end; pos++) {
          const char = cx.char(pos)
          if (char === NEWLINE || char === OPEN_BRACKET) return -1
          if (char === PIPE && pipe < 0) pipe = pos
          if (char !== CLOSE_BRACKET) continue
          if (cx.char(pos + 1) !== CLOSE_BRACKET) return -1
          const targetEnd = pipe < 0 ? pos : pipe
          if (targetEnd === start + 2 || cx.slice(start + 2, targetEnd).trim() === "") return -1
          const children = [cx.elt("WikilinkMark", start, start + 2), cx.elt("WikilinkTarget", start + 2, targetEnd)]
          if (pipe >= 0) {
            children.push(cx.elt("WikilinkPipe", pipe, pipe + 1))
            if (pos > pipe + 1) children.push(cx.elt("WikilinkLabel", pipe + 1, pos))
          }
          children.push(cx.elt("WikilinkMark", pos, pos + 2))
          return cx.addElement(cx.elt("Wikilink", start, pos + 2, children))
        }
        return -1
      },
    },
  ],
}

const markdownExtensions = [Table, TaskList, Strikethrough, Wikilink]
const markdownParser = commonmark.configure(markdownExtensions)

type WikilinkResolution = { exists: boolean; label?: string }
type WikilinkResolver = (slug: string) => WikilinkResolution

function wikilinkText(slug: string, label?: string) {
  return label && label !== slug ? `[[${slug}|${label}]]` : `[[${slug}]]`
}

export { markdownExtensions, markdownParser, Wikilink, wikilinkText }
export type { WikilinkResolution, WikilinkResolver }
