"use client"

import { useQuery, type QueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { useDataClient, type DefaultServerError } from "@/components/ui/server-data"
import type { ServerStatus } from "@/components/ui/use-server-data"

/** Data that one resource's answer writes into another's query, as `resource.seed(params, data)` builds it. */
type ResourceSeed = { key: readonly unknown[]; data: unknown }

type ServerQueryOptions<T, TSelected = T> = {
  enabled?: boolean
  /** How long a result counts as fresh, in ms; otherwise the client's default (30 s with `createDataClient`). */
  staleTime?: number
  /** Keeps the previous key's data while the next loads, as the page hooks do. Default false: a detail never shows another's. */
  keepPrevious?: boolean
  /** Shown while the first load is pending, never cached. */
  placeholder?: T
  /**
   * Picks what `data` holds from the cached answer, as TanStack's `select`: it runs again only when the answer or the
   * function changes (define it outside the component or memoise it), and an equal result keeps its identity. The
   * cache, `settle` and `seeds` still see the whole answer.
   */
  select?: (data: T) => TSelected
  /**
   * Other resources this answer fills: `(task) => [taskSummary.seed(task.id, summaryOf(task))]`. Written once the
   * fetch resolves, whether or not those resources are mounted, unless the fetch was aborted; a resource whose data
   * was written after this fetch started keeps it.
   */
  seeds?: (data: T) => readonly ResourceSeed[]
}

type ServerQueryState<T, TError = DefaultServerError> = {
  data: T | undefined
  status: ServerStatus
  /** A request is in flight, the first one or a refetch. */
  fetching: boolean
  /** `data` is the previous key's (`keepPrevious`) or the `placeholder` while this one loads. */
  previous: boolean
  error: TError | null
  retry: () => void
}

// Marks the queries `useServerQuery` owns, so a mutation's `settle` tells them from pages under the same key.
const resourceMeta = { serverData: "resource" }

/** Writes each seed unless its query got data after `requestedAt`, which is fresher than the answer seeding it. */
function writeSeeds(client: QueryClient, seeds: readonly ResourceSeed[], requestedAt: number) {
  for (const { key, data } of seeds) {
    if (data === undefined) continue
    const state = client.getQueryState(key)
    if (state !== undefined && state.data !== undefined && state.dataUpdatedAt >= requestedAt) continue
    client.setQueryData(key, data)
  }
}

/**
 * One resource that isn't paged: a detail, a snapshot or a whole short list. Put its key under a source's
 * (`[...tasks.key, "detail", id]`) so `useInvalidateSource` and `useSourceMutation` reach it. `fetch` gets the signal,
 * aborted when the key changes or nothing reads it any more, and must not resolve to `undefined` (use `null`).
 */
function useServerQuery<T, TError = DefaultServerError, TSelected = T>(
  key: readonly unknown[],
  fetch: (context: { signal: AbortSignal }) => Promise<T>,
  options: ServerQueryOptions<T, TSelected> = {},
): ServerQueryState<TSelected, TError> {
  const client = useDataClient()
  const { placeholder, keepPrevious, seeds, select } = options
  const query = useQuery<T, TError, TSelected, readonly unknown[]>(
    {
      queryKey: key,
      queryFn: async ({ signal }) => {
        const requestedAt = Date.now()
        const data = await fetch({ signal })
        if (seeds && !signal.aborted) writeSeeds(client, seeds(data), requestedAt)
        return data
      },
      enabled: options.enabled !== false,
      meta: resourceMeta,
      ...(options.staleTime === undefined ? {} : { staleTime: options.staleTime }),
      ...(select === undefined ? {} : { select }),
      placeholderData: (previous) => (keepPrevious ? previous : undefined) ?? (placeholder as typeof previous),
    },
    client,
  )
  const { refetch } = query
  const retry = useCallback(() => {
    void refetch()
  }, [refetch])
  return {
    data: query.data,
    status: query.status,
    fetching: query.isFetching,
    previous: query.isPlaceholderData,
    error: query.error,
    retry,
  }
}

type ResourceDefinition<P, T> = {
  /** The query key for these parameters; put it under a source's key so mutations of the source reach it. */
  key: (params: P) => readonly unknown[]
  fetch: (params: P, context: { signal: AbortSignal }) => Promise<T>
  staleTime?: number
  /** Other resources this answer fills, as `useServerQuery`'s `seeds`. */
  seeds?: (data: T, params: P) => readonly ResourceSeed[]
}

type Resource<P, T> = ResourceDefinition<P, T> & {
  /** This resource's data for `params`, for another resource's `seeds`; `data` is checked against its type. */
  seed: (params: P, data: T) => ResourceSeed
}

/**
 * A resource declared once, for every screen that reads it: its key, its fetch, its options and the resources its
 * answer seeds. Read it with `useServerResource(resource, params)`.
 */
function defineResource<P, T>(definition: ResourceDefinition<P, T>): Resource<P, T> {
  return { ...definition, seed: (params, data) => ({ key: definition.key(params), data }) }
}

/** `useServerQuery` with a resource's key, fetch, `staleTime` and `seeds`; `options` override its `staleTime`. */
function useServerResource<P, T, TError = DefaultServerError, TSelected = T>(
  resource: Resource<P, T>,
  params: P,
  options: Omit<ServerQueryOptions<T, TSelected>, "seeds"> = {},
): ServerQueryState<TSelected, TError> {
  const { seeds } = resource
  const staleTime = options.staleTime ?? resource.staleTime
  return useServerQuery<T, TError, TSelected>(resource.key(params), (context) => resource.fetch(params, context), {
    ...options,
    ...(staleTime === undefined ? {} : { staleTime }),
    ...(seeds === undefined ? {} : { seeds: (data: T) => seeds(data, params) }),
  })
}

export { defineResource, resourceMeta, useServerQuery, useServerResource }
export type { Resource, ResourceDefinition, ResourceSeed, ServerQueryOptions, ServerQueryState }
