"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react"

import {
  createDataTableController,
  DataTable,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
} from "@/components/ui/data-table"
import { DataState } from "@/components/ui/data-state"
import { FilterChips } from "@/components/ui/filter-chips"
import { countActiveFilters, FilterPanel, FilterPanelTrigger } from "@/components/ui/filter-panel"
import { FilterScope } from "@/components/ui/filter-scope"
import { FilterSearch } from "@/components/ui/filter-search"
import {
  ServerTableNavigation,
  ServerTablePageSize,
  serverDataTableLabels,
  type ServerDataTableLabels,
} from "@/components/ui/server-data-table-parts"
import { usePageController, useServerInfinite, useServerPage } from "@/components/ui/use-server-data"
import { useDelayedFlag, useReachEnd } from "@/components/ui/use-server-table"
import { searchFieldOf, type FilterSchema, type FilterValues } from "@/lib/filter-schema"
import { createUrlCodec } from "@/lib/filter-url"
import type { PageController, UrlHistory } from "@/lib/page-controller"
import {
  isPagePosition,
  pageCountOf,
  pageRange,
  resolveNavigation,
  type NavigationMode,
  type PageSource,
  type SortSpec,
} from "@/lib/page-source"
import type { UrlStateAdapter } from "@/lib/url-state"
import { useLocale } from "@/lib/locale"
import { cn } from "@/lib/utils"

type ServerTableUrlState = {
  adapter: UrlStateAdapter
  /** Prefixes the table's params, for two tables on one page. */
  prefix?: string
  history?: UrlHistory
  format?: "fields" | "encoded"
}

type ServerDataTableFilterUi = "search" | "chips" | "panel" | "none"

type ServerDataTableProps<T, S extends FilterSchema> = Pick<
  DataTableProps<T>,
  | "getRowLabel"
  | "selectable"
  | "selection"
  | "defaultSelection"
  | "onSelectionChange"
  | "onRowOpen"
  | "virtualize"
  | "estimateSize"
  | "loadingRows"
  | "tableClassName"
> & {
  /** Names the table, for screen readers and agents. */
  label: string
  source: PageSource<T, FilterValues<S>>
  /** Give a column `sortField` to sort it on the server. */
  columns: readonly DataTableColumn<T>[]
  filters?: S
  /**
   * The built-in filter UI: `"search"` (default when the schema has a text field), `"chips"` (search and
   * `FilterChips`) or `"panel"` (search and a `FilterPanel` beside the table, a sheet on narrow screens).
   * Ignored with `toolbar`.
   */
  filterUi?: ServerDataTableFilterUi
  /** Filter UIs of your own, composed from the parts; they find the schema and controller from the table. */
  toolbar?: ReactNode
  defaultFilters?: FilterValues<S>
  defaultSort?: readonly SortSpec[]
  /** `"multi"`: Shift+click adds a column to the sort. Default `"single"`. */
  sortMode?: "single" | "multi"
  pageSize?: number
  pageSizes?: readonly number[]
  /** Default `"auto"`: page numbers with an exact total, previous and next without, load more for a cursor. */
  navigation?: NavigationMode
  /** Keeps filters, sort and page in the URL: `hashUrlState()`, `historyUrlState()` or your router's adapter. */
  urlState?: UrlStateAdapter | ServerTableUrlState
  /** A controller of your own, from `usePageController`, to drive the table from outside. */
  controller?: PageController<FilterValues<S>>
  labels: ServerDataTableLabels
  /** Formats the counts, dates and numbers it shows; the page's `<html lang>` by default (`useLocale`). */
  locale?: string
  className?: string
}

const toDirection = { asc: "ascending", desc: "descending" } as const
const noSort: readonly SortSpec[] = []
const defaultPageSizes: readonly number[] = [10, 25, 50, 100]

function urlOptions<S extends FilterSchema>(
  urlState: ServerDataTableProps<unknown, S>["urlState"],
  schema: S,
  defaults: { size: number; sort: readonly SortSpec[] },
) {
  if (!urlState) return undefined
  const options = "adapter" in urlState ? urlState : { adapter: urlState }
  const codec = createUrlCodec(schema, { prefix: options.prefix, format: options.format, defaults })
  return { adapter: options.adapter, codec, history: options.history }
}

/**
 * A DataTable over a `PageSource`: the server filters, sorts and pages. Loading, error with retry and empty come
 * from `DataState`; the rows of the previous page stay while the next loads, and a polite status says what is
 * shown after each load. Filters, sort and page can live in the URL.
 */
function ServerDataTable<T, S extends FilterSchema = Record<never, never>>({
  label,
  source,
  columns,
  filters,
  filterUi,
  toolbar,
  defaultFilters,
  defaultSort = noSort,
  sortMode = "single",
  pageSize = 25,
  pageSizes = defaultPageSizes,
  navigation: navigationMode = "auto",
  urlState,
  controller: controllerProp,
  labels: labelOverrides,
  locale: localeProp,
  className,
  tableClassName,
  ...tableProps
}: ServerDataTableProps<T, S>) {
  const labels = { ...serverDataTableLabels, ...labelOverrides }
  const locale = useLocale(localeProp)
  const schema = filters ?? ({} as S)
  const searchKey = searchFieldOf(schema)
  const [url] = useState(() =>
    controllerProp ? undefined : urlOptions(urlState, schema, { size: pageSize, sort: defaultSort }),
  )
  const own = usePageController<T, FilterValues<S>>(source, {
    filter: defaultFilters,
    sort: defaultSort,
    sortMode,
    pageSize,
    pageSizes,
    navigation: navigationMode,
    search: searchKey === undefined ? undefined : { key: searchKey as keyof FilterValues<S> & string },
    url,
  })
  const controller = controllerProp ?? own.controller
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  const [tableController] = useState(createDataTableController)
  const [panelOpen, setPanelOpen] = useState(false)
  const panelTrigger = useRef<HTMLButtonElement>(null)

  const accumulating = ["load-more", "infinite"].includes(resolveNavigation(source.capabilities, navigationMode))
  const paged = useServerPage(source, state.request, { enabled: !accumulating, navigation: navigationMode })
  const more = useServerInfinite(
    source,
    { filter: state.filter, sort: state.sort, size: state.size },
    { enabled: accumulating },
  )
  const view = accumulating ? more : paged
  const navigation = accumulating ? resolveNavigation(source.capabilities, navigationMode) : paged.navigation
  const reachEnd = useReachEnd(more.loadMore, navigation === "infinite" && more.hasMore && !more.fetching)

  const cursorMode = !isPagePosition(state.request.position)
  const index = cursorMode ? state.cursorIndex + 1 : state.page
  const pageCount =
    navigation === "pages" && view.total.kind === "exact"
      ? pageCountOf(view.total.value, state.size)
      : index + (paged.result?.hasMore ? 1 : 0)
  const offset = accumulating ? 0 : (index - 1) * state.size
  const range = pageRange(offset, view.items.length, view.total)
  const slow = useDelayedFlag(view.fetching, JSON.stringify(state.request))
  const statusText =
    view.status === "error"
      ? ""
      : slow || view.status === "pending"
        ? slow
          ? labels.loading
          : ""
        : range
          ? labels.range(range, locale)
          : labels.noResults

  const goToPage = (next: number) => {
    if (navigation === "pages" || (!cursorMode && Math.abs(next - index) !== 1)) controller.setPage(next)
    else if (next > index) controller.next(paged.result)
    else if (next < index) controller.previous(paged.result)
  }

  const fieldOf = new Map(columns.flatMap((column) => (column.sortField ? [[column.sortField, column.id]] : [])))
  const sorts: DataTableSort[] = state.sort.flatMap((spec) => {
    const columnId = fieldOf.get(spec.field)
    return columnId ? [{ columnId, direction: toDirection[spec.direction] }] : []
  })
  const onSortChange = (next: DataTableSort | null, details: ChangeDetails) => {
    if (!next) return controller.setSort([])
    const field = columns.find((column) => column.id === next.columnId)?.sortField
    if (!field) return
    const event = details.event
    if (sortMode === "multi" && event instanceof MouseEvent && event.shiftKey)
      return controller.toggleSort(field, { additive: true })
    controller.setSort([{ field, direction: next.direction === "ascending" ? "asc" : "desc" }])
  }

  const table = (rows: readonly T[], loading: boolean, empty?: ReactNode) => (
    <DataTable
      {...tableProps}
      label={label}
      rows={rows}
      columns={columns}
      getRowId={(row) => source.getId(row)}
      controller={tableController}
      manual
      pageSize={state.size}
      pageCount={accumulating ? 1 : pageCount}
      page={accumulating ? 1 : index}
      onPageChange={(next) => goToPage(next)}
      sort={sorts[0] ?? null}
      secondarySorts={sorts.slice(1)}
      onSortChange={onSortChange}
      loading={loading}
      // Enough placeholder rows to push what's below the table out of view, where the page that replaces them
      // will put it too, so the first page loads without moving the footer.
      loadingRows={tableProps.loadingRows ?? Math.min(state.size, 25)}
      busy={view.fetching && !loading}
      empty={empty}
      renderPagination={() => null}
      tableClassName={tableClassName}
    />
  )

  const ui = toolbar === undefined ? (filterUi ?? (searchKey ? "search" : "none")) : "custom"
  const search = searchKey ? <FilterSearch /> : null
  const filterContent =
    ui === "custom" ? (
      toolbar
    ) : ui === "search" ? (
      search
    ) : ui === "chips" ? (
      <>
        {search}
        <FilterChips labels={labels.chips} locale={locale} />
      </>
    ) : ui === "panel" ? (
      <>
        {search}
        <FilterPanelTrigger
          ref={panelTrigger}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          count={countActiveFilters(schema, state.filter)}
        >
          {labels.panel?.title}
        </FilterPanelTrigger>
      </>
    ) : null

  return (
    <div data-slot="server-data-table" className={cn("flex w-full min-w-0 flex-col gap-items", className)}>
      {filters && filterContent && (
        <FilterScope
          schema={schema}
          controller={controller}
          label={labels.filters(label)}
          searchPlaceholder={labels.searchPlaceholder(label)}
          className="flex flex-wrap items-center gap-items"
        >
          {filterContent}
        </FilterScope>
      )}
      <div className="flex min-w-0 items-start gap-section">
        <div className="flex min-w-0 flex-1 flex-col gap-items">
          <DataState
            status={view.status}
            data={view.status === "success" ? view.items : undefined}
            error={view.error}
            onRetry={view.retry}
            labels={labels}
            loading={table([], true)}
            empty={table([], false, labels.emptyTitle)}
          >
            {(rows) => table(rows, false)}
          </DataState>
          {navigation === "infinite" && <div ref={reachEnd} aria-hidden="true" data-slot="server-data-table-end" />}
          <div
            data-slot="server-data-table-footer"
            className="flex flex-wrap items-center justify-between gap-items narrow:flex-col narrow:items-stretch"
          >
            <output aria-live="polite" className="min-h-5 text-body-sm text-muted-foreground tabular-nums">
              {statusText}
            </output>
            <div className="flex flex-wrap items-center gap-items narrow:justify-between">
              {!accumulating && (
                <ServerTablePageSize
                  locale={locale}
                  size={state.size}
                  sizes={controller.pageSizes}
                  onSizeChange={(size) => controller.setPageSize(size)}
                  label={labels.pageSize}
                />
              )}
              <ServerTableNavigation
                label={label}
                navigation={navigation}
                page={index}
                pageCount={pageCount}
                onPageChange={goToPage}
                hasMore={more.hasMore}
                loadingMore={more.loadingMore}
                onLoadMore={more.loadMore}
                labels={labels}
              />
            </div>
          </div>
        </div>
        {filters && ui === "panel" && (
          <FilterPanel
            locale={locale}
            schema={schema}
            controller={controller}
            open={panelOpen}
            onOpenChange={setPanelOpen}
            returnFocus={() => panelTrigger.current}
            labels={labels.panel}
            className="self-start overflow-hidden rounded-surface border"
          />
        )}
      </div>
    </div>
  )
}

export { ServerDataTable }
export type { ServerDataTableFilterUi, ServerDataTableLabels, ServerDataTableProps, ServerTableUrlState }
