"use client"

import { useSyncExternalStore, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { DataState } from "@/components/ui/data-state"
import { FilterScope } from "@/components/ui/filter-scope"
import { FilterSearch } from "@/components/ui/filter-search"
import { List, type ListProps } from "@/components/ui/list"
import { Skeleton } from "@/components/ui/skeleton"
import { usePageController, useServerInfinite } from "@/components/ui/use-server-data"
import { useDelayedFlag, useReachEnd } from "@/components/ui/use-server-table"
import { searchFieldOf, type FilterSchema, type FilterValues } from "@/lib/filter-schema"
import { assumeType } from "@/lib/narrow"
import type { PageController } from "@/lib/page-controller"
import { pageRange, pageStatusLabels, type PageSource, type PageStatusLabels, type SortSpec } from "@/lib/page-source"
import { useLocale } from "@/lib/locale"
import { cn } from "@/lib/utils"

type ServerListLabels = {
  errorTitle: ReactNode
  retry: ReactNode
  emptyTitle: ReactNode
  emptyDescription?: ReactNode
  range?: PageStatusLabels["range"]
  noResults?: string
  loading?: string
  refreshing?: string
  loadMore?: string
  filters?: (label: string) => string
  /** The search field's placeholder: "Search Tasks…". Its accessible name stays the field's label. */
  searchPlaceholder?: (label: string) => string
}

const serverListLabels = {
  range: pageStatusLabels.range,
  noResults: pageStatusLabels.empty,
  loading: pageStatusLabels.loading,
  refreshing: "Refreshing",
  loadMore: "Load more",
  filters: (label: string) => `${label} filters`,
  searchPlaceholder: (label: string) => `Search ${label}…`,
}

type ServerListProps<T, S extends FilterSchema> = Pick<
  ListProps<T>,
  "variant" | "value" | "defaultValue" | "onValueChange" | "onSelect" | "virtualize" | "estimateSize"
> & {
  /** Names the list, for screen readers and agents. */
  "aria-label": string
  source: PageSource<T, FilterValues<S>>
  renderItem: (item: T, index: number) => ReactNode
  /** A row's text, for agents and find in page while it isn't rendered. */
  itemText: (item: T) => string
  filters?: S
  /** Filter UIs of your own; by default a `FilterSearch` when the schema has a text field. */
  toolbar?: ReactNode
  defaultFilters?: FilterValues<S>
  sort?: readonly SortSpec[]
  /** Rows per request. Default 50. */
  pageSize?: number
  /** Loads the next page as the end of the list scrolls into view, beside the Load more button. Default true. */
  infinite?: boolean
  /**
   * Reloads the shown rows every so many ms while the document is visible, as the hooks' `refetchInterval`: the rows
   * stay, unmarked, and the status announces nothing. Default false.
   */
  refetchInterval?: number | false
  /** Keeps polling while the document is hidden, as the hooks' `refetchIntervalInBackground`. Default false. */
  refetchIntervalInBackground?: boolean
  controller?: PageController<FilterValues<S>>
  labels: ServerListLabels
  /** Formats the counts; the page's `<html lang>` by default (`useLocale`). */
  locale?: string
  className?: string
}

function ServerListLoading({ rows, label }: { rows: number; label: string }) {
  return (
    <div data-slot="server-list-loading" aria-busy="true" className="flex min-w-0 flex-col">
      <output className="sr-only">{label}</output>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} aria-hidden="true" className="flex flex-col gap-inline px-inset-item py-inset-item">
          <Skeleton className="h-lh w-2/3 max-w-80" />
          <Skeleton className="h-4 w-1/3 max-w-40" />
        </div>
      ))}
    </div>
  )
}

function ServerList<T, S extends FilterSchema = Record<never, never>>({
  "aria-label": label,
  source,
  renderItem,
  itemText,
  filters,
  toolbar,
  defaultFilters,
  sort,
  pageSize = 50,
  infinite = true,
  refetchInterval = false,
  refetchIntervalInBackground = false,
  controller: controllerProp,
  labels: labelOverrides,
  locale: localeProp,
  className,
  ...listProps
}: ServerListProps<T, S>) {
  const labels = { ...serverListLabels, ...labelOverrides }
  const locale = useLocale(localeProp)
  // Workaround: without `filters` the schema is empty, which TypeScript can't confirm is an `S` for a generic `S`.
  const schema = filters ?? assumeType<S>({})
  const searchKey = searchFieldOf(schema)
  const own = usePageController<T, FilterValues<S>>(source, {
    filter: defaultFilters,
    sort,
    pageSize,
    search: searchKey === undefined ? undefined : { key: searchKey as keyof FilterValues<S> & string },
  })
  const controller = controllerProp ?? own.controller
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const rows = useServerInfinite(
    source,
    { filter: state.filter, sort: state.sort, size: state.size },
    { refetchInterval, refetchIntervalInBackground },
  )
  const reachEnd = useReachEnd(rows.loadMore, infinite && rows.hasMore && !rows.fetching)
  const slow = useDelayedFlag(
    rows.fetching && !rows.polling,
    `${JSON.stringify(state.request)}:${String(rows.pages.length)}`,
  )
  const range = pageRange(0, rows.items.length, rows.total)
  const statusText =
    rows.status === "error"
      ? ""
      : slow
        ? labels.loading
        : rows.status === "pending"
          ? ""
          : range
            ? labels.range(range, locale)
            : labels.noResults

  const content = toolbar ?? (searchKey ? <FilterSearch /> : null)
  return (
    <div data-slot="server-list" className={cn("flex min-w-0 flex-col gap-items", className)}>
      {filters && content && (
        <FilterScope
          schema={schema}
          controller={controller}
          label={labels.filters(label)}
          searchPlaceholder={labels.searchPlaceholder(label)}
          className="flex flex-wrap items-center gap-items"
        >
          {content}
        </FilterScope>
      )}
      <DataState
        status={rows.status}
        data={rows.status === "success" ? rows.items : undefined}
        error={rows.error}
        onRetry={rows.retry}
        labels={labels}
        loading={<ServerListLoading rows={Math.min(pageSize, 20)} label={labels.loading} />}
      >
        {(items) => (
          <div
            aria-busy={(rows.fetching && !rows.polling && !rows.loadingMore) || undefined}
            className="flex min-w-0 flex-col"
          >
            <List<T>
              {...listProps}
              aria-label={label}
              items={items}
              getItemId={(item) => source.getId(item)}
              itemText={itemText}
              renderItem={renderItem}
            />
          </div>
        )}
      </DataState>
      {infinite && rows.hasMore && <div ref={reachEnd} aria-hidden="true" data-slot="server-list-end" />}
      <div data-slot="server-list-footer" className="flex flex-wrap items-center justify-between gap-items">
        <output aria-live="polite" className="min-h-5 text-body-sm text-muted-foreground tabular-nums">
          {statusText}
        </output>
        {(rows.hasMore || rows.pages.length > 1) && (
          <Button
            variant="outline"
            loading={rows.loadingMore}
            disabled={!rows.hasMore}
            focusableWhenDisabled
            onClick={() => rows.loadMore()}
          >
            {labels.loadMore}
          </Button>
        )}
      </div>
    </div>
  )
}

export { ServerList, serverListLabels }
export type { ServerListLabels, ServerListProps }
