"use client"

// TanStack Virtual's rows in document flow, as virtual-rows had them before it moved to UI SDK's virtualizer: kept for
// CommitHistory and GitTree, whose held arrow keys reached the next paint in 12 ms at the 95th percentile on it and
// 20-26 ms on UI SDK's (tooling/git-bench.mjs, 50,000 commits, 1x CPU). Everything else uses virtual-rows.

import {
  defaultRangeExtractor,
  useVirtualizer,
  useWindowVirtualizer,
  type Range,
  type VirtualItem,
} from "@tanstack/react-virtual"
import { useCallback, useMemo, useRef, useState } from "react"
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
function useFlowRows({ count, virtualize = "auto", estimateSize, getKey, overscan = 8 }: VirtualRowsOptions) {
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
    /** Where each row starts in the anchor and how tall it is, measured or estimated. */
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

export { useFlowRows }
