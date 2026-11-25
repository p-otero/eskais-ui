/** The eight colours a teletext set could show. */
type TeletextColor = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white"

/** The four coloured keys on the remote. */
type FastextColor = "red" | "green" | "yellow" | "blue"

/**
 * A run of cells in one colour: `text`, or `mosaic` block graphics, one number per cell whose six bits are its 2×3
 * sextants (bit 0 top left, 1 top right, 2 middle left, 3 middle right, 4 bottom left, 5 bottom right).
 */
type TeletextSpan = {
  text?: string
  mosaic?: readonly number[]
  /** Text or mosaic colour. Default `white`. */
  fg?: TeletextColor
  /** Cell colour. Default `black`. */
  bg?: TeletextColor
  /** Blinks once a second, as teletext's flash did; steady under reduced motion. */
  flash?: boolean
  /** Draws mosaics as separated blocks, with a gap around each sextant. */
  separated?: boolean
}

/** One of the 23 page rows. Spans run left to right from the first column; a row holds 40 cells and cuts the rest. */
type TeletextRow =
  | readonly TeletextSpan[]
  | {
      spans: readonly TeletextSpan[]
      /** Twice as tall, over the next row, which is then not shown. */
      doubleHeight?: boolean
      /** The page's heading, for screen readers. */
      heading?: boolean
    }

/** A coloured key's link: where it goes and the word it shows on the bottom row. */
type FastextLink = { page: number; label: string }

type TeletextPage = {
  /** Names the page's region for screen readers, and is its heading when no row is one. */
  title: string
  rows?: readonly TeletextRow[]
  /** Pages that rotate, each its own rows: shown in turn, as subpages were. */
  subpages?: readonly (readonly TeletextRow[])[]
  fastext?: Partial<Record<FastextColor, FastextLink>>
}

const pageColumns = 40
const pageRows = 23
const firstPage = 100
const lastPage = 899

const fastextColors: readonly FastextColor[] = ["red", "green", "yellow", "blue"]

type NormalRow = { spans: readonly TeletextSpan[]; doubleHeight: boolean; heading: boolean }

const isSpanList = (row: TeletextRow): row is readonly TeletextSpan[] => Array.isArray(row)

function normalRow(row: TeletextRow): NormalRow {
  if (isSpanList(row)) return { spans: row, doubleHeight: false, heading: false }
  return { spans: row.spans, doubleHeight: row.doubleHeight ?? false, heading: row.heading ?? false }
}

/** The spans of a row cut to the 40 columns a page has. */
function fittedSpans(spans: readonly TeletextSpan[]): TeletextSpan[] {
  const fitted: TeletextSpan[] = []
  let used = 0
  for (const span of spans) {
    const room = pageColumns - used
    if (room <= 0) break
    if (span.mosaic) {
      const mosaic = span.mosaic.slice(0, room)
      fitted.push({ ...span, mosaic })
      used += mosaic.length
    } else {
      const text = [...(span.text ?? "")].slice(0, room).join("")
      fitted.push({ ...span, text })
      used += [...text].length
    }
  }
  return fitted
}

const cellsOf = (span: TeletextSpan) => span.mosaic?.length ?? [...(span.text ?? "")].length

/** The rows a page shows now: its own, or the subpage's. */
function rowsOf(page: TeletextPage, subpage: number): readonly TeletextRow[] {
  const subpages = page.subpages
  if (subpages?.length) return subpages[subpage % subpages.length] ?? []
  return page.rows ?? []
}

const subpageCount = (page: TeletextPage | undefined) => Math.max(1, page?.subpages?.length ?? 0)

/**
 * Turns block art into mosaic cells: every two characters across and three lines down make one cell, and any
 * character but a space or a dot is a lit sextant. Returns one array of cells for each page row the art covers.
 */
function teletextMosaic(art: readonly string[]): number[][] {
  const width = Math.max(0, ...art.map((line) => line.length))
  const rows: number[][] = []
  for (let top = 0; top < art.length; top += 3) {
    const cells: number[] = []
    for (let left = 0; left < width; left += 2) {
      let bits = 0
      for (let bit = 0; bit < 6; bit++) {
        const char = art[top + Math.floor(bit / 2)]?.[left + (bit % 2)] ?? " "
        if (char !== " " && char !== ".") bits |= 1 << bit
      }
      cells.push(bits)
    }
    rows.push(cells)
  }
  return rows
}

export {
  cellsOf,
  fastextColors,
  firstPage,
  fittedSpans,
  lastPage,
  normalRow,
  pageColumns,
  pageRows,
  rowsOf,
  subpageCount,
  teletextMosaic,
}
export type { FastextColor, FastextLink, NormalRow, TeletextColor, TeletextPage, TeletextRow, TeletextSpan }
