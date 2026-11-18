"use client"

import { memo, useMemo, type MouseEvent } from "react"

import type { ShellRoute, ShellRouteSection, MobileRoutes } from "@/components/ui/shell-routes"
import { isPlainClick } from "@/components/ui/link-primitive"
import type { MobileNavItem } from "@/components/ui/mobile-nav"
import { SidebarGroup, SidebarItem } from "@/components/ui/sidebar"

/** Navigates to a route by id. Stable, so memoized items skip re-rendering. */
type NavigateTo = (id: string) => void

function RouteIcon({ route, className }: { route: ShellRoute; className?: string }) {
  const Icon = route.icon
  return Icon ? <Icon className={className} /> : null
}

// Memoized: on navigation only the item that was current and the one that is now re-render.
const ShellSidebarItem = memo(function ShellSidebarItem({
  route,
  current,
  navigate,
  intent,
}: {
  route: ShellRoute
  current: boolean
  navigate: NavigateTo
  intent?: NavigateTo
}) {
  return (
    <SidebarItem
      href={route.href}
      current={current}
      icon={<RouteIcon route={route} />}
      badge={route.badge}
      // Always set, so agents can follow every route; without onNavigate it loads the href like a plain link.
      onFollow={() => navigate(route.id)}
      onIntent={intent ? () => intent(route.id) : undefined}
    >
      {route.label}
    </SidebarItem>
  )
})

function ShellSidebarSections({
  sections,
  currentId,
  navigate,
  intent,
}: {
  sections: readonly ShellRouteSection[]
  currentId: string | undefined
  navigate: NavigateTo
  /** Preloads a route by id when someone is about to follow it. Stable, like `navigate`. */
  intent?: NavigateTo
}) {
  return sections.map((section) => (
    <SidebarGroup key={section.id} label={section.label} tone={section.tone}>
      {section.routes.map((route) => (
        <ShellSidebarItem
          key={route.id}
          route={route}
          current={route.id === currentId}
          navigate={navigate}
          intent={intent}
        />
      ))}
    </SidebarGroup>
  ))
}

function followClick(event: MouseEvent<HTMLAnchorElement>, id: string, navigate: NavigateTo) {
  if (event.defaultPrevented || !isPlainClick(event.nativeEvent)) return
  event.preventDefault()
  navigate(id)
}

function mobileItem(route: ShellRoute, current: boolean, navigate: NavigateTo | undefined): MobileNavItem {
  const item = { label: route.label, icon: <RouteIcon route={route} />, badge: route.badge, current }
  if (!navigate) return { ...item, href: route.href }
  // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- MobileNav fills it with the label
  return { ...item, render: <a href={route.href} onClick={(event) => followClick(event, route.id, navigate)} /> }
}

/**
 * The bottom bar's items and overflow. Each route's item is built once as current and once not, so a navigation
 * hands MobileNav the same objects for every route but two, and its memoized slots skip the rest.
 */
function useMobileNavItems(mobile: MobileRoutes, currentId: string | undefined, navigate: NavigateTo | undefined) {
  const variants = useMemo(() => {
    const build = (routes: readonly ShellRoute[]) =>
      routes.map((route) => ({
        id: route.id,
        idle: mobileItem(route, false, navigate),
        current: mobileItem(route, true, navigate),
      }))
    return { shown: build(mobile.shown), rest: build(mobile.rest) }
  }, [mobile, navigate])
  return useMemo(() => {
    const pick = (list: typeof variants.shown) =>
      list.map((variant) => (variant.id === currentId ? variant.current : variant.idle))
    return { items: pick(variants.shown), overflow: pick(variants.rest) }
  }, [variants, currentId])
}

export { ShellSidebarSections, RouteIcon, useMobileNavItems }
export type { NavigateTo }
