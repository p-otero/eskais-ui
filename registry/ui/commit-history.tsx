"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import { usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import { createTreeController, Tree } from "@ui-sdk/react/tree"
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"

import { Button } from "@/components/ui/button"
import { CommitBranchSelect } from "@/components/ui/commit-branch-select"
import { doneCount, Rows, summaryOf, treeItemsOf } from "@/components/ui/commit-history-rows"
import {
  commitHistory,
  type CommitHistoryChangeReason,
  type CommitHistoryController,
  type CommitHistoryOptions,
} from "@/components/ui/commit-history-primitive"
import {
  commitHistoryLabels,
  commitName,
  type CommitHistoryLabels,
  type CommitRowContext,
} from "@/components/ui/commit-history-row"
import { Select } from "@/components/ui/select"
import { useNow } from "@/components/ui/use-now"
import {
  useBranchModel,
  useCommitGraph,
  useCommitTrail,
  useFocusHead,
  useJustExpanded,
  useReachEnd,
} from "@/components/ui/use-commit-history"
import { useInstanceState } from "@/components/ui/use-instance-state"
import { useTrailRows } from "@/components/ui/use-trail-rows"
import type { BranchInfo, CommitBranch } from "@/lib/commit-branches"
import { rowOfCommit, type Commit } from "@/lib/commit-graph"
import { createCommitFinder, subjectPieces } from "@/lib/commit-message"
import { useLocale } from "@/lib/locale"
import type { Instant } from "@/lib/time"
import { cn } from "@/lib/utils"

type CommitHistoryProps = Omit<PartProps<"div">, "children" | "onSelect"> & {
  /** Names the history, for screen readers and agents. */
  "aria-label": string
  /** Newest first, children before parents: the order of `git log --topo-order`. */
  commits: readonly Commit[]
  /** The base branch; with `branches` and `onBranchChange`, a switcher chooses it. */
  branch?: string
  /**
   * Branch names for the switcher, or branches with their head (`{ name, head, tone?, ahead?, behind?,
   * updatedAt?, author? }`), which the branches view draws.
   */
  branches?: readonly (string | CommitBranch)[]
  onBranchChange?: CommitHistoryOptions["onBranchChange"]
  /** The count in the header; the finished commits loaded by default. Pass the server's total when paging. */
  count?: number
  /** Merges whose merged commits show, by id. Collapsed by default: one line per commit. */
  expanded?: readonly string[]
  defaultExpanded?: readonly string[]
  onExpandedChange?: CommitHistoryOptions["onExpandedChange"]
  /**
   * The selected commit's id, for a list beside a detail pane; `null` for none. Passing `selected`,
   * `defaultSelected` or `onSelect` turns selection on: a press, Enter or Space selects a row (`aria-selected`),
   * and a press or Enter on the row already selected opens its details, or its merged commits on a merge.
   */
  selected?: string | null
  defaultSelected?: string | null
  onSelect?: CommitHistoryOptions["onSelectedChange"]
  /** Commits whose details show under their row. */
  details?: readonly string[]
  defaultDetails?: readonly string[]
  onDetailsChange?: CommitHistoryOptions["onDetailsChange"]
  /** `"single"` (default) keeps one commit's details open at a time. */
  detailsMode?: "single" | "multiple"
  /** Dims the rows other than the focused, hovered or open one. On while details are open by default. */
  focusMode?: boolean
  /** Click or Enter on a commit runs this instead of showing its details, for apps that navigate to a commit. */
  onOpenCommit?: (commit: Commit, details: ChangeDetails<CommitHistoryChangeReason>) => void
  onCopyHash?: CommitHistoryOptions["onCopyHash"]
  /** Older commits exist: a Load more button, and `onLoadMore` once the end scrolls into view. */
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => unknown
  /** One clock for every time in the list; a 30-second `useNow` by default. */
  now?: Instant
  locale?: string
  timeZone?: string
  labels?: Partial<CommitHistoryLabels>
  /** A row's estimated height in px before it is measured. Default 30. */
  estimateSize?: number
  /**
   * Find in page reaches commits scrolled out of view, by subject, through UI SDK's virtualizer and its findable
   * layers, built once the page is idle after its first paint. Off by default: on 50,000 commits it costs about a
   * frame on some held-arrow presses (p95 22-27 ms against 10 ms) and 10-40% on the first paint.
   */
  findable?: boolean
  /** Lanes the graph opens at most; an octopus merge's extra parents past it draw no lane. Default 12. */
  maxLanes?: number
  controller?: CommitHistoryController
  /** Content at the end of the header, before the count. */
  actions?: ReactNode
  /**
   * `"branches"` draws every active branch in `branches` as its own lane beside the base, coloured and labelled
   * at its head, with a select (or a press on a pill) to show one alone; merged branches stay folded under their merge. Commits are then
   * `git log --all --topo-order`. Default `"trail"`.
   */
  view?: "trail" | "branches"
  /** The branch in focus in the branches view: its head scrolled to and focused. */
  focusedBranch?: string | null
  onFocusedBranchChange?: CommitHistoryOptions["onFocusedBranchChange"]
  /** In the branches view, a branch in focus hides the other branches' commits. */
  filterBranch?: boolean
  /** A branch with no update for this long, in ms, shows as stale. Default 30 days. */
  staleAfter?: number
}

const noBranches: readonly CommitBranch[] = []

// oxlint-disable-next-line shadcn/no-arbitrary-values -- the scroller's cap with `findable` (UI SDK's virtualizer needs it bounded), and a lane's width
const trailWidths = "[--commit-history-height:40rem] [--commit-lane:0.875rem]"
// oxlint-disable-next-line shadcn/no-arbitrary-values -- a row's line at the reference frame's density, a touch target's height on a coarse pointer
const trailLine = "[--commit-line:1.875rem] pointer-coarse:[--commit-line:var(--control-height-touch)]"

/**
 * A commit trail, one line per commit: a graph lane per line of history, merges collapsed to one row whose
 * merged commits open on a side lane, and a commit's details inline under its row. Rows virtualize, the lanes
 * are laid out lazily from the top, and appending older pages costs only the new rows.
 */
function CommitHistory({
  "aria-label": label,
  commits,
  branch,
  branches,
  onBranchChange,
  count,
  expanded,
  defaultExpanded,
  onExpandedChange,
  selected,
  defaultSelected,
  onSelect,
  details,
  defaultDetails,
  onDetailsChange,
  detailsMode,
  focusMode,
  onOpenCommit,
  onCopyHash,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  now: nowProp,
  locale: localeProp,
  timeZone,
  labels: labelOverrides,
  estimateSize = 30,
  findable = false,
  maxLanes,
  controller,
  actions,
  view = "trail",
  focusedBranch,
  onFocusedBranchChange,
  filterBranch = false,
  staleAfter,
  className,
  onFocus,
  onPointerDownCapture,
  onKeyDownCapture,
  ...props
}: CommitHistoryProps) {
  const labels = useMemo(() => ({ ...commitHistoryLabels, ...labelOverrides }), [labelOverrides])
  const locale = useLocale(localeProp)
  const now = useNow({ now: nowProp, intervalMs: 30_000 })

  const graph = useCommitGraph(commits)
  const branchList = useMemo(
    () => (branches ?? []).filter((entry): entry is CommitBranch => typeof entry !== "string"),
    [branches],
  )
  const branchNames = useMemo(
    () => branches?.map((entry) => (typeof entry === "string" ? entry : entry.name)),
    [branches],
  )
  const model = useBranchModel(graph, view === "branches" ? branchList : noBranches, { base: branch, staleAfter, now })
  const find = useMemo(() => createCommitFinder(graph), [graph])
  const nameContext = useMemo(() => ({ now, locale, labels }), [now, locale, labels])
  const lookup = useMemo(
    () => ({
      find,
      entries: () =>
        graph.commits.map((commit) => ({
          value: commit.id,
          label: commitName(commit, nameContext, model?.byHead.get(commit.id)),
        })),
      branches: () => (model?.all ?? []).map(summaryOf),
    }),
    [find, graph, nameContext, model],
  )

  const handle = usePrimitive(commitHistory, {
    lookup,
    expanded,
    defaultExpanded,
    onExpandedChange,
    selected,
    defaultSelected,
    onSelectedChange: onSelect,
    details,
    defaultDetails,
    onDetailsChange,
    detailsMode,
    branch,
    branches: branchNames,
    onBranchChange,
    focusedBranch,
    onFocusedBranchChange,
    onCopyHash,
    controller,
    onOpenCommit: onOpenCommit
      ? (id, change) => {
          const row = rowOfCommit(graph, id)
          if (row !== undefined) onOpenCommit(graph.commits[row] as Commit, change)
        }
      : undefined,
  })
  const state = useInstanceState<typeof handle.state>(handle.instance)
  const activeIndex =
    model && state.focusedBranch ? model.active.findIndex((info) => info.name === state.focusedBranch) : -1
  const trail = useCommitTrail(graph, state.expanded, {
    maxLanes: maxLanes ?? (model ? 8 : undefined),
    model,
    only: filterBranch && activeIndex >= 0 ? activeIndex : undefined,
  })
  const { visible } = trail
  const justExpanded = useJustExpanded(state.expanded)
  const openDetails = useMemo(() => new Set(state.details), [state.details])
  const items = useMemo(() => treeItemsOf(graph), [graph])

  const commitAt = useCallback(
    (index: number) => graph.commits[visible.rows[index] as number] as Commit,
    [graph, visible],
  )
  const keyAt = useCallback((index: number) => commitAt(index).id, [commitAt])
  const textAt = useCallback((index: number) => subjectPieces(commitAt(index)), [commitAt])
  const { setScroller, anchor, ...virtual } = useTrailRows({
    count: visible.count,
    estimate: estimateSize,
    getKey: keyAt,
    text: textAt,
    findable,
  })

  // Stable, so the memoized branch select doesn't render its branches again on every move.
  const focusBranch = useCallback(
    (name: string | null) => handle.api.focusBranch(name, { reason: "item-press" }),
    [handle],
  )
  const context = useMemo<CommitRowContext>(
    () => ({
      now,
      locale,
      timeZone,
      labels,
      copied: state.copied,
      copyHash: (id, event) => void handle.api.copyHash(id, event),
      focusedBranch: state.focusedBranch,
    }),
    [now, locale, timeZone, labels, state.copied, handle, state.focusedBranch],
  )

  const [tree] = useState(() => createTreeController())
  const focusedInfo = model?.all.find((info) => info.name === state.focusedBranch)
  const headRow = focusedInfo ? rowOfCommit(graph, focusedInfo.head) : undefined
  useFocusHead(
    focusedInfo && headRow !== undefined
      ? { id: focusedInfo.head, position: visible.position[headRow] ?? -1 }
      : undefined,
    virtual.reveal,
    tree.focus,
  )
  const shownHeads = useMemo(() => {
    if (!model) return undefined
    const map = new Map<string, BranchInfo[]>()
    for (const info of model.all) {
      if (info.state === "merged") continue
      const list = map.get(info.head)
      if (list) list.push(info)
      else map.set(info.head, [info])
    }
    return map
  }, [model])

  const selectable = selected !== undefined || defaultSelected !== undefined || onSelect !== undefined
  // The selection as the press found it: a press on the row already selected opens it rather than selecting it.
  const selectedAtPress = useRef<string | null>(null)
  const notePress = () => {
    selectedAtPress.current = state.selected
  }

  const reachEnd = useReachEnd(onLoadMore, hasMore && !loadingMore)
  const total = count ?? doneCount(commits)
  const dimmed = focusMode ?? state.details.length > 0
  const switcher = branchNames && branchNames.length > 1 && onBranchChange

  return usePart(
    handle,
    "root",
    {},
    {
      ...props,
      "aria-label": label,
      ...({ "data-focus-mode": dimmed ? "" : undefined } as Record<`data-${string}`, string | undefined>),
      className: cn(
        "group/history flex min-h-0 min-w-0 flex-col gap-items rounded-surface border bg-card px-inset-item py-inset-item text-card-foreground shadow-surface",
        trailWidths,
        trailLine,
        className,
      ),
      onPointerDownCapture: (event: PointerEvent<HTMLDivElement>) => {
        onPointerDownCapture?.(event)
        notePress()
      },
      onKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDownCapture?.(event)
        notePress()
      },
      onFocus: (event: FocusEvent<HTMLDivElement>) => {
        onFocus?.(event)
        if (!virtual.virtual || !(event.target instanceof Element)) return
        const index = Number(event.target.closest<HTMLElement>("[data-index]")?.dataset.index ?? Number.NaN)
        if (!Number.isNaN(index)) virtual.pin(index)
      },
      children: (
        <>
          <div
            data-slot="commit-history-header"
            className="flex min-w-0 items-center justify-between gap-items px-(--item-padding-x)"
          >
            {model && model.active.length > 0 ? (
              <CommitBranchSelect
                branches={model.active}
                focused={state.focusedBranch}
                onFocus={focusBranch}
                labels={labels}
                now={now}
                locale={locale}
              />
            ) : switcher ? (
              <Select
                aria-label={labels.branch}
                size="sm"
                options={branchNames.map((name) => ({ value: name, label: name }))}
                value={state.branch}
                onValueChange={(value) => {
                  if (typeof value === "string") handle.api.selectBranch(value, { reason: "item-press" })
                }}
                triggerProps={{
                  className:
                    "-ms-(--item-padding-x) w-auto border-transparent bg-transparent px-(--item-padding-x) font-medium shadow-none hover:bg-accent",
                }}
              />
            ) : (
              <span className="truncate text-body-sm font-medium">{state.branch ?? branch}</span>
            )}
            <span className="flex shrink-0 items-center gap-items">
              {actions}
              <span data-slot="commit-history-count" className="text-caption text-muted-foreground tabular-nums">
                {labels.commits(total, locale)}
              </span>
            </span>
          </div>
          <div
            ref={setScroller}
            className={cn("min-h-0 flex-1 overflow-y-auto", findable && "max-h-(--commit-history-height)")}
          >
            <div ref={anchor} className="min-w-0">
              <Tree
                aria-label={label}
                // The history's own actions serve agents by commit; the tree would list every row a second time.
                data-agent-hidden=""
                items={items}
                mode={selectable ? "single" : "none"}
                value={selectable ? state.selected : undefined}
                onValueChange={(next, change) => {
                  if (typeof next === "string" || next === null)
                    handle.api.select(next, { reason: change.reason as CommitHistoryChangeReason, event: change.event })
                }}
                expandOnPress={false}
                controller={tree}
                expanded={state.expanded as string[]}
                onExpandedChange={(next, change) =>
                  handle.api.setExpanded(next, {
                    reason: change.reason as CommitHistoryChangeReason,
                    event: change.event,
                  })
                }
                onAction={(id, { event }) => {
                  // A press inside a commit's details, like its copy button, is not a press on the row.
                  if (event?.target instanceof Element && event.target.closest("[data-slot=commit-details]")) return
                  // A press on a branch's pill shows only that branch, or every branch again when it's the one shown.
                  const pill =
                    event?.target instanceof Element ? event.target.closest<HTMLElement>("[data-branch]") : null
                  if (pill?.dataset.branch) {
                    const name = pill.dataset.branch
                    handle.api.focusBranch(state.focusedBranch === name ? null : name, { reason: "item-press", event })
                    return
                  }
                  const entry = find(id)
                  if (!entry) return
                  const options = { reason: "item-press" as const, event }
                  if (selectable && selectedAtPress.current !== id) return
                  if (entry.merge) handle.api.toggle(id, options)
                  else if (onOpenCommit) handle.api.openCommit(id, options)
                  else handle.api.toggleDetails(id, options)
                }}
                onHighlight={(_id, { index }) => {
                  if (virtual.virtual && index >= 0) virtual.scrollToIndex(index)
                }}
                style={virtual.absolute ? { height: virtual.height } : undefined}
                className={cn("flex min-w-0 flex-col outline-none", virtual.virtual && "relative")}
              >
                <Rows
                  trail={trail}
                  details={openDetails}
                  justExpanded={justExpanded}
                  context={context}
                  virtual={virtual}
                  heads={shownHeads}
                />
              </Tree>
            </div>
            {hasMore && <div ref={reachEnd} aria-hidden="true" data-slot="commit-history-end" />}
          </div>
          {hasMore && onLoadMore && (
            <Button
              variant="ghost"
              size="sm"
              loading={loadingMore}
              className="self-center"
              onClick={() => onLoadMore()}
            >
              {labels.loadMore}
            </Button>
          )}
        </>
      ),
    },
  )
}

export { CommitHistory, commitHistoryLabels }
export type { CommitHistoryLabels, CommitHistoryProps }
