"use client"

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  type InfiniteData,
  type Query,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

import { useDataClient } from "@/components/ui/server-data"
import { resourceMeta } from "@/components/ui/use-server-query"
import {
  createPageController,
  type PageController,
  type PageControllerOptions,
  type PageControllerState,
} from "@/lib/page-controller"
import {
  resolveNavigation,
  totalOf,
  type Navigation,
  type NavigationMode,
  type PageRequest,
  type PageResult,
  type PageSource,
  type SortSpec,
  type TotalInfo,
} from "@/lib/page-source"

type ServerStatus = "pending" | "error" | "success"

type ServerPageOptions = {
  enabled?: boolean
  /** Overrides the navigation `"auto"` picks from the source. */
  navigation?: NavigationMode
}

type ServerPageState<T> = {
  /** The page's rows; while another page loads, the previous page's rows stay here. */
  items: T[]
  result: PageResult<T> | undefined
  status: ServerStatus
  /** A request is in flight, the first one or a refetch. */
  fetching: boolean
  /** The rows shown belong to the previous request while the new one loads. */
  previous: boolean
  total: TotalInfo
  navigation: Navigation
  error: unknown
  retry: () => void
}

function pageKey<F>(source: PageSource<unknown, F>, request: PageRequest<F>): QueryKey {
  return [...source.key, "page", request.filter, request.sort, request.position, request.size]
}

type ServerTotalState = { total: number | undefined; status: ServerStatus; fetching: boolean; error: unknown }

/** The source's own count, as a query of its own (`[...key, "total", filter]`); idle without `fetchTotal`. */
function useServerTotal<T, F>(
  source: PageSource<T, F>,
  filter: F,
  options: { enabled?: boolean } = {},
): ServerTotalState {
  const client = useDataClient()
  const fetchTotal = source.fetchTotal
  const query = useQuery(
    {
      queryKey: [...source.key, "total", filter],
      queryFn: ({ signal }) => (fetchTotal as NonNullable<typeof fetchTotal>).call(source, filter, { signal }),
      enabled: fetchTotal !== undefined && options.enabled !== false,
      placeholderData: keepPreviousData,
    },
    client,
  )
  return { total: query.data, status: query.status, fetching: query.isFetching, error: query.error }
}

/**
 * One page of a source for a request. The rows of the previous request stay while the next loads, a superseded
 * request is aborted through its signal, and `fetchTotal` runs beside it without holding the rows back.
 */
function useServerPage<T, F>(
  source: PageSource<T, F>,
  request: PageRequest<F>,
  options: ServerPageOptions = {},
): ServerPageState<T> {
  const client = useDataClient()
  const query = useQuery(
    {
      queryKey: pageKey(source, request),
      queryFn: ({ signal }) => source.fetchPage(request, { signal }),
      enabled: options.enabled !== false,
      placeholderData: keepPreviousData,
    },
    client,
  )
  const counted = useServerTotal(source, request.filter, { enabled: options.enabled })
  const result = query.data
  const total = totalOf(result, counted.total)
  const { refetch } = query
  const retry = useCallback(() => {
    void refetch()
  }, [refetch])
  return {
    items: result?.items ?? [],
    result,
    status: query.status,
    fetching: query.isFetching,
    previous: query.isPlaceholderData,
    total,
    navigation: resolveNavigation(source.capabilities, options.navigation, total),
    error: query.error,
    retry,
  }
}

type InfiniteRequest<F> = { filter: F; sort: readonly SortSpec[]; size: number }

type ServerInfiniteState<T> = {
  /** Every loaded page's rows, in order. */
  items: T[]
  pages: PageResult<T>[]
  status: ServerStatus
  fetching: boolean
  /** The next page is loading. */
  loadingMore: boolean
  hasMore: boolean
  loadMore: () => Promise<void>
  total: TotalInfo
  error: unknown
  retry: () => void
}

type PageParam = number | string | null

/** Pages that add up, for load more and infinite scroll: page numbers or cursors, as the source pages. */
function useServerInfinite<T, F>(
  source: PageSource<T, F>,
  request: InfiniteRequest<F>,
  options: { enabled?: boolean } = {},
): ServerInfiniteState<T> {
  const client = useDataClient()
  const cursorMode = source.capabilities.position === "cursor"
  const query = useInfiniteQuery(
    {
      queryKey: [...source.key, "infinite", request.filter, request.sort, request.size],
      queryFn: ({ signal, pageParam }: { signal: AbortSignal; pageParam: PageParam }) =>
        source.fetchPage(
          {
            ...request,
            position: cursorMode
              ? { cursor: pageParam as string | null, direction: "forward" }
              : { page: pageParam as number },
          },
          { signal },
        ),
      initialPageParam: (cursorMode ? null : 1) as PageParam,
      getNextPageParam: (last: PageResult<T>, all: PageResult<T>[]): PageParam | undefined => {
        if (cursorMode) return last.nextCursor ?? undefined
        const total = last.total ?? last.totalEstimate
        const more =
          last.hasMore ?? (total === undefined ? last.items.length >= request.size : all.length * request.size < total)
        return more && last.items.length > 0 ? all.length + 1 : undefined
      },
      enabled: options.enabled !== false,
      placeholderData: keepPreviousData,
    },
    client,
  )
  const counted = useServerTotal(source, request.filter, { enabled: options.enabled })
  const pages = query.data?.pages ?? []
  const { fetchNextPage, refetch, hasNextPage, isFetchingNextPage } = query
  const loadMore = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) return
    await fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])
  const retry = useCallback(() => {
    void refetch()
  }, [refetch])
  return {
    items: pages.flatMap((page) => page.items),
    pages,
    status: query.status,
    fetching: query.isFetching,
    loadingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    loadMore,
    total: totalOf(pages[0], counted.total),
    error: query.error,
    retry,
  }
}

type InvalidateOptions = {
  /** Rejects with the error when a reload fails, after its retries, so the caller can say so. Default false. */
  throwOnError?: boolean
}

/**
 * Refreshes every query of the source by its key prefix: pages, infinite lists, totals and `useServerQuery`
 * resources under it. The returned function resolves once the shown ones have reloaded; with `throwOnError`, here or
 * per call, a failed reload rejects.
 */
function useInvalidateSource(
  source: { key: readonly unknown[] },
  options: InvalidateOptions = {},
): (call?: InvalidateOptions) => Promise<void> {
  const client = useDataClient()
  const { key } = source
  const throwOnError = options.throwOnError === true
  // The function is often an onClick handler, so `call` may be an event: only a boolean `throwOnError` counts.
  return useCallback(
    (call?: InvalidateOptions) =>
      client.invalidateQueries(
        { queryKey: key },
        { throwOnError: typeof call?.throwOnError === "boolean" ? call.throwOnError : throwOnError },
      ),
    [client, key, throwOnError],
  )
}

type Snapshot = [QueryKey, unknown][]

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
  await client.invalidateQueries({ queryKey: key, predicate: rest, refetchType: "none" })
  void client.refetchQueries({
    queryKey: key,
    predicate: (query) => rest(query) && query.state.fetchStatus === "fetching",
  })
}

type SourceMutationOptions<T, Variables, Result, Data = Result> = {
  mutationFn: (variables: Variables) => Promise<Result>
  /** Its queries are refreshed once the mutation settles, unless `settleItems` or `settle` writes the answer. */
  source: PageSource<T, never> | { key: readonly unknown[] }
  /** Opt-in: changes the cached rows at once and restores them if the mutation fails. */
  optimistic?: (items: T[], variables: Variables) => T[]
  /**
   * On success, the rows of every page and infinite query under the key, from the server's answer, in place of the
   * refresh: `(items, saved) => items.map((row) => (row.id === saved.id ? saved : row))`. Each page keeps its total.
   */
  settleItems?: (items: T[], result: Result, variables: Variables) => T[]
  /**
   * On success, the data of every `useServerQuery` under the key, from the server's answer, in place of the refresh.
   * `current` is what that query holds; return `undefined` to leave it alone, as for another id's detail.
   */
  settle?: (
    result: Result,
    variables: Variables,
    current: Data | undefined,
    queryKey: readonly unknown[],
  ) => Data | undefined
  onSuccess?: (result: Result, variables: Variables) => unknown
  onError?: (error: unknown, variables: Variables) => unknown
}

type SourceMutationState<Variables, Result> = {
  mutate: (variables: Variables) => void
  mutateAsync: (variables: Variables) => Promise<Result>
  status: "idle" | "pending" | "error" | "success"
  pending: boolean
  error: unknown
  reset: () => void
}

/**
 * A change to the source's data. Its queries refresh afterwards; `optimistic` shows the change before, and
 * `settleItems` and `settle` write the server's answer instead of refreshing.
 */
function useSourceMutation<T, Variables = void, Result = unknown, Data = Result>(
  options: SourceMutationOptions<T, Variables, Result, Data>,
): SourceMutationState<Variables, Result> {
  const client = useDataClient()
  const { key } = options.source
  const { settle, settleItems } = options
  const settles = settle !== undefined || settleItems !== undefined
  const mutation = useMutation<Result, unknown, Variables, { snapshot: Snapshot } | undefined>(
    {
      mutationFn: options.mutationFn,
      onMutate: async (variables) => {
        const optimistic = options.optimistic
        if (!optimistic) return undefined
        await client.cancelQueries({ queryKey: key })
        const snapshot = client.getQueriesData<unknown>({ queryKey: key })
        updateItems<T>(client, key, (items) => optimistic(items, variables))
        return { snapshot }
      },
      onError: (error, variables, context) => {
        for (const [queryKey, data] of context?.snapshot ?? []) client.setQueryData(queryKey, data)
        return options.onError?.(error, variables)
      },
      onSuccess: async (result, variables) => {
        if (settles) {
          await settleQueries(client, key, (query) => {
            const data = query.state.data
            if (query.meta?.serverData === resourceMeta.serverData) {
              return settle?.(result, variables, data as Data | undefined, query.queryKey)
            }
            return (
              settleItems &&
              mapItems<T>(query.queryKey[key.length], data, (items) => settleItems(items, result, variables))
            )
          })
        }
        return options.onSuccess?.(result, variables)
      },
      onSettled: (_result, error) =>
        settles && error === null ? undefined : client.invalidateQueries({ queryKey: key }),
    },
    client,
  )
  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    status: mutation.status,
    pending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}

/** A page controller for the component's life, its state, and the URL followed while mounted. */
function usePageController<T, F>(
  source: PageSource<T, F>,
  options?: PageControllerOptions<F>,
): { state: PageControllerState<F>; controller: PageController<F> } {
  const [controller] = useState(() => createPageController(source, options))
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  useEffect(() => controller.connect(), [controller])
  useEffect(() => () => controller.dispose(), [controller])
  return { state, controller }
}

export {
  pageKey,
  useInvalidateSource,
  usePageController,
  useServerInfinite,
  useServerPage,
  useServerTotal,
  useSourceMutation,
}
export type {
  InfiniteRequest,
  InvalidateOptions,
  ServerInfiniteState,
  ServerPageOptions,
  ServerPageState,
  ServerStatus,
  ServerTotalState,
  SourceMutationOptions,
  SourceMutationState,
}
