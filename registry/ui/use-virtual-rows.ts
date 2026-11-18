"use client"

import { createVirtualizer, type VirtualItem } from "@ui-sdk/core"
import { useCallback, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react"
import { flushSync } from "react-dom"

/** `"auto"` virtualizes past `VIRTUALIZE_THRESHOLD` rows. */
type Virtualize = boolean | "auto"

const VIRTUALIZE_THRESHOLD = 200

type VirtualRowsOptions = {
  count: number
  virtualize?: Virtualize
  /** A row's estimated height in px before it is measured. */
  estimateSize?: number | ((index: number) => number)
  /** Keep it stable (`useCallback` over the ids): a new function makes the rows read their keys again. */
  getKey: (index: number) => string
  overscan?: number
  /**
   * The text find in page should find in each row, so it reaches rows that aren't rendered: UI SDK's findable
   * layers hold it in `hidden="until-found"` stand-ins and scroll a matched row in. Keep it stable.
   */
  findable?: (index: number) => string
  /**
   * The element the rows scroll in, when the caller knows it: saves looking for the nearest scrolling ancestor,
   * which reads every ancestor's computed style while the list mounts. Keep it stable.
   */
  scrollElement?: (anchor: HTMLElement) => HTMLElement | null
}

/** A rendered row, or a gap holding the space of the rows from `from` up to `to` that aren't rendered. */
type Segment =
  | { type: "row"; index: number; key: string }
  | { type: "gap"; size: number; from: number; to: number; key: string }

type Scroller = { element: HTMLElement | null; margin: number }

type RowsProps = {
  findable?: (index: number) => string
  count: number
  /** One size for every row, which the first measured row replaces, or a size per row. */
  estimate: number | ((index: number) => number)
  getKey: (index: number) => string
  margin: number
}

const noItems: VirtualItem[] = []
const noSubscription = () => () => undefined

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
  return estimateSize ?? 52
}

const sizeAt = (estimate: RowsProps["estimate"], index: number) =>
  typeof estimate === "number" ? estimate : estimate(index)

// UI SDK's virtualizer connects to a scrolling element; a list that scrolls with the page goes through this stand-in
// for the window. It has no ResizeObserver of its own: `connectRows` follows the window's resize instead.
function windowScroller(view: Window) {
  return {
    get scrollTop() {
      return view.scrollY
    },
    set scrollTop(top: number) {
      view.scrollTo({ top })
    },
    get scrollLeft() {
      return view.scrollX
    },
    set scrollLeft(left: number) {
      view.scrollTo({ left })
    },
    get clientHeight() {
      return view.innerHeight
    },
    get clientWidth() {
      return view.innerWidth
    },
    scrollTo: (options: ScrollToOptions) => view.scrollTo(options),
    // The findable layers go in the page's body, positioned against the viewport.
    clientTop: 0,
    clientLeft: 0,
    getBoundingClientRect: () => new DOMRect(0, 0, view.innerWidth, view.innerHeight),
    prepend: (node: Node) => view.document.body.prepend(node),
    append: (node: Node) => view.document.body.append(node),
    addEventListener: (type: string, listener: EventListener, options?: AddEventListenerOptions) =>
      view.addEventListener(type, listener, options),
    removeEventListener: (type: string, listener: EventListener) => view.removeEventListener(type, listener),
    // No defaultView, so the virtualizer adds no ResizeObserver to the stand-in; `connectRows` follows the window.
    ownerDocument: {
      defaultView: {},
      createElement: (tag: string) => view.document.createElement(tag),
      createTextNode: (text: string) => view.document.createTextNode(text),
    },
  } as unknown as HTMLElement
}

/**
 * One list's virtualizer, with the props it reads: `update` swaps in new ones and reads the list again, and `pin`
 * keeps a row rendered wherever the list is scrolled, like the one with focus.
 */
function createRows(initial: RowsProps, overscan: number) {
  let props = initial
  let pinned: number | undefined
  // Rows of one size: the first one measured sets the size of every row not measured yet. Rows that then measure the
  // same change nothing, where a fractional height against a whole-pixel estimate re-rendered the list once more for
  // every row that scrolled in.
  let learned: number | undefined
  const estimateAt = (index: number) =>
    typeof props.estimate === "number" ? (learned ?? props.estimate) : props.estimate(index)
  const virtualizer = createVirtualizer({
    count: () => props.count,
    estimate: estimateAt,
    key: (index) => props.getKey(index),
    overscan,
    get scrollMargin() {
      return props.margin
    },
    keep: () => (pinned === undefined || pinned >= props.count ? [] : [pinned]),
    ...(initial.findable ? { findable: (index: number) => props.findable?.(index) ?? "" } : {}),
  })
  // The virtualizer reads a row's size as soon as it joins, which right after React changed the DOM forces a layout
  // on every key press that brings a row in. A row joins from this observer instead: its first callback comes after
  // the browser's own layout and before paint, so the size is read for free and the row never shows at a wrong one.
  const joining = new Map<Element, { index: number; stop?: () => void }>()
  const firstSize =
    typeof ResizeObserver === "function"
      ? new ResizeObserver((entries) => {
          for (const entry of entries) {
            const row = joining.get(entry.target)
            firstSize?.unobserve(entry.target)
            if (!row || row.stop) continue
            if (learned === undefined && typeof props.estimate === "number") {
              learned = entry.target.getBoundingClientRect().height || undefined
              if (learned !== undefined) virtualizer.refresh()
            }
            row.stop = virtualizer.measure(row.index, entry.target as HTMLElement)
          }
        })
      : undefined
  return {
    findable: initial.findable !== undefined,
    virtualizer,
    estimateAt,
    /** The size learned from the first measured row, which moves every row not measured yet. */
    learned: () => learned,
    update(next: RowsProps) {
      props = next
      virtualizer.refresh()
    },
    pin(index: number | undefined) {
      pinned = index
    },
    measure(index: number, el: HTMLElement) {
      const row: { index: number; stop?: () => void } = { index }
      joining.set(el, row)
      firstSize?.observe(el)
      return () => {
        firstSize?.unobserve(el)
        if (joining.get(el) === row) joining.delete(el)
        row.stop?.()
      }
    },
  }
}

function connectRows(rows: ReturnType<typeof createRows>, scroller: Scroller) {
  const options = { findable: rows.findable }
  if (scroller.element) return rows.virtualizer.connect(scroller.element, options)
  const disconnect = rows.virtualizer.connect(windowScroller(globalThis.window), options)
  const onResize = () => rows.virtualizer.refresh()
  globalThis.addEventListener("resize", onResize)
  return () => {
    disconnect()
    globalThis.removeEventListener("resize", onResize)
  }
}

function segmentsOf(items: readonly VirtualItem[], total: number, count: number) {
  const segments: Segment[] = []
  let position = 0
  let next = 0
  for (const item of items) {
    if (item.index > next) {
      const key = next === 0 ? "gap-start" : `gap-${String(next)}`
      segments.push({ type: "gap", size: Math.max(0, item.start - position), from: next, to: item.index, key })
    }
    segments.push({ type: "row", index: item.index, key: item.key })
    position = item.start + item.size
    next = item.index + 1
  }
  if (next < count)
    segments.push({ type: "gap", size: Math.max(0, total - position), from: next, to: count, key: "gap-end" })
  return segments
}

/**
 * Renders only the rows in view (and the pinned one), in document flow: gaps take the place of the rows in between,
 * so a table keeps its rows in `tbody` and a list its items in `ul`. It scrolls with the nearest scrolling ancestor
 * of the element given to `anchor`, or the window when there is none. On UI SDK's virtualizer, through
 * `useSyncExternalStore`: the list renders again only when the rows in view change, not on every scroll event.
 */
function useVirtualRows({
  count,
  virtualize = "auto",
  estimateSize,
  getKey,
  overscan = 8,
  scrollElement: findScroller = scrollParentOf,
  findable,
}: VirtualRowsOptions) {
  const enabled = isVirtual(virtualize, count)
  const estimate = useMemo(() => sizeOf(estimateSize), [estimateSize])
  const [scroller, setScroller] = useState<Scroller | null>(null)
  const margin = scroller?.margin ?? 0
  const [rows] = useState(() => createRows({ count, estimate, getKey, margin, findable }, overscan))

  useLayoutEffect(() => {
    rows.update({ count, estimate, getKey, margin, findable })
    // oxlint-disable-next-line p-otero/no-callback-prop-in-effect-deps -- a new getKey means new keys, which re-measure rows; List and DataTable memoize it, and a refresh never renders the parent unless the rows in view change
  }, [rows, count, estimate, getKey, margin, findable])
  useLayoutEffect(() => (enabled && scroller ? connectRows(rows, scroller) : undefined), [rows, enabled, scroller])

  const live = enabled && scroller !== null
  const items = useSyncExternalStore(
    live ? rows.virtualizer.subscribe : noSubscription,
    () => (live ? rows.virtualizer.items() : noItems),
    () => noItems,
  )

  const anchor = useCallback(
    (node: HTMLElement | null) => {
      if (!node || !enabled) return
      const scrollElement = findScroller(node)
      setScroller({ element: scrollElement, margin: marginIn(node, scrollElement) })
    },
    [enabled, findScroller],
  )

  let segments: Segment[]
  if (!enabled) {
    segments = Array.from({ length: count }, (_, index) => ({ type: "row", index, key: getKey(index) }))
  } else if (!live) {
    segments =
      count > 0 ? [{ type: "gap", size: count * sizeAt(estimate, 0), from: 0, to: count, key: "gap-start" }] : []
  } else {
    segments = segmentsOf(items, rows.virtualizer.size(), count)
  }

  const scrollToIndex = useCallback(
    (index: number) => {
      if (enabled) rows.virtualizer.scrollToIndex(index, { align: "auto" })
    },
    [enabled, rows],
  )
  const pin = useCallback((index: number | undefined) => rows.pin(index), [rows])
  /** Renders a row now, wherever the list is scrolled, like one an agent is about to activate. */
  const renderNow = useCallback(
    (index: number) => {
      if (!enabled) return
      rows.pin(index)
      flushSync(() => rows.virtualizer.refresh())
    },
    [enabled, rows],
  )
  // A row's ref: measures it, then as it resizes, until React runs the returned cleanup.
  const measureElement = useCallback(
    (node: HTMLElement | null) => {
      if (!node) return undefined
      const index = Number(node.dataset.index)
      return Number.isInteger(index) ? rows.measure(index, node) : undefined
    },
    [rows],
  )

  return {
    enabled,
    anchor,
    segments,
    pin,
    renderNow,
    rendered: (index: number) => !enabled || segments.some((s) => s.type === "row" && s.index === index),
    measureElement: enabled ? measureElement : undefined,
    scrollToIndex,
  }
}

export { scrollParentOf, useVirtualRows, VIRTUALIZE_THRESHOLD }
export type { Segment, Virtualize, VirtualRowsOptions }
