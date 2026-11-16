import { useSyncExternalStore, type MouseEvent } from "react"

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

function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/** Props for a registry Link (or SidebarItem, NavigationMenuLink) that routes on the client. */
function linkTo(route: string) {
  return {
    href: hrefFor(route),
    onClick: (event: MouseEvent) => {
      if (event.defaultPrevented || !isPlainClick(event)) return
      event.preventDefault()
      navigate(route)
    },
  }
}

/** Like linkTo, and also offers agents a `follow` action; keep it for the few links an agent should follow. */
function followTo(route: string) {
  return { href: hrefFor(route), onFollow: () => navigate(route) }
}

export { basePath, followTo, hrefFor, linkTo, navigate, routeFromPathname, useRoute }
