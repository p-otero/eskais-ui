import { ledMatrixGlyphData } from "@/components/ui/led-matrix-glyphs"

/** How tall a glyph is, in dots; every glyph is five dots wide at most. */
const glyphRows = 7
const glyphColumns = 5
const spaceColumns = 3

type Glyph = { columns: number[] }

const glyphStride = 1 + glyphRows

function columnsOfRows(rows: number[], tabular: boolean): number[] {
  const columns = Array.from({ length: glyphColumns }, (_, column) =>
    rows.reduce((mask, row, index) => (row & (1 << (glyphColumns - 1 - column)) ? mask | (1 << index) : mask), 0),
  )
  if (tabular) return columns
  const first = columns.findIndex((mask) => mask !== 0)
  if (first === -1) return Array.from({ length: spaceColumns }, () => 0)
  const last = columns.findLastIndex((mask) => mask !== 0)
  return columns.slice(first, last + 1)
}

function parseGlyphs(): Map<string, Glyph> {
  const glyphs = new Map<string, Glyph>()
  for (let index = 0; index < ledMatrixGlyphData.length; index += glyphStride) {
    const char = ledMatrixGlyphData[index]!
    const rows = Array.from(ledMatrixGlyphData.slice(index + 1, index + glyphStride), (digit) =>
      Number.parseInt(digit, 32),
    )
    glyphs.set(char, { columns: columnsOfRows(rows, /\d/.test(char)) })
  }
  return glyphs
}

let glyphTable: Map<string, Glyph> | undefined
const glyphsOnce = () => (glyphTable ??= parseGlyphs())

/** The glyph a character shows: its own, its letter without the accent, or `?` for anything the font lacks. */
function glyphOf(char: string): Glyph {
  const glyphs = glyphsOnce()
  return (
    glyphs.get(char) ??
    glyphs.get(char.normalize("NFD").replaceAll(/\p{Mark}/gu, "")) ??
    glyphs.get(char.normalize("NFKD")[0] ?? "") ??
    glyphs.get("?")!
  )
}

/** Whether the font draws this character itself, rather than a stand-in. */
function hasGlyph(char: string) {
  return glyphsOnce().has(char)
}

/**
 * A line of text as columns of dots, one gap between characters: each number is a column, bit 0 its top dot. `scale`
 * repeats every dot that many times across and down, for a sign with more rows than a glyph.
 */
function textColumns(text: string, scale = 1): number[] {
  const columns: number[] = []
  const chars = [...text.normalize("NFC")]
  for (const [index, char] of chars.entries()) {
    for (const column of glyphOf(char).columns) {
      const scaled = scale === 1 ? column : scaleColumn(column, scale)
      for (let repeat = 0; repeat < scale; repeat++) columns.push(scaled)
    }
    if (index < chars.length - 1) for (let repeat = 0; repeat < scale; repeat++) columns.push(0)
  }
  return columns
}

function scaleColumn(column: number, scale: number) {
  let scaled = 0
  for (let row = 0; row < glyphRows; row++) {
    if (!(column & (1 << row))) continue
    for (let repeat = 0; repeat < scale; repeat++) scaled |= 1 << (row * scale + repeat)
  }
  return scaled
}

const measure = (text: string, scale: number) => textColumns(text, scale).length

/**
 * Splits a message into pages that each fit `columns` dots across: whole words where they fit, a word longer than the
 * sign broken between characters.
 */
function pagesOf(text: string, columns: number, scale = 1): string[] {
  const pages: string[] = []
  let line = ""
  const push = () => {
    if (line) pages.push(line)
    line = ""
  }
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (measure(candidate, scale) <= columns) {
      line = candidate
      continue
    }
    push()
    if (measure(word, scale) <= columns) {
      line = word
      continue
    }
    for (const char of word) {
      if (line && measure(line + char, scale) > columns) push()
      line += char
    }
  }
  push()
  return pages.length ? pages : [""]
}

export { glyphColumns, glyphOf, glyphRows, hasGlyph, pagesOf, textColumns }
