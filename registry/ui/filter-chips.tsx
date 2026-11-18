"use client"

import { MenuTrigger } from "@ui-sdk/react/menu"
import { PopoverTrigger } from "@ui-sdk/react/popover"
import { useRef, useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { FilterBar, FilterBarButton } from "@/components/ui/filter-bar"
import { appliesAtOnce, FilterField, type FilterFieldLabels } from "@/components/ui/filter-field"
import { useFilterScope } from "@/components/ui/filter-scope"
import { Popover, PopoverContent } from "@/components/ui/popover"
import {
  activeFilterKeys,
  isActiveValue,
  searchFieldOf,
  type DateInput,
  type DateRange,
  type FilterField as FilterFieldDefinition,
  type FilterSchema,
  type FilterValues,
  type NumberFilter,
} from "@/lib/filter-schema"
import { useLocale } from "@/lib/locale"
import type { PageController } from "@/lib/page-controller"
import { formatCount } from "@/lib/page-source"

type FilterChipsLabels = {
  /** Names the toolbar. */
  toolbar: string
  addFilter: string
  reset: string
  remove: (field: string) => string
  /** A chip's text, which is also its name: "Status: Open, Blocked". */
  chip: (field: string, summary: string) => string
  /** A multiple choice with more than two picks: "3 selected", the count in `locale`. */
  selected: (count: number, locale?: string) => string
  yes: string
  no: string
  field?: Partial<FilterFieldLabels>
}

const filterChipsLabels: FilterChipsLabels = {
  toolbar: "Filters",
  addFilter: "Add filter",
  reset: "Reset filters",
  remove: (field) => `Remove ${field} filter`,
  chip: (field, summary) => (summary === "" ? field : `${field}: ${summary}`),
  selected: (count, locale) => `${formatCount(count, locale)} selected`,
  yes: "Yes",
  no: "No",
}

const symbols = { eq: "=", neq: "≠", lt: "<", lte: "≤", gt: ">", gte: "≥" }

const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/

// A date-only value is a calendar day, so it is shown in UTC: the day it names, whatever the viewer's time zone.
function dateText(value: DateInput | undefined, locale: string | undefined) {
  if (value === undefined) return ""
  if (typeof value === "string") {
    const day = dateOnly.exec(value)
    if (day) {
      const time = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(time)
    }
    const time = Date.parse(value)
    if (Number.isNaN(time)) return value
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(time)
  }
  if (value instanceof Date) return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value)
  const temporal = value as { toLocaleString?: (locale?: string, options?: Intl.DateTimeFormatOptions) => string }
  return typeof temporal.toLocaleString === "function"
    ? temporal.toLocaleString(locale, { dateStyle: "medium" })
    : value.toString()
}

/**
 * A short text for a field's value, for a chip: "Open, Blocked", "≥ 10", "Jan 1, 2026 – Jan 31, 2026". Numbers and
 * dates are written in `locale`.
 */
function summarizeFilter(
  field: FilterFieldDefinition,
  value: unknown,
  labels: Pick<FilterChipsLabels, "selected" | "yes" | "no">,
  valueLabels?: Readonly<Record<string, string>>,
  locale?: string,
): string {
  if (!isActiveValue(value)) return ""
  switch (field.kind) {
    case "options":
    case "remoteOption": {
      const values = Array.isArray(value) ? (value as string[]) : [String(value)]
      const name = (item: string) =>
        field.kind === "options"
          ? (field.options.find((option) => option.value === item)?.label ?? item)
          : (valueLabels?.[item] ?? item)
      return values.length > 2 ? labels.selected(values.length, locale) : values.map(name).join(", ")
    }
    case "boolean":
      return value === true ? (field.trueLabel ?? labels.yes) : (field.falseLabel ?? labels.no)
    case "number": {
      const number = value as NumberFilter
      if (number.op === "between") return `${formatCount(number.min, locale)}–${formatCount(number.max, locale)}`
      return `${symbols[number.op]} ${formatCount(number.value, locale)}`
    }
    case "date":
      return dateText(value as DateInput, locale)
    case "dateRange": {
      const range = value as DateRange
      const from = dateText(range.from, locale)
      const to = dateText(range.to, locale)
      if (range.from !== undefined && range.to !== undefined) return `${from} – ${to}`
      return range.from === undefined ? `≤ ${to}` : `≥ ${from}`
    }
    default:
      return String(value)
  }
}

type FilterChipsProps<S extends FilterSchema> = {
  /** The fields offered, in order. Default: every field but the search field, which `FilterSearch` edits. */
  fields?: readonly (keyof S & string)[]
  /** Labels of remote option values chosen elsewhere, like ids read from the URL. */
  valueLabels?: Readonly<Record<string, string>>
  labels?: Partial<FilterChipsLabels>
  /** Writes the chips' numbers and dates, and the editors'; the page's `<html lang>` by default (`useLocale`). */
  locale?: string
  schema?: S
  controller?: PageController<FilterValues<S>>
  className?: string
}

/**
 * Filters as chips in a FilterBar: one chip per active filter, opening an editor for its field, a button that
 * removes it, "Add filter" for the others, and reset. Picks apply at once; typed values on Enter or on close.
 */
function FilterChips<S extends FilterSchema>({
  fields,
  valueLabels: knownLabels,
  labels: labelOverrides,
  locale: localeProp,
  className,
  ...props
}: FilterChipsProps<S>) {
  const { schema, controller, state } = useFilterScope(props)
  const labels = { ...filterChipsLabels, ...labelOverrides }
  const locale = useLocale(localeProp)
  const searchKey = searchFieldOf(schema)
  const offered = fields ?? Object.keys(schema).filter((key) => key !== searchKey)
  const values = state.filter as Record<string, unknown>
  const [editing, setEditing] = useState<{ key: string; draft: unknown } | null>(null)
  const [chosenLabels, setValueLabels] = useState<Record<string, string>>({})
  const valueLabels = { ...knownLabels, ...chosenLabels }
  const addButton = useRef<HTMLButtonElement>(null)

  const active = activeFilterKeys(schema, state.filter).filter((key) => offered.includes(key))
  const shown = editing && !active.includes(editing.key) ? [...active, editing.key] : active
  const available = offered.filter((key) => !shown.includes(key))

  const apply = (key: string, value: unknown) =>
    (controller as unknown as PageController<Record<string, unknown>>).setFilterValue(key, value)

  const close = (key: string) => {
    if (editing?.key !== key) return
    apply(key, editing.draft)
    setEditing(null)
    // A chip added from the menu and left empty goes away; focus returns to "Add filter" instead of the page.
    if (!isActiveValue(editing.draft)) requestAnimationFrame(() => addButton.current?.focus())
  }

  return (
    <FilterBar
      label={labels.toolbar}
      isFiltered={active.length > 0}
      onReset={() => {
        setEditing(null)
        for (const key of active) apply(key, undefined)
      }}
      resetLabel={labels.reset}
      className={className}
    >
      {shown.map((key) => {
        const field = schema[key] as FilterFieldDefinition
        const open = editing?.key === key
        const value = open ? editing.draft : values[key]
        const summary = summarizeFilter(field, values[key], labels, valueLabels, locale)
        return (
          <span key={key} data-slot="filter-chip" className="inline-flex items-center">
            <Popover open={open} onOpenChange={(next) => (next ? setEditing({ key, draft: values[key] }) : close(key))}>
              <FilterBarButton
                render={<PopoverTrigger />}
                size="sm"
                data-active={isActiveValue(values[key]) ? "" : undefined}
                className="max-w-64 rounded-e-none border-e-0 data-active:border-input-strong"
              >
                <span className="truncate">{labels.chip(field.label, summary)}</span>
              </FilterBarButton>
              <PopoverContent align="start" className="w-80">
                <FilterField
                  field={field}
                  value={value}
                  labels={labels.field}
                  locale={locale}
                  valueLabels={valueLabels}
                  onValueChange={(next) => {
                    setEditing({ key, draft: next })
                    if (appliesAtOnce(field)) apply(key, next)
                  }}
                  onSubmit={() => close(key)}
                  onValueLabels={(found) => setValueLabels((previous) => ({ ...previous, ...found }))}
                />
              </PopoverContent>
            </Popover>
            <FilterBarButton
              size="icon"
              aria-label={labels.remove(field.label)}
              className="size-control-sm rounded-s-none"
              onClick={() => {
                if (open) setEditing(null)
                apply(key, undefined)
                requestAnimationFrame(() => addButton.current?.focus())
              }}
            >
              <XIcon />
            </FilterBarButton>
          </span>
        )
      })}
      {available.length > 0 && (
        <DropdownMenu onAction={(key) => setEditing({ key: String(key), draft: undefined })}>
          <FilterBarButton ref={addButton} render={<MenuTrigger />} variant="ghost" size="sm">
            <PlusIcon />
            {labels.addFilter}
          </FilterBarButton>
          <DropdownMenuContent>
            {available.map((key) => (
              <DropdownMenuItem key={key} value={key}>
                {schema[key]?.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </FilterBar>
  )
}

export { FilterChips, filterChipsLabels, summarizeFilter }
export type { FilterChipsLabels, FilterChipsProps }
