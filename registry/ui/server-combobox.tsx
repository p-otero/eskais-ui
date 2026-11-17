"use client"

import { useAsyncOptions } from "@ui-sdk/react/async-options"
import {
  ComboboxChip as ComboboxChipPrimitive,
  ComboboxChipRemove as ComboboxChipRemovePrimitive,
  ComboboxChips as ComboboxChipsPrimitive,
  ComboboxStatus,
  ComboboxValue,
} from "@ui-sdk/react/combobox"
import { useRef } from "react"
import { XIcon } from "lucide-react"

import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import type { PageSource } from "@/lib/page-source"
import { cn } from "@/lib/utils"

type ServerComboboxLabels = {
  trigger: string
  clear: string
  remove: (label: string) => string
  /** The status region while the first results or more load. */
  loading: string
  error: string
  /** Shown in the list when nothing matches. */
  empty: (query: string) => string
  /** The status region once results are in. */
  count: (count: number, hasMore: boolean) => string
}

const serverComboboxLabels: ServerComboboxLabels = {
  trigger: "Show options",
  clear: "Clear",
  remove: (label) => `Remove ${label}`,
  loading: "Loading…",
  error: "Couldn't load options",
  empty: (query) => (query === "" ? "No options" : `Nothing matches “${query}”`),
  count: (count, hasMore) => `${String(count)}${hasMore ? "+" : ""} ${count === 1 ? "option" : "options"}`,
}

type Option = { value: string; label: string }

/** What a change chose, by label: an id's label is only known once its option has loaded. */
type ServerComboboxChange = { labels: Readonly<Record<string, string>> }

type ServerComboboxBaseProps<T> = {
  source: PageSource<T, { q?: string }>
  getLabel: (item: T) => string
  /** The value an item stores. Default: the source's `getId`. */
  getValue?: (item: T) => string
  /** Labels of values chosen before their options load, like ids read from the URL. */
  valueLabels?: Readonly<Record<string, string>>
  "aria-label"?: string
  placeholder?: string
  pageSize?: number
  /** How long typing must pause before a search, in ms. Default 250. */
  debounce?: number
  disabled?: boolean
  labels?: Partial<ServerComboboxLabels>
  className?: string
}

type ServerComboboxSingleProps<T> = ServerComboboxBaseProps<T> & {
  multiple?: false
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null, change: ServerComboboxChange) => void
}

type ServerComboboxMultipleProps<T> = ServerComboboxBaseProps<T> & {
  multiple: true
  value?: readonly string[]
  defaultValue?: readonly string[]
  onValueChange?: (value: string[], change: ServerComboboxChange) => void
}

type ServerComboboxProps<T> = ServerComboboxSingleProps<T> | ServerComboboxMultipleProps<T>

const chipClassName =
  "inline-flex max-w-full shrink-0 items-center gap-inline rounded-control border border-transparent bg-secondary px-inset-chip py-inset-chip text-xs font-medium text-secondary-foreground data-highlighted:ring-2 data-highlighted:ring-ring"
const chipRemoveClassName =
  "touch-target inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-full opacity-70 hover:opacity-100 [&>svg]:size-3"

/**
 * A Combobox whose options come from a `PageSource`, searched on the server as you type: requests wait for typing
 * to pause and are aborted when replaced, the next page loads when the list scrolls to its end, and the server's
 * order is kept (`filter={false}`). With `multiple`, choices show as chips.
 */
function ServerCombobox<T>({ className, ...props }: ServerComboboxProps<T>) {
  const {
    source,
    getLabel,
    getValue = (item: T) => source.getId(item),
    valueLabels,
    placeholder,
    pageSize = 20,
    debounce = 250,
    disabled,
  } = props
  const labels = { ...serverComboboxLabels, ...props.labels }
  const cursors = useRef(new Map<number, string | null>())
  const known = useRef(new Map<string, string>())

  const options = useAsyncOptions<Option>(
    async (query, { signal, page }) => {
      if (page === 0) cursors.current = new Map([[0, null]])
      const position =
        source.capabilities.position === "cursor"
          ? { cursor: cursors.current.get(page) ?? null, direction: "forward" as const }
          : { page: page + 1 }
      const result = await source.fetchPage(
        { filter: query.trim() === "" ? {} : { q: query.trim() }, sort: [], size: pageSize, position },
        { signal },
      )
      if (result.nextCursor) cursors.current.set(page + 1, result.nextCursor)
      const items = result.items.map((item) => ({ value: getValue(item), label: getLabel(item) }))
      for (const item of items) known.current.set(item.value, item.label)
      return { items, hasMore: result.hasMore ?? (result.nextCursor ?? null) !== null }
    },
    { debounce, immediate: true },
  )

  const labelOf = (value: string) => known.current.get(value) ?? valueLabels?.[value] ?? value
  const changeOf = (values: readonly string[]): ServerComboboxChange => ({
    labels: Object.fromEntries(values.map((value) => [value, labelOf(value)])),
  })

  const root = {
    items: options.items,
    filter: false as const,
    status: options.status,
    disabled,
    itemToLabel: labelOf,
    onQueryChange: (query: string) => options.setQuery(query),
    onLoadMore: options.loadMore,
  }

  const list = (
    <ComboboxContent>
      <ComboboxStatus className="sr-only">
        {(state) =>
          state.status === "error"
            ? labels.error
            : state.loading
              ? labels.loading
              : labels.count(state.count, options.hasMore)
        }
      </ComboboxStatus>
      <ComboboxEmpty>{(state) => (state.empty && !state.loading ? labels.empty(state.query) : null)}</ComboboxEmpty>
      <ComboboxList>
        {(state) =>
          (state.items as Option[]).map((option) => (
            <ComboboxItem key={option.value} value={option.value} label={option.label}>
              {option.label}
              <ComboboxItemIndicator />
            </ComboboxItem>
          ))
        }
      </ComboboxList>
    </ComboboxContent>
  )

  if (props.multiple) {
    return (
      <Combobox<string, true>
        {...root}
        multiple
        value={props.value === undefined ? undefined : [...props.value]}
        defaultValue={props.defaultValue === undefined ? undefined : [...props.defaultValue]}
        onValueChange={(value) => props.onValueChange?.(value, changeOf(value))}
      >
        <ComboboxControl className={cn("h-auto min-h-field-control flex-wrap py-inline", className)}>
          <ComboboxChipsPrimitive className="flex min-w-0 flex-1 flex-wrap items-center gap-inline">
            <ComboboxValue>
              {(state) =>
                (state.value as string[]).map((value, index) => (
                  <ComboboxChipPrimitive key={value} value={value} className={chipClassName}>
                    <span className="truncate">{state.labels[index]}</span>
                    <ComboboxChipRemovePrimitive
                      aria-label={labels.remove(state.labels[index] ?? value)}
                      className={chipRemoveClassName}
                    >
                      <XIcon strokeWidth={2.5} />
                    </ComboboxChipRemovePrimitive>
                  </ComboboxChipPrimitive>
                ))
              }
            </ComboboxValue>
            <ComboboxInput aria-label={props["aria-label"]} placeholder={placeholder} className="min-w-16 flex-1" />
          </ComboboxChipsPrimitive>
          <ComboboxTrigger aria-label={labels.trigger} />
        </ComboboxControl>
        {list}
      </Combobox>
    )
  }
  return (
    <Combobox<string>
      {...root}
      value={props.value}
      defaultValue={props.defaultValue}
      onValueChange={(value) => props.onValueChange?.(value, changeOf(value === null ? [] : [value]))}
    >
      <ComboboxControl className={className}>
        <ComboboxInput aria-label={props["aria-label"]} placeholder={placeholder} />
        <ComboboxClear aria-label={labels.clear} />
        <ComboboxTrigger aria-label={labels.trigger} />
      </ComboboxControl>
      {list}
    </Combobox>
  )
}

export { ServerCombobox, serverComboboxLabels }
export type {
  ServerComboboxChange,
  ServerComboboxLabels,
  ServerComboboxMultipleProps,
  ServerComboboxProps,
  ServerComboboxSingleProps,
}
