"use client"

import { useAsyncOptions, type AsyncOptionsStatus } from "@ui-sdk/react/async-options"
import type { SearchFilter } from "@ui-sdk/react/command"
import { useRef, type ReactNode } from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandStatus,
} from "@/components/ui/command"
import { CommandDialog, CommandDialogContent } from "@/components/ui/command-dialog"
import { useDocumentWorkspace } from "@/components/ui/document-workspace-context"
import type { PageSource } from "@/lib/page-source"

type DocumentQuickOpenItem = {
  value: string
  label: string
  /** A folder or path, shown after the label. */
  description?: string
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

function QuickOpenList({ items, labels, onOpen, status, ...search }: QuickOpenListProps) {
  const workspace = useDocumentWorkspace()
  const groups = new Map<string, DocumentQuickOpenItem[]>()
  for (const item of items) groups.set(item.group ?? "", [...(groups.get(item.group ?? "") ?? []), item])
  const empty = (query: string) => (typeof labels.empty === "function" ? labels.empty(query) : labels.empty)
  const row = (item: DocumentQuickOpenItem) => (
    <CommandItem key={item.value} value={item.value} label={item.label} keywords={item.keywords && [...item.keywords]}>
      <span className="truncate">{item.label}</span>
      {item.description && (
        <span className="ms-auto shrink-0 truncate text-caption text-muted-foreground">{item.description}</span>
      )}
    </CommandItem>
  )
  return (
    <Command
      status={status}
      {...search}
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
      <CommandList>
        {[...groups].map(([group, entries]) =>
          group ? (
            <CommandGroup key={group}>
              <CommandGroupLabel>{group}</CommandGroupLabel>
              {entries.map(row)}
            </CommandGroup>
          ) : (
            entries.map(row)
          ),
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
