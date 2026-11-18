/** One `key: value` line of a frontmatter block; a YAML list (`- a` lines or `[a, b]`) gives an array. */
type FrontmatterProperty = { key: string; value: string | readonly string[] }

type Frontmatter = {
  /** Where the block starts and ends in the Markdown (the opening `---` to the end of the closing fence's line). */
  from: number
  to: number
  /** The text between the fences, as written. */
  raw: string
  properties: FrontmatterProperty[]
}

const OPEN = /^---[ \t]*$/
const CLOSE = /^(?:---|\.\.\.)[ \t]*$/
const BOM = "﻿"

/** The leading YAML block's bounds, or `null`: it needs `---` on the first line and a closing `---` or `...` line. */
function frontmatterBounds(markdown: string) {
  const from = markdown.startsWith(BOM) ? BOM.length : 0
  let lineStart = from
  let contentFrom = -1
  while (lineStart <= markdown.length) {
    const newline = markdown.indexOf("\n", lineStart)
    const lineEnd = newline < 0 ? markdown.length : newline
    const text = markdown.slice(lineStart, lineEnd).replace(/\r$/, "")
    if (contentFrom < 0) {
      if (!OPEN.test(text)) return null
      contentFrom = newline < 0 ? lineEnd : newline + 1
    } else if (CLOSE.test(text)) {
      const breakSize = markdown[lineStart - 2] === "\r" ? 2 : 1
      const contentTo = lineStart === contentFrom ? contentFrom : lineStart - breakSize
      return { from, to: lineStart + text.length, contentFrom, contentTo }
    }
    if (newline < 0) return null
    lineStart = newline + 1
  }
  return null
}

function unquote(value: string) {
  const text = value.trim()
  if (text.length >= 2 && (text[0] === '"' || text[0] === "'") && text.at(-1) === text[0]) return text.slice(1, -1)
  return text.replace(/\s+#.*$/, "")
}

function splitInline(list: string) {
  const items: string[] = []
  let current = ""
  let quote = ""
  for (const char of list) {
    if (quote) {
      if (char === quote) quote = ""
      current += char
    } else if (char === '"' || char === "'") {
      quote = char
      current += char
    } else if (char === ",") {
      items.push(current)
      current = ""
    } else {
      current += char
    }
  }
  if (current.trim() || items.length) items.push(current)
  return items.map(unquote).filter((item) => item !== "")
}

/**
 * Reads the `key: value` lines, lists and `|`/`>` blocks of a simple YAML block. Anything else (nested maps,
 * anchors) is skipped: the `raw` text is there for a real YAML parser.
 */
function parseFrontmatterProperties(raw: string): FrontmatterProperty[] {
  const properties: FrontmatterProperty[] = []
  let list: string[] | null = null
  let block: { lines: string[]; join: string } | null = null
  let current: FrontmatterProperty | null = null
  const finish = () => {
    if (current && block) current.value = block.lines.join(block.join).trim()
    else if (current && list) current.value = list
    block = null
    list = null
  }
  for (const line of raw.split(/\r\n?|\n/)) {
    if (block && (/^\s/.test(line) || !line.trim())) {
      block.lines.push(line.trim())
      continue
    }
    if (!line.trim() || /^\s*#/.test(line)) continue
    const item = /^\s*-\s+(.*)$/.exec(line) ?? (/^\s*-$/.test(line) ? ["", ""] : null)
    if (item && current && list) {
      list.push(unquote(item[1] ?? ""))
      continue
    }
    const entry = /^([^\s#:-][^:]*?|"[^"]*"|'[^']*'):(?:[ \t]+(.*))?$/.exec(line)
    if (!entry) continue
    finish()
    const key = unquote(entry[1] ?? "")
    const value = (entry[2] ?? "").trim()
    current = { key, value: "" }
    properties.push(current)
    if (value === "") list = []
    else if (/^[|>][+-]?$/.test(value)) block = { lines: [], join: value.startsWith("|") ? "\n" : " " }
    else if (value.startsWith("[") && value.endsWith("]")) current.value = splitInline(value.slice(1, -1))
    else current.value = unquote(value)
  }
  finish()
  return properties.map((property) =>
    Array.isArray(property.value) && property.value.length === 0 ? { ...property, value: "" } : property,
  )
}

/** The leading YAML frontmatter of a Markdown document, or `null` when it has none. */
function parseFrontmatter(markdown: string): Frontmatter | null {
  const bounds = frontmatterBounds(markdown)
  if (!bounds) return null
  const raw = markdown.slice(bounds.contentFrom, bounds.contentTo)
  return { from: bounds.from, to: bounds.to, raw, properties: parseFrontmatterProperties(raw) }
}

export { frontmatterBounds, parseFrontmatter, parseFrontmatterProperties }
export type { Frontmatter, FrontmatterProperty }
