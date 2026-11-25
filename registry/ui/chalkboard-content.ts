import { isOneOf, isRecord, isStringArray } from "@/lib/narrow"

/** The chalk a block is written in. */
type ChalkColor = "white" | "yellow" | "pink" | "blue" | "green"

type ChalkboardMenuItem = { name: string; price: string; note?: string }

/** One thing on the board: a heading, a line of text, a list, or a menu with prices on dot leaders. */
type ChalkboardBlock =
  | { type: "heading"; text: string; color?: ChalkColor }
  | { type: "text"; text: string; color?: ChalkColor }
  | { type: "list"; items: string[]; color?: ChalkColor }
  | { type: "menu"; items: ChalkboardMenuItem[]; color?: ChalkColor }

/**
 * What goes on the board: blocks, or plain text with one per line: `# Today` a heading, `- Soup` a list item,
 * `Coffee ... 2.50` (or `Coffee | 2.50`) a menu line, and anything else a line of text.
 */
type ChalkboardContent = string | readonly ChalkboardBlock[]

const chalkColors: readonly ChalkColor[] = ["white", "yellow", "pink", "blue", "green"]

const menuLine = /^(.+?)\s*(?:\.{3,}|…+|\|)\s*(\S.*)$/

function parseText(text: string): ChalkboardBlock[] {
  const blocks: ChalkboardBlock[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const last = blocks.at(-1)
    if (!line) continue
    if (line.startsWith("#")) {
      blocks.push({ type: "heading", text: line.replace(/^#+\s*/, "") })
      continue
    }
    const item = /^[-*•]\s+(.*)$/.exec(line)?.[1]
    if (item !== undefined) {
      if (last?.type === "list") last.items.push(item)
      else blocks.push({ type: "list", items: [item] })
      continue
    }
    const priced = menuLine.exec(line)
    if (priced) {
      const entry = { name: priced[1]!.trim(), price: priced[2]!.trim() }
      if (last?.type === "menu") last.items.push(entry)
      else blocks.push({ type: "menu", items: [entry] })
      continue
    }
    blocks.push({ type: "text", text: line })
  }
  return blocks
}

const colorOf = (value: unknown) => (isOneOf(chalkColors, value) ? { color: value } : {})

function menuItemOf(value: unknown): ChalkboardMenuItem | undefined {
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.price !== "string") return undefined
  return { name: value.name, price: value.price, ...(typeof value.note === "string" ? { note: value.note } : {}) }
}

function blockOf(value: unknown): ChalkboardBlock | undefined {
  if (!isRecord(value)) return undefined
  const color = colorOf(value.color)
  if ((value.type === "heading" || value.type === "text") && typeof value.text === "string")
    return { type: value.type, text: value.text, ...color }
  if (value.type === "list" && isStringArray(value.items)) return { type: "list", items: [...value.items], ...color }
  if (value.type === "menu" && Array.isArray(value.items)) {
    const items = value.items.map(menuItemOf)
    if (items.every((item) => item !== undefined)) return { type: "menu", items, ...color }
  }
  return undefined
}

/** Reads content from any value: plain text or blocks. `undefined` when it isn't either. */
function chalkboardBlocks(content: unknown): ChalkboardBlock[] | undefined {
  if (typeof content === "string") return parseText(content)
  if (!Array.isArray(content)) return undefined
  const blocks = content.map(blockOf)
  return blocks.every((block) => block !== undefined) ? blocks : undefined
}

/** The board's text, in reading order, a line for each heading, line, item or priced dish. */
function chalkboardText(blocks: readonly ChalkboardBlock[]): string[] {
  return blocks.flatMap((block) => {
    if (block.type === "heading" || block.type === "text") return [block.text]
    if (block.type === "list") return block.items
    return block.items.map((item) => `${item.name} ${item.price}`)
  })
}

export { chalkboardBlocks, chalkboardText, chalkColors }
export type { ChalkboardBlock, ChalkboardContent, ChalkboardMenuItem, ChalkColor }
