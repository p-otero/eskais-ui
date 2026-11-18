"use client"

import { useAsyncOptions, type AsyncOptionsStatus } from "@ui-sdk/react/async-options"
import type { SearchFilter } from "@ui-sdk/react/command"
import { matchRanges, matchSegments, type MatchRange } from "@ui-sdk/react/text-match"
import { useMemo, useRef, useState, type ReactNode } from "react"

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItemText,
  CommandList,
  CommandRows,
  CommandStatus,
  type CommandData,
  type CommandDataItem,
} from "@/components/ui/command"
import { CommandDialog, CommandDialogContent } from "@/components/ui/command-dialog"
import { useDocumentWorkspace } from "@/components/ui/document-workspace-context"
import type { PageSource } from "@/lib/page-source"

type DocumentQuickOpenItem = {
  value: string
  label: string
  /** A folder or path, shown after the label. */
  description?: string
  /**
   * A passage of the note, like the one a search matched: a muted second line under the label, cut at two lines,
   * with the query's words marked. Plain text; agents and screen readers read it with the label.
   */
  snippet?: string
  keywords?: readonly string[]
  /** Items with the same group are listed under it. */
  group?: string
}

type DocumentQuickOpenLabels = {
  title: string
  placeholder?: string
  /** Shown when nothing matches: text, or a function of the query. */
  empty: ReactNode | ((query: string) => ReactNode)
  /** Shown while the first results load, and read out while any load. */
  loading: string
  /** Shown, and read out, when a search fails. */
  error: string
  /** Read out once results are in. */
  count: (count: number) => string
}

const documentQuickOpenLabels: Omit<DocumentQuickOpenLabels, "title"> = {
  empty: "No matches",
  loading: "Searching…",
  error: "Couldn't search",
  count: (count) => `${String(count)} ${count === 1 ? "result" : "results"}`,
}

type DocumentQuickOpenBaseProps = {
  onOpen: (value: string) => void
  labels?: Partial<DocumentQuickOpenLabels>
}

type DocumentQuickOpenItemsProps = DocumentQuickOpenBaseProps & {
  items: readonly DocumentQuickOpenItem[]
  /**
   * How typing narrows `items`: `"fuzzy"` (default), `"contains"`, `"startsWith"` or a function. `false` keeps every
   * item in its order, for results your own search already matched, like a note found by its body.
   */
  filter?: SearchFilter<string>
  /** Hears the query as it changes, to run your own search and pass its results as `items`. */
  onQueryChange?: (query: string) => void
  /** Your search's state: `"loading"` dims the list and is read out, `"error"` says the search failed. */
  status?: AsyncOptionsStatus
  source?: never
}

type DocumentQuickOpenSourceProps<T> = DocumentQuickOpenBaseProps & {
  /**
   * Searches on the server as you type, with the query as `filter.q` (no `q` while it's empty): requests wait for
   * typing to pause and a newer one aborts the last, the next page loads at the end of the list, and the server's
   * order and matches are kept, whatever the titles say.
   */
  source: PageSource<T, { q?: string }>
  /** What a result shows and the value `onOpen` gets. */
  getItem: (item: T) => DocumentQuickOpenItem
  pageSize?: number
  /** How long typing must pause before a search, in ms. Default 200. */
  debounce?: number
  items?: never
}

type DocumentQuickOpenProps<T = unknown> = DocumentQuickOpenItemsProps | DocumentQuickOpenSourceProps<T>

type QuickOpenListProps = {
  items: readonly DocumentQuickOpenItem[]
  labels: DocumentQuickOpenLabels
  onOpen: (value: string) => void
  filter?: SearchFilter<string>
  onQueryChange?: (query: string) => void
  status?: AsyncOptionsStatus
  onLoadMore?: () => void
}

type QuickOpenCommand = CommandDataItem & { description?: string; snippet?: string }

/** Every place each word of the query appears in `text`, matched as the command filter matches (case, accents). */
function queryRanges(text: string, query: string) {
  const ranges: MatchRange[] = []
  for (const word of new Set(query.trim().split(/\s+/u).filter(Boolean))) {
    let from = 0
    while (from < text.length) {
      const [range] = matchRanges(text.slice(from), word, "contains")
      if (!range || range.end <= range.start) break
      ranges.push({ start: from + range.start, end: from + range.end })
      from += range.end
    }
  }
  ranges.sort((a, b) => a.start - b.start)
  const merged: MatchRange[] = []
  for (const range of ranges) {
    const last = merged.at(-1)
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  return merged
}

function QuickOpenSnippet({ text, query }: { text: string; query: string }) {
  const segments = useMemo(() => matchSegments(text, queryRanges(text, query)), [text, query])
  return (
    <span data-slot="quick-open-snippet" className="line-clamp-2 text-caption text-muted-foreground">
      <span className="sr-only">, </span>
      {segments.map((segment, at) =>
        segment.match ? (
          // oxlint-disable-next-line react/no-array-index-key -- the snippet's pieces have no identity beyond their place
          <mark key={at} className="bg-transparent font-semibold text-current">
            {segment.text}
          </mark>
        ) : (
          segment.text
        ),
      )}
    </span>
  )
}

// A row with a snippet is the label's line and up to two of `text-caption`, measured once it renders.
const snippetRows =
  "[&_[data-slot=command-item]:has(>[data-slot=quick-open-snippet])]:h-auto [&_[data-slot=command-item]:has(>[data-slot=quick-open-snippet])]:flex-col [&_[data-slot=command-item]:has(>[data-slot=quick-open-snippet])]:items-stretch [&_[data-slot=command-item]:has(>[data-slot=quick-open-snippet])]:gap-0 [&_[data-slot=command-item]:has(>[data-slot=quick-open-snippet])]:py-inset-item"
const snippetRowSize = (item: QuickOpenCommand) => (item.snippet ? 52 : undefined)

// Items with a group are listed under it, groups in the order their first item comes.
function quickOpenData(items: readonly DocumentQuickOpenItem[]): CommandData {
  const groups = new Map<string, QuickOpenCommand[]>()
  for (const { group = "", keywords, ...item } of items) {
    const command: QuickOpenCommand = { ...item, ...(keywords && { keywords: [...keywords] }) }
    groups.set(group, [...(groups.get(group) ?? []), command])
  }
  return [...groups].flatMap(([group, entries]): CommandData =>
    group ? [{ type: "group", label: group, items: entries }] : entries,
  )
}

// The items go to Command as data and render through CommandRows: past 50, only the rows in view mount, so a vault
// of notes opens on the next frame, while typing, the arrows and agents still reach every one.
function QuickOpenList({ items, labels, onOpen, status, onQueryChange, filter, onLoadMore }: QuickOpenListProps) {
  const workspace = useDocumentWorkspace()
  const data = useMemo(() => quickOpenData(items), [items])
  // CommandList's state has no query; the snippets mark what was typed.
  const [query, setQuery] = useState("")
  const empty = (text: string) => (typeof labels.empty === "function" ? labels.empty(text) : labels.empty)
  return (
    <Command
      items={data}
      status={status}
      filter={filter}
      onLoadMore={onLoadMore}
      onQueryChange={(next) => {
        setQuery(next)
        onQueryChange?.(next)
      }}
      onAction={(value) => {
        workspace.quickOpen.close()
        onOpen(value)
      }}
    >
      <CommandInput aria-label={labels.title} placeholder={labels.placeholder} />
      {/* Only a search that reports its state gets a status region; a local filter keeps the list's announcement. */}
      {status !== undefined && (
        <CommandStatus className="sr-only">
          {(state) =>
            state.status === "error" ? labels.error : state.loading ? labels.loading : labels.count(state.count)
          }
        </CommandStatus>
      )}
      <CommandEmpty>
        {(state) =>
          status === "error" ? labels.error : state.loading ? labels.loading : state.empty ? empty(state.query) : null
        }
      </CommandEmpty>
      <CommandList className={snippetRows}>
        {(state) => (
          <CommandRows<QuickOpenCommand> items={state.items} estimateItemSize={snippetRowSize}>
            {(item) => {
              const title = (
                <>
                  <CommandItemText className="truncate" />
                  {item.description && (
                    <span className="ms-auto shrink-0 truncate text-caption text-muted-foreground">
                      <span className="sr-only">, </span>
                      {item.description}
                    </span>
                  )}
                </>
              )
              if (!item.snippet) return title
              return (
                <>
                  <span className="flex min-w-0 items-center gap-inline">{title}</span>
                  <QuickOpenSnippet text={item.snippet} query={query} />
                </>
              )
            }}
          </CommandRows>
        )}
      </CommandList>
    </Command>
  )
}

type SourceListProps<T> = Omit<DocumentQuickOpenSourceProps<T>, "labels"> & { labels: DocumentQuickOpenLabels }

/** Mounted while the dialog is open, so a closed quick open never searches. */
function SourceList<T>({ source, getItem, pageSize = 20, debounce = 200, labels, onOpen }: SourceListProps<T>) {
  const cursors = useRef(new Map<number, string | null>())
  const results = useAsyncOptions<DocumentQuickOpenItem>(
    async (query, { signal, page }) => {
      if (page === 0) cursors.current = new Map([[0, null]])
      const position =
        source.capabilities.position === "cursor"
          ? { cursor: cursors.current.get(page) ?? null, direction: "forward" as const }
          : { page: page + 1 }
      const q = query.trim()
      const result = await source.fetchPage(
        { filter: q === "" ? {} : { q }, sort: [], size: pageSize, position },
        { signal },
      )
      if (result.nextCursor) cursors.current.set(page + 1, result.nextCursor)
      return { items: result.items.map(getItem), hasMore: result.hasMore ?? (result.nextCursor ?? null) !== null }
    },
    { debounce, immediate: true },
  )
  return (
    <QuickOpenList
      items={results.items}
      labels={labels}
      onOpen={onOpen}
      filter={false}
      status={results.status}
      onQueryChange={(query) => results.setQuery(query)}
      onLoadMore={results.loadMore}
    />
  )
}

/**
 * Ctrl/Cmd+P in a `DocumentWorkspace`: calls `onOpen` with the chosen value, then focus goes back to the document.
 * `items` are searched in the browser, or listed as they are with `filter={false}`, `onQueryChange` and `status`;
 * a `source` with `getItem` searches the server, debounced, stale responses dropped, more loading at the end.
 */
function DocumentQuickOpen<T>(props: DocumentQuickOpenProps<T>) {
  const workspace = useDocumentWorkspace()
  const labels = { title: workspace.labels.quickOpen, ...documentQuickOpenLabels, ...props.labels }
  return (
    <CommandDialog
      controller={workspace.quickOpen}
      onOpenChangeComplete={(open) => open || workspace.refocusDocument()}
    >
      <CommandDialogContent title={labels.title} finalFocus={workspace.documentFocusTarget}>
        {props.source ? (
          <SourceList {...props} labels={labels} />
        ) : (
          <QuickOpenList
            items={props.items}
            labels={labels}
            onOpen={props.onOpen}
            filter={props.filter}
            onQueryChange={props.onQueryChange}
            status={props.status}
          />
        )}
      </CommandDialogContent>
    </CommandDialog>
  )
}

export { DocumentQuickOpen, documentQuickOpenLabels }
export type {
  DocumentQuickOpenItem,
  DocumentQuickOpenItemsProps,
  DocumentQuickOpenLabels,
  DocumentQuickOpenProps,
  DocumentQuickOpenSourceProps,
}
