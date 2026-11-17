"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import {
  createListboxController,
  Listbox,
  ListboxGroup,
  ListboxGroupLabel,
  type ListboxValueChangeReason,
} from "@ui-sdk/react/listbox"
import { usePart, usePrimitive, type PartProps } from "@ui-sdk/react/primitive"
import {
  createContext,
  memo,
  use,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"

import { list, type ListEntry, type ListOptions } from "@/components/ui/list-primitive"
import { RowNavigationProvider, useRowNavigation } from "@/components/ui/row-navigation"
import { GapFindStubs, useVirtualRows, type Virtualize } from "@/components/ui/virtual-rows"
import { cn } from "@/lib/utils"

type ListVariant = "row" | "card"
type ItemHandle = { label: string; activate: () => boolean }

type ListContextValue = {
  variant: ListVariant
  selectable: boolean
  register: (id: string, handle: ItemHandle) => () => void
  select: (id: string, event: Event) => boolean
  /** Rows that Space or `x` check, for bulk actions; undefined when the list has none. */
  checked?: { has: (id: string) => boolean; toggle: (id: string) => void }
}

/** Where a data row sits among all rows, while the list is virtualized. */
type ListItemPosition = { index: number; setsize: number; measure?: (node: HTMLElement | null) => void }

const ListContext = createContext<ListContextValue | null>(null)
const PositionContext = createContext<ListItemPosition | null>(null)

function useListContext() {
  return use(ListContext)
}

function useListItemPosition() {
  return use(PositionContext)
}

const containerClassNames = {
  row: "flex flex-col",
  card: "grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-items",
} satisfies Record<ListVariant, string>

type ListProps<Item = unknown> = Omit<PartProps<"div">, "children" | "onSelect" | "defaultValue"> & {
  /** Names the list, for screen readers and agents. */
  "aria-label": string
  variant?: ListVariant
  /** With any of `value`, `defaultValue` or `onValueChange`, the rows are options of a UI SDK Listbox. */
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (id: string | null, details: ChangeDetails<ListboxValueChangeReason>) => void
  onSelect?: ListOptions["onSelect"]
  /** Rows as data, rendered by `renderItem`: every row is reachable by keyboard and agents, rendered or not. */
  items?: readonly Item[]
  getItemId?: (item: Item) => string
  renderItem?: (item: Item, index: number) => ReactNode
  /** A row's text, for agents and for find in page while it isn't rendered. */
  itemText?: (item: Item) => string
  /** `"auto"` (default) renders only the rows in view past 200 data rows. Rows only; cards never virtualize. */
  virtualize?: Virtualize
  /** A row's estimated height in px before it is measured. */
  estimateSize?: number
  /** Rows checked for a bulk action: Space or `x` on a row toggles it, and each row shows a checkbox. */
  checkedIds?: readonly string[]
  onCheckedIdsChange?: (ids: string[]) => void
  children?: ReactNode
}

function rootAttributes(variant: ListVariant, selectable: boolean) {
  return { "data-slot": "list", "data-variant": variant, "data-selectable": selectable ? "" : undefined }
}

function defaultText(item: unknown) {
  if (typeof item === "string") return item
  if (typeof item === "object" && item !== null) {
    const record = item as Record<string, unknown>
    for (const key of ["title", "label", "name", "id"]) if (typeof record[key] === "string") return record[key]
  }
  return ""
}

function defaultId(item: unknown) {
  if (typeof item === "object" && item !== null && "id" in item) return String((item as { id: unknown }).id)
  return String(item)
}

const listboxKeys: Record<string, string> = { j: "ArrowDown", k: "ArrowUp" }

// The listbox moves with arrows; j and k are the same moves, and the page keys jump by a screen of options.
function listboxKeyDown(event: KeyboardEvent<HTMLElement>, setValue: (id: string) => void) {
  if (event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof HTMLElement)) return
  const option = event.target.closest<HTMLElement>('[role="option"]')
  if (!option) return
  const arrow = listboxKeys[event.key]
  if (arrow) {
    event.preventDefault()
    event.stopPropagation()
    option.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: arrow, bubbles: true, cancelable: true }))
    return
  }
  if (event.key !== "PageDown" && event.key !== "PageUp") return
  const options = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]')]
  const viewport = event.currentTarget.closest<HTMLElement>("[data-slot=list]")?.parentElement?.clientHeight ?? 0
  const page = Math.max(1, Math.floor(viewport / Math.max(1, option.offsetHeight)) - 1)
  const from = options.indexOf(option)
  const target = options[Math.min(options.length - 1, Math.max(0, from + (event.key === "PageDown" ? page : -page)))]
  const id = target?.dataset.itemId
  if (!target || id === undefined) return
  event.preventDefault()
  target.scrollIntoView({ block: "nearest" })
  target.focus()
  setValue(id)
}

type ListRowProps<Item> = {
  item: Item
  index: number
  setsize?: number
  measure?: ListItemPosition["measure"]
  renderItem: (item: Item, index: number) => ReactNode
}

// Memoized: scrolling re-renders the list for its new range, and rows already in view stay as they are.
const ListRow = memo(function ListRow<Item>({ item, index, setsize, measure, renderItem }: ListRowProps<Item>) {
  const position = useMemo(
    () => (setsize === undefined ? null : { index, setsize, measure }),
    [index, setsize, measure],
  )
  return <PositionContext value={position}>{renderItem(item, index)}</PositionContext>
}) as <Item>(props: ListRowProps<Item>) => ReactNode

function List<Item = unknown>({
  "aria-label": label,
  variant = "row",
  value,
  defaultValue,
  onValueChange,
  onSelect,
  items: data,
  getItemId = defaultId,
  renderItem,
  itemText = defaultText,
  virtualize = "auto",
  estimateSize,
  checkedIds,
  onCheckedIdsChange,
  className,
  children,
  onFocus,
  ...props
}: ListProps<Item>) {
  const selectable = value !== undefined || defaultValue !== undefined || onValueChange !== undefined
  const items = useRef(new Map<string, ItemHandle>())
  const [registered, setRegistered] = useState<ListEntry[]>([])
  const [listbox] = useState(() => createListboxController<string>())

  const ids = useMemo(() => data?.map(getItemId), [data, getItemId])
  const indexOf = useMemo(() => new Map(ids?.map((id, index) => [id, index])), [ids])
  const dataEntries = useMemo(
    () => data?.map((item, index) => ({ value: ids?.[index] ?? "", label: itemText(item) })),
    [data, ids, itemText],
  )

  const { anchor, ...virtual } = useVirtualRows({
    count: data?.length ?? 0,
    virtualize: renderItem && variant === "row" ? virtualize : false,
    estimateSize,
    getKey: (index) => ids?.[index] ?? String(index),
  })

  // Data rows name themselves; registering only keeps their handles, since re-rendering here re-registers them.
  const fromData = data !== undefined
  const refresh = useCallback(() => {
    if (fromData) return
    setRegistered([...items.current].map(([id, handle]) => ({ value: id, label: handle.label })))
  }, [fromData])

  const handle = usePrimitive(list, {
    entries: dataEntries ?? registered,
    onSelect,
    activate: (id) => {
      if (selectable) return listbox.setValue(id)
      const index = indexOf.get(id)
      if (!items.current.has(id) && index !== undefined) virtual.renderNow(index)
      return items.current.get(id)?.activate() ?? false
    },
  })

  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds])
  const checked = useMemo(
    () =>
      onCheckedIdsChange && checkedIds
        ? {
            has: (id: string) => checkedSet.has(id),
            toggle: (id: string) =>
              onCheckedIdsChange(
                checkedSet.has(id) ? checkedIds.filter((checkedId) => checkedId !== id) : [...checkedIds, id],
              ),
          }
        : undefined,
    [checkedIds, checkedSet, onCheckedIdsChange],
  )

  const navigation = useRowNavigation({
    ids,
    onToggle: checked ? (id) => checked.toggle(id) : undefined,
    reveal: (id) => {
      const index = indexOf.get(id)
      if (index !== undefined) virtual.scrollToIndex(index)
    },
  })

  const context = useMemo<ListContextValue>(
    () => ({
      variant,
      selectable,
      checked,
      register: (id, item) => {
        items.current.set(id, item)
        refresh()
        return () => {
          if (items.current.get(id) === item) items.current.delete(id)
          refresh()
        }
      },
      select: (id, event) => handle.api.select(id, { reason: "item-press", event }),
    }),
    [variant, selectable, checked, refresh, handle],
  )

  const textAt = useCallback(
    (index: number) => (data?.[index] === undefined ? "" : itemText(data[index])),
    [data, itemText],
  )

  let rows: ReactNode = children
  if (data && renderItem) {
    const GapTag = selectable ? "div" : "li"
    rows = virtual.segments.map((segment) => {
      if (segment.type === "gap") {
        return (
          <GapTag key={segment.key} aria-hidden="true" data-slot="list-gap" style={{ height: segment.size }}>
            <GapFindStubs
              from={segment.from}
              to={segment.to}
              text={textAt}
              offsetOf={virtual.offsetOf}
              onFound={virtual.scrollToIndex}
            />
          </GapTag>
        )
      }
      const item = data[segment.index]
      if (item === undefined) return null
      return (
        <ListRow
          key={segment.key}
          item={item}
          index={segment.index}
          setsize={virtual.enabled ? data.length : undefined}
          measure={virtual.measureElement}
          renderItem={renderItem}
        />
      )
    })
  }

  const container = selectable ? (
    // The root's `select` covers the listbox for agents; two entries with one name would make a ref ambiguous.
    <Listbox<string>
      ref={anchor}
      data-agent-hidden=""
      controller={listbox}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      onHighlight={(_value, details) => {
        if (virtual.enabled && details.index >= 0) virtual.scrollToIndex(details.index)
      }}
      onKeyDownCapture={(event) => listboxKeyDown(event, (id) => listbox.setValue(id))}
      aria-label={label}
      className={cn(containerClassNames[variant], "outline-none", virtual.enabled && "relative")}
    >
      {rows}
    </Listbox>
  ) : (
    <ul ref={anchor} className={cn(containerClassNames[variant], virtual.enabled && "relative")}>
      {rows}
    </ul>
  )

  return usePart(
    handle,
    "root",
    {},
    {
      ...props,
      ...rootAttributes(variant, selectable),
      "aria-label": label,
      onFocus: (event: FocusEvent<HTMLDivElement>) => {
        onFocus?.(event)
        if (!virtual.enabled || !(event.target instanceof Element)) return
        const index = Number(event.target.closest<HTMLElement>("[data-index]")?.dataset.index ?? Number.NaN)
        if (!Number.isNaN(index)) virtual.pin(index)
      },
      className: cn("flex min-w-0 flex-col", className),
      children: (
        <ListContext value={context}>
          {selectable ? container : <RowNavigationProvider handle={navigation}>{container}</RowNavigationProvider>}
        </ListContext>
      ),
    },
    "div",
  )
}

type ListGroupProps = {
  label: ReactNode
  /** Shown beside the label, like "Proposed 3". */
  count?: number
  className?: string
  children: ReactNode
}

const groupLabelClassName =
  "flex items-center gap-inline px-inset-item text-meta tracking-meta text-muted-foreground uppercase"

function ListGroup({ label, count, className, children }: ListGroupProps) {
  const context = useListContext()
  const labelId = useId()
  const variant = context?.variant ?? "row"
  const heading = (
    <>
      {label}
      {count !== undefined && (
        <>
          {" "}
          <span className="tabular-nums">{count}</span>
        </>
      )}
    </>
  )
  if (context?.selectable) {
    return (
      <ListboxGroup data-slot="list-group" className={cn("flex flex-col gap-inline not-first:pt-group", className)}>
        <ListboxGroupLabel className={groupLabelClassName}>{heading}</ListboxGroupLabel>
        <div className={containerClassNames[variant]}>{children}</div>
      </ListboxGroup>
    )
  }
  return (
    <li data-slot="list-group" className={cn("flex flex-col gap-inline not-first:pt-group", className)}>
      <div id={labelId} className={groupLabelClassName}>
        {heading}
      </div>
      <ul aria-labelledby={labelId} className={containerClassNames[variant]}>
        {children}
      </ul>
    </li>
  )
}

export { List, ListGroup, useListContext, useListItemPosition }
export type { ItemHandle, ListGroupProps, ListItemPosition, ListProps, ListVariant }
