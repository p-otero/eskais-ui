"use client"

import {
  defaultRangeExtractor,
  useVirtualizer,
  useWindowVirtualizer,
  type Range,
  type VirtualItem,
} from "@tanstack/react-virtual"
import { memo, useCallback, useMemo, useRef, useState, type CSSProperties } from "react"
import { flushSync } from "react-dom"

/** `"auto"` virtualizes past `VIRTUALIZE_THRESHOLD` rows. */
type Virtualize = boolean | "auto"

const VIRTUALIZE_THRESHOLD = 200

type VirtualRowsOptions = {
  count: number
  virtualize?: Virtualize
  /** A row's estimated height in px before it is measured. */
  estimateSize?: number | ((index: number) => number)
  getKey: (index: number) => string
  overscan?: number
}

/** A rendered row, or a gap holding the space of the rows from `from` up to `to` that aren't rendered. */
type Segment =
  | { type: "row"; index: number; key: string }
  | { type: "gap"; size: number; from: number; to: number; key: string }

type Scroller = { element: HTMLElement | null; margin: number }

function scrollParentOf(el: HTMLElement) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight + 1) return node
  }
  return null
}

function marginIn(el: HTMLElement, scroller: HTMLElement | null) {
  const top = el.getBoundingClientRect().top
  if (!scroller) return top + globalThis.scrollY
  return top - scroller.getBoundingClientRect().top + scroller.scrollTop
}

function isVirtual(virtualize: Virtualize, count: number) {
  return virtualize === "auto" ? count > VIRTUALIZE_THRESHOLD : virtualize
}

function sizeOf(estimateSize: VirtualRowsOptions["estimateSize"]) {
  if (typeof estimateSize === "function") return estimateSize
  const size = estimateSize ?? 52
  return () => size
}

/**
 * Renders only the rows in view (and `keep`), in document flow: gaps take the place of the rows in between, so a
 * table keeps its rows in `tbody` and a list its items in `ul`. It scrolls with the nearest scrolling ancestor of
 * the element given to `anchor`, or the window when there is none.
 */
function useVirtualRows({ count, virtualize = "auto", estimateSize, getKey, overscan = 8 }: VirtualRowsOptions) {
  const enabled = isVirtual(virtualize, count)
  const [scroller, setScroller] = useState<Scroller | null>(null)
  const estimate = useMemo(() => sizeOf(estimateSize), [estimateSize])
  // The focused row stays rendered while scrolled away, so focus isn't lost. Pinning it on every focus move
  // re-renders nothing; the range picks it up on the next scroll, or at once when `version` changes.
  const pinned = useRef<number | undefined>(undefined)
  const [version, setVersion] = useState(0)

  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range)
      const keep = pinned.current
      if (version < 0 || keep === undefined || keep >= range.count || indexes.includes(keep)) return indexes
      return [...indexes, keep].toSorted((a, b) => a - b)
    },
    [version],
  )

  const shared = {
    count,
    estimateSize: estimate,
    getItemKey: getKey,
    overscan,
    rangeExtractor,
    scrollMargin: scroller?.margin ?? 0,
  }
  // oxlint-disable-next-line react/incompatible-library -- TanStack Virtual's instance is read during render by design, so the compiler leaves this hook unmemoized
  const element = useVirtualizer<HTMLElement, HTMLElement>({
    ...shared,
    enabled: enabled && scroller !== null && scroller.element !== null,
    getScrollElement: () => scroller?.element ?? null,
  })
  const windowed = useWindowVirtualizer<HTMLElement>({
    ...shared,
    enabled: enabled && scroller !== null && scroller.element === null,
  })
  const virtualizer = scroller?.element ? element : windowed

  const anchor = useCallback(
    (node: HTMLElement | null) => {
      if (!node || !enabled) return
      const scrollElement = scrollParentOf(node)
      setScroller({ element: scrollElement, margin: marginIn(node, scrollElement) })
    },
    [enabled],
  )

  let segments: Segment[]
  if (!enabled) {
    segments = Array.from({ length: count }, (_, index) => ({ type: "row", index, key: getKey(index) }))
  } else if (scroller === null) {
    segments = count > 0 ? [{ type: "gap", size: count * estimate(0), from: 0, to: count, key: "gap-start" }] : []
  } else {
    segments = segmentsOf(virtualizer.getVirtualItems(), virtualizer.getTotalSize(), scroller.margin, count)
  }
  const margin = scroller?.margin ?? 0
  const offsetOf = useCallback(
    (index: number) => {
      const item = virtualizer.measurementsCache[index]
      if (!item) return { start: index * estimate(index), size: estimate(index) }
      return { start: item.start - margin, size: item.size }
    },
    [virtualizer, margin, estimate],
  )

  const scrollToIndex = useCallback(
    (index: number) => {
      if (enabled) virtualizer.scrollToIndex(index, { align: "auto" })
    },
    [enabled, virtualizer],
  )
  const pin = useCallback((index: number | undefined) => {
    pinned.current = index
  }, [])
  /** Renders a row now, wherever the list is scrolled, like one an agent is about to activate. */
  const renderNow = useCallback(
    (index: number) => {
      if (!enabled) return
      pinned.current = index
      flushSync(() => setVersion((current) => current + 1))
    },
    [enabled],
  )

  return {
    enabled,
    anchor,
    segments,
    pin,
    renderNow,
    rendered: (index: number) => !enabled || segments.some((s) => s.type === "row" && s.index === index),
    measureElement: enabled ? virtualizer.measureElement : undefined,
    scrollToIndex,
    /** Where each row starts in the anchor and how tall it is, measured or estimated, for `GapFindStubs`. */
    offsetOf,
  }
}

function segmentsOf(items: VirtualItem[], total: number, margin: number, count: number) {
  const segments: Segment[] = []
  let position = 0
  let next = 0
  for (const item of items) {
    const start = item.start - margin
    if (item.index > next) {
      const key = next === 0 ? "gap-start" : `gap-${String(next)}`
      segments.push({ type: "gap", size: Math.max(0, start - position), from: next, to: item.index, key })
    }
    segments.push({ type: "row", index: item.index, key: String(item.key) })
    position = start + item.size
    next = item.index + 1
  }
  if (next < count)
    segments.push({ type: "gap", size: Math.max(0, total - position), from: next, to: count, key: "gap-end" })
  return segments
}

const CHUNK = 100

type StubChunkProps = {
  from: number
  to: number
  text: (index: number) => string
  offsetOf: (index: number) => { start: number; size: number }
  onFound: (index: number) => void
}

function setUntilFound(index: number, onFound: (index: number) => void) {
  const found = () => flushSync(() => onFound(index))
  return (node: HTMLElement | null) => {
    if (!node) return
    node.setAttribute("hidden", "until-found")
    node.addEventListener("beforematch", found)
    return () => node.removeEventListener("beforematch", found)
  }
}

const StubChunk = memo(function StubChunk({ from, to, text, offsetOf, onFound }: StubChunkProps) {
  const stubs = []
  for (let index = from; index < to; index += 1) {
    const { start, size } = offsetOf(index)
    const style: CSSProperties = { top: start, height: size }
    stubs.push(
      <div key={index} ref={setUntilFound(index, onFound)} className="absolute inset-x-0 overflow-hidden" style={style}>
        {text(index)}
      </div>,
    )
  }
  return stubs
})

type GapFindStubsProps = {
  from: number
  to: number
  /** Stable, like a `useCallback`: a chunk of stubs re-renders only when the rows it holds change. */
  text: (index: number) => string
  offsetOf: (index: number) => { start: number; size: number }
  onFound: (index: number) => void
}

/**
 * A gap's rows as `hidden="until-found"` text, so find in page reaches rows that aren't rendered; finding one
 * calls `onFound`, which renders the real row in its place. Stub positions aren't refreshed as rows are measured:
 * re-rendering every stub per measurement costs more than a key press may. Render it in the gap.
 */
function GapFindStubs({ from, to, text, offsetOf, onFound }: GapFindStubsProps) {
  const chunks = []
  for (let start = Math.floor(from / CHUNK) * CHUNK; start < to; start += CHUNK) {
    chunks.push(
      <StubChunk
        key={start}
        from={Math.max(from, start)}
        to={Math.min(to, start + CHUNK)}
        text={text}
        offsetOf={offsetOf}
        onFound={onFound}
      />,
    )
  }
  return chunks
}

export { GapFindStubs, useVirtualRows, VIRTUALIZE_THRESHOLD }
export type { Segment, Virtualize, VirtualRowsOptions }
