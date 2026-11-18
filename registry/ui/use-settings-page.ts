"use client"

import { createContext, use, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react"

import type { UrlParamAdapter } from "@/lib/url-param"

// A smooth scroll that never fires scrollend (nothing to scroll) still unlocks after this long.
const jumpLock = 1000

/**
 * The section being read among `ids` (newline-separated, in page order): the first one across a band just below the
 * sticky bars (the sections' `scroll-margin-top`), else the one above it. `pin` holds a section someone went to until
 * the scroll lands, so the sections it passes don't flash, and until the next crossing after that: a
 * short last section stays marked though it never reaches the band.
 */
function useObservedSection(ids: string, onChange: (id: string) => void) {
  const [observed, setObserved] = useState<string>()
  const locked = useRef(false)
  const last = useRef<string | undefined>(undefined)
  const changed = useEffectEvent(onChange)
  useEffect(() => {
    const order = ids ? ids.split("\n") : []
    const elements = order.map((id) => document.getElementById(id)).filter((element) => element !== null)
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return
    const visible = new Set<string>()
    const line = Number.parseFloat(getComputedStyle(elements[0]!).scrollMarginTop) || 0
    const band = Math.max(line + 1, innerHeight * 0.3)
    const update = () => {
      if (locked.current) return
      const above = elements.findLast((element) => element.getBoundingClientRect().top < line)
      const next = order.find((id) => visible.has(id)) ?? above?.id ?? order[0]
      if (next === undefined) return
      if (next === last.current) return
      last.current = next
      setObserved(next)
      changed(next)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        update()
      },
      { rootMargin: `-${String(line)}px 0px -${String(Math.max(0, innerHeight - band))}px 0px` },
    )
    for (const element of elements) observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [ids])
  return {
    observed,
    pin: (id: string) => {
      locked.current = true
      last.current = id
      setObserved(id)
      // The scroll landing, or the person taking over with a wheel, a touch or a key, ends the hold.
      const ends = ["scrollend", "wheel", "touchstart", "keydown"] as const
      const release = () => {
        clearTimeout(timer)
        for (const type of ends) removeEventListener(type, release, true)
        locked.current = false
      }
      const timer = setTimeout(release, jumpLock)
      for (const type of ends) addEventListener(type, release, { capture: true, passive: true })
    },
  }
}

/**
 * Calls `jump` with the URL's section on mount and whenever the URL changes to another one, like Back or a deep
 * link. Returns `write`, which records a section in the URL without jumping to it again.
 */
function useUrlSection(url: UrlParamAdapter | undefined, jump: (id: string) => void) {
  const last = useRef<string | null>(null)
  const onUrl = useEffectEvent(() => {
    const id = url?.read() ?? null
    if (id === null || id === last.current) return
    last.current = id
    jump(id)
  })
  useEffect(() => {
    if (!url) return
    onUrl()
    return url.subscribe(onUrl)
  }, [url])
  return (id: string) => {
    last.current = id
    url?.write(id)
  }
}

// What counts as the person taking over the page before a section the URL named has mounted.
const interactions = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "focusin"] as const

/**
 * A section the URL named before it mounted, like one that renders after its data loads. Its `SettingsSection`
 * reports in when it mounts and `arrive` runs once, unless the person has pressed, typed, scrolled or moved focus
 * since: then the page stays where they put it.
 */
function createPendingSection() {
  let waiting: { id: string; arrive: (id: string) => void } | null = null
  const cancel = () => {
    waiting = null
  }
  return {
    wait(id: string, arrive: (id: string) => void) {
      waiting = { id, arrive }
    },
    mounted(id: string) {
      if (waiting?.id !== id) return
      const { arrive } = waiting
      waiting = null
      arrive(id)
    },
    cancel,
    /** Listens for the person taking over while the page is mounted; returns the cleanup. */
    listen() {
      for (const type of interactions) addEventListener(type, cancel, { capture: true, passive: true })
      return () => {
        for (const type of interactions) removeEventListener(type, cancel, true)
      }
    },
  }
}

type PendingSection = ReturnType<typeof createPendingSection>

const PendingSectionContext = createContext<PendingSection | null>(null)

function usePendingSection() {
  const [pending] = useState(createPendingSection)
  useEffect(() => pending.listen(), [pending])
  return pending
}

/** Tells the page a section has mounted, so a URL that named it before it rendered can still go to it. */
function useSectionMounted(id: string) {
  const pending = use(PendingSectionContext)
  useLayoutEffect(() => pending?.mounted(id), [pending, id])
}

export { PendingSectionContext, useObservedSection, usePendingSection, useSectionMounted, useUrlSection }
