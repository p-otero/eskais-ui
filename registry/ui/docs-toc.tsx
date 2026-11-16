"use client"

import { useEffect, useState, type ComponentProps, type ReactNode, type RefObject } from "react"

import { Link } from "@/components/ui/link"
import { cn } from "@/lib/utils"

type DocsTocItem = { id: string; label: ReactNode; level?: 2 | 3 }

type DocsTocProps = Omit<ComponentProps<"nav">, "children"> & {
  items: readonly DocsTocItem[]
  /** A visible title above the list; the navigation is named by `aria-label` either way. */
  title?: ReactNode
  /** Where a heading counts as read, as an IntersectionObserver rootMargin; the top inset clears a sticky header. */
  rootMargin?: string
}

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

/** "On this page": links to the page's headings, marking the one being read with `aria-current="location"`. */
function DocsToc({
  items,
  title,
  rootMargin = "-96px 0px -60% 0px",
  "aria-label": label = "On this page",
  className,
  ...props
}: DocsTocProps) {
  const active = useActiveId(items.map((item) => item.id).join("\n"), rootMargin)
  if (items.length === 0) return null
  return (
    <nav
      data-slot="docs-toc"
      aria-label={label}
      className={cn("flex flex-col gap-items text-body-sm", className)}
      {...props}
    >
      {title !== undefined && <p className="text-meta tracking-meta text-muted-foreground uppercase">{title}</p>}
      <ul className="flex flex-col gap-inline border-s">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`#${item.id}`}
              variant="nav"
              current={active === item.id ? "location" : undefined}
              className={cn(
                "-ms-px block border-s border-transparent py-px ps-items aria-[current]:border-primary",
                item.level === 3 && "ps-group",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export { DocsToc, useTocItems }
export type { DocsTocItem, DocsTocProps }
