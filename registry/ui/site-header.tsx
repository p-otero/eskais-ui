"use client"

import type { ComponentProps, ReactNode } from "react"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuItemClassName,
} from "@/components/ui/navigation-menu"
import { SiteHeaderDrawer } from "@/components/ui/site-header-drawer"
import {
  isCurrent,
  linkTarget,
  SiteHeaderPanelLinks,
  type SiteHeaderItem,
  type SiteHeaderRenderLink,
} from "@/components/ui/site-header-links"
import { useOverflowCount, useScrolled } from "@/components/ui/use-site-header"
import { cn } from "@/lib/utils"

type SiteHeaderLabels = {
  /** The trigger that holds the links that don't fit. */
  more: string
  /** The narrow-screen button that opens every link in a drawer. */
  menu: string
  close: string
}

const siteHeaderLabels: SiteHeaderLabels = { more: "More", menu: "Open menu", close: "Close menu" }

type SiteHeaderProps = Omit<ComponentProps<"header">, "children"> & {
  /** Names the `<nav>` landmark, like "Main". */
  label: string
  /** Usually a link to the home page with the logo. */
  brand?: ReactNode
  items: readonly SiteHeaderItem[]
  /** Calls to action at the end, like a Button to sign in. */
  actions?: ReactNode
  /** Turns every link into your router's, like `(item) => <Link to={item.href} />`. */
  renderLink?: SiteHeaderRenderLink
  moreLabel?: string
  menuLabel?: string
  closeLabel?: string
  /** The drawer's title on narrow screens. Defaults to `label`. */
  menuTitle?: string
}

// oxlint-disable-next-line shadcn/no-arbitrary-values -- sticks below the safe area, like Floating's top edge
const stickyClassName = "sticky top-[calc(var(--floating-offset)+env(safe-area-inset-top))]"

const scrolledClassName = [
  "group-data-scrolled/site-header:bg-[color-mix(in_oklab,var(--popover)_min(100%,calc(var(--floating-opacity)+10%)),transparent)]",
  "group-data-scrolled/site-header:shadow-[var(--floating-shadow),var(--floating-shadow)]",
].join(" ")

const triggerCurrentClassName = "data-current:bg-accent data-current:text-accent-foreground"

function Chevron() {
  return <span aria-hidden="true" className="size-3 shrink-0" />
}

function BarItem({ item, renderLink }: { item: SiteHeaderItem; renderLink?: SiteHeaderRenderLink }) {
  if (!item.items) {
    return (
      <NavigationMenuItem>
        <NavigationMenuLink
          {...linkTarget(item, renderLink)}
          current={item.current}
          variant="top"
          className="touch-target"
        >
          {item.label}
        </NavigationMenuLink>
      </NavigationMenuItem>
    )
  }
  return (
    <NavigationMenuItem value={item.label}>
      <NavigationMenuTrigger
        data-current={isCurrent(item) ? "" : undefined}
        className={cn("touch-target", triggerCurrentClassName)}
      >
        {item.label}
      </NavigationMenuTrigger>
      <NavigationMenuContent sideOffset={8}>
        <SiteHeaderPanelLinks items={item.items} renderLink={renderLink} className="w-64" />
      </NavigationMenuContent>
    </NavigationMenuItem>
  )
}

function MorePanel({ items, renderLink }: { items: readonly SiteHeaderItem[]; renderLink?: SiteHeaderRenderLink }) {
  const links = items.filter((item) => !item.items)
  const groups = items.filter((item) => item.items)
  return (
    <div className="flex w-64 flex-col gap-group">
      {links.length > 0 && <SiteHeaderPanelLinks items={links} renderLink={renderLink} />}
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-inline">
          <span className="px-inset-item text-caption font-medium text-muted-foreground">{group.label}</span>
          <SiteHeaderPanelLinks items={group.items ?? []} renderLink={renderLink} aria-label={group.label} />
        </div>
      ))}
    </div>
  )
}

function SiteHeader({
  label,
  brand,
  items,
  actions,
  renderLink,
  moreLabel = siteHeaderLabels.more,
  menuLabel = siteHeaderLabels.menu,
  closeLabel = siteHeaderLabels.close,
  menuTitle,
  className,
  ...props
}: SiteHeaderProps) {
  const { containerRef, measureRef, count } = useOverflowCount()
  const { sentinelRef, scrolled } = useScrolled()
  const shown = count === null ? items : items.slice(0, count)
  const hidden = count === null ? [] : items.slice(count)

  return (
    <>
      <span ref={sentinelRef} aria-hidden="true" data-slot="site-header-sentinel" className="absolute size-px" />
      <header
        data-slot="site-header"
        data-scrolled={scrolled ? "" : undefined}
        className={cn(
          "group/site-header pointer-events-none z-sticky flex w-full justify-center px-floating",
          stickyClassName,
          className,
        )}
        {...props}
      >
        <div
          data-slot="site-header-bar"
          className={cn(
            "pointer-events-auto flex w-full max-w-(--site-header-width,64rem) min-w-0 items-center gap-items surface-floating p-inline transition duration-panel ease-standard",
            scrolledClassName,
          )}
        >
          {brand !== undefined && (
            <div data-slot="site-header-brand" className="flex shrink-0 items-center ps-(--item-padding-x)">
              {brand}
            </div>
          )}
          <div ref={containerRef} data-slot="site-header-nav" className="relative min-w-0 flex-1 narrow:hidden">
            <NavigationMenu
              aria-label={label}
              data-measured={count === null ? undefined : ""}
              className="w-full max-w-none justify-center not-data-measured:overflow-hidden"
            >
              <NavigationMenuList>
                {shown.map((item) => (
                  <BarItem key={item.label} item={item} renderLink={renderLink} />
                ))}
                {hidden.length > 0 && (
                  <NavigationMenuItem value="more">
                    <NavigationMenuTrigger
                      data-current={hidden.some(isCurrent) ? "" : undefined}
                      className={cn("touch-target", triggerCurrentClassName)}
                    >
                      {moreLabel}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent sideOffset={8} align="end">
                      <MorePanel items={hidden} renderLink={renderLink} />
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                )}
              </NavigationMenuList>
            </NavigationMenu>
            {/* Spec: an invisible row wider than the bar still widens the page: on a phone the layout viewport grows with
                it, and fixed overlays (dialogs, sheets) are laid out past the screen's edge. */}
            <div aria-hidden="true" inert className="pointer-events-none invisible absolute inset-0 overflow-hidden">
              <div
                ref={measureRef}
                data-slot="site-header-measure"
                className="absolute start-0 top-0 flex w-max gap-inline"
              >
                {items.map((item) => (
                  <span key={item.label} data-slot="site-header-measure-item" className={navigationMenuItemClassName}>
                    {item.label}
                    {item.items && <Chevron />}
                  </span>
                ))}
                <span data-slot="site-header-measure-more" className={navigationMenuItemClassName}>
                  {moreLabel}
                  <Chevron />
                </span>
              </div>
            </div>
          </div>
          {actions !== undefined && (
            <div data-slot="site-header-actions" className="ms-auto flex shrink-0 items-center gap-items">
              {actions}
            </div>
          )}
          <SiteHeaderDrawer
            label={label}
            title={menuTitle ?? label}
            items={items}
            renderLink={renderLink}
            menuLabel={menuLabel}
            closeLabel={closeLabel}
          />
        </div>
      </header>
    </>
  )
}

export { SiteHeader, siteHeaderLabels }
export type { SiteHeaderItem, SiteHeaderLabels, SiteHeaderProps, SiteHeaderRenderLink }
