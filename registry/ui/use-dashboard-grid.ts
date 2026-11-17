"use client"

import { useLayoutEffect, useState } from "react"

/** Whether `element`'s content is taller than its box, so it scrolls; follows resizes of the box and its content. */
function useOverflowing(element: HTMLElement | null) {
  const [overflowing, setOverflowing] = useState(false)
  useLayoutEffect(() => {
    if (!element) return
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of element.children) observer.observe(child)
    const mutations = new MutationObserver(() => {
      for (const child of element.children) observer.observe(child)
      measure()
    })
    mutations.observe(element, { childList: true })
    return () => {
      observer.disconnect()
      mutations.disconnect()
    }
  }, [element])
  return overflowing
}

export { useOverflowing }
