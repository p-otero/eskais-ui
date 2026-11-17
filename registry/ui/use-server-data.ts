"use client"

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

import { useDataClient } from "@/components/ui/server-data"
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

/** Refreshes every query of the source: pages, infinite lists and totals, by its key prefix. */
function useInvalidateSource(source: { key: readonly unknown[] }) {
  const client = useDataClient()
  const { key } = source
  return useCallback(() => client.invalidateQueries({ queryKey: key }), [client, key])
}

type Snapshot = [QueryKey, unknown][]

function updateItems<T>(client: QueryClient, key: readonly unknown[], update: (items: T[]) => T[]) {
  const kind = (queryKey: QueryKey) => queryKey[key.length]
  for (const [queryKey, data] of client.getQueriesData<unknown>({ queryKey: key })) {
    if (data === undefined) continue
    if (kind(queryKey) === "page") {
      const page = data as PageResult<T>
      client.setQueryData(queryKey, { ...page, items: update(page.items) })
    } else if (kind(queryKey) === "infinite") {
      const infinite = data as InfiniteData<PageResult<T>>
      client.setQueryData(queryKey, {
        ...infinite,
        pages: infinite.pages.map((page) => ({ ...page, items: update(page.items) })),
      })
    }
  }
}

type SourceMutationOptions<T, Variables, Result> = {
  mutationFn: (variables: Variables) => Promise<Result>
  /** Its queries are refreshed once the mutation settles. */
  source: PageSource<T, never> | { key: readonly unknown[] }
  /** Opt-in: changes the cached rows at once and restores them if the mutation fails. */
  optimistic?: (items: T[], variables: Variables) => T[]
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

/** A change to the source's data: its queries refresh afterwards, and `optimistic` shows the change before. */
function useSourceMutation<T, Variables = void, Result = unknown>(
  options: SourceMutationOptions<T, Variables, Result>,
): SourceMutationState<Variables, Result> {
  const client = useDataClient()
  const { key } = options.source
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
      onSuccess: (result, variables) => options.onSuccess?.(result, variables),
      onSettled: () => client.invalidateQueries({ queryKey: key }),
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
  ServerInfiniteState,
  ServerPageOptions,
  ServerPageState,
  ServerStatus,
  ServerTotalState,
  SourceMutationOptions,
  SourceMutationState,
}
