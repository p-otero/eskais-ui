"use client"

import { QueryClient, QueryClientContext, QueryClientProvider, type QueryClientConfig } from "@tanstack/react-query"
import { use, useState, type ReactNode } from "react"

/** Whether an error is a client error (4xx), read from its `status`: retrying would fail the same way. */
function isClientError(error: unknown) {
  const status = typeof error === "object" && error !== null ? (error as { status?: unknown }).status : undefined
  return typeof status === "number" && status >= 400 && status < 500
}

type DataClientOptions = {
  /** Retries after a failure that isn't a 4xx. Default 2. */
  retries?: number
  /** How long a result counts as fresh, in ms. Default 30 s. */
  staleTime?: number
  /** Default false: a table doesn't reload because the window got focus. */
  refetchOnWindowFocus?: boolean
  /** Retry delay in ms, or TanStack's exponential backoff when unset. */
  retryDelay?: number
}

/**
 * A query client with the registry's defaults: two retries except on a 4xx, 30 s fresh, no refetch on focus.
 * Pass it to your own `QueryClientProvider`, or let `DataProvider` make one.
 */
function createDataClient(options: DataClientOptions = {}): QueryClient {
  const { retries = 2, staleTime = 30_000, refetchOnWindowFocus = false, retryDelay } = options
  const config: QueryClientConfig = {
    defaultOptions: {
      queries: {
        retry: (failures, error) => !isClientError(error) && failures < retries,
        staleTime,
        refetchOnWindowFocus,
        ...(retryDelay === undefined ? {} : { retryDelay }),
      },
      mutations: { retry: false },
    },
  }
  return new QueryClient(config)
}

let fallback: QueryClient | undefined

// Without any provider the hooks share one client, mounted once, so a single-page app needs no setup. A server
// renderer should mount `DataProvider` per request instead, so no cache outlives it.
function fallbackClient() {
  if (!fallback) {
    fallback = createDataClient()
    fallback.mount()
  }
  return fallback
}

/** The app's `QueryClient` when one is provided, else the shared default. */
function useDataClient(): QueryClient {
  return use(QueryClientContext) ?? fallbackClient()
}

type DataProviderProps = {
  /** A client of your own; otherwise the app's, or a new one with `createDataClient` defaults. */
  client?: QueryClient
  options?: DataClientOptions
  children: ReactNode
}

/** Uses the app's `QueryClient` when it has one; otherwise provides one with the registry's defaults. */
function DataProvider({ client, options, children }: DataProviderProps) {
  const existing = use(QueryClientContext)
  const [own] = useState(() => client ?? createDataClient(options))
  if (existing && !client) return children
  return <QueryClientProvider client={client ?? own}>{children}</QueryClientProvider>
}

export { createDataClient, DataProvider, isClientError, useDataClient }
export type { DataClientOptions, DataProviderProps }
