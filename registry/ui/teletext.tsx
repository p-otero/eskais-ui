"use client"

import { Button } from "@ui-sdk/react/button"
import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { memo, type ReactNode, useRef, useState, useSyncExternalStore } from "react"

import {
  cellsOf,
  fastextColors,
  fittedSpans,
  normalRow,
  pageRows,
  rowsOf,
  subpageCount,
  type TeletextPage,
  type TeletextRow,
  type TeletextSpan,
} from "@/components/ui/teletext-page"
import { teletext, type TeletextOptions } from "@/components/ui/teletext-primitive"
import { useTeletextClock } from "@/components/ui/use-teletext-clock"
import { useTeletextSearch } from "@/components/ui/use-teletext-search"
import { useTeletextSubpages } from "@/components/ui/use-teletext-subpages"
import { useLocale } from "@/lib/locale"
import { cn, cssVars } from "@/lib/utils"

type TeletextLabels = {
  /** Describes the page region to screen readers: how to tune with the number keys. */
  hint: string
}

const teletextLabels: TeletextLabels = {
  hint: "Type three digits to go to a page; Left and Right turn subpages.",
}

type TeletextState = { page: number; searching: boolean }

type TeletextProps = Omit<TeletextOptions, "pages"> & {
  /** The set's accessible name: "Teletext". */
  label: string
  /** The service's pages by number, 100 to 899. */
  pages: Readonly<Record<number, TeletextPage>>
  /** The service's name on the header row, up to about ten characters. */
  service?: string
  /** Shows the date and a running clock on the header row, in the page's locale. Default true. */
  clock?: boolean
  /** How long the counter runs through the broadcast before a new page shows, in ms. 0 shows it at once. Default 900. */
  searchMs?: number
  /** How long each subpage stays before the next, in ms. Default 12000. */
  subpageMs?: number
  /** `crt` (the default) adds scanlines and a darker rim, as a tube set had; `flat` leaves them to a screen it sits in. */
  screen?: "crt" | "flat"
  /** The locale for the header's date and clock; the page's `lang` by default. */
  locale?: string
  labels?: Partial<TeletextLabels>
  /** Classes for the set; a function gets the page shown and whether it's searching. */
  className?: string | ((state: TeletextState) => string | undefined)
}

function sextantRects(
  cells: readonly number[],
  separated: boolean,
): { key: string; x: number; y: number; width: number }[] {
  const rects: { key: string; x: number; y: number; width: number }[] = []
  for (let y = 0; y < 3; y++) {
    let run = -1
    for (let x = 0; x <= cells.length * 2; x++) {
      const cell = cells[Math.floor(x / 2)] ?? 0
      const lit = x < cells.length * 2 && Boolean(cell & (1 << (y * 2 + (x % 2))))
      if (lit && separated) rects.push({ key: `${String(y)}-${String(x)}`, x, y, width: 1 })
      else if (lit && run === -1) run = x
      else if (!lit && run !== -1) {
        rects.push({ key: `${String(y)}-${String(run)}`, x: run, y, width: x - run })
        run = -1
      }
    }
  }
  return rects
}

function Mosaic({ cells, separated }: { cells: readonly number[]; separated: boolean }) {
  const gap = separated ? 0.14 : 0
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- teletext block graphics drawn from the page's data, not an icon
    <svg
      data-slot="teletext-mosaic"
      aria-hidden="true"
      viewBox={`0 0 ${String(cells.length * 2)} 3`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      {sextantRects(cells, separated).map((rect) => (
        <rect
          key={rect.key}
          x={rect.x + gap}
          y={rect.y + gap}
          width={rect.width - gap * 2}
          height={1 - gap * 2}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}

function Span({ span }: { span: TeletextSpan }) {
  return (
    <span
      data-slot="teletext-span"
      data-fg={span.fg ?? "white"}
      data-bg={span.bg ?? "black"}
      data-flash={span.flash ? "" : undefined}
      style={cssVars({ "--teletext-cells": cellsOf(span) })}
    >
      {span.mosaic ? <Mosaic cells={span.mosaic} separated={span.separated ?? false} /> : span.text}
    </span>
  )
}

function Row({ row, line }: { row: TeletextRow; line: number }) {
  const { spans, doubleHeight, heading } = normalRow(row)
  const fitted = fittedSpans(spans)
  const starts = fitted.map((_, index) => fitted.slice(0, index).reduce((sum, span) => sum + cellsOf(span), 0))
  const cells = (
    <span data-slot="teletext-cells">
      {fitted.map((span, index) => (
        <Span key={starts[index]} span={span} />
      ))}
    </span>
  )
  const style = cssVars({ "--teletext-line": line + 1 })
  const double = doubleHeight ? "" : undefined
  if (heading) {
    return (
      <h2 data-slot="teletext-row" data-double={double} style={style}>
        {cells}
      </h2>
    )
  }
  return (
    <div data-slot="teletext-row" data-double={double} style={style}>
      {cells}
    </div>
  )
}

const Rows = memo(function Rows({ rows }: { rows: readonly TeletextRow[] }) {
  const lines: ReactNode[] = []
  for (let line = 0; line < Math.min(rows.length, pageRows); line++) {
    const row = rows[line]!
    lines.push(<Row key={`line-${String(line)}`} row={row} line={line} />)
    if (normalRow(row).doubleHeight) line++
  }
  return lines
})

const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

const dataAttributes = (values: Record<string, string | undefined>): Record<`data-${string}`, string | undefined> =>
  Object.fromEntries(Object.entries(values).map(([key, value]) => [`data-${key}`, value]))

const twoDigits = (value: number) => String(value).padStart(2, "0")

function Clock({ locale }: { locale: string | undefined }) {
  const second = useTeletextClock()
  if (second === null) return <span data-slot="teletext-clock" />
  const date = new Date(second * 1000)
  const day = new Intl.DateTimeFormat(locale, { weekday: "short", day: "2-digit", month: "short" })
    .format(date)
    .replaceAll(/[.,]/g, "")
  const time = `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}/${twoDigits(date.getSeconds())}`
  return (
    <span data-slot="teletext-clock">
      <span data-slot="teletext-date">{day}</span> <span data-slot="teletext-time">{time}</span>
    </span>
  )
}

function PageNumber({
  shown,
  tuned,
  entry,
  searchMs,
  onArrive,
}: {
  shown: number
  tuned: number
  entry: string
  searchMs: number
  onArrive: (page: number) => void
}) {
  const search = useTeletextSearch({ from: shown, to: tuned, searchMs, onArrive })
  const number = entry ? entry.padEnd(3, "-") : String(search.shown)
  return (
    <span data-slot="teletext-number" data-searching={search.searching ? "" : undefined}>
      {`P${number}`}
    </span>
  )
}

/**
 * A teletext set: 40 by 25 character cells in the eight broadcast colours, with double-height rows, 2×3 mosaic
 * graphics, flash, a header with the page number, the service and a clock, and the four coloured Fastext keys. Type
 * three digits on the page to tune: the counter runs through the broadcast before the page shows. Subpages rotate.
 * It fills its parent at 4:3, sized to it, so it fits a TV's screen.
 */
function Teletext({
  label,
  pages,
  page,
  defaultPage,
  onPageChange,
  service = "",
  clock = true,
  searchMs = 900,
  subpageMs = 12_000,
  screen = "crt",
  locale: ownLocale,
  labels: ownLabels,
  className,
}: TeletextProps) {
  const labels = { ...teletextLabels, ...ownLabels }
  const locale = useLocale(ownLocale)
  const handle = usePrimitive(teletext, { pages, page, defaultPage, onPageChange })
  useSyncExternalStore(handle.instance.subscribe, handle.instance.get, handle.instance.get)
  const { page: tuned, entry, subpage } = handle.state
  const [shown, setShown] = useState(tuned)
  const searchesFor = prefersReducedMotion() ? 0 : searchMs
  if (searchesFor <= 0 && shown !== tuned) setShown(tuned)
  const region = useRef<HTMLDivElement>(null)
  const current = pages[shown]
  const count = subpageCount(current)
  useTeletextSubpages(region, { count, intervalMs: subpageMs, onTurn: () => handle.api.turnSubpage(1) })
  const rows = current ? rowsOf(current, subpage) : []
  const hasHeading = rows.some((row) => normalRow(row).heading)
  const searching = shown !== tuned

  const pagePart = usePart(
    handle,
    "page",
    {},
    {
      ref: region,
      "aria-label": current?.title ?? String(shown),
      "aria-description": labels.hint,
      children: (
        <>
          {current && !hasHeading ? <h2 className="sr-only">{current.title}</h2> : null}
          <Rows rows={rows} />
        </>
      ),
    },
    "div",
  )

  return usePart(
    handle,
    "root",
    {},
    {
      "aria-label": label,
      ...dataAttributes({ searching: searching ? "" : undefined, screen }),
      className: cn("relative", typeof className === "function" ? className({ page: shown, searching }) : className),
      children: (
        <div data-slot="teletext-screen">
          <div data-slot="teletext-header">
            <PageNumber shown={shown} tuned={tuned} entry={entry} searchMs={searchesFor} onArrive={setShown} />
            <span data-slot="teletext-service">{service}</span>
            {count > 1 ? <span data-slot="teletext-subpage">{`${String(subpage + 1)}/${String(count)}`}</span> : null}
            {clock ? <Clock locale={locale} /> : null}
          </div>
          {pagePart}
          <div data-slot="teletext-fastext">
            {fastextColors.map((color) => {
              const link = current?.fastext?.[color]
              return link ? (
                <Button
                  key={color}
                  data-fastext={color}
                  className="touch-target"
                  onClick={(event) => handle.api.fastext(color, event.nativeEvent)}
                >
                  {link.label}
                </Button>
              ) : (
                <span key={color} data-fastext={color} aria-hidden="true" />
              )
            })}
          </div>
        </div>
      ),
    },
    "div",
  )
}

export { Teletext, teletextLabels }
export type { TeletextLabels, TeletextProps, TeletextState }
