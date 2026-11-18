"use client"

import type { ReactNode } from "react"

import { CommitHistory, type CommitHistoryProps } from "@/components/ui/commit-history"
import { DataState } from "@/components/ui/data-state"
import { useServerInfinite } from "@/components/ui/use-server-data"
import type { Commit } from "@/lib/commit-graph"
import type { PageSource, SortSpec } from "@/lib/page-source"

type ServerCommitHistoryLabels = NonNullable<CommitHistoryProps["labels"]> & {
  errorTitle: ReactNode
  retry: ReactNode
  emptyTitle: ReactNode
  emptyDescription?: ReactNode
  refreshing?: string
}

type ServerCommitHistoryProps<F> = Omit<
  CommitHistoryProps,
  "commits" | "hasMore" | "loadingMore" | "onLoadMore" | "labels" | "count"
> & {
  /** Pages of commits, newest first; each page continues the last, as `git log --skip` or a cursor does. */
  source: PageSource<Commit, F>
  /** What the source filters on, like the branch: a new filter starts again from the newest commit. */
  filter: F
  sort?: readonly SortSpec[]
  /** Commits per request. Default 100. */
  pageSize?: number
  labels: ServerCommitHistoryLabels
}

const NO_SORT: readonly SortSpec[] = []

/**
 * A CommitHistory over a `PageSource`: older pages load as the end scrolls into view and from a Load more button,
 * the header counts the source's total when it gives one, and the graph carries on across pages without being
 * laid out again.
 */
function ServerCommitHistory<F>({
  source,
  filter,
  sort = NO_SORT,
  pageSize = 100,
  labels,
  ...props
}: ServerCommitHistoryProps<F>) {
  const pages = useServerInfinite(source, { filter, sort, size: pageSize })
  const total = pages.total.kind === "none" ? undefined : pages.total.value
  return (
    <DataState
      status={pages.status}
      data={pages.status === "success" ? pages.items : undefined}
      error={pages.error}
      onRetry={pages.retry}
      fetching={pages.fetching && !pages.loadingMore}
      labels={labels}
    >
      {(commits) => (
        <CommitHistory
          {...props}
          commits={commits}
          count={total}
          hasMore={pages.hasMore}
          loadingMore={pages.loadingMore}
          onLoadMore={pages.loadMore}
          labels={labels}
        />
      )}
    </DataState>
  )
}

export { ServerCommitHistory }
export type { ServerCommitHistoryLabels, ServerCommitHistoryProps }
