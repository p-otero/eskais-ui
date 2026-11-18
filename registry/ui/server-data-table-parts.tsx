"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import type { FilterChipsLabels } from "@/components/ui/filter-chips"
import type { FilterPanelLabels } from "@/components/ui/filter-panel"
import {
  Pagination,
  PaginationItem,
  PaginationList,
  PaginationNext,
  PaginationPrevious,
  defaultPaginationLabels,
} from "@/components/ui/pagination"
import { Select } from "@/components/ui/select"
import { useMediaQuery } from "@/components/ui/use-media-query"
import { pageStatusLabels, type Navigation, type PageStatusLabels } from "@/lib/page-source"

type ServerDataTableLabels = {
  errorTitle: ReactNode
  retry: ReactNode
  emptyTitle: ReactNode
  emptyDescription?: ReactNode
  /** The live region after each load: "Showing 21–40 of 312". */
  range?: PageStatusLabels["range"]
  noResults?: string
  /** Said once a load has taken 400 ms. */
  loading?: string
  /** Screen-reader text for a refetch behind the rows. */
  refreshing?: string
  pageSize?: string
  /** Names the page navigation after the table, so two tables on a page have distinct landmarks. */
  pagination?: (label: string) => string
  previousPage?: string
  nextPage?: string
  page?: (page: number) => string
  loadMore?: string
  /** Names the filters for agents. */
  filters?: (label: string) => string
  /** The search field's placeholder: "Search Tasks…". Its accessible name stays the field's label. */
  searchPlaceholder?: (label: string) => string
  chips?: Partial<FilterChipsLabels>
  panel?: Partial<FilterPanelLabels>
}

const serverDataTableLabels = {
  range: pageStatusLabels.range,
  noResults: pageStatusLabels.empty,
  loading: pageStatusLabels.loading,
  refreshing: "Refreshing",
  pageSize: "Rows per page",
  pagination: (label: string) => `${label} pages`,
  previousPage: defaultPaginationLabels.previous,
  nextPage: defaultPaginationLabels.next,
  page: defaultPaginationLabels.page,
  loadMore: "Load more",
  filters: (label: string) => `${label} filters`,
  searchPlaceholder: (label: string) => `Search ${label}…`,
} satisfies Omit<
  Required<ServerDataTableLabels>,
  "errorTitle" | "retry" | "emptyTitle" | "emptyDescription" | "chips" | "panel"
>

type ResolvedLabels = typeof serverDataTableLabels & ServerDataTableLabels

type ServerTableNavigationProps = {
  /** The table's label, for the navigation's name. */
  label: string
  navigation: Navigation
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => unknown
  labels: ResolvedLabels
}

function ServerTableNavigation({
  label,
  navigation,
  page,
  pageCount,
  onPageChange,
  hasMore,
  loadingMore,
  onLoadMore,
  labels,
}: ServerTableNavigationProps) {
  // On a phone, the current page alone between the ends keeps the numbers and both steps on one line.
  const narrow = useMediaQuery("(width <= 47.5rem)")
  const paginationLabels = {
    navigation: labels.pagination(label),
    previous: labels.previousPage,
    next: labels.nextPage,
    page: labels.page,
  }
  // Agents page through the table's own `setPage`; a second component with the table's name would be ambiguous.
  if (navigation === "pages") {
    if (pageCount <= 1) return null
    return (
      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={(next) => onPageChange(next)}
        labels={paginationLabels}
        siblings={narrow ? 0 : 1}
        data-agent-hidden=""
        className="w-auto"
      />
    )
  }
  if (navigation === "prev-next") {
    if (pageCount <= 1) return null
    // Previous and Next only: there is no total to number the pages by. Steps at an end stay focusable.
    return (
      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={(next) => onPageChange(next)}
        aria-label={labels.pagination(label)}
        data-agent-hidden=""
        className="w-auto"
      >
        <PaginationList>
          <PaginationItem>
            <PaginationPrevious aria-label={labels.previousPage} />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext aria-label={labels.nextPage} />
          </PaginationItem>
        </PaginationList>
      </Pagination>
    )
  }
  return (
    <Button
      variant="outline"
      render={(part) => <button {...part} data-slot="server-data-table-load-more" />}
      loading={loadingMore}
      disabled={!hasMore}
      focusableWhenDisabled
      onClick={() => onLoadMore()}
    >
      {labels.loadMore}
    </Button>
  )
}

type ServerTablePageSizeProps = {
  size: number
  sizes: readonly number[]
  onSizeChange: (size: number) => void
  label: string
}

function ServerTablePageSize({ size, sizes, onSizeChange, label }: ServerTablePageSizeProps) {
  if (sizes.length < 2) return null
  const options = sizes.map((value) => ({ value: String(value), label: String(value) }))
  return (
    <span data-slot="server-data-table-page-size" className="flex items-center gap-inline text-body-sm">
      <span aria-hidden="true" className="whitespace-nowrap text-muted-foreground">
        {label}
      </span>
      <Select
        aria-label={label}
        size="sm"
        options={options}
        value={String(size)}
        onValueChange={(value) => {
          if (value !== null) onSizeChange(Number(value))
        }}
      />
    </span>
  )
}

export { ServerTableNavigation, ServerTablePageSize, serverDataTableLabels }
export type { ResolvedLabels, ServerDataTableLabels, ServerTableNavigationProps, ServerTablePageSizeProps }
