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
  Children,
  createContext,
  isValidElement,
  memo,
  use,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react"

import { list, type ListEntry, type ListOptions } from "@/components/ui/list-primitive"
import { RowNavigationProvider, useRowNavigation } from "@/components/ui/row-navigation"
import { useVirtualRows, type Virtualize } from "@/components/ui/virtual-rows"
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
type ListItemPosition = {
  index: number
  setsize: number
  /** The virtualizer's ref for the row; it returns the cleanup that stops measuring. */
  measure?: (node: HTMLElement | null) => (() => void) | undefined
}

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

type ChildRow = ReactElement<{ id: string; title?: unknown }>

// Flat rows given as children, each with a string `id` (`<ListItem id>`), are the list's data too, so they
// virtualize like `items`. Anything else, like a ListGroup, keeps rendering as it is.
function childRowsOf(children: ReactNode): ChildRow[] | undefined {
  const all = Children.toArray(children)
  if (all.length === 0) return undefined
  const rows: ChildRow[] = []
  for (const child of all) {
    if (!isValidElement<{ id?: unknown }>(child) || typeof child.props.id !== "string") return undefined
    rows.push(child as ChildRow)
  }
  return rows
}

const childId = (row: unknown) => (row as ChildRow).props.id
const childText = (row: unknown) => {
  const { id, title } = (row as ChildRow).props
  return typeof title === "string" ? title : id
}
const renderChild = (row: unknown) => row as ChildRow

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
  items,
  getItemId = defaultId,
  renderItem: renderItemProp,
  itemText: itemTextProp = defaultText,
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
  const handles = useRef(new Map<string, ItemHandle>())
  const [registered, setRegistered] = useState<ListEntry[]>([])
  const [listbox] = useState(() => createListboxController<string>())

  const childRows = useMemo(
    () => (items === undefined && variant === "row" ? childRowsOf(children) : undefined),
    [items, variant, children],
  )
  const data: readonly unknown[] | undefined = items ?? childRows
  const getId = (childRows ? childId : getItemId) as (item: unknown) => string
  const itemText = (childRows ? childText : itemTextProp) as (item: unknown) => string
  const renderItem = (childRows ? renderChild : renderItemProp) as
    | ((item: unknown, index: number) => ReactNode)
    | undefined

  const ids = useMemo(() => data?.map(getId), [data, getId])
  const indexOf = useMemo(() => new Map(ids?.map((id, index) => [id, index])), [ids])
  const dataEntries = useMemo(
    () => data?.map((item, index) => ({ value: ids?.[index] ?? "", label: itemText(item) })),
    [data, ids, itemText],
  )

  const keyAt = useCallback((index: number) => ids?.[index] ?? String(index), [ids])
  const textAt = useCallback(
    (index: number) => (data?.[index] === undefined ? "" : itemText(data[index])),
    [data, itemText],
  )
  const { anchor, ...virtual } = useVirtualRows({
    count: data?.length ?? 0,
    findable: textAt,
    virtualize: renderItem && variant === "row" ? virtualize : false,
    estimateSize,
    getKey: keyAt,
  })

  // Data rows name themselves; registering only keeps their handles, since re-rendering here re-registers them.
  const fromData = data !== undefined
  const refresh = useCallback(() => {
    if (fromData) return
    setRegistered([...handles.current].map(([id, handle]) => ({ value: id, label: handle.label })))
  }, [fromData])

  const handle = usePrimitive(list, {
    entries: dataEntries ?? registered,
    onSelect,
    activate: (id) => {
      if (selectable) return listbox.setValue(id)
      const index = indexOf.get(id)
      if (!handles.current.has(id) && index !== undefined) virtual.renderNow(index)
      return handles.current.get(id)?.activate() ?? false
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
        handles.current.set(id, item)
        refresh()
        return () => {
          if (handles.current.get(id) === item) handles.current.delete(id)
          refresh()
        }
      },
      select: (id, event) => handle.api.select(id, { reason: "item-press", event }),
    }),
    [variant, selectable, checked, refresh, handle],
  )

  let rows: ReactNode = children
  if (data && renderItem) {
    const GapTag = selectable ? "div" : "li"
    rows = virtual.segments.map((segment) => {
      if (segment.type === "gap") {
        return <GapTag key={segment.key} aria-hidden="true" data-slot="list-gap" style={{ height: segment.size }} />
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

  const rootProps = {
    ...props,
    ...rootAttributes(variant, selectable),
    ref: anchor,
    "aria-label": label,
    onFocus: (event: FocusEvent<HTMLElement>) => {
      onFocus?.(event as FocusEvent<HTMLDivElement>)
      if (!virtual.enabled || !(event.target instanceof Element)) return
      const index = Number(event.target.closest<HTMLElement>("[data-index]")?.dataset.index ?? Number.NaN)
      if (!Number.isNaN(index)) virtual.pin(index)
    },
    className: cn("min-w-0", containerClassNames[variant], virtual.enabled && "relative", className),
  }

  // Selectable, the listbox is the List's own element, so one element carries the name. Agents see both: the List
  // takes `select` (through `onSelect`), the listbox `setValue`, so a step that names either action is unambiguous.
  const partProps = selectable
    ? {
        ...rootProps,
        className: cn(rootProps.className, "outline-none"),
        children: <ListContext value={context}>{rows}</ListContext>,
        render: ({ ref, ...part }: Record<string, unknown>) => (
          <Listbox<string>
            {...part}
            ref={ref as Ref<HTMLDivElement>}
            render={(listboxProps) => <div {...listboxProps} data-slot="list" />}
            controller={listbox}
            value={value}
            defaultValue={defaultValue}
            onValueChange={onValueChange}
            onHighlight={(_value, details) => {
              if (virtual.enabled && details.index >= 0) virtual.scrollToIndex(details.index)
            }}
            onKeyDownCapture={(event) => listboxKeyDown(event, (id) => listbox.setValue(id))}
          />
        ),
      }
    : {
        ...rootProps,
        // Preflight's list-style: none strips list semantics in Safari unless the role is explicit.
        role: "list",
        children: (
          <ListContext value={context}>
            <RowNavigationProvider handle={navigation}>{rows}</RowNavigationProvider>
          </ListContext>
        ),
      }

  return usePart(handle, "root", {}, partProps as PartProps<"ul">, selectable ? "div" : "ul")
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
      <ListboxGroup
        render={<div data-slot="list-group" />}
        className={cn("flex flex-col gap-inline not-first:pt-group", className)}
      >
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
