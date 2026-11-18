import { withParam, type UrlRouter } from "@/lib/url-router"

/**
 * One value kept in the URL, without knowing the router: what a block reads, writes and listens to. Write your own
 * over a router's API, or use `createUrlParam`.
 */
type UrlParamAdapter = {
  /** The value now, or null when it's absent. */
  read: () => string | null
  /** Sets the value, or removes it with null. */
  write: (value: string | null) => void
  /** Calls `listener` when the value may have changed, like on Back; returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void
  /** The href of the current route with this value, for links that open it in a new tab. */
  href?: (value: string | null) => string
}

type UrlParamOptions = {
  /**
   * `search` (default) keeps it in `location.search`, which hash routers never read, so their route is untouched.
   * `hash` keeps it in the query of a hash route, `#/devices?device=a1`, where a hash router's `useSearchParams`
   * sees it too. Ignored with `router`.
   */
  in?: "search" | "hash"
  /**
   * Reads and writes through a router adapter instead of `location`: `hashRouter()` or `historyRouter()` from
   * `@/lib/url-router`, or one over your router's own API, so the route it owns stays its own.
   */
  router?: UrlRouter
  /** `push` (default) adds a history entry, so Back undoes the change; `replace` doesn't. */
  history?: "push" | "replace"
}

function hashParts(hash: string) {
  const at = hash.indexOf("?")
  return at === -1 ? { route: hash, query: "" } : { route: hash.slice(0, at), query: hash.slice(at + 1) }
}

const noop = () => () => {}

function routerParam(name: string, router: UrlRouter, replace: boolean): UrlParamAdapter {
  return {
    read: () => router.read().params.get(name),
    write(value) {
      const location = router.read()
      if (location.params.get(name) === value) return
      router.navigate(withParam(location, name, value), { replace })
    },
    subscribe: (listener) => router.subscribe(listener),
    href: (value) => router.href(withParam(router.read(), name, value)),
  }
}

/** A `UrlParamAdapter` over `history`: deep links, Back and Forward work in plain, history and hash routers. */
function createUrlParam(
  name: string,
  { in: where = "search", router, history: mode = "push" }: UrlParamOptions = {},
): UrlParamAdapter {
  if (router) return routerParam(name, router, mode === "replace")
  const listeners = new Set<() => void>()
  const params = () => {
    if (typeof location === "undefined") return new URLSearchParams()
    return new URLSearchParams(where === "search" ? location.search : hashParts(location.hash).query)
  }
  const urlWith = (value: string | null) => {
    const next = params()
    if (value === null) next.delete(name)
    else next.set(name, value)
    const query = next.toString()
    const url = new URL(location.href)
    if (where === "search") url.search = query
    else url.hash = `${hashParts(location.hash).route}${query ? `?${query}` : ""}`
    return url
  }
  const adapter: UrlParamAdapter = {
    read: () => params().get(name),
    write(value) {
      if (typeof location === "undefined" || adapter.read() === value) return
      const url = urlWith(value)
      // history keeps the router's own state object, so routers that store keys there still recognise the entry.
      const state: unknown = history.state
      if (mode === "push") history.pushState(state, "", url)
      else history.replaceState(state, "", url)
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      if (typeof window === "undefined") return noop()
      listeners.add(listener)
      addEventListener("popstate", listener)
      addEventListener("hashchange", listener)
      return () => {
        listeners.delete(listener)
        removeEventListener("popstate", listener)
        removeEventListener("hashchange", listener)
      }
    },
    href(value) {
      if (typeof location === "undefined") return ""
      const url = urlWith(value)
      return where === "search" ? `${url.pathname}${url.search}${url.hash}` : url.hash
    },
  }
  return adapter
}

export { createUrlParam }
export type { UrlParamAdapter, UrlParamOptions }
