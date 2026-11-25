import {
  notifyManager,
  partialMatchKey,
  type InfiniteData,
  type Query,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"

import { assumeType } from "@/lib/narrow"
import type { PageResult } from "@/lib/page-source"

// Workaround: TanStack's `cancelRefetch` joins a first load, and a read that left before a write may answer with
// the data from before it, so every read in flight is cancelled silently and fetched again by the caller.
function restartInFlight(
  client: QueryClient,
  filters: { queryKey: readonly unknown[]; predicate?: (query: Query) => boolean },
) {
  const inFlight = client.getQueryCache().findAll({ ...filters, fetchStatus: "fetching" })
  for (const query of inFlight) void query.cancel({ silent: true })
  return inFlight
}

function reloadKey(client: QueryClient, key: readonly unknown[], throwOnError = false) {
  return notifyManager.batch(() => {
    const cache = client.getQueryCache()
    const idle = new Set(cache.findAll({ queryKey: key, fetchStatus: "idle" }))
    const restarted = restartInFlight(client, { queryKey: key })
    const done = client.invalidateQueries({ queryKey: key }, { throwOnError })
    for (const query of restarted) query.fetch().catch(() => undefined)
    const refetched = [...idle].filter((query) => query.state.fetchStatus === "fetching")
    return { restarted, refetched, done }
  })
}

/**
 * Invalidates the key, and refetches its shown queries and every read that was in flight, restarted. Resolves once
 * the shown ones have reloaded; with `throwOnError`, rejects with the first failure.
 */
function refreshKey(client: QueryClient, key: readonly unknown[], throwOnError = false): Promise<void> {
  return reloadKey(client, key, throwOnError).done
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
    // Workaround: TanStack's cache types data as unknown; the hooks store a `PageResult<T>` under a "page" query.
    const page = assumeType<PageResult<T>>(data)
    return { ...page, items: update(page.items) }
  }
  if (kind === "infinite") {
    // Workaround: TanStack's cache types data as unknown; the hooks store pages of `PageResult<T>` under an "infinite" query.
    const infinite = assumeType<InfiniteData<PageResult<T>>>(data)
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
   * Resolves once every read in the result's `restarted` has settled, following each query through later restarts
   * (another write, an invalidation) to its latest read. Starts no read of its own. Default false.
   */
  awaitRestarted?: boolean
  /** Rejects with the first failure, after its retries, of a read the call awaits: `refetch`'s or `awaitRestarted`'s. */
  throwOnError?: boolean
}

/** What a patch did, by query key, each list in the cache's order. */
type PatchResult = {
  /** The queries the patch wrote data into. */
  written: readonly QueryKey[]
  /**
   * The queries whose read in flight the patch stopped without starting it again (`inFlight: "cancel"`, or a hold's
   * patch): they show the patch and the read's late answer is dropped. With `refetch` a shown one is read again by the
   * reload, so it is in `refetched` too.
   */
  cancelled: readonly QueryKey[]
  /**
   * The queries whose read in flight this call started again: a written query's under `"restart"`, a first read the
   * patch left empty, with `refetch` every read in flight under the key, and under a hold's patch the reads the hold
   * paused that now run. A read that another hold still pauses isn't listed.
   */
  restarted: readonly QueryKey[]
  /** With `refetch`, the queries the reload started a read for that weren't reading before. */
  refetched: readonly QueryKey[]
}

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
 * Holds open under a client, by key. A hook's read under one waits for it to end (`pausedRead`); `holdSource` adds and
 * ends them.
 */
type Hold = { key: readonly unknown[]; ended: Promise<void> }

const holds = new WeakMap<QueryClient, Set<Hold>>()
const pausedReads = new WeakMap<Query, number>()

function holdOver(client: QueryClient, queryKey: readonly unknown[]): Hold | undefined {
  for (const hold of holds.get(client) ?? []) if (partialMatchKey(queryKey, hold.key)) return hold
  return undefined
}

/** The query's read is a hook's read waiting for a hold to end, so it hasn't sent a request. */
function isPaused(query: Query) {
  return (pausedReads.get(query) ?? 0) > 0
}

/** The hooks read through `pausedRead`; a query no hook owns (a prefetch) reads without waiting for a hold. */
function knowsHolds(query: Query) {
  return typeof query.meta?.serverData === "string"
}

/**
 * Runs `read` once no hold covers the key; until then the query reads as fetching and nothing is requested. Aborting
 * the signal (the read is cancelled or restarted) drops the wait without a request.
 */
function pausedRead<T>(
  client: QueryClient,
  context: { queryKey: readonly unknown[]; signal: AbortSignal },
  read: () => Promise<T>,
): Promise<T> {
  const hold = holdOver(client, context.queryKey)
  if (hold === undefined) return read()
  const { signal } = context
  const query = client.getQueryCache().find({ queryKey: context.queryKey, exact: true })
  if (query !== undefined) pausedReads.set(query, (pausedReads.get(query) ?? 0) + 1)
  let waiting = true
  const stop = () => {
    if (!waiting) return false
    waiting = false
    if (query !== undefined) pausedReads.set(query, (pausedReads.get(query) ?? 1) - 1)
    return true
  }
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      if (stop()) reject(signal.reason)
    }
    if (signal.aborted) abort()
    else signal.addEventListener("abort", abort, { once: true })
    void hold.ended.then(() => {
      signal.removeEventListener("abort", abort)
      if (stop()) resolve()
    })
  }).then(() => pausedRead(client, context, read))
}

function keysOf(queries: Iterable<Query>): QueryKey[] {
  return Array.from(queries, (query) => query.queryKey)
}

/**
 * Writes the patch, restarts or cancels the reads it makes stale and reloads with `refetch`. `resume` runs in the
 * write's batch with the queries written, and returns the reads a hold's patch lets run.
 */
function runPatch<T, Data>(
  client: QueryClient,
  key: readonly unknown[],
  patch: SourcePatch<T, Data>,
  options: PatchOptions,
  resume?: (written: ReadonlySet<Query>) => readonly Query[],
): Promise<PatchResult> {
  const refetch = options.refetch === true
  const throwOnError = options.throwOnError === true
  const cancel = options.inFlight === "cancel"
  const written = new Set<Query>()
  const cancelled: Query[] = []
  const stale: Query[] = []
  const resumed = notifyManager.batch(() => {
    for (const query of client.getQueryCache().findAll({ queryKey: key })) {
      const current = query.state.data
      const kind = queryKind(query, key)
      const next =
        kind === "resource"
          ? // Workaround: TanStack's cache types data as unknown; a resource under the source's key holds the patch's `Data`.
            patch.resource?.(assumeType<Data | undefined>(current), query.queryKey)
          : patch.items && mapItems<T>(kind, current, patch.items)
      const fetching = query.state.fetchStatus === "fetching"
      // Workaround: a cancel with `revert` puts the state from before the read back at once (TanStack 5.107 reverts in the
      // retryer's `onCancel`), so the write below lands on a query that isn't fetching and nothing reverts it later.
      if (fetching && next !== undefined && cancel) {
        void query.cancel({ revert: true })
        cancelled.push(query)
      } else if (fetching && (next !== undefined || current === undefined)) stale.push(query)
      if (next !== undefined) {
        client.setQueryData(query.queryKey, next)
        written.add(query)
      }
    }
    // Perf: `refetch` restarts every read in flight under the key just after, so restarting here too would send a request
    // that is aborted at once.
    if (!refetch) {
      for (const query of stale) {
        void query.cancel({ silent: true })
        query.fetch().catch(() => undefined)
      }
    }
    return resume?.(written) ?? []
  })
  const reload = refetch ? reloadKey(client, key, throwOnError) : undefined
  const running = (query: Query) => !(knowsHolds(query) && holdOver(client, query.queryKey) !== undefined)
  const restarted = [...new Set([...(reload?.restarted ?? stale), ...resumed])].filter(running)
  const reads = [
    reload?.done,
    options.awaitRestarted === true ? awaitReads(client, restarted, throwOnError) : undefined,
  ].filter((read) => read !== undefined)
  const result: PatchResult = {
    written: keysOf(written),
    cancelled: keysOf(cancelled),
    restarted: keysOf(restarted),
    refetched: keysOf(reload?.refetched ?? []),
  }
  return Promise.all(reads).then(() => result)
}

/**
 * Writes what the server now holds into every cached query under the key, without a request. A read in flight that
 * could answer with the data from before it (its query is written, or has no data yet) restarts in the same batch,
 * or with `inFlight: "cancel"` a written query's read is cancelled; with `refetch`, the whole key reloads afterwards,
 * and its restart of every read in flight stands in for the patch's. Resolves with what it did.
 */
function patchSource<T, Data = unknown>(
  client: QueryClient,
  source: { key: readonly unknown[] },
  patch: SourcePatch<T, Data>,
  options: PatchOptions = {},
): Promise<PatchResult> {
  return runPatch(client, source.key, patch, options)
}

export {
  holdOver,
  holds,
  isPaused,
  knowsHolds,
  mapItems,
  patchSource,
  pausedRead,
  queryKind,
  refreshKey,
  runPatch,
  settleQueries,
  updateItems,
}
export type { Hold, PatchOptions, PatchResult, SourcePatch }
