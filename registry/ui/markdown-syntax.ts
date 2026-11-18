import {
  parser as commonmark,
  Strikethrough,
  Table,
  TaskList,
  type InlineContext,
  type MarkdownConfig,
} from "@lezer/markdown"

const EXCLAMATION = 33
const OPEN_BRACKET = 91
const CLOSE_BRACKET = 93
const PIPE = 124
const NEWLINE = 10

/** `[[target|label]]` from `start + open`, as a node named `name` whose marks are `mark`; -1 when it isn't one. */
function parseTarget(cx: InlineContext, start: number, open: number, name: string, mark: string) {
  let pipe = -1
  for (let pos = start + open; pos < cx.end; pos++) {
    const char = cx.char(pos)
    if (char === NEWLINE || char === OPEN_BRACKET) return -1
    if (char === PIPE && pipe < 0) pipe = pos
    if (char !== CLOSE_BRACKET) continue
    if (cx.char(pos + 1) !== CLOSE_BRACKET) return -1
    const targetEnd = pipe < 0 ? pos : pipe
    if (targetEnd === start + open || cx.slice(start + open, targetEnd).trim() === "") return -1
    const children = [cx.elt(mark, start, start + open), cx.elt("WikilinkTarget", start + open, targetEnd)]
    if (pipe >= 0) {
      children.push(cx.elt("WikilinkPipe", pipe, pipe + 1))
      if (pos > pipe + 1) children.push(cx.elt("WikilinkLabel", pipe + 1, pos))
    }
    children.push(cx.elt(mark, pos, pos + 2))
    return cx.addElement(cx.elt(name, start, pos + 2, children))
  }
  return -1
}

const Wikilink: MarkdownConfig = {
  defineNodes: ["Wikilink", "WikilinkMark", "WikilinkTarget", "WikilinkPipe", "WikilinkLabel", "Embed", "EmbedMark"],
  parseInline: [
    {
      name: "Embed",
      before: "Image",
      parse(cx, next, start) {
        if (next !== EXCLAMATION || cx.char(start + 1) !== OPEN_BRACKET || cx.char(start + 2) !== OPEN_BRACKET) {
          return -1
        }
        return parseTarget(cx, start, 3, "Embed", "EmbedMark")
      },
    },
    {
      name: "Wikilink",
      before: "Link",
      parse(cx, next, start) {
        if (next !== OPEN_BRACKET || cx.char(start + 1) !== OPEN_BRACKET) return -1
        return parseTarget(cx, start, 2, "Wikilink", "WikilinkMark")
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
