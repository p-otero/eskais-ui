import { notifyManager, type InfiniteData, type Query, type QueryClient } from "@tanstack/react-query"

import type { PageResult } from "@/lib/page-source"

/**
 * Cancels every read in flight under the key silently, first loads included, for the caller to fetch again: one that
 * left before a write may answer with the data from before it, and `cancelRefetch` joins a first load. The query stays
 * pending or fetching without an error, and the aborted request's late answer or rejection is dropped.
 */
function restartInFlight(
  client: QueryClient,
  filters: { queryKey: readonly unknown[]; predicate?: (query: Query) => boolean },
) {
  const inFlight = client.getQueryCache().findAll({ ...filters, fetchStatus: "fetching" })
  for (const query of inFlight) void query.cancel({ silent: true })
  return inFlight
}

/**
 * Invalidates the key, and refetches its shown queries and every read that was in flight, restarted. Resolves once
 * the shown ones have reloaded; with `throwOnError`, rejects with the first failure.
 */
function refreshKey(client: QueryClient, key: readonly unknown[], throwOnError = false): Promise<void> {
  return notifyManager.batch(() => {
    const inFlight = restartInFlight(client, { queryKey: key })
    const shown = client.invalidateQueries({ queryKey: key }, { throwOnError })
    // An in-flight read the invalidation doesn't refetch (nothing observes it, as a prefetch) starts here; for one it
    // did, `fetch` joins the read it just started.
    for (const query of inFlight) query.fetch().catch(() => undefined)
    return shown
  })
}

/**
 * What kind of query this is under the source's key. The hooks mark theirs; a query no hook has observed, such as one
 * filled with `setQueryData` or by a resource's `seeds`, is told by the segment after the key, and anything else is a
 * resource.
 */
function queryKind(query: Query, key: readonly unknown[]): "page" | "infinite" | "total" | "resource" {
  const marked = query.meta?.serverData
  const kind = typeof marked === "string" ? marked : query.queryKey[key.length]
  return kind === "page" || kind === "infinite" || kind === "total" ? kind : "resource"
}

/** A page or infinite query's data with each page's rows updated; `undefined` for any other query or no data. */
function mapItems<T>(kind: unknown, data: unknown, update: (items: T[]) => T[]): unknown {
  if (data === undefined) return undefined
  if (kind === "page") {
    const page = data as PageResult<T>
    return { ...page, items: update(page.items) }
  }
  if (kind === "infinite") {
    const infinite = data as InfiniteData<PageResult<T>>
    return {
      ...infinite,
      pages: infinite.pages.map((page) => ({ ...page, items: update(page.items) })),
    }
  }
  return undefined
}

function updateItems<T>(client: QueryClient, key: readonly unknown[], update: (items: T[]) => T[]) {
  for (const [queryKey, data] of client.getQueriesData<unknown>({ queryKey: key })) {
    const next = mapItems(queryKey[key.length], data, update)
    if (next !== undefined) client.setQueryData(queryKey, next)
  }
}

/**
 * Writes the server's answer where `next` returns data. Each query written has its read in flight cancelled first, so
 * an answer sent before the change can't overwrite it. The rest of the key is marked stale without a request, and a
 * read of it already in flight, which started before the change, starts again without holding the mutation.
 */
async function settleQueries(client: QueryClient, key: readonly unknown[], next: (query: Query) => unknown) {
  const writes = client
    .getQueryCache()
    .findAll({ queryKey: key })
    .map((query) => [query, next(query)] as const)
    .filter(([, data]) => data !== undefined)
  await Promise.all(writes.map(([query]) => client.cancelQueries({ queryKey: query.queryKey, exact: true })))
  for (const [query, data] of writes) client.setQueryData(query.queryKey, data)
  const written = new Set<Query>(writes.map(([query]) => query))
  const rest = (query: Query) => !written.has(query)
  notifyManager.batch(() => {
    void client.invalidateQueries({ queryKey: key, predicate: rest, refetchType: "none" })
    for (const query of restartInFlight(client, { queryKey: key, predicate: rest }))
      query.fetch().catch(() => undefined)
  })
}

type SourcePatch<T, Data = unknown> = {
  /** The rows of every page and infinite query under the key that has data; each page keeps its total. */
  items?: (items: T[]) => T[]
  /**
   * The data of every other query under the key (`useServerQuery`, `useServerResource`), from what it holds, which is
   * `undefined` while its first read is pending. Return `undefined` to leave it alone, as for another id's detail.
   */
  resource?: (current: Data | undefined, queryKey: readonly unknown[]) => Data | undefined
}

type PatchOptions = {
  /**
   * Also reloads the key afterwards, as `useInvalidateSource` does, and resolves once the shown queries have reloaded.
   * Default false: the patch is what the server holds now and nothing new is requested.
   */
  refetch?: boolean
  /**
   * A read in flight under a query the patch writes may answer with the data from before it. `"restart"` (default)
   * starts it again; `"cancel"` stops it and keeps the patch, as a mutation's `settle`. A first read the patch leaves
   * empty restarts either way, or its query would stay pending.
   */
  inFlight?: "restart" | "cancel"
  /**
   * Resolves once every read the patch restarted has settled, following each query through later restarts (another
   * write, an invalidation) to its latest read. Starts no read of its own. Default false.
   */
  awaitRestarted?: boolean
  /** Rejects with the first failure, after its retries, of a read the call awaits: `refetch`'s or `awaitRestarted`'s. */
  throwOnError?: boolean
}

/**
 * Settles once the query's latest read has: a restart (its read cancelled silently and started again) keeps it
 * fetching, so this follows it. Rejects when that read failed, or resolves; resolves too when the query is removed.
 */
function latestRead(client: QueryClient, query: Query): Promise<void> {
  const cache = client.getQueryCache()
  const errors = query.state.errorUpdateCount
  return new Promise((resolve, reject) => {
    const settled = (removed: boolean) => {
      if (removed) resolve()
      else if (query.state.fetchStatus !== "idle") return false
      else if (query.state.errorUpdateCount > errors) reject(query.state.error)
      else resolve()
      return true
    }
    if (settled(cache.get(query.queryHash) !== query)) return
    const unsubscribe = cache.subscribe((event) => {
      if (event.query === query && settled(event.type === "removed")) unsubscribe()
    })
  })
}

function awaitReads(client: QueryClient, queries: readonly Query[], throwOnError: boolean): Promise<void> {
  return Promise.all(
    queries.map((query) =>
      throwOnError ? latestRead(client, query) : latestRead(client, query).catch(() => undefined),
    ),
  ).then(() => undefined)
}

/**
 * Writes what the server now holds into every cached query under the key, without a request. A read in flight that
 * could answer with the data from before it (its query is written, or has no data yet) restarts in the same batch,
 * or with `inFlight: "cancel"` a written query's read is cancelled; with `refetch`, the whole key reloads afterwards,
 * and its restart of every read in flight stands in for the patch's.
 */
function patchSource<T, Data = unknown>(
  client: QueryClient,
  source: { key: readonly unknown[] },
  patch: SourcePatch<T, Data>,
  options: PatchOptions = {},
): Promise<void> {
  const { key } = source
  const refetch = options.refetch === true
  const throwOnError = options.throwOnError === true
  const cancel = options.inFlight === "cancel"
  const restarted: Query[] = []
  notifyManager.batch(() => {
    for (const query of client.getQueryCache().findAll({ queryKey: key })) {
      const current = query.state.data
      const kind = queryKind(query, key)
      const next =
        kind === "resource"
          ? patch.resource?.(current as Data | undefined, query.queryKey)
          : patch.items && mapItems<T>(kind, current, patch.items)
      const fetching = query.state.fetchStatus === "fetching"
      // A cancel with `revert` puts the state from before the read back at once (TanStack 5.107 reverts in the
      // retryer's `onCancel`), so the write below lands on a query that isn't fetching and nothing reverts it later.
      if (fetching && next !== undefined && cancel) void query.cancel({ revert: true })
      else if (fetching && (next !== undefined || current === undefined)) restarted.push(query)
      if (next !== undefined) client.setQueryData(query.queryKey, next)
    }
    // `refetch` restarts every read in flight under the key just after, so restarting here too would send a request
    // that is aborted at once.
    if (!refetch) {
      for (const query of restarted) {
        void query.cancel({ silent: true })
        query.fetch().catch(() => undefined)
      }
    }
  })
  const reads = [
    refetch ? refreshKey(client, key, throwOnError) : undefined,
    options.awaitRestarted === true ? awaitReads(client, restarted, throwOnError) : undefined,
  ].filter((read) => read !== undefined)
  return Promise.all(reads).then(() => undefined)
}

export { mapItems, patchSource, queryKind, refreshKey, settleQueries, updateItems }
export type { PatchOptions, SourcePatch }
