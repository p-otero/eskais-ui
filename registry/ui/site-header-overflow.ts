"use client"

import { useEffect, useRef, useState } from "react"

/** How many items, in order, fit in `available` with the gap between them, leaving room for a More trigger. */
function fitCount(widths: readonly number[], moreWidth: number, gap: number, available: number) {
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1)
  if (total <= available) return widths.length
  let used = moreWidth
  let count = 0
  for (const width of widths) {
    if (used + gap + width > available) break
    used += gap + width
    count++
  }
  return count
}

function widthOf(element: Element | null) {
  return element?.getBoundingClientRect().width ?? 0
}

/**
 * Measures a hidden row of item copies against the space their container offers. It observes sizes, never scroll
 * or window resize, so it also reacts to fonts loading and to siblings growing.
 */
function useOverflowCount() {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure || typeof ResizeObserver !== "function") return
    const observer = new ResizeObserver(() => {
      const items = [...measure.querySelectorAll('[data-slot="site-header-measure-item"]')].map(widthOf)
      const more = widthOf(measure.querySelector('[data-slot="site-header-measure-more"]'))
      const gap = Number.parseFloat(getComputedStyle(measure).columnGap) || 0
      setCount(fitCount(items, more, gap, widthOf(container)))
    })
    observer.observe(container)
    observer.observe(measure)
    return () => observer.disconnect()
  }, [])

  return { containerRef, measureRef, count }
}

export { fitCount, useOverflowCount }
