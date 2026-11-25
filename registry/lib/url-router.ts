/** A route and its query, whatever the router writes them as: `{ path: "/devices", params: device=a1 }`. */
type UrlLocation = { path: string; params: URLSearchParams }

type UrlNavigateOptions = { replace: boolean }

/**
 * The few things a block needs from the app's router: where it is, how to go somewhere, the href of somewhere and
 * when it moved. `hashRouter()` and `historyRouter()` cover routers that read `location`; wrap any other router's own
 * API in the same shape, so the blocks go through it and it never sees a URL it didn't write.
 */
type UrlRouter = {
  read(): UrlLocation
  navigate(to: UrlLocation, options: UrlNavigateOptions): void
  /** The href of a location, for a link that opens in a new tab: `#/settings?section=security`. */
  href(to: UrlLocation): string
  /** Calls `listener` when the location may have changed, like on Back; returns the unsubscribe. */
  subscribe(listener: () => void): () => void
}

type RouterWindow = Pick<Window, "location" | "history" | "addEventListener" | "removeEventListener">

function browserWindow(): RouterWindow | undefined {
  return typeof window === "undefined" ? undefined : window
}

// Spec: the history API fires no event, so a write through one browser router tells the others through this set.
const browserListeners = new Set<() => void>()

function notifyBrowser() {
  for (const listener of browserListeners) listener()
}

function subscribeBrowser(target: RouterWindow | undefined, listener: () => void) {
  if (!target) return () => {}
  browserListeners.add(listener)
  target.addEventListener("popstate", listener)
  target.addEventListener("hashchange", listener)
  return () => {
    browserListeners.delete(listener)
    target.removeEventListener("popstate", listener)
    target.removeEventListener("hashchange", listener)
  }
}

function withQuery(path: string, params: URLSearchParams) {
  const query = params.toString()
  return query === "" ? path : `${path}?${query}`
}

const pathHref = (to: UrlLocation) => withQuery(to.path || "/", to.params)
const hashHref = (to: UrlLocation) => `#${pathHref(to)}`

function splitRoute(route: string) {
  const mark = route.indexOf("?")
  if (mark === -1) return { path: route, params: new URLSearchParams() }
  return { path: route.slice(0, mark), params: new URLSearchParams(route.slice(mark + 1)) }
}

function go(target: RouterWindow, url: string, { replace }: UrlNavigateOptions) {
  const state: unknown = target.history.state
  if (replace) target.history.replaceState(state, "", url)
  else target.history.pushState(state, "", url)
  notifyBrowser()
}

/**
 * A hash route, `#/devices?device=a1`: the path is the hash before `?`, so changing the query keeps the route. An
 * empty hash reads as `/`. Hrefs are `#/path?query`, which fast links follow as hash routes.
 */
function hashRouter(target: RouterWindow | undefined = browserWindow()): UrlRouter {
  return {
    read() {
      const hash = target?.location.hash ?? ""
      const { path, params } = splitRoute(hash.startsWith("#") ? hash.slice(1) : hash)
      return { path: path || "/", params }
    },
    navigate(to, options) {
      if (!target) return
      go(target, `${target.location.pathname}${target.location.search}${hashHref(to)}`, options)
    },
    href: hashHref,
    subscribe: (listener) => subscribeBrowser(target, listener),
  }
}

/** The path and query string, `/devices?device=a1`; a write keeps the hash, an href leaves it out. */
function historyRouter(target: RouterWindow | undefined = browserWindow()): UrlRouter {
  return {
    read: () => ({
      path: target?.location.pathname ?? "/",
      params: new URLSearchParams(target?.location.search ?? ""),
    }),
    navigate(to, options) {
      if (!target) return
      go(target, `${pathHref(to)}${target.location.hash}`, options)
    },
    href: pathHref,
    subscribe: (listener) => subscribeBrowser(target, listener),
  }
}

type MemoryRouter = UrlRouter & {
  /** Every navigation, newest last, for tests: `{ href, replace }`. */
  readonly entries: readonly { href: string; replace: boolean }[]
}

/** Kept in memory, `/path?query`: for tests, server rendering and screens that shouldn't touch the URL. */
function memoryRouter(initial = "/"): MemoryRouter {
  const listeners = new Set<() => void>()
  let current = splitRoute(initial)
  const entries: { href: string; replace: boolean }[] = []
  return {
    entries,
    read: () => ({ path: current.path || "/", params: new URLSearchParams(current.params) }),
    navigate(to, { replace }) {
      current = { path: to.path, params: new URLSearchParams(to.params) }
      entries.push({ href: pathHref(to), replace })
      for (const listener of listeners) listener()
    },
    href: pathHref,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** The location with one param set, or removed with null; the path and every other param stay. */
function withParam(location: UrlLocation, name: string, value: string | null): UrlLocation {
  const params = new URLSearchParams(location.params)
  if (value === null) params.delete(name)
  else params.set(name, value)
  return { path: location.path, params }
}

export { hashRouter, historyRouter, memoryRouter, withParam }
export type { MemoryRouter, RouterWindow, UrlLocation, UrlNavigateOptions, UrlRouter }
