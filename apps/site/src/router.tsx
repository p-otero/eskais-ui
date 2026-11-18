import { useSyncExternalStore } from "react"

import { preloadRoute } from "./preload"

// The built entry lives in <site>/assets/, so its parent folder is the site root wherever it's hosted.
const basePath = import.meta.env.DEV ? "/" : new URL("../", import.meta.url).pathname

function routeFromPathname(pathname: string) {
  const inside = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname.replace(/^\//, "")
  const route = `/${inside.replace(/index\.html$/, "").replace(/\/+$/, "")}`
  return route
}

function hrefFor(route: string) {
  const [path = "/", hash] = route.split("#")
  const target = path === "/" ? basePath : `${basePath}${path.slice(1)}/`
  return hash ? `${target}#${hash}` : target
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("popstate", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("popstate", listener)
  }
}

function useRoute() {
  return useSyncExternalStore(
    subscribe,
    () => routeFromPathname(location.pathname),
    () => "/",
  )
}

function navigate(route: string) {
  const href = hrefFor(route)
  const hash = route.split("#")[1]
  history.pushState(null, "", href)
  for (const listener of listeners) listener()
  if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView())
  else window.scrollTo({ top: 0 })
}

/**
 * Props for a registry Link (or SidebarItem, NavigationMenuLink, ButtonLink) that routes on the client: on a mouse
 * press, a click or Enter, and preloads the route's code when someone is about to follow it.
 */
function linkTo(route: string) {
  return {
    href: hrefFor(route),
    onNavigate: () => navigate(route),
    onIntent: () => preloadRoute(route),
  }
}

/** Like linkTo, and also offers agents a `follow` action; keep it for the few links an agent should follow. */
function followTo(route: string) {
  return { href: hrefFor(route), onFollow: () => navigate(route), onIntent: () => preloadRoute(route) }
}

export { basePath, followTo, hrefFor, linkTo, navigate, routeFromPathname, useRoute }
