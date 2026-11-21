"use client"

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type RefObject } from "react"

import type { ResizableController } from "@/components/ui/resizable"
import {
  findHeading,
  readHeadings,
  type DocumentEditor,
  type DocumentHeading,
  type DocumentWorkspaceMode,
} from "@/components/ui/document-workspace-context"

type StoredPanels = { explorer?: boolean; aside?: boolean; explorerSize?: number; asideSize?: number }

// Storage can throw (blocked site data, a sandboxed frame) or be missing (a server); the panels then just don't
// remember.
function readPanels(key: string | undefined): StoredPanels {
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === "object" ? (parsed as StoredPanels) : {}
  } catch {
    return {}
  }
}

function writePanels(key: string | undefined, patch: StoredPanels) {
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify({ ...readPanels(key), ...patch }))
  } catch {
    // Not remembered, still applied for this page.
  }
}

/** The sizes of the panels that are open in a committed layout, by key; `null` marks a panel that isn't there. */
function openSizes(controller: ResizableController, layout: number[], panels: Record<string, string | null>) {
  const present = Object.entries(panels).filter((entry): entry is [string, string] => entry[1] !== null)
  const sizes: StoredPanels = {}
  present.forEach(([key, panel], index) => {
    if ((key === "explorerSize" || key === "asideSize") && !controller.isCollapsed(panel)) sizes[key] = layout[index]
  })
  return sizes
}

/** Whether `ref`'s element is at most `width` px wide; false until it has been measured. */
function useContainerNarrow(ref: RefObject<HTMLElement | null>, width: number) {
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setNarrow(element.getBoundingClientRect().width <= width)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, width])
  return narrow
}

/** A value the parent may control: `value` wins when set, and `onChange` hears every change. */
function useControllable<T>(value: T | undefined, initial: () => T, onChange?: (next: T) => void) {
  const [own, setOwn] = useState(initial)
  const current = value ?? own
  const set = (next: T) => {
    if (next === current) return
    if (value === undefined) setOwn(next)
    onChange?.(next)
  }
  return [current, set] as const
}

type PanelOptions = {
  narrow: boolean
  open: boolean
  setOpen: (open: boolean) => void
  controller: ResizableController
  panelId: string
}

/**
 * One side panel, a resizable column when wide and a drawer when narrow. Entering the narrow layout closes it, so a
 * drawer never pops open on its own, and leaving it brings back what the column was.
 */
function usePanel({ narrow, open, setOpen, controller, panelId }: PanelOptions) {
  // Derived while rendering, so the drawer stays shut in the render where the layout turns narrow: it may show
  // only once it has opened in this layout.
  const [track, setTrack] = useState({ narrow, open, allowed: false })
  let allowed = track.allowed
  if (track.narrow !== narrow || track.open !== open) {
    allowed = narrow !== track.narrow ? false : open && !track.open ? true : track.allowed
    setTrack({ narrow, open, allowed })
  }

  const wide = useRef<boolean | null>(null)
  const onLayout = useEffectEvent((isNarrow: boolean) => {
    if (isNarrow) {
      if (wide.current === null) wide.current = open
      if (open) setOpen(false)
    } else if (wide.current !== null) {
      const restore = wide.current
      wide.current = null
      if (restore !== open) setOpen(restore)
    }
  })
  useEffect(() => onLayout(narrow), [narrow])

  useEffect(() => {
    if (narrow) return
    if (open && controller.isCollapsed(panelId)) controller.expand(panelId)
    else if (!open && !controller.isCollapsed(panelId)) controller.collapse(panelId)
  }, [narrow, open, controller, panelId])

  return { drawerOpen: narrow && open && allowed }
}

/** Calls `onChange` after a render where `key` differs from the one before; never on mount. */
function useOnKeyChange(key: unknown, onChange: () => void) {
  const changed = useEffectEvent(onChange)
  const previous = useRef(key)
  useEffect(() => {
    if (Object.is(previous.current, key)) return
    previous.current = key
    changed()
  }, [key])
}

type ModeScrollOptions = {
  mode: DocumentWorkspaceMode
  headings: readonly DocumentHeading[]
  editorRef: RefObject<DocumentEditor | null> | undefined
  documentRef: RefObject<HTMLElement | null>
}

function scrollToElement(container: HTMLElement, element: HTMLElement) {
  container.scrollTop += element.getBoundingClientRect().top - container.getBoundingClientRect().top
}

/** Focuses what `find` returns as soon as it exists, for up to a second. */
function focusWhenReady(find: () => HTMLElement | null) {
  let frames = 0
  const step = () => {
    const target = find()
    if (target) target.focus({ preventScroll: true })
    else if (frames++ < 60) requestAnimationFrame(step)
  }
  step()
}

/**
 * For half a second after a popup closes, focus left on nothing (the body, or the region an editor was replaced
 * in) goes back to the document. A note opened from the popup remounts the editor that focus returned to.
 */
function watchLostFocus(region: HTMLElement | null, refocus: () => void) {
  const until = performance.now() + 500
  const step = () => {
    const active = document.activeElement
    if (!active || active === document.body || active === region) {
      refocus()
      return
    }
    if (performance.now() < until) requestAnimationFrame(step)
  }
  step()
}

/** Runs `step` on each frame until it returns true, for up to a second; the result cancels it. */
function eachFrame(step: () => boolean) {
  let frames = 0
  let frame = 0
  const run = () => {
    if (step() || ++frames >= 60) return
    frame = requestAnimationFrame(run)
  }
  frame = requestAnimationFrame(run)
  return () => cancelAnimationFrame(frame)
}

function revealHeading(container: HTMLElement | null, heading: DocumentHeading | number) {
  const target = findHeading(container, heading)
  if (!container || !target) return
  scrollToElement(container, target)
  if (!target.hasAttribute("tabindex")) target.tabIndex = -1
  target.focus({ preventScroll: true })
}

/**
 * Keeps the reading position across a mode switch, by heading: `capture` notes the heading at the top before the
 * switch, and once the other mode has rendered, it is scrolled to the top there.
 */
function useModeScroll({ mode, headings, editorRef, documentRef }: ModeScrollOptions) {
  const pending = useRef<number | null>(null)

  const capture = () => {
    if (mode === "edit") {
      const line = editorRef?.current?.getScrollLine() ?? 1
      pending.current = headings.findLastIndex((heading) => heading.line <= line)
      return
    }
    const container = documentRef.current
    if (!container) return
    const top = container.getBoundingClientRect().top + 4
    const rendered = readHeadings(container)
    const index = rendered.findLastIndex((heading) => heading.getBoundingClientRect().top <= top)
    const slug = rendered[index]?.dataset.slug
    const bySlug = slug === undefined ? -1 : headings.findIndex((heading) => heading.slug === slug)
    pending.current = bySlug >= 0 ? bySlug : index
  }

  const restore = useEffectEvent((index: number, to: DocumentWorkspaceMode) => {
    // The other mode's view mounts its content a frame or more later (an editor builds its view in an effect).
    return eachFrame(() => {
      if (to === "read") {
        const container = documentRef.current
        const target = index >= 0 ? findHeading(container, headings[index] ?? index) : undefined
        if (!container || (!target && index >= 0)) return false
        if (target) scrollToElement(container, target)
        else container.scrollTop = 0
        return true
      }
      const editor = editorRef?.current
      if (!editor) return false
      editor.scrollToLine(index >= 0 ? (headings[index]?.line ?? 1) : 1)
      return true
    })
  })

  useEffect(() => {
    const index = pending.current
    pending.current = null
    if (index === null) return
    return restore(index, mode)
  }, [mode])

  return capture
}

export {
  focusWhenReady,
  openSizes,
  readPanels,
  revealHeading,
  useContainerNarrow,
  useControllable,
  useModeScroll,
  useOnKeyChange,
  usePanel,
  watchLostFocus,
  writePanels,
}
export type { StoredPanels }
