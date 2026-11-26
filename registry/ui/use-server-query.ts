"use client"

import { useQuery, type QueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { useDataClient, type DefaultServerError } from "@/components/ui/server-data"
import { pausedRead } from "@/components/ui/server-data-cache"
import { isPollFetch, type PollOptions } from "@/components/ui/server-data-poll"
import { readOptionsOf, type ReadOptions, type ServerStatus } from "@/components/ui/use-server-data"
import { useServerPoll } from "@/components/ui/use-server-poll"
import { assumeType } from "@/lib/narrow"

/** Data that one resource's answer writes into another's query, as `resource.seed(params, data)` builds it. */
type ResourceSeed = { key: readonly unknown[]; data: unknown }

/**
 * `networkMode`: when the read may run, as `createDataClient`'s; `"always"` for a backend the browser's online state
 * says nothing about (IPC, localhost). `refetchOnWindowFocus`, `refetchOnReconnect`, `refetchOnMount`: when it reloads
 * on its own; otherwise the client's.
 */
type ServerQueryOptions<T, TSelected = T, TError = DefaultServerError> = ReadOptions &
  PollOptions<ServerQueryState<TSelected, TError>> & {
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
  /** The request in flight is a `refetchInterval` poll's, which a status shouldn't announce. */
  polling: boolean
  /** `data` is the previous key's (`keepPrevious`) or the `placeholder` while this one loads. */
  previous: boolean
  error: TError | null
  retry: () => void
}

const resourceMeta = { serverData: "resource" }

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
  options: ServerQueryOptions<T, TSelected, TError> = {},
): ServerQueryState<TSelected, TError> {
  const client = useDataClient()
  const enabled = options.enabled !== false
  const { placeholder, keepPrevious, seeds, select } = options
  const query = useQuery<T, TError, TSelected, readonly unknown[]>(
    {
      queryKey: key,
      queryFn: (context) =>
        pausedRead(client, context, async () => {
          const { signal } = context
          const requestedAt = Date.now()
          const data = await fetch({ signal })
          if (seeds && !signal.aborted) writeSeeds(client, seeds(data), requestedAt)
          return data
        }),
      enabled,
      meta: resourceMeta,
      ...readOptionsOf(options),
      ...(options.staleTime === undefined ? {} : { staleTime: options.staleTime }),
      ...(select === undefined ? {} : { select }),
      placeholderData: (previous) =>
        // Workaround: TanStack types placeholder data as `NonFunctionGuard<T>`, which a generic `T` can't be narrowed to; a
        // placeholder is data, never a function.
        (keepPrevious ? previous : undefined) ?? assumeType<typeof previous>(placeholder),
    },
    client,
  )
  const { refetch } = query
  const retry = useCallback(() => {
    void refetch()
  }, [refetch])
  const state: ServerQueryState<TSelected, TError> = {
    data: query.data,
    status: query.status,
    fetching: query.isFetching,
    polling: query.isFetching && isPollFetch(client, key),
    previous: query.isPlaceholderData,
    error: query.error,
    retry,
  }
  useServerPoll(client, [key], options, state)
  return state
}

/**
 * `networkMode`, `refetchOnWindowFocus`, `refetchOnReconnect` and `refetchOnMount` as `useServerQuery`'s, for every
 * screen that reads the resource: `refetchOnWindowFocus: false, refetchOnReconnect: false` keeps one whose reads
 * overwrite per-item ETags from reloading behind an edit.
 */
type ResourceDefinition<P, T> = Omit<ReadOptions, "enabled"> & {
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

const definedKeys = [
  "staleTime",
  "networkMode",
  "refetchOnWindowFocus",
  "refetchOnReconnect",
  "refetchOnMount",
] as const satisfies readonly (keyof ResourceDefinition<unknown, unknown> & keyof ServerQueryOptions<unknown>)[]

type DefinedOptions = Pick<ServerQueryOptions<unknown>, (typeof definedKeys)[number]>

function definedOptions(resource: DefinedOptions, options: DefinedOptions): DefinedOptions {
  const merged: Record<string, unknown> = {}
  for (const name of definedKeys) {
    const value = options[name] ?? resource[name]
    if (value !== undefined) merged[name] = value
  }
  return merged as DefinedOptions
}

/**
 * `useServerQuery` with a resource's key, fetch, `seeds` and options (`staleTime`, `networkMode`, the refetch
 * triggers); an option given here wins over the resource's.
 */
function useServerResource<P, T, TError = DefaultServerError, TSelected = T>(
  resource: Resource<P, T>,
  params: P,
  options: Omit<ServerQueryOptions<T, TSelected, TError>, "seeds"> = {},
): ServerQueryState<TSelected, TError> {
  const { seeds } = resource
  return useServerQuery<T, TError, TSelected>(resource.key(params), (context) => resource.fetch(params, context), {
    ...options,
    ...definedOptions(resource, options),
    ...(seeds === undefined ? {} : { seeds: (data: T) => seeds(data, params) }),
  })
}

export { defineResource, resourceMeta, useServerQuery, useServerResource }
export type { Resource, ResourceDefinition, ResourceSeed, ServerQueryOptions, ServerQueryState }
