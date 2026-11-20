"use client"

import {
  QueryClient,
  QueryClientContext,
  QueryClientProvider,
  type QueryClientConfig,
  type Register,
} from "@tanstack/react-query"
import { use, useState, type ReactNode } from "react"

function statusOf(error: unknown) {
  const status = typeof error === "object" && error !== null ? (error as { status?: unknown }).status : undefined
  return typeof status === "number" ? status : undefined
}

/** Whether an error is a client error (4xx), read from its `status`: retrying would fail the same way. */
function isClientError(error: unknown) {
  const status = statusOf(error)
  return status !== undefined && status >= 400 && status < 500
}

/**
 * Whether a retry may succeed: a `status` of 408, 425, 429 or 5xx, or a `TypeError` without one, which is how `fetch`
 * reports a network failure. Any other error (a 4xx, a parse error, an IPC or domain error) fails the same way again.
 */
function isTransientError(error: unknown) {
  const status = statusOf(error)
  if (status === undefined) return error instanceof TypeError
  return status === 408 || status === 425 || status === 429 || status >= 500
}

/**
 * The `error` type of the data hooks when none is given: the `defaultError` an app registers with TanStack Query
 * (`declare module "@tanstack/react-query" { interface Register { defaultError: ApiError } }`), else `unknown`. Not
 * TanStack's `Error`: a fetch can reject with anything, and the hooks typed `error` as `unknown` before.
 */
type DefaultServerError = Register extends { defaultError: infer TError } ? TError : unknown

type RetryRule = (failureCount: number, error: unknown) => boolean

type DataClientOptions = {
  /**
   * When a failed read runs again. A number is the retries after a failure that isn't a 4xx (default 2); a function
   * decides alone, from the failures so far and the error: `(failures, error) => failures < 3 && isTransientError(error)`.
   * `false` never retries, as `0` does.
   */
  retry?: number | false | RetryRule
  /** @deprecated Use `retry`. */
  retries?: number
  /** How long a result counts as fresh, in ms. Default 30 s. */
  staleTime?: number
  /** Default false: a table doesn't reload because the window got focus. */
  refetchOnWindowFocus?: boolean
  /** Retry delay in ms, or a function of the failures so far and the error; TanStack's exponential backoff when unset. */
  retryDelay?: number | ((failureCount: number, error: unknown) => number)
}

function retryRule(retry: number | false | RetryRule): RetryRule {
  if (typeof retry === "function") return retry
  if (retry === false) return () => false
  return (failures, error) => !isClientError(error) && failures < retry
}

/**
 * A query client with the registry's defaults: two retries except on a 4xx, 30 s fresh, no refetch on focus.
 * Mutations never retry: a write that failed may still have reached the server.
 * Pass it to your own `QueryClientProvider`, or let `DataProvider` make one.
 */
function createDataClient(options: DataClientOptions = {}): QueryClient {
  const { retries = 2, staleTime = 30_000, refetchOnWindowFocus = false, retryDelay } = options
  const config: QueryClientConfig = {
    defaultOptions: {
      queries: {
        retry: retryRule(options.retry ?? retries),
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

export { createDataClient, DataProvider, isClientError, isTransientError, useDataClient }
export type { DataClientOptions, DataProviderProps, DefaultServerError, RetryRule }
