"use client"

import { useState, type FormEvent, type ReactNode, type Ref } from "react"
import { SlidersHorizontalIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FilterField, type FilterFieldLabels } from "@/components/ui/filter-field"
import { useFilterScope } from "@/components/ui/filter-scope"
import { SidePanel } from "@/components/ui/side-panel"
import { narrowQuery, useMediaQuery } from "@/components/ui/use-media-query"
import {
  activeFilterKeys,
  searchFieldOf,
  type FilterField as FilterFieldDefinition,
  type FilterSchema,
  type FilterValues,
} from "@/lib/filter-schema"
import type { PageController } from "@/lib/page-controller"

type FilterPanelLabels = {
  /** The panel's title and name. */
  title: string
  apply: string
  reset: string
  close: string
  field?: Partial<FilterFieldLabels>
}

const filterPanelLabels: FilterPanelLabels = {
  title: "Filters",
  apply: "Apply filters",
  reset: "Reset",
  close: "Close",
}

type FilterPanelProps<S extends FilterSchema> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The fields shown, in order. Default: every field but the search field. */
  fields?: readonly (keyof S & string)[]
  valueLabels?: Readonly<Record<string, string>>
  /** Where focus goes when the side panel closes: the button that opened it. */
  returnFocus?: () => HTMLElement | null | undefined
  labels?: Partial<FilterPanelLabels>
  /** Writes the fields' dates and numbers; the page's `<html lang>` by default (`useLocale`). */
  locale?: string
  schema?: S
  controller?: PageController<FilterValues<S>>
  className?: string
}

type FormProps = {
  locale?: string
  schema: FilterSchema
  keys: readonly string[]
  values: Record<string, unknown>
  labels: FilterPanelLabels
  valueLabels?: Readonly<Record<string, string>>
  onApply: (draft: Record<string, unknown>) => void
}

function FilterPanelForm({ schema, keys, values, labels, valueLabels, locale, onApply }: FormProps) {
  const [draft, setDraft] = useState(() => Object.fromEntries(keys.map((key) => [key, values[key]])))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onApply(draft)
  }
  return (
    <form onSubmit={submit} data-slot="filter-panel-form" className="flex min-h-0 flex-1 flex-col gap-group">
      {keys.map((key) => (
        <FilterField
          locale={locale}
          key={key}
          field={schema[key] as FilterFieldDefinition}
          value={draft[key]}
          labels={labels.field}
          valueLabels={valueLabels}
          onValueChange={(value) => setDraft((previous) => ({ ...previous, [key]: value }))}
        />
      ))}
      <div className="mt-auto flex flex-wrap justify-end gap-items">
        <Button
          variant="ghost"
          onClick={() => {
            const cleared = Object.fromEntries(keys.map((key) => [key, undefined]))
            setDraft(cleared)
            onApply(cleared)
          }}
        >
          {labels.reset}
        </Button>
        <Button type="submit">{labels.apply}</Button>
      </div>
    </form>
  )
}

/**
 * Every filter in one form, applied together: a side panel beside the results on wide screens, a bottom sheet on
 * narrow ones (760px and below). Apply sends the draft; Reset clears the fields it shows.
 */
function FilterPanel<S extends FilterSchema>({
  open,
  onOpenChange,
  fields,
  valueLabels,
  returnFocus,
  labels: labelOverrides,
  locale,
  className,
  ...props
}: FilterPanelProps<S>) {
  const { schema, controller, state } = useFilterScope(props)
  const labels = { ...filterPanelLabels, ...labelOverrides }
  const narrow = useMediaQuery(narrowQuery)
  const searchKey = searchFieldOf(schema)
  const keys = fields ?? Object.keys(schema).filter((key) => key !== searchKey)
  const values = state.filter as Record<string, unknown>
  const apply = (draft: Record<string, unknown>) => {
    const next = { ...values }
    for (const key of keys) {
      if (draft[key] === undefined) delete next[key]
      else next[key] = draft[key]
    }
    controller.setFilter(next as FilterValues<S>)
    if (narrow) onOpenChange(false)
  }
  // A new form whenever the applied filters change elsewhere (chips, the URL), so the draft starts from them.
  const form = (
    <FilterPanelForm
      locale={locale}
      key={JSON.stringify(keys.map((key) => values[key]))}
      schema={schema}
      keys={keys}
      values={values}
      labels={labels}
      valueLabels={valueLabels}
      onApply={apply}
    />
  )
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={labels.title}
      returnFocus={returnFocus}
      scope="filter-panel"
      narrow="sheet"
      labels={{ close: labels.close }}
      className={className}
    >
      {form}
    </SidePanel>
  )
}

type FilterPanelTriggerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** How many filters apply, shown beside the label. */
  count?: number
  ref?: Ref<HTMLButtonElement>
  children?: ReactNode
  className?: string
}

/** The button that shows and hides a `FilterPanel`, with the number of filters that apply. */
function FilterPanelTrigger({ open, onOpenChange, count = 0, ref, children, className }: FilterPanelTriggerProps) {
  return (
    <Button
      ref={ref}
      variant="outline"
      aria-expanded={open}
      render={(part) => <button {...part} data-slot="filter-panel-trigger" />}
      onClick={() => onOpenChange(!open)}
      className={className}
    >
      <SlidersHorizontalIcon />
      {children ?? filterPanelLabels.title}
      {count > 0 && " "}
      {count > 0 && (
        <Badge variant="secondary" className="tabular-nums">
          {count}
        </Badge>
      )}
    </Button>
  )
}

/** How many of the panel's fields apply now, for `FilterPanelTrigger count`. */
function countActiveFilters<S extends FilterSchema>(schema: S, values: FilterValues<S>) {
  const searchKey = searchFieldOf(schema)
  return activeFilterKeys(schema, values).filter((key) => key !== searchKey).length
}

export { countActiveFilters, FilterPanel, filterPanelLabels, FilterPanelTrigger }
export type { FilterPanelLabels, FilterPanelProps, FilterPanelTriggerProps }
