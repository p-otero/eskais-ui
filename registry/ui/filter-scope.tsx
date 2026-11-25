"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { createContext, use, useMemo, useSyncExternalStore, type ReactNode } from "react"

import { serverFilters } from "@/components/ui/server-filters-primitive"
import { findFilterKey, parseFilterInput } from "@/lib/filter-input"
import { searchFieldOf, type FilterSchema, type FilterValues } from "@/lib/filter-schema"
import { assumeType } from "@/lib/narrow"
import type { PageController } from "@/lib/page-controller"

type AnyController = PageController<FilterValues<FilterSchema>>

type FilterScopeValue = { schema: FilterSchema; controller: AnyController; searchPlaceholder?: string }

const FilterScopeContext = createContext<FilterScopeValue | null>(null)

type FilterScopeProps<S extends FilterSchema> = {
  schema: S
  controller: PageController<FilterValues<S>>
  /** Names the filters for agents, who set them with `filter(field, value)`, `search` and `clearFilters`. */
  label: string
  /** The placeholder of a `FilterSearch` inside that doesn't set its own: "Search tasks…". */
  searchPlaceholder?: string
  className?: string
  children?: ReactNode
}

/** Agents filter by a field's label: `filter("Status", ["Open", "Blocked"])`. */
function FilterScope<S extends FilterSchema>({
  schema,
  controller,
  label,
  searchPlaceholder,
  className,
  children,
}: FilterScopeProps<S>) {
  const scope = useMemo(
    () => ({
      schema,
      // Workaround: React context isn't generic and the filter type is invariant; `useFilterScope` gives it back as the reader's `S`.
      controller: assumeType<AnyController>(controller),
      searchPlaceholder,
    }),
    [schema, controller, searchPlaceholder],
  )
  const handle = usePrimitive(serverFilters, {
    fields: Object.entries(schema).map(([key, field]) => ({ value: key, label: field.label })),
    apply: (name, input) => {
      const key = findFilterKey(schema, name)
      const field = schema[key] as S[keyof S]
      const value = parseFilterInput(field, input)
      if (key === searchFieldOf(schema))
        controller.setSearch(typeof value === "string" ? value : "", { immediate: true })
      // Workaround: TypeScript can't relate `parseFilterInput`'s value to the field through the key.
      else controller.setFilterValue(key, assumeType<FilterValues<S>[typeof key]>(value))
    },
    clear: () => controller.resetFilters(),
  })
  return usePart(
    handle,
    "root",
    {},
    {
      "aria-label": label,
      className,
      children: <FilterScopeContext value={scope}>{children}</FilterScopeContext>,
    },
    "div",
  )
}

/** A passed `schema` or `controller` wins over the nearest `FilterScope`'s; throws when neither has one. */
function useFilterScope<S extends FilterSchema>(props: { schema?: S; controller?: PageController<FilterValues<S>> }) {
  const scope = use(FilterScopeContext)
  // Workaround: React context isn't generic; the scope stored these for any schema and the reader takes them as its `S`.
  const schema = props.schema ?? assumeType<S | undefined>(scope?.schema)
  const controller = props.controller ?? assumeType<PageController<FilterValues<S>> | undefined>(scope?.controller)
  if (!schema || !controller)
    throw new Error("A filter UI needs `schema` and `controller`, or a FilterScope around it.")
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  return { schema, controller, state, searchPlaceholder: scope?.searchPlaceholder }
}

export { FilterScope, useFilterScope }
export type { FilterScopeProps }
