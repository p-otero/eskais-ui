"use client"

import type { ComponentProps, ReactNode } from "react"

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle, type EmptySize } from "@/components/ui/empty"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { Spinner } from "@/components/ui/spinner"
import { useLastSuccess } from "@/components/ui/use-last-success"
import { cn } from "@/lib/utils"
import { assumeType } from "@/lib/narrow"

type DataStatus = "pending" | "error" | "success"

type DataStateLabels = {
  /** Screen-reader text while loading. */
  loading: string
  /** Screen-reader text while previous data stays on screen during a refetch. */
  refreshing: string
  errorTitle: ReactNode
  retry: ReactNode
  emptyTitle: ReactNode
  emptyDescription?: ReactNode
}

const defaultLabels = { loading: "Loading", refreshing: "Refreshing" }

type ErrorProps<E> =
  | { renderError: (error: E, retry: (() => unknown) | undefined) => ReactNode; onRetry?: () => unknown }
  | { renderError?: undefined; onRetry: () => unknown; labels: { errorTitle: ReactNode; retry: ReactNode } }
  | { renderError?: undefined; onRetry?: undefined; labels: { errorTitle: ReactNode } }

type EmptyProps = { empty: ReactNode } | { empty?: undefined; labels: { emptyTitle: ReactNode } }

type DataStateRootProps = Omit<ComponentProps<"div">, "children" | "className">

type DataStateProps<T, E> = DataStateRootProps & {
  status: DataStatus
  /** The result. Read only while `status` is success: data passed while pending is not shown. */
  data: T | undefined
  /** Shown as content, marked busy, while pending before the first success, like cached or initial data. */
  placeholderData?: T
  error?: E
  /** Whether successful data counts as empty. By default an empty array, `null` or `undefined` does. */
  isEmpty?: (data: T) => boolean
  /** Replaces the default LoadingState. */
  loading?: ReactNode
  /** Keeps showing the data of the last success while `status` is pending again, marked busy. Default true. */
  keepPreviousData?: boolean
  /** A refetch in the background while `status` stays success, as some data libraries report it. */
  fetching?: boolean
  labels?: Partial<DataStateLabels>
  size?: EmptySize
  className?: string
  children: (data: T) => ReactNode
} & ErrorProps<E> &
  EmptyProps

function defaultIsEmpty(data: unknown) {
  return Array.isArray(data) && data.length === 0
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message
  return error === undefined || error === null ? undefined : String(error)
}

function DataState<T, E = unknown>(props: DataStateProps<T, E>) {
  const {
    status,
    data,
    placeholderData,
    error,
    isEmpty = defaultIsEmpty,
    loading,
    keepPreviousData = true,
    fetching = false,
    size = "panel",
    className,
    children,
    labels: _labels,
    renderError: _renderError,
    onRetry: _onRetry,
    empty: _empty,
    ...rest
  } = props
  const labels: Partial<DataStateLabels> & typeof defaultLabels = {
    ...defaultLabels,
    ...(props.labels as Partial<DataStateLabels> | undefined),
  }
  const lastSuccess = useLastSuccess(status, data)

  const blank = (value: T | undefined): value is undefined => value === undefined || value === null || isEmpty(value)
  const kept = keepPreviousData ? lastSuccess : undefined
  const shown = status === "success" ? data : status === "pending" ? (kept ?? placeholderData) : undefined
  const busy = (status === "pending" && !blank(shown)) || (status === "success" && fetching)

  let content: ReactNode
  if (status === "error") {
    content = props.renderError ? (
      props.renderError(assumeType<E>(error), props.onRetry)
    ) : props.onRetry ? (
      <ErrorState
        size={size}
        title={labels.errorTitle}
        message={messageOf(error)}
        onRetry={props.onRetry}
        retryLabel={labels.retry}
      />
    ) : (
      <ErrorState size={size} title={labels.errorTitle} message={messageOf(error)} />
    )
  } else if (status === "pending" && blank(shown)) {
    content = loading ?? <LoadingState size={size} label={labels.loading} />
  } else if (blank(shown)) {
    content = props.empty ?? (
      <Empty size={size}>
        <EmptyHeader>
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
          {labels.emptyDescription === undefined ? null : (
            <EmptyDescription>{labels.emptyDescription}</EmptyDescription>
          )}
        </EmptyHeader>
      </Empty>
    )
  } else {
    content = children(shown)
  }

  return (
    <div
      {...rest}
      data-slot="data-state"
      data-status={status}
      data-busy={busy ? "" : undefined}
      aria-busy={busy || undefined}
      className={cn("relative flex w-full min-w-0 flex-1 flex-col", className)}
    >
      {content}
      {busy ? (
        <span data-slot="data-state-busy" className="absolute end-0 top-0 text-muted-foreground">
          <Spinner size="sm" label={labels.refreshing} />
        </span>
      ) : null}
    </div>
  )
}

export { DataState }
export type { DataStateLabels, DataStateProps, DataStatus }
