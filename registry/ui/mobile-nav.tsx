"use client"

import type { ComponentProps, ReactElement, ReactNode } from "react"
import { EllipsisIcon } from "lucide-react"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuLinkIcon,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"

type MobileNavItem = {
  label: string
  href?: string
  /** Shown above the label; decorative, so the label names the link. */
  icon: ReactNode
  current?: boolean
  /** A short count or mark on the icon, like 3. It joins the link's name. */
  badge?: ReactNode
  /** Your router's link, like `<Link to="/inbox" />`. Wins over `renderLink`. */
  render?: ReactElement<Record<string, unknown>>
}

type MobileNavProps = Omit<ComponentProps<"nav">, "children" | "defaultValue"> & {
  /** Names the `<nav>` landmark. */
  label: string
  /** Up to five. Past five, or with `overflow`, the fifth slot becomes More. */
  items: MobileNavItem[]
  /** Links that open from More, above the bar. */
  overflow?: MobileNavItem[]
  moreLabel?: string
  moreIcon?: ReactNode
  renderLink?: (item: MobileNavItem) => ReactElement<Record<string, unknown>> | undefined
  /** Shows the bar at every width, not only on narrow screens. */
  always?: boolean
}

const maxSlots = 5

const slotClassName =
  "group/mobile-nav-item relative flex h-(--mobile-nav-height) min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-px rounded-control px-inline py-0 text-caption data-has-icon:flex-col data-has-icon:items-center font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-current:text-foreground data-open:text-foreground"

const iconClassName =
  "relative inline-flex h-control-sm w-full max-w-14 items-center justify-center rounded-full transition-colors group-data-current/mobile-nav-item:bg-accent group-data-current/mobile-nav-item:text-accent-foreground group-data-open/mobile-nav-item:bg-accent [&_svg]:size-5 [&_svg]:shrink-0"

const noOverflow: MobileNavItem[] = []
const dots = <EllipsisIcon />

// oxlint-disable-next-line shadcn/no-arbitrary-values -- keeps the links above the home indicator
const safeAreaClassName = "pb-[env(safe-area-inset-bottom)]"

function target(item: MobileNavItem, renderLink: MobileNavProps["renderLink"]) {
  const render = item.render ?? renderLink?.(item)
  return render ? { render } : { href: item.href }
}

// After the label in the DOM, so the link reads "Inbox, 3", and placed over the icon's top end.
function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="absolute start-1/2 top-inline ms-inline inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-inset-chip text-meta leading-none text-destructive-foreground">
      <span className="sr-only">, </span>
      {children}
    </span>
  )
}

function Slot({ item, renderLink }: { item: MobileNavItem; renderLink: MobileNavProps["renderLink"] }) {
  return (
    <NavigationMenuItem className="flex min-w-0 flex-1">
      <NavigationMenuLink
        {...target(item, renderLink)}
        current={item.current}
        data-slot="mobile-nav-link"
        className={cn(slotClassName, "flex-1")}
      >
        <span className={iconClassName}>
          <NavigationMenuLinkIcon>{item.icon}</NavigationMenuLinkIcon>
        </span>
        <span className="max-w-full truncate">{item.label}</span>
        {item.badge !== undefined && <Badge>{item.badge}</Badge>}
      </NavigationMenuLink>
    </NavigationMenuItem>
  )
}

function MobileNav({
  label,
  items,
  overflow = noOverflow,
  moreLabel = "More",
  moreIcon = dots,
  renderLink,
  always = false,
  className,
  ...props
}: MobileNavProps) {
  const fits = items.length <= maxSlots && overflow.length === 0
  const shown = fits ? items : items.slice(0, maxSlots - 1)
  const more = fits ? [] : [...items.slice(maxSlots - 1), ...overflow]

  return (
    <NavigationMenu
      aria-label={label}
      data-slot="mobile-nav"
      openOnHover={false}
      className={cn(
        "fixed inset-x-0 bottom-0 z-sticky w-full max-w-none border-t bg-background/(--glass-opacity) backdrop-surface",
        safeAreaClassName,
        always ? "flex" : "hidden narrow:flex",
        className,
      )}
      {...props}
    >
      <NavigationMenuList className="w-full gap-0 px-inline">
        {shown.map((item) => (
          <Slot key={item.label} item={item} renderLink={renderLink} />
        ))}
        {more.length > 0 && (
          <NavigationMenuItem value="more" className="flex min-w-0 flex-1">
            <NavigationMenuTrigger
              data-current={more.some((item) => item.current) ? "" : undefined}
              className={cn(
                slotClassName,
                "hover:bg-transparent data-open:bg-transparent data-open:text-foreground [&>svg:last-child]:hidden",
              )}
            >
              <span className={iconClassName}>{moreIcon}</span>
              <span className="max-w-full truncate">{moreLabel}</span>
            </NavigationMenuTrigger>
            <NavigationMenuContent side="top" align="end" sideOffset={8} collisionPadding={8}>
              <ul className="m-0 flex w-56 list-none flex-col gap-px p-0">
                {more.map((item) => (
                  <li key={item.label}>
                    <NavigationMenuLink
                      {...target(item, renderLink)}
                      current={item.current}
                      className="pointer-coarse:min-h-(--control-height-touch) data-current:bg-accent data-current:text-accent-foreground"
                    >
                      <NavigationMenuLinkIcon>{item.icon}</NavigationMenuLinkIcon>
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="text-caption text-muted-foreground">
                          <span className="sr-only">, </span>
                          {item.badge}
                        </span>
                      )}
                    </NavigationMenuLink>
                  </li>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        )}
      </NavigationMenuList>
    </NavigationMenu>
  )
}

export { MobileNav }
export type { MobileNavItem, MobileNavProps }
