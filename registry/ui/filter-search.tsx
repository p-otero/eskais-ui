"use client"

import type { KeyboardEvent } from "react"
import { SearchIcon } from "lucide-react"

import { useFilterScope } from "@/components/ui/filter-scope"
import { Input, InputGroup } from "@/components/ui/input"
import { searchFieldOf, type FilterSchema, type FilterValues } from "@/lib/filter-schema"
import type { PageController } from "@/lib/page-controller"
import { cn } from "@/lib/utils"

type FilterSearchProps<S extends FilterSchema> = {
  /** Defaults to the schema's first text field's label. */
  label?: string
  placeholder?: string
  schema?: S
  controller?: PageController<FilterValues<S>>
  className?: string
}

/**
 * The schema's search field: shows the text at once and commits it after the controller's debounce (250 ms).
 * Enter commits at once, Escape clears. An agent's value commits without waiting.
 */
function FilterSearch<S extends FilterSchema>({ label, placeholder, className, ...props }: FilterSearchProps<S>) {
  const { schema, controller, state, searchPlaceholder } = useFilterScope(props)
  const key = searchFieldOf(schema)
  const name = label ?? (key === undefined ? undefined : schema[key]?.label) ?? ""
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault()
      controller.flushSearch()
    } else if (event.key === "Escape" && state.searchText !== "") {
      event.preventDefault()
      event.stopPropagation()
      controller.setSearch("", { immediate: true })
    }
  }
  return (
    <InputGroup
      render={<search />}
      aria-label={name}
      data-slot="filter-search"
      className={cn("w-full sm:max-w-72 sm:flex-1", className)}
    >
      <SearchIcon />
      <Input
        type="search"
        aria-label={name}
        placeholder={placeholder ?? searchPlaceholder}
        value={state.searchText}
        onValueChange={(value, details) =>
          controller.setSearch(value, { immediate: (details as { source?: string } | undefined)?.source === "agent" })
        }
        onKeyDown={onKeyDown}
        className="[&::-webkit-search-cancel-button]:hidden"
      />
    </InputGroup>
  )
}

export { FilterSearch }
export type { FilterSearchProps }
