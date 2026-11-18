"use client"

import { createContext, use, useMemo } from "react"

import {
  currentRouteId,
  mobileRoutes,
  placedIn,
  sectionRoutes,
  type ShellRoute,
  type ShellRouteGroup,
  type ShellCurrent,
} from "@/components/ui/shell-routes"
import type { SidebarState } from "@/components/ui/use-sidebar-state"

const ShellSidebarContext = createContext<SidebarState | null>(null)

/**
 * The Shell's sidebar state, from inside the Shell (its pages, `actions`, `brand`): `collapsed`, `setCollapsed` and
 * the `controller`, to toggle the sidebar from a command or a menu.
 */
function useShellSidebar(): SidebarState {
  const sidebar = use(ShellSidebarContext)
  if (!sidebar) throw new Error("useShellSidebar must be called inside a Shell")
  return sidebar
}

/** What the shell derives from its routes: rebuilt when the routes change, not on every navigation. */
function useShellRoutes<Route extends ShellRoute>(
  routes: readonly Route[],
  groups: readonly ShellRouteGroup[] | undefined,
  current: ShellCurrent<Route> | undefined,
) {
  const sections = useMemo(
    () =>
      sectionRoutes(
        routes.filter((route) => placedIn(route, "sidebar")),
        groups,
      ),
    [routes, groups],
  )
  const paletteSections = useMemo(
    () =>
      sectionRoutes(
        routes.filter((route) => placedIn(route, "palette")),
        groups,
      ),
    [routes, groups],
  )
  const mobile = useMemo(() => mobileRoutes(routes), [routes])
  const currentId = useMemo(() => currentRouteId(routes, current), [routes, current])
  return { sections, paletteSections, mobile, currentId }
}

export { ShellSidebarContext, useShellRoutes, useShellSidebar }
