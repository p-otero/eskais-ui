"use client"

import { useMemo } from "react"

import {
  currentRouteId,
  mobileRoutes,
  sectionRoutes,
  type ShellRoute,
  type ShellRouteGroup,
  type ShellCurrent,
} from "@/components/ui/shell-routes"

/** What the shell derives from its routes: rebuilt when the routes change, not on every navigation. */
function useShellRoutes<Route extends ShellRoute>(
  routes: readonly Route[],
  groups: readonly ShellRouteGroup[] | undefined,
  current: ShellCurrent<Route> | undefined,
) {
  const sections = useMemo(() => sectionRoutes(routes, groups), [routes, groups])
  const mobile = useMemo(() => mobileRoutes(routes), [routes])
  const currentId = useMemo(() => currentRouteId(routes, current), [routes, current])
  return { sections, mobile, currentId }
}

export { useShellRoutes }
