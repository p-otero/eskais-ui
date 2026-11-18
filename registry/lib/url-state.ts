import { useCallback, useMemo, useSyncExternalStore } from "react"

type UrlWriteOptions = { replace: boolean }

/** Where a screen keeps its state in the URL, whatever the router: the query string, the hash, or memory. */
type UrlStateAdapter = {
  read(): URLSearchParams
  write(params: URLSearchParams, options: UrlWriteOptions): void
  subscribe(callback: () => void): () => void
}

type UrlStateWindow = Pick<Window, "location" | "history" | "addEventListener" | "removeEventListener">

function browserWindow(): UrlStateWindow | undefined {
  return typeof window === "undefined" ? undefined : window
}

/** A shared set of listeners, so a write through one adapter tells every subscriber, not only the browser's. */
function createListeners() {
  const listeners = new Set<() => void>()
  return {
    add(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    notify() {
      for (const listener of listeners) listener()
    },
  }
}

function withQuery(base: string, params: URLSearchParams) {
  const query = params.toString()
  return query === "" ? base : `${base}?${query}`
}

/** The query string: `/tasks?status=open`. Writes go through `history.replaceState` or `pushState`. */
function historyUrlState(target: UrlStateWindow | undefined = browserWindow()): UrlStateAdapter {
  const listeners = createListeners()
  return {
    read: () => new URLSearchParams(target?.location.search ?? ""),
    write(params, { replace }) {
      if (!target) return
      const url = withQuery(target.location.pathname, params) + target.location.hash
      if (replace) target.history.replaceState(target.history.state, "", url)
      else target.history.pushState(target.history.state, "", url)
      listeners.notify()
    },
    subscribe(callback) {
      const remove = listeners.add(callback)
      target?.addEventListener("popstate", callback)
      return () => {
        remove()
        target?.removeEventListener("popstate", callback)
      }
    },
  }
}

function splitHash(hash: string) {
  const body = hash.startsWith("#") ? hash.slice(1) : hash
  const mark = body.indexOf("?")
  return mark === -1 ? { route: body, query: "" } : { route: body.slice(0, mark), query: body.slice(mark + 1) }
}

/** A hash router's query: `#/tasks?status=open`. The route before `?` is kept as it is. */
function hashUrlState(target: UrlStateWindow | undefined = browserWindow()): UrlStateAdapter {
  const listeners = createListeners()
  return {
    read: () => new URLSearchParams(splitHash(target?.location.hash ?? "").query),
    write(params, { replace }) {
      if (!target) return
      const { route } = splitHash(target.location.hash)
      const hash = `#${withQuery(route, params)}`
      const url = target.location.pathname + target.location.search + hash
      // Setting `location.hash` would add an entry even for a replace; the history API doesn't fire `hashchange`.
      if (replace) target.history.replaceState(target.history.state, "", url)
      else target.history.pushState(target.history.state, "", url)
      listeners.notify()
    },
    subscribe(callback) {
      const remove = listeners.add(callback)
      target?.addEventListener("hashchange", callback)
      target?.addEventListener("popstate", callback)
      return () => {
        remove()
        target?.removeEventListener("hashchange", callback)
        target?.removeEventListener("popstate", callback)
      }
    },
  }
}

type MemoryUrlState = UrlStateAdapter & {
  /** Every write, newest last, for tests: `{ query, replace }`. */
  readonly history: readonly { query: string; replace: boolean }[]
}

/** Kept in memory: for tests, server rendering and screens that shouldn't touch the URL. */
function memoryUrlState(initial: string | URLSearchParams = ""): MemoryUrlState {
  const listeners = createListeners()
  let current = new URLSearchParams(initial)
  const history: { query: string; replace: boolean }[] = []
  return {
    history,
    read: () => new URLSearchParams(current),
    write(params, { replace }) {
      current = new URLSearchParams(params)
      history.push({ query: current.toString(), replace })
      listeners.notify()
    },
    subscribe: (callback) => listeners.add(callback),
  }
}

const empty = ""

/** The adapter's params, re-rendering when they change. `setParams` writes, replacing the entry by default. */
function useUrlState(adapter: UrlStateAdapter) {
  const query = useSyncExternalStore(
    adapter.subscribe,
    () => adapter.read().toString(),
    () => empty,
  )
  const params = useMemo(() => new URLSearchParams(query), [query])
  const setParams = useCallback(
    (next: URLSearchParams, options: Partial<UrlWriteOptions> = {}) =>
      adapter.write(next, { replace: options.replace ?? true }),
    [adapter],
  )
  return [params, setParams] as const
}

export { hashUrlState, historyUrlState, memoryUrlState, useUrlState }
export type { MemoryUrlState, UrlStateAdapter, UrlStateWindow, UrlWriteOptions }
