"use client"

import { useMemo, useSyncExternalStore } from "react"

/** The theme's `narrow:` breakpoint, as a media query. */
const narrowQuery = "(width <= 47.5rem)"

function subscribeTo(query: string) {
  return (notify: () => void) => {
    if (typeof matchMedia !== "function") return () => {}
    const list = matchMedia(query)
    list.addEventListener("change", notify)
    return () => list.removeEventListener("change", notify)
  }
}

// The server and the first client render report no match, so hydration matches before the query runs.
function useMediaQuery(query: string) {
  const subscribe = useMemo(() => subscribeTo(query), [query])
  return useSyncExternalStore(
    subscribe,
    () => typeof matchMedia === "function" && matchMedia(query).matches,
    () => false,
  )
}

export { narrowQuery, useMediaQuery }
