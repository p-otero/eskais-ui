"use client"

import { useEffect, useState, type RefObject } from "react"

import type { DocsTocItem } from "@/components/ui/docs-toc"

/** Reads the headings with an id inside `container`, and follows them as they change. */
function useTocItems(container: RefObject<HTMLElement | null>, selector = "h2[id], h3[id]") {
  const [items, setItems] = useState<DocsTocItem[]>([])
  useEffect(() => {
    const element = container.current
    if (!element) return
    const read = () => {
      const next = [...element.querySelectorAll<HTMLElement>(selector)].map((heading) => ({
        id: heading.id,
        label: heading.textContent ?? "",
        level: heading.tagName === "H3" ? (3 as const) : (2 as const),
      }))
      setItems((previous) =>
        previous.length === next.length && previous.every((item, index) => item.id === next[index]?.id)
          ? previous
          : next,
      )
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(element, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [container, selector])
  return items
}

/** The heading being read among `ids` (newline-separated, in page order). */
function useActiveId(ids: string, rootMargin: string) {
  const [active, setActive] = useState<string>()
  useEffect(() => {
    const order = ids ? ids.split("\n") : []
    const elements = order.map((id) => document.getElementById(id)).filter((element) => element !== null)
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return
    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        const first = order.find((id) => visible.has(id))
        // Between two headings the one above stays active, so a long section keeps its entry highlighted.
        const above = elements.findLast((element) => element.getBoundingClientRect().top < 0)
        setActive(first ?? above?.id ?? order[0])
      },
      { rootMargin },
    )
    for (const element of elements) observer.observe(element)
    return () => observer.disconnect()
  }, [ids, rootMargin])
  return active
}

export { useActiveId, useTocItems }
