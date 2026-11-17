"use client"

import type { ComponentProps, ReactNode } from "react"

import { Link } from "@/components/ui/link"
import { useActiveId, useTocItems } from "@/components/ui/use-docs-toc"
import { cn } from "@/lib/utils"

type DocsTocItem = { id: string; label: ReactNode; level?: 2 | 3 }

type DocsTocProps = Omit<ComponentProps<"nav">, "children"> & {
  items: readonly DocsTocItem[]
  /** A visible title above the list; the navigation is named by `aria-label` either way. */
  title?: ReactNode
  /** Where a heading counts as read, as an IntersectionObserver rootMargin; the top inset clears a sticky header. */
  rootMargin?: string
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
