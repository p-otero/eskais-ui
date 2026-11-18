import type { ComponentType, ReactNode } from "react"

/** Where a route can show: the sidebar (and its drawer), the bottom bar, its More sheet, and the palette's Go to. */
type ShellPlacement = "sidebar" | "mobile" | "more" | "palette"

type ShellRoute = {
  /** Unique among the routes: keys and the palette's command values come from it. */
  id: string
  /** Names the route's link in the sidebar, the bottom bar and the palette. */
  label: string
  href: string
  /** Any icon component, like a lucide icon. Decorative: the label names the route. */
  icon?: ComponentType<{ className?: string }>
  /** The `id` of one of `groups`; without `groups`, the group's label. Routes without one come first, unlabelled. */
  group?: string
  /**
   * In the bottom bar on narrow screens, which has four slots; More opens the rest. `{ order }` places it apart from
   * the sidebar's order: routes sort by `order`, then by their place in the list, and `true` counts as order 0.
   */
  mobile?: boolean | { order: number }
  /**
   * Where it shows; everywhere by default. `["sidebar"]` keeps it out of the bottom bar, More and the palette.
   * Listing `"mobile"` puts it in the bottom bar as `mobile: true` does; leaving `"mobile"` out keeps it out of the
   * bar even with `mobile` set. `"more"` lets More list it when the bar doesn't show it.
   */
  placements?: readonly ShellPlacement[]
  /** More words the palette matches, like synonyms. */
  keywords?: readonly string[]
  /** A short count or mark beside the label, like 3. It joins the link's name. */
  badge?: ReactNode
}

type ShellRouteGroup = {
  id: string
  label: string
  /** `muted` quiets the group, like sections on their way out. */
  tone?: "default" | "muted"
}

/**
 * The current page: an href, compared exactly, or a matcher for nested routes, called with each route's href. When
 * several routes match, the one with the longest href is current.
 */
type ShellCurrent<Route extends ShellRoute = ShellRoute> = string | ((href: string, route: Route) => boolean)

type ShellRouteSection = {
  id: string
  label?: string
  tone: "default" | "muted"
  routes: ShellRoute[]
}

type MobileRoutes = { shown: ShellRoute[]; rest: ShellRoute[] }

const mobileSlots = 4

function placedIn(route: ShellRoute, placement: ShellPlacement) {
  return route.placements === undefined || route.placements.includes(placement)
}

function sectionRoutes(
  routes: readonly ShellRoute[],
  groups: readonly ShellRouteGroup[] | undefined,
): ShellRouteSection[] {
  const ungrouped: ShellRouteSection = { id: "", tone: "default", routes: [] }
  const sections = new Map<string, ShellRouteSection>()
  for (const group of groups ?? []) {
    sections.set(group.id, { id: group.id, label: group.label, tone: group.tone ?? "default", routes: [] })
  }
  for (const route of routes) {
    let section = route.group === undefined ? undefined : sections.get(route.group)
    if (!section && route.group !== undefined && groups === undefined) {
      section = { id: route.group, label: route.group, tone: "default", routes: [] }
      sections.set(route.group, section)
    }
    const target = section ?? ungrouped
    target.routes.push(route)
  }
  return [ungrouped, ...sections.values()].filter((section) => section.routes.length > 0)
}

function currentRouteId<Route extends ShellRoute>(
  routes: readonly Route[],
  current: ShellCurrent<Route> | undefined,
): string | undefined {
  if (current === undefined) return undefined
  if (typeof current === "string") return routes.find((route) => route.href === current)?.id
  let best: Route | undefined
  for (const route of routes) {
    if (current(route.href, route) && (best === undefined || route.href.length > best.href.length)) best = route
  }
  return best?.id
}

function mobileOrder(route: ShellRoute): number | undefined {
  if (!placedIn(route, "mobile")) return undefined
  if (typeof route.mobile === "object") return route.mobile.order
  return route.mobile || route.placements !== undefined ? 0 : undefined
}

function mobileRoutes(routes: readonly ShellRoute[]): MobileRoutes {
  const candidates: { route: ShellRoute; order: number; index: number }[] = []
  for (const [index, route] of routes.entries()) {
    const order = mobileOrder(route)
    if (order !== undefined) candidates.push({ route, order, index })
  }
  candidates.sort((a, b) => a.order - b.order || a.index - b.index)
  const shown = candidates.slice(0, mobileSlots).map((candidate) => candidate.route)
  return { shown, rest: routes.filter((route) => !shown.includes(route) && placedIn(route, "more")) }
}

export { currentRouteId, mobileRoutes, placedIn, sectionRoutes }
export type { ShellRoute, ShellPlacement, ShellRouteGroup, ShellRouteSection, ShellCurrent, MobileRoutes }
