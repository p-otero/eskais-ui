"use client"

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"

import { Button } from "@/components/ui/button"

type TabsScrollLabels = {
  /** Names of the pointer-only scroll buttons. They are hidden from screen readers, which reach every tab by arrow keys. */
  left: string
  right: string
}

const tabsScrollLabels: TabsScrollLabels = { left: "Scroll tabs left", right: "Scroll tabs right" }

type Edges = { left: boolean; right: boolean }

// Physical edges, not logical ones: scrollLeft is negative under rtl in every current engine, and the fades and
// buttons are placed physically, so reading both sides from the absolute offset covers both directions.
function readEdges(element: HTMLElement): Edges {
  const max = element.scrollWidth - element.clientWidth
  if (max <= 1) return { left: false, right: false }
  const offset = Math.abs(element.scrollLeft)
  const fromStart = offset > 1
  const toEnd = offset < max - 1
  const rtl = getComputedStyle(element).direction === "rtl"
  return rtl ? { left: toEnd, right: fromStart } : { left: fromStart, right: toEnd }
}

function useScrollEdges() {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState<Edges>({ left: false, right: false })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () =>
      setEdges((previous) => {
        const next = readEdges(element)
        return next.left === previous.left && next.right === previous.right ? previous : next
      })
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : undefined
    observer?.observe(element)
    for (const child of element.children) observer?.observe(child)
    element.addEventListener("scroll", update, { passive: true })
    update()
    return () => {
      observer?.disconnect()
      element.removeEventListener("scroll", update)
    }
  }, [])

  const scroll = (direction: -1 | 1) => {
    const element = ref.current
    if (!element) return
    const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" })
  }

  return { ref, edges, scroll }
}

function Chevron({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

type ScrollButtonProps = { side: "left" | "right"; label: string; onScroll: () => void }

// Pointer-only, so aria-hidden and out of the tab order; agents select tabs on the tablist itself.
function ScrollButton({ side, label, onScroll }: ScrollButtonProps) {
  return (
    <span
      data-slot="tabs-scroll-button"
      data-side={side}
      className="absolute inset-y-0 hidden items-center rounded-control bg-muted data-[side=left]:left-0 data-[side=right]:right-0 group-data-overflow-left/tabs-scroll:data-[side=left]:pointer-fine:flex group-data-overflow-right/tabs-scroll:data-[side=right]:pointer-fine:flex"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-hidden="true"
        tabIndex={-1}
        data-agent-hidden=""
        onClick={onScroll}
      >
        <Chevron d={side === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </Button>
    </span>
  )
}

type TabsScrollProps = {
  labels?: Partial<TabsScrollLabels>
  children: (ref: RefObject<HTMLDivElement | null>) => ReactNode
}

function TabsScroll({ labels: labelOverrides, children }: TabsScrollProps) {
  const labels = { ...tabsScrollLabels, ...labelOverrides }
  const { ref, edges, scroll } = useScrollEdges()
  return (
    <div
      data-slot="tabs-scroll"
      data-overflow-left={edges.left ? "" : undefined}
      data-overflow-right={edges.right ? "" : undefined}
      className="group/tabs-scroll relative flex max-w-full min-w-0 has-data-[orientation=vertical]:contents"
    >
      {children(ref)}
      <ScrollButton side="left" label={labels.left} onScroll={() => scroll(-1)} />
      <ScrollButton side="right" label={labels.right} onScroll={() => scroll(1)} />
    </div>
  )
}

export { readEdges, TabsScroll, tabsScrollLabels }
export type { TabsScrollLabels }
