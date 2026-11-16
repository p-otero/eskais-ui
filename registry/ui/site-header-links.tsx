"use client"

import type { ComponentProps, ReactElement } from "react"

import { NavigationMenuLink } from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"

type SiteHeaderItem = {
  label: string
  /** Where the link goes. An item with `items` is a dropdown and needs none. */
  href?: string
  /** Marks the link for the current page with `aria-current="page"`. */
  current?: boolean
  /** A second line under the label, in a dropdown or the More panel. */
  description?: string
  /** Your router's link, like `<Link to="/pricing" />`. Wins over `renderLink`. */
  render?: ReactElement<Record<string, unknown>>
  /** Child links: the item becomes a dropdown. One level deep. */
  items?: readonly SiteHeaderItem[]
}

type SiteHeaderRenderLink = (item: SiteHeaderItem) => ReactElement<Record<string, unknown>> | undefined

function isCurrent(item: SiteHeaderItem): boolean {
  return Boolean(item.current) || (item.items?.some(isCurrent) ?? false)
}

// A router link brings its own href, and a second one on top could point somewhere else.
function linkTarget(item: SiteHeaderItem, renderLink: SiteHeaderRenderLink | undefined) {
  const render = item.render ?? renderLink?.(item)
  return render ? { render } : { href: item.href }
}

type PanelLinksProps = Omit<ComponentProps<"ul">, "children"> & {
  items: readonly SiteHeaderItem[]
  renderLink?: SiteHeaderRenderLink
}

function SiteHeaderPanelLinks({ items, renderLink, className, ...props }: PanelLinksProps) {
  return (
    <ul className={cn("m-0 flex list-none flex-col gap-px p-0", className)} {...props}>
      {items.map((item) => (
        <li key={item.label}>
          <NavigationMenuLink
            {...linkTarget(item, renderLink)}
            current={item.current}
            className="justify-center pointer-coarse:min-h-(--control-height-touch) data-current:bg-accent data-current:text-accent-foreground"
          >
            <span className="font-medium">{item.label}</span>
            {item.description && <span className="text-body-sm text-muted-foreground">{item.description}</span>}
          </NavigationMenuLink>
        </li>
      ))}
    </ul>
  )
}

export { isCurrent, linkTarget, SiteHeaderPanelLinks }
export type { SiteHeaderItem, SiteHeaderRenderLink }
