"use client"

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  type InfiniteData,
  type NetworkMode,
  type QueryKey,
} from "@tanstack/react-query"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

import { useDataClient, type DefaultServerError } from "@/components/ui/server-data"
import {
  mapItems,
  patchSource,
  queryKind,
  refreshKey,
  settleQueries,
  updateItems,
  type PatchOptions,
  type SourcePatch,
} from "@/components/ui/server-data-cache"
import {
  createPageController,
  type PageController,
  type PageControllerOptions,
  type PageControllerState,
} from "@/lib/page-controller"
import { assumeType } from "@/lib/narrow"
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

/** `true` reloads a stale query on the event, `"always"` a fresh one too, `false` never. */
type RefetchTrigger = boolean | "always"

/**
 * When a query reloads on its own, per hook; otherwise the client's (`createDataClient`: no reload on focus, reload a
 * stale query on mount, and on reconnect unless `networkMode` is `"always"`). TanStack reloads a query when any hook that reads it asks to, so a resource
 * that must never reload this way (one whose reads overwrite per-item ETags kept for later writes) says so in
 * `defineResource`, for every screen.
 */
type RefetchOptions = {
  refetchOnWindowFocus?: RefetchTrigger
  refetchOnReconnect?: RefetchTrigger
  refetchOnMount?: RefetchTrigger
}

/** What every reading hook takes besides its request: when a read may run and when it reloads on its own. */
type ReadOptions = RefetchOptions & {
  enabled?: boolean
  /** When a read may run, as `createDataClient`'s `networkMode`; otherwise the client's. */
  networkMode?: NetworkMode
}

type ServerPageOptions = ReadOptions & {
  /** Overrides the navigation `"auto"` picks from the source. */
  navigation?: NavigationMode
}

/** `networkMode` for a query or mutation's options, left out when unset so the client's default applies. */
function networkModeOf(networkMode: NetworkMode | undefined) {
  return networkMode === undefined ? {} : { networkMode }
}

const refetchKeys = ["refetchOnWindowFocus", "refetchOnReconnect", "refetchOnMount"] as const

/** A query's `networkMode` and refetch triggers, the unset ones left out so the client's defaults apply. */
function readOptionsOf(options: ReadOptions): Omit<ReadOptions, "enabled"> {
  const picked: Omit<ReadOptions, "enabled"> = { ...networkModeOf(options.networkMode) }
  for (const name of refetchKeys) if (options[name] !== undefined) picked[name] = options[name]
  return picked
}

type ServerPageState<T, TError = DefaultServerError> = {
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
  error: TError | null
  retry: () => void
}

function pageKey<F>(source: PageSource<unknown, F>, request: PageRequest<F>): QueryKey {
  return [...source.key, "page", request.filter, request.sort, request.position, request.size]
}

type ServerTotalState<TError = DefaultServerError> = {
  total: number | undefined
  status: ServerStatus
  fetching: boolean
  error: TError | null
}

// Tells a mutation's `settle` and `settleItems` which kind of query each one under the key is, mounted or not.
const pageMeta = { serverData: "page" }
const infiniteMeta = { serverData: "infinite" }
const totalMeta = { serverData: "total" }

/** The source's own count, as a query of its own (`[...key, "total", filter]`); idle without `fetchTotal`. */
function useServerTotal<T, F, TError = DefaultServerError>(
  source: PageSource<T, F>,
  filter: F,
  options: ReadOptions = {},
): ServerTotalState<TError> {
  const client = useDataClient()
  const fetchTotal = source.fetchTotal
  const query = useQuery<number, TError>(
    {
      queryKey: [...source.key, "total", filter],
      queryFn: ({ signal }) =>
        fetchTotal
          ? fetchTotal.call(source, filter, { signal })
          : Promise.reject(new TypeError("This source has no `fetchTotal`.")),
      enabled: fetchTotal !== undefined && options.enabled !== false,
      meta: totalMeta,
      ...readOptionsOf(options),
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
function useServerPage<T, F, TError = DefaultServerError>(
  source: PageSource<T, F>,
  request: PageRequest<F>,
  options: ServerPageOptions = {},
): ServerPageState<T, TError> {
  const client = useDataClient()
  const query = useQuery<PageResult<T>, TError>(
    {
      queryKey: pageKey(source, request),
      queryFn: ({ signal }) => source.fetchPage(request, { signal }),
      enabled: options.enabled !== false,
      meta: pageMeta,
      ...readOptionsOf(options),
      placeholderData: keepPreviousData,
    },
    client,
  )
  const counted = useServerTotal(source, request.filter, options)
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

type ServerInfiniteState<T, TError = DefaultServerError> = {
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
  error: TError | null
  retry: () => void
}

type PageParam = number | string | null

/** Pages that add up, for load more and infinite scroll: page numbers or cursors, as the source pages. */
function useServerInfinite<T, F, TError = DefaultServerError>(
  source: PageSource<T, F>,
  request: InfiniteRequest<F>,
  options: ReadOptions = {},
): ServerInfiniteState<T, TError> {
  const client = useDataClient()
  const cursorMode = source.capabilities.position === "cursor"
  const query = useInfiniteQuery<PageResult<T>, TError, InfiniteData<PageResult<T>, PageParam>, QueryKey, PageParam>(
    {
      queryKey: [...source.key, "infinite", request.filter, request.sort, request.size],
      queryFn: ({ signal, pageParam }: { signal: AbortSignal; pageParam: PageParam }) =>
        source.fetchPage(
          {
            ...request,
            position: cursorMode
              ? { cursor: typeof pageParam === "number" ? null : pageParam, direction: "forward" }
              : { page: typeof pageParam === "number" ? pageParam : 1 },
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
      meta: infiniteMeta,
      ...readOptionsOf(options),
      placeholderData: keepPreviousData,
    },
    client,
  )
  const counted = useServerTotal(source, request.filter, options)
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
      refreshKey(client, key, typeof call?.throwOnError === "boolean" ? call.throwOnError : throwOnError),
    [client, key, throwOnError],
  )
}

type Snapshot = [QueryKey, unknown][]

/** `patchSource` bound to the app's client and this source, for a write the app learned of elsewhere. */
function usePatchSource<T, Data = unknown>(
  source: PageSource<T, never> | { key: readonly unknown[] },
): (patch: SourcePatch<T, Data>, options?: PatchOptions) => Promise<void> {
  const client = useDataClient()
  const { key } = source
  return useCallback(
    (patch: SourcePatch<T, Data>, options?: PatchOptions) => patchSource<T, Data>(client, { key }, patch, options),
    [client, key],
  )
}

type SourceMutationOptions<T, Variables, Result, Data = Result, TError = DefaultServerError> = {
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
  /**
   * Mutations with the same `scope.id`, from this hook or any other, run one at a time in the order they were called,
   * as TanStack's `scope`: the next starts once the one before has settled, its refresh included. A failure doesn't
   * stop the queue.
   */
  scope?: { id: string }
  /** TanStack's `mutationKey`, to find these mutations with `useMutationState` or `client.isMutating`. */
  mutationKey?: readonly unknown[]
  /** When the mutation may run, as `createDataClient`'s `networkMode`; otherwise the client's. */
  networkMode?: NetworkMode
  /**
   * Whether a failed mutation reloads the key, in case part of the change reached the server. Default true; false
   * adds no read to a failed command (`optimistic` rows are still restored).
   */
  refreshOnError?: boolean
  onSuccess?: (result: Result, variables: Variables) => unknown
  onError?: (error: TError, variables: Variables) => unknown
}

type SourceMutationState<Variables, Result, TError = DefaultServerError> = {
  mutate: (variables: Variables) => void
  mutateAsync: (variables: Variables) => Promise<Result>
  status: "idle" | "pending" | "error" | "success"
  pending: boolean
  error: TError | null
  reset: () => void
}

/**
 * A change to the source's data. Its queries refresh afterwards; `optimistic` shows the change before, and
 * `settleItems` and `settle` write the server's answer instead of refreshing.
 */
function useSourceMutation<T, Variables = void, Result = unknown, Data = Result, TError = DefaultServerError>(
  options: SourceMutationOptions<T, Variables, Result, Data, TError>,
): SourceMutationState<Variables, Result, TError> {
  const client = useDataClient()
  const { key } = options.source
  const { settle, settleItems } = options
  const settles = settle !== undefined || settleItems !== undefined
  const refreshOnError = options.refreshOnError !== false
  const mutation = useMutation<Result, TError, Variables, { snapshot: Snapshot } | undefined>(
    {
      mutationFn: options.mutationFn,
      ...(options.scope === undefined ? {} : { scope: options.scope }),
      ...(options.mutationKey === undefined ? {} : { mutationKey: options.mutationKey }),
      ...networkModeOf(options.networkMode),
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
            const kind = queryKind(query, key)
            // TanStack's cache types data as unknown; a resource under the source's key holds the mutation's `Data`.
            if (kind === "resource")
              return settle?.(result, variables, assumeType<Data | undefined>(data), query.queryKey)
            return settleItems && mapItems<T>(kind, data, (items) => settleItems(items, result, variables))
          })
        }
        return options.onSuccess?.(result, variables)
      },
      onSettled: (_result, error) => {
        const refresh = error === null ? !settles : refreshOnError
        return refresh ? refreshKey(client, key) : undefined
      },
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
  patchSource,
  readOptionsOf,
  useInvalidateSource,
  usePatchSource,
  usePageController,
  useServerInfinite,
  useServerPage,
  useServerTotal,
  useSourceMutation,
}
export type {
  InfiniteRequest,
  InvalidateOptions,
  PatchOptions,
  ReadOptions,
  RefetchOptions,
  RefetchTrigger,
  ServerInfiniteState,
  ServerPageOptions,
  ServerPageState,
  ServerStatus,
  ServerTotalState,
  SourceMutationOptions,
  SourceMutationState,
  SourcePatch,
}
