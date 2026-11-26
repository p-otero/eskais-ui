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
  pausedRead,
  queryKind,
  refreshKey,
  settleQueries,
  updateItems,
  type PatchOptions,
  type PatchResult,
  type SourcePatch,
} from "@/components/ui/server-data-cache"
import { isPollFetch, type PollOptions } from "@/components/ui/server-data-poll"
import { holdSource, type HoldPatchOptions, type SourceHold } from "@/components/ui/server-data-hold"
import { networkModeOf, readOptionsOf, type ReadOptions } from "@/components/ui/server-data-options"
import type { RefetchOptions, RefetchTrigger } from "@/components/ui/server-data-options"
import { useServerPoll } from "@/components/ui/use-server-poll"
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

type ServerPageOptions<T = unknown, TError = DefaultServerError> = ReadOptions &
  PollOptions<ServerPageState<T, TError>> & {
    /** Overrides the navigation `"auto"` picks from the source. */
    navigation?: NavigationMode
  }

type ServerInfiniteOptions<T = unknown, TError = DefaultServerError> = ReadOptions &
  PollOptions<ServerInfiniteState<T, TError>>

type ServerPageState<T, TError = DefaultServerError> = {
  /** The page's rows; while another page loads, the previous page's rows stay here. */
  items: T[]
  result: PageResult<T> | undefined
  status: ServerStatus
  /** A request is in flight, the first one or a refetch. */
  fetching: boolean
  /** The request in flight is a `refetchInterval` poll's, which a status shouldn't announce. */
  polling: boolean
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

const pageMeta = { serverData: "page" }
const infiniteMeta = { serverData: "infinite" }
const totalMeta = { serverData: "total" }

function totalKey<F>(source: PageSource<unknown, F>, filter: F): QueryKey {
  return [...source.key, "total", filter]
}

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
      queryKey: totalKey(source, filter),
      queryFn: (context) =>
        pausedRead(client, context, () =>
          fetchTotal
            ? fetchTotal.call(source, filter, { signal: context.signal })
            : Promise.reject(new TypeError("This source has no `fetchTotal`.")),
        ),
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
  options: ServerPageOptions<T, TError> = {},
): ServerPageState<T, TError> {
  const client = useDataClient()
  const enabled = options.enabled !== false
  const queryKey = pageKey(source, request)
  const query = useQuery<PageResult<T>, TError>(
    {
      queryKey,
      queryFn: (context) => pausedRead(client, context, () => source.fetchPage(request, { signal: context.signal })),
      enabled,
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
  const state: ServerPageState<T, TError> = {
    items: result?.items ?? [],
    result,
    status: query.status,
    fetching: query.isFetching,
    polling: query.isFetching && isPollFetch(client, queryKey),
    previous: query.isPlaceholderData,
    total,
    navigation: resolveNavigation(source.capabilities, options.navigation, total),
    error: query.error,
    retry,
  }
  useServerPoll(client, source.fetchTotal ? [queryKey, totalKey(source, request.filter)] : [queryKey], options, state)
  return state
}

type InfiniteRequest<F> = { filter: F; sort: readonly SortSpec[]; size: number }

type ServerInfiniteState<T, TError = DefaultServerError> = {
  /** Every loaded page's rows, in order. */
  items: T[]
  pages: PageResult<T>[]
  status: ServerStatus
  fetching: boolean
  /** The request in flight is a `refetchInterval` poll's, which a status shouldn't announce. */
  polling: boolean
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
  options: ServerInfiniteOptions<T, TError> = {},
): ServerInfiniteState<T, TError> {
  const client = useDataClient()
  const enabled = options.enabled !== false
  const cursorMode = source.capabilities.position === "cursor"
  const queryKey: QueryKey = [...source.key, "infinite", request.filter, request.sort, request.size]
  const query = useInfiniteQuery<PageResult<T>, TError, InfiniteData<PageResult<T>, PageParam>, QueryKey, PageParam>(
    {
      queryKey,
      queryFn: (context: { queryKey: QueryKey; signal: AbortSignal; pageParam: PageParam }) =>
        pausedRead(client, context, () =>
          source.fetchPage(
            {
              ...request,
              position: cursorMode
                ? { cursor: typeof context.pageParam === "number" ? null : context.pageParam, direction: "forward" }
                : { page: typeof context.pageParam === "number" ? context.pageParam : 1 },
            },
            { signal: context.signal },
          ),
        ),
      initialPageParam: (cursorMode ? null : 1) as PageParam,
      getNextPageParam: (last: PageResult<T>, all: PageResult<T>[]): PageParam | undefined => {
        if (cursorMode) return last.nextCursor ?? undefined
        const total = last.total ?? last.totalEstimate
        const more =
          last.hasMore ?? (total === undefined ? last.items.length >= request.size : all.length * request.size < total)
        return more && last.items.length > 0 ? all.length + 1 : undefined
      },
      enabled,
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
  const state: ServerInfiniteState<T, TError> = {
    items: pages.flatMap((page) => page.items),
    pages,
    status: query.status,
    fetching: query.isFetching,
    polling: query.isFetching && isPollFetch(client, queryKey),
    loadingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    loadMore,
    total: totalOf(pages[0], counted.total),
    error: query.error,
    retry,
  }
  useServerPoll(client, source.fetchTotal ? [queryKey, totalKey(source, request.filter)] : [queryKey], options, state)
  return state
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
): (patch: SourcePatch<T, Data>, options?: PatchOptions) => Promise<PatchResult> {
  const client = useDataClient()
  const { key } = source
  return useCallback(
    (patch: SourcePatch<T, Data>, options?: PatchOptions) => patchSource<T, Data>(client, { key }, patch, options),
    [client, key],
  )
}

/**
 * `holdSource` bound to the app's client and this source: the returned function begins a hold. Every hold this
 * component began and hasn't ended is released when it unmounts, so no read stays paused.
 */
function useHoldSource<T, Data = unknown>(
  source: PageSource<T, never> | { key: readonly unknown[] },
): () => SourceHold<T, Data> {
  const client = useDataClient()
  const { key } = source
  const [open] = useState(() => new Set<SourceHold<T, Data>>())
  useEffect(
    () => () => {
      for (const hold of open) hold.release()
      open.clear()
    },
    [open],
  )
  return useCallback(() => {
    for (const ended of open) if (!ended.active) open.delete(ended)
    const hold = holdSource<T, Data>(client, { key })
    open.add(hold)
    return hold
  }, [client, key, open])
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
            // Workaround: TanStack's cache types data as unknown; a resource under the source's key holds the mutation's `Data`.
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
  holdSource,
  pageKey,
  patchSource,
  readOptionsOf,
  useInvalidateSource,
  useHoldSource,
  usePatchSource,
  usePageController,
  useServerInfinite,
  useServerPage,
  useServerTotal,
  useSourceMutation,
}
export type {
  HoldPatchOptions,
  InfiniteRequest,
  InvalidateOptions,
  PatchOptions,
  PatchResult,
  ReadOptions,
  RefetchOptions,
  RefetchTrigger,
  ServerInfiniteOptions,
  ServerInfiniteState,
  ServerPageOptions,
  ServerPageState,
  ServerStatus,
  ServerTotalState,
  SourceMutationOptions,
  SourceHold,
  SourceMutationState,
  SourcePatch,
}
