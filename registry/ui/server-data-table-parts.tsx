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
  pagination?: string
  previousPage?: string
  nextPage?: string
  page?: (page: number) => string
  loadMore?: string
  /** Names the filters for agents. */
  filters?: (label: string) => string
  chips?: Partial<FilterChipsLabels>
  panel?: Partial<FilterPanelLabels>
}

const serverDataTableLabels = {
  range: pageStatusLabels.range,
  noResults: pageStatusLabels.empty,
  loading: pageStatusLabels.loading,
  refreshing: "Refreshing",
  pageSize: "Rows per page",
  pagination: defaultPaginationLabels.navigation,
  previousPage: defaultPaginationLabels.previous,
  nextPage: defaultPaginationLabels.next,
  page: defaultPaginationLabels.page,
  loadMore: "Load more",
  filters: (label: string) => `${label} filters`,
} satisfies Omit<
  Required<ServerDataTableLabels>,
  "errorTitle" | "retry" | "emptyTitle" | "emptyDescription" | "chips" | "panel"
>

type ResolvedLabels = typeof serverDataTableLabels & ServerDataTableLabels

type ServerTableNavigationProps = {
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
  navigation,
  page,
  pageCount,
  onPageChange,
  hasMore,
  loadingMore,
  onLoadMore,
  labels,
}: ServerTableNavigationProps) {
  const paginationLabels = {
    navigation: labels.pagination,
    previous: labels.previousPage,
    next: labels.nextPage,
    page: labels.page,
  }
  if (navigation === "pages") {
    if (pageCount <= 1) return null
    return (
      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={(next) => onPageChange(next)}
        labels={paginationLabels}
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
        aria-label={labels.pagination}
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
      data-slot="server-data-table-load-more"
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
      <span aria-hidden="true" className="text-muted-foreground">
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
