"use client"

import { useEffectEvent, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

import type { UrlParamAdapter } from "@/lib/url-param"

const noSubscription = () => () => {}

/**
 * The selected id: `selectedId` when controlled, else the URL's when `url` is set, else its own state. `apply`
 * stores an accepted change wherever the value lives.
 */
function useSelectedId(
  selectedId: string | null | undefined,
  defaultSelectedId: string | null | undefined,
  url: UrlParamAdapter | undefined,
) {
  const [own, setOwn] = useState<string | null>(defaultSelectedId ?? null)
  const fromUrl = useSyncExternalStore(
    url?.subscribe ?? noSubscription,
    () => url?.read() ?? null,
    () => null,
  )
  let current = own
  if (selectedId !== undefined) current = selectedId
  else if (url) current = fromUrl
  const apply = (id: string | null) => {
    if (selectedId !== undefined) return
    if (url) url.write(id)
    else setOwn(id)
  }
  return [current, apply] as const
}

function rootFontSize() {
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/**
 * Whether `element` is narrower than `rem`, measured like the CSS container query that stacks the panes, so the two
 * agree. False on the server and until measured.
 */
function useNarrowerThan(element: HTMLElement | null, rem: number) {
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    if (!element) return
    const measure = () => {
      const width = element.clientWidth
      setNarrow(width > 0 && width < rem * rootFontSize())
    }
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element, rem])
  return narrow
}

type FocusRequest = "detail" | "row"

type DetailFocusOptions = {
  selectedId: string | null
  /** Whether the panes are stacked, so the list is hidden while an item is open. */
  stacked: boolean
  list: HTMLElement | null
  detail: HTMLElement | null
  /** The focusable element of the row with this id; by default the row with `data-item-id` or `data-row-id`. */
  getRowElement?: (id: string) => HTMLElement | null | undefined
}

function focusHeading(pane: HTMLElement | null) {
  if (!pane) return
  const heading =
    pane.querySelector<HTMLElement>('[data-slot="master-detail-title"]') ??
    pane.querySelector<HTMLElement>("h1, h2, h3, h4, h5, h6")
  const target = heading ?? pane
  if (!target.hasAttribute("tabindex")) target.tabIndex = -1
  target.focus()
}

function defaultRow(list: HTMLElement | null, id: string) {
  const escaped = CSS.escape(id)
  const row = list?.querySelector<HTMLElement>(`[data-item-id="${escaped}"], [data-row-id="${escaped}"]`)
  if (!row) return null
  if (row.hasAttribute("tabindex")) return row
  return row.querySelector<HTMLElement>('[data-slot="list-item-primary"], a[href], button:not([disabled]), [tabindex]')
}

type DetailFocus = {
  /** Where focus goes after the next selection change: the open item's heading, or its row. */
  request: (target: FocusRequest) => void
  /** Focuses the open item's heading now, like when its row is pressed again. */
  heading: () => void
}

/**
 * Moves focus once the selection has rendered: to the detail's heading when it opens, back to the row that opened
 * it when it closes. A change that didn't ask (followed focus, an agent, the URL) only moves focus that would
 * otherwise be lost: on the body, in the pane being hidden, or in the detail that just closed.
 */
function useDetailFocus({ selectedId, stacked, list, detail, getRowElement }: DetailFocusOptions): DetailFocus {
  const previous = useRef(selectedId)
  const pending = useRef<FocusRequest | null>(null)
  const panes = useRef({ detail })
  const isStacked = useEffectEvent(() => stacked)
  const rowOf = useEffectEvent((id: string) => (getRowElement ? getRowElement(id) : defaultRow(list, id)))
  useLayoutEffect(() => {
    panes.current = { detail }
  }, [detail])
  useLayoutEffect(() => {
    const before = previous.current
    previous.current = selectedId
    const request = pending.current
    pending.current = null
    if (before === selectedId) return
    const active = document.activeElement
    const lost = active === null || active === document.body
    if (selectedId !== null) {
      const hidden = isStacked() && active !== null && list?.contains(active) === true
      if (request === "detail" || lost || hidden) focusHeading(detail)
      return
    }
    if (before === null) return
    const inDetail = active !== null && detail?.contains(active) === true
    if (request === "row" || lost || inDetail) rowOf(before)?.focus()
  }, [selectedId, list, detail])
  return useMemo<DetailFocus>(
    () => ({
      request: (target) => {
        pending.current = target
      },
      heading: () => focusHeading(panes.current.detail),
    }),
    [],
  )
}

const flagListeners = new Map<string, Set<() => void>>()

// Spec: storage can throw (blocked site data, a sandboxed frame).
function readFlag(key: string): boolean | undefined {
  let value: string | null = null
  try {
    value = localStorage.getItem(key)
  } catch {
    return undefined
  }
  return value === null ? undefined : value === "true"
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value))
  } catch {}
  for (const listener of flagListeners.get(key) ?? []) listener()
}

function subscribeFlag(key: string) {
  return (notify: () => void) => {
    const own = flagListeners.get(key) ?? new Set()
    flagListeners.set(key, own)
    own.add(notify)
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) notify()
    }
    addEventListener("storage", onStorage)
    return () => {
      own.delete(notify)
      removeEventListener("storage", onStorage)
    }
  }
}

/** A boolean remembered in localStorage under `key`; the server and the first client render use `initial`. */
function useStoredFlag(key: string | undefined, initial: boolean) {
  const [own, setOwn] = useState(initial)
  const subscribe = useMemo(() => (key === undefined ? noSubscription : subscribeFlag(key)), [key])
  const stored = useSyncExternalStore(
    subscribe,
    () => (key === undefined ? undefined : readFlag(key)),
    () => undefined,
  )
  const value = key === undefined ? own : (stored ?? initial)
  const set = (next: boolean) => (key === undefined ? setOwn(next) : writeFlag(key, next))
  return [value, set] as const
}

/** Runs `sync(value)` after each commit where `value` changed, like telling a controller about a new state. */
function useSyncAfterCommit<T>(value: T, sync: (value: T) => void) {
  const run = useEffectEvent(sync)
  useLayoutEffect(() => {
    run(value)
  }, [value])
}

export { useDetailFocus, useNarrowerThan, useSelectedId, useStoredFlag, useSyncAfterCommit }
export type { FocusRequest }
