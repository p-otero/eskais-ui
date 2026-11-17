"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * True once `active` has held for `delay` ms within the same `episode` (a request's key): a load that finishes
 * sooner never says "Loading…", so the live region doesn't chatter.
 */
function useDelayedFlag(active: boolean, episode: string, delay = 400) {
  const [ready, setReady] = useState<string | null>(null)
  useEffect(() => {
    if (!active) return undefined
    const timer = setTimeout(() => setReady(episode), delay)
    return () => clearTimeout(timer)
  }, [active, episode, delay])
  return active && ready === episode
}

/** A ref for an element at the end of a list: `onReach` runs whenever it scrolls into view. */
function useReachEnd(onReach: () => unknown, enabled: boolean) {
  return useCallback(
    (node: HTMLElement | null) => {
      if (!node || !enabled || typeof IntersectionObserver === "undefined") return undefined
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void onReach()
        },
        { rootMargin: "200px 0px" },
      )
      observer.observe(node)
      return () => observer.disconnect()
    },
    [onReach, enabled],
  )
}

export { useDelayedFlag, useReachEnd }
