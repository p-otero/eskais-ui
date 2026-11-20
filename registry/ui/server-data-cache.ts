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
  /** With `refetch`, rejects when a reload fails after its retries. Default false. */
  throwOnError?: boolean
}

/**
 * Writes what the server now holds into every cached query under the key, without a request. A read in flight that
 * could answer with the data from before it (its query is written, or has no data yet) restarts in the same batch,
 * `refetch` or not, so nothing stays pending; with `refetch`, the whole key reloads afterwards.
 */
function patchSource<T, Data = unknown>(
  client: QueryClient,
  source: { key: readonly unknown[] },
  patch: SourcePatch<T, Data>,
  options: PatchOptions = {},
): Promise<void> {
  const { key } = source
  notifyManager.batch(() => {
    for (const query of client.getQueryCache().findAll({ queryKey: key })) {
      const current = query.state.data
      const kind = queryKind(query, key)
      const next =
        kind === "resource"
          ? patch.resource?.(current as Data | undefined, query.queryKey)
          : patch.items && mapItems<T>(kind, current, patch.items)
      const restart = query.state.fetchStatus === "fetching" && (next !== undefined || current === undefined)
      if (restart) void query.cancel({ silent: true })
      if (next !== undefined) client.setQueryData(query.queryKey, next)
      if (restart) query.fetch().catch(() => undefined)
    }
  })
  return options.refetch === true ? refreshKey(client, key, options.throwOnError === true) : Promise.resolve()
}

export { mapItems, patchSource, queryKind, refreshKey, settleQueries, updateItems }
export type { PatchOptions, SourcePatch }
