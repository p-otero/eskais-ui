"use client"

import { useEffect, useRef, useState } from "react"

import { fitCount, widthOf } from "@/components/ui/site-header-overflow"

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

/** Whether the 1px sentinel the header renders has left the viewport, so the page scrolled under the header. */
function useScrolled() {
  const sentinelRef = useRef<HTMLSpanElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver !== "function") return
    const observer = new IntersectionObserver(([entry]) => setScrolled(entry ? !entry.isIntersecting : false))
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])
  return { sentinelRef, scrolled }
}

export { useOverflowCount, useScrolled }
