"use client"

import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

import { useDataClient } from "@/components/ui/server-data"
import type { ServerStatus } from "@/components/ui/use-server-data"

type ServerQueryOptions<T> = {
  enabled?: boolean
  /** How long a result counts as fresh, in ms; otherwise the client's default (30 s with `createDataClient`). */
  staleTime?: number
  /** Keeps the previous key's data while the next loads, as the page hooks do. Default false: a detail never shows another's. */
  keepPrevious?: boolean
  /** Shown while the first load is pending, never cached. */
  placeholder?: T
}

type ServerQueryState<T> = {
  data: T | undefined
  status: ServerStatus
  /** A request is in flight, the first one or a refetch. */
  fetching: boolean
  /** `data` is the previous key's (`keepPrevious`) or the `placeholder` while this one loads. */
  previous: boolean
  error: unknown
  retry: () => void
}

// Marks the queries `useServerQuery` owns, so a mutation's `settle` tells them from pages under the same key.
const resourceMeta = { serverData: "resource" }

/**
 * One resource that isn't paged: a detail, a snapshot or a whole short list. Put its key under a source's
 * (`[...tasks.key, "detail", id]`) so `useInvalidateSource` and `useSourceMutation` reach it. `fetch` gets the signal,
 * aborted when the key changes or nothing reads it any more, and must not resolve to `undefined` (use `null`).
 */
function useServerQuery<T>(
  key: readonly unknown[],
  fetch: (context: { signal: AbortSignal }) => Promise<T>,
  options: ServerQueryOptions<T> = {},
): ServerQueryState<T> {
  const client = useDataClient()
  const { placeholder, keepPrevious } = options
  const query = useQuery<T, unknown, T, readonly unknown[]>(
    {
      queryKey: key,
      queryFn: ({ signal }) => fetch({ signal }),
      enabled: options.enabled !== false,
      meta: resourceMeta,
      ...(options.staleTime === undefined ? {} : { staleTime: options.staleTime }),
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

export { resourceMeta, useServerQuery }
export type { ServerQueryOptions, ServerQueryState }
