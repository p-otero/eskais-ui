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
import { createContext, use, useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react"

import { list, type ListEntry, type ListOptions } from "@/components/ui/list-primitive"
import { cn } from "@/lib/utils"

type ListVariant = "row" | "card"
type ItemHandle = { label: string; activate: () => boolean }

type ListContextValue = {
  variant: ListVariant
  selectable: boolean
  register: (id: string, handle: ItemHandle) => () => void
  select: (id: string, event: Event) => boolean
}

const ListContext = createContext<ListContextValue | null>(null)

function useListContext() {
  return use(ListContext)
}

const containerClassNames = {
  row: "flex flex-col",
  card: "grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-items",
} satisfies Record<ListVariant, string>

type ListProps = Omit<PartProps<"div">, "children" | "onSelect" | "defaultValue"> & {
  /** Names the list, for screen readers and agents. */
  "aria-label": string
  variant?: ListVariant
  /** With any of `value`, `defaultValue` or `onValueChange`, the rows are options of a UI SDK Listbox. */
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (id: string | null, details: ChangeDetails<ListboxValueChangeReason>) => void
  onSelect?: ListOptions["onSelect"]
  children: ReactNode
}

function rootAttributes(variant: ListVariant, selectable: boolean) {
  return { "data-slot": "list", "data-variant": variant, "data-selectable": selectable ? "" : undefined }
}

function List({
  "aria-label": label,
  variant = "row",
  value,
  defaultValue,
  onValueChange,
  onSelect,
  className,
  children,
  ...props
}: ListProps) {
  const selectable = value !== undefined || defaultValue !== undefined || onValueChange !== undefined
  const items = useRef(new Map<string, ItemHandle>())
  const [entries, setEntries] = useState<ListEntry[]>([])
  const [listbox] = useState(() => createListboxController<string>())

  const refresh = useCallback(() => {
    setEntries([...items.current].map(([id, handle]) => ({ value: id, label: handle.label })))
  }, [])

  const handle = usePrimitive(list, {
    entries,
    onSelect,
    activate: (id) => (selectable ? listbox.setValue(id) : (items.current.get(id)?.activate() ?? false)),
  })

  const context = useMemo<ListContextValue>(
    () => ({
      variant,
      selectable,
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
    [variant, selectable, refresh, handle],
  )

  const body = selectable ? (
    // The root's `select` covers the listbox for agents; two entries with one name would make a ref ambiguous.
    <Listbox<string>
      data-agent-hidden=""
      controller={listbox}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      aria-label={label}
      className={cn(containerClassNames[variant], "outline-none")}
    >
      {children}
    </Listbox>
  ) : (
    <ul className={containerClassNames[variant]}>{children}</ul>
  )

  return usePart(
    handle,
    "root",
    {},
    {
      ...props,
      ...rootAttributes(variant, selectable),
      "aria-label": label,
      className: cn("flex min-w-0 flex-col", className),
      children: <ListContext value={context}>{body}</ListContext>,
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

export { List, ListGroup, useListContext }
export type { ItemHandle, ListGroupProps, ListProps, ListVariant }
