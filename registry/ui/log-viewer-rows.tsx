"use client"

import type { VirtualItem } from "@ui-sdk/core"
import type { usePrimitive } from "@ui-sdk/react/primitive"
import { memo, useCallback, useSyncExternalStore, type CSSProperties, type ReactNode } from "react"

import { ansiCssColor, type AnsiSpan, type AnsiStyle } from "@/lib/ansi"
import type { Tone } from "@/lib/tone"
import type { logViewer } from "@/components/ui/log-viewer-primitive"
import type { LogLine } from "@/components/ui/log-viewer-store"
import { cn, cssVars } from "@/lib/utils"

type LogViewerApi = ReturnType<typeof usePrimitive<typeof logViewer>>["api"]

/** How a source shows: its name in the filter and on its lines, and its colour (a chart colour by default). */
type LogSource = {
  id: string
  label?: string
  /** A CSS colour for its mark; `var(--chart-1)` to `var(--chart-5)` in turn by default. */
  color?: string
  /** A tone's solid colour instead of a chart colour. */
  tone?: Tone
}

const toneColors: Record<Tone, string> = {
  neutral: "var(--muted-foreground)",
  info: "var(--info)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
  violet: "var(--violet)",
}

type SourceStyle = { label: string; color: string }

function sourceStyles(order: readonly string[], configured: readonly LogSource[]) {
  const byId = new Map(configured.map((source) => [source.id, source]))
  const styles = new Map<string, SourceStyle>()
  order.forEach((id, position) => {
    const source = byId.get(id)
    const color =
      source?.color ?? (source?.tone ? toneColors[source.tone] : `var(--chart-${String((position % 5) + 1)})`)
    styles.set(id, { label: source?.label ?? id, color })
  })
  return styles
}

const timeFormats = new Map<string, Intl.DateTimeFormat>()

function formatTime(time: number, locale: string | undefined) {
  const key = locale ?? ""
  let format = timeFormats.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hourCycle: "h23",
    })
    timeFormats.set(key, format)
  }
  return format.format(time)
}

// Perf: a line remounts each time it scrolls back into view, so its time is formatted once per locale.
const formattedTimes = new WeakMap<LogLine, { locale: string | undefined; text: string; iso: string }>()

function timeOf(line: LogLine, time: number, locale: string | undefined) {
  const known = formattedTimes.get(line)
  if (known && known.locale === locale) return known
  const formatted = { locale, text: formatTime(time, locale), iso: new Date(time).toISOString() }
  formattedTimes.set(line, formatted)
  return formatted
}

type SpanLook = { className?: string; style?: CSSProperties }

// Perf: runs share style objects across lines, so each look is computed once.
const looks = new WeakMap<AnsiStyle, SpanLook>()

function spanStyle(style: AnsiStyle): SpanLook {
  const known = looks.get(style)
  if (known) return known
  const look = lookOf(style)
  looks.set(style, look)
  return look
}

function solidInverseColors(fg: string | undefined, bg: string | undefined): CSSProperties {
  return { backgroundColor: fg ?? "var(--foreground)", color: bg ? "var(--foreground)" : "var(--muted)" }
}

function tintedBackgroundColors(fg: string | undefined, bg: string | undefined): CSSProperties {
  const css: CSSProperties = {}
  if (fg) css.color = fg
  if (bg) css.backgroundColor = `color-mix(in oklab, ${bg} 22%, transparent)`
  return css
}

function lookOf(style: AnsiStyle): SpanLook {
  const fg = style.fg === undefined ? undefined : ansiCssColor(style.fg)
  const bg = style.bg === undefined ? undefined : ansiCssColor(style.bg)
  const css = style.inverse ? solidInverseColors(fg, bg) : tintedBackgroundColors(fg, bg)
  const className = cn(
    style.bold && "font-semibold",
    style.dim && !fg && "text-muted-foreground",
    style.italic && "italic",
    style.underline && "underline",
    style.strike && "line-through",
  )
  return { className: className || undefined, style: Object.keys(css).length > 0 ? css : undefined }
}

function matchRanges(text: string, query: string) {
  const needle = query.trim().toLowerCase()
  if (needle === "") return []
  const haystack = text.toLowerCase()
  const ranges: [from: number, toExclusive: number][] = []
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
    ranges.push([at, at + needle.length])
  }
  return ranges
}

const markClassName = "rounded-xs bg-warning-soft text-warning-soft-foreground"

function LineText({ line, query }: { line: LogLine; query: string }) {
  const spans: readonly AnsiSpan[] = line.spans ?? [{ text: line.text }]
  const ranges = matchRanges(line.text, query)
  if (ranges.length === 0 && !line.spans) return line.text
  const pieces: ReactNode[] = []
  let offset = 0
  spans.forEach((span, spanIndex) => {
    const { className, style } = span.style ? spanStyle(span.style) : {}
    const end = offset + span.text.length
    const cuts = ranges.filter(([from, to]) => from < end && to > offset)
    const parts: ReactNode[] = []
    let at = offset
    for (const [from, to] of cuts) {
      const start = Math.max(from, offset)
      const stop = Math.min(to, end)
      if (start > at) parts.push(span.text.slice(at - offset, start - offset))
      parts.push(
        <mark key={start} className={markClassName}>
          {span.text.slice(start - offset, stop - offset)}
        </mark>,
      )
      at = stop
    }
    if (at < end) parts.push(span.text.slice(at - offset))
    offset = end
    pieces.push(
      className || style ? (
        // oxlint-disable-next-line react/no-array-index-key -- a line's runs have no identity but their order
        <span key={spanIndex} className={className} style={style}>
          {parts}
        </span>
      ) : (
        // oxlint-disable-next-line react/no-array-index-key -- a line's runs have no identity but their order
        <span key={spanIndex}>{parts}</span>
      ),
    )
  })
  return pieces
}

type LogRowProps = {
  line: LogLine
  /** Its position, only while lines wrap: wrapped rows are measured one by one. */
  position: number | undefined
  source: SourceStyle | undefined
  error: boolean
  current: boolean
  wrap: boolean
  timestamps: boolean
  locale: string | undefined
  query: string
  measure: LogViewerApi["measure"] | undefined
}

// Perf: rows sit in flow inside their run, so lines leaving above move the run, not every row.
const LogRow = memo(function LogRow({
  line,
  position,
  source,
  error,
  current,
  wrap,
  timestamps,
  locale,
  query,
  measure,
}: LogRowProps) {
  const ref = useCallback(
    (el: HTMLDivElement | null) => (el && measure && position !== undefined ? measure(position, el) : undefined),
    [measure, position],
  )
  return (
    <div
      ref={measure ? ref : undefined}
      data-slot="log-viewer-line"
      data-index={position}
      data-line-id={line.id}
      data-level={line.level}
      data-error={error ? "" : undefined}
      data-current={current ? "" : undefined}
      className="flex gap-items border-s-2 border-transparent px-inset-item data-current:border-destructive data-error:bg-destructive-soft data-error:text-destructive-soft-foreground data-[level=warn]:border-warning-border"
    >
      {timestamps && line.time !== undefined && (
        <time
          data-slot="log-viewer-time"
          dateTime={timeOf(line, line.time, locale).iso}
          className="shrink-0 text-muted-foreground tabular-nums in-data-error:text-inherit"
        >
          {timeOf(line, line.time, locale).text}
        </time>
      )}
      {source && (
        <span
          data-slot="log-viewer-source"
          style={cssVars({ "--log-source": source.color })}
          className="flex w-(--log-source-width) shrink-0 items-center gap-inline truncate text-muted-foreground before:size-2 before:shrink-0 before:rounded-full before:bg-(--log-source) in-data-error:text-inherit"
        >
          {source.label}
        </span>
      )}
      <span
        data-slot="log-viewer-text"
        className={cn("min-w-0", wrap ? "flex-1 whitespace-pre-wrap wrap-anywhere" : "whitespace-pre")}
      >
        <LineText line={line} query={query} />
      </span>
    </div>
  )
})

const noItems: VirtualItem[] = []

function consecutiveRuns(items: readonly VirtualItem[]) {
  const runs: VirtualItem[][] = []
  for (const item of items) {
    const run = runs.at(-1)
    const last = run?.at(-1)
    if (run && last && last.index + 1 === item.index) run.push(item)
    else runs.push([item])
  }
  return runs
}

type LogRowsProps = {
  api: LogViewerApi
  sources: Map<string, SourceStyle>
  wrap: boolean
  timestamps: boolean
  locale: string | undefined
  query: string
  currentError: number | null
}

// Perf: subscribes to the virtualizer itself, so scrolling renders this list, not the viewer.
const LogRows = memo(function LogRows({ api, sources, wrap, timestamps, locale, query, currentError }: LogRowsProps) {
  const items = useSyncExternalStore(api.virtual.subscribe, api.virtual.items, () => noItems)
  const measure = wrap ? api.measure : undefined
  const bindRows = useCallback((el: HTMLDivElement | null) => api.bindRows(el), [api])
  return (
    <div ref={bindRows} data-slot="log-viewer-rows" className="relative min-w-full">
      {consecutiveRuns(items).map((run, runIndex) => (
        <div
          // oxlint-disable-next-line react/no-array-index-key -- a run is the rows in view, or a kept row apart: its place is its identity
          key={runIndex}
          style={{ transform: `translateY(${String(run[0]?.start ?? 0)}px)` }}
          className={cn("absolute start-0 top-0", wrap ? "w-full" : "w-max min-w-full")}
        >
          {run.map((item) => {
            const line = api.line(Number(item.key))
            if (!line) return null
            return (
              <LogRow
                key={item.key}
                line={line}
                position={wrap ? item.index : undefined}
                source={line.source === undefined ? undefined : sources.get(line.source)}
                error={api.isError(line)}
                current={line.id === currentError}
                wrap={wrap}
                timestamps={timestamps}
                locale={locale}
                query={query}
                measure={measure}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
})
export { LogRows, sourceStyles }
export type { LogSource, LogViewerApi, SourceStyle }
