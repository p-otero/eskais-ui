"use client"

import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { createContext, use, useMemo, useSyncExternalStore, type ReactNode } from "react"

import { serverFilters } from "@/components/ui/server-filters-primitive"
import { findFilterKey, parseFilterInput } from "@/lib/filter-input"
import { searchFieldOf, type FilterSchema, type FilterValues } from "@/lib/filter-schema"
import type { PageController } from "@/lib/page-controller"

type AnyController = PageController<FilterValues<FilterSchema>>

type FilterScopeValue = { schema: FilterSchema; controller: AnyController }

const FilterScopeContext = createContext<FilterScopeValue | null>(null)

type FilterScopeProps<S extends FilterSchema> = {
  schema: S
  controller: PageController<FilterValues<S>>
  /** Names the filters for agents, who set them with `filter(field, value)`, `search` and `clearFilters`. */
  label: string
  className?: string
  children?: ReactNode
}

/**
 * Gives filter UIs inside it (`FilterSearch`, `FilterChips`, `FilterPanel`) their schema and controller, and lets
 * agents filter by a field's label: `filter("Status", ["Open", "Blocked"])`.
 */
function FilterScope<S extends FilterSchema>({ schema, controller, label, className, children }: FilterScopeProps<S>) {
  const scope = useMemo(() => ({ schema, controller: controller as unknown as AnyController }), [schema, controller])
  const handle = usePrimitive(serverFilters, {
    fields: Object.entries(schema).map(([key, field]) => ({ value: key, label: field.label })),
    apply: (name, input) => {
      const key = findFilterKey(schema, name)
      const field = schema[key] as S[keyof S]
      const value = parseFilterInput(field, input)
      if (key === searchFieldOf(schema))
        controller.setSearch(typeof value === "string" ? value : "", { immediate: true })
      else controller.setFilterValue(key, value as FilterValues<S>[typeof key])
    },
    clear: () => controller.resetFilters(),
  })
  return usePart(
    handle,
    "root",
    {},
    {
      "aria-label": label,
      ...({ "data-slot": "filter-scope" } as object),
      className,
      children: <FilterScopeContext value={scope}>{children}</FilterScopeContext>,
    },
    "div",
  )
}

/** The schema and controller of the nearest `FilterScope`, or the ones passed; and the controller's state. */
function useFilterScope<S extends FilterSchema>(props: { schema?: S; controller?: PageController<FilterValues<S>> }) {
  const scope = use(FilterScopeContext)
  const schema = (props.schema ?? scope?.schema) as S | undefined
  const controller = (props.controller ?? scope?.controller) as PageController<FilterValues<S>> | undefined
  if (!schema || !controller)
    throw new Error("A filter UI needs `schema` and `controller`, or a FilterScope around it.")
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
  return { schema, controller, state }
}

export { FilterScope, useFilterScope }
export type { FilterScopeProps }
