"use client"

import { useId, useState, type ReactNode } from "react"

import { Checkbox, CheckboxGroup, CheckboxIndicator } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumberInput, NumberInputControl, NumberInputGroup } from "@/components/ui/number-input"
import { Select } from "@/components/ui/select"
import { filterFieldLabels, type FilterFieldLabels } from "@/components/ui/filter-field-labels"
import { ServerCombobox } from "@/components/ui/server-combobox"
import type {
  DateRange,
  FilterField as FilterFieldDefinition,
  NumberField,
  NumberFilter,
  NumberOp,
} from "@/lib/filter-schema"
import { useLocale } from "@/lib/locale"
import { cn } from "@/lib/utils"

type FilterFieldProps = {
  field: FilterFieldDefinition
  value: unknown
  onValueChange: (value: unknown) => void
  labels?: Partial<FilterFieldLabels>
  /** Labels of remote option values that haven't loaded, like ids from the URL. */
  valueLabels?: Readonly<Record<string, string>>
  /** Enter in a text or number input, to apply at once. */
  onSubmit?: () => void
  /** The labels of remote options as they are chosen, for a summary that shows labels, not ids. */
  onValueLabels?: (labels: Readonly<Record<string, string>>) => void
  /** Writes dates and numbers in the pickers and inputs; the page's `<html lang>` by default (`useLocale`). */
  locale?: string
  className?: string
}

const legendClassName = "text-body-sm font-medium"
// A part of a grouped field (From, Value) reads quieter than the group's legend, so the hierarchy shows.
const subLabelClassName = "font-normal text-muted-foreground"

function TextControl({ field, value, onValueChange, onSubmit, className }: FilterFieldProps) {
  return (
    <Field className={className}>
      <FieldLabel>{field.label}</FieldLabel>
      <Input
        value={typeof value === "string" ? value : ""}
        placeholder={field.kind === "text" ? field.placeholder : undefined}
        onValueChange={(next) => onValueChange(next === "" ? undefined : next)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit?.()
        }}
      />
    </Field>
  )
}

function OptionsLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} className={legendClassName}>
      {children}
    </span>
  )
}

function OptionsControl({
  field,
  value,
  onValueChange,
  labels,
  className,
}: FilterFieldProps & { labels: FilterFieldLabels }) {
  const labelId = useId()
  if (field.kind !== "options") return null
  if (!field.multiple) {
    return (
      <Field className={className}>
        <FieldLabel>{field.label}</FieldLabel>
        <Select
          options={field.options}
          value={typeof value === "string" ? value : null}
          onValueChange={(next) => onValueChange(next ?? undefined)}
          placeholder={labels.any}
          clearable={labels.any}
        />
      </Field>
    )
  }
  const checked = Array.isArray(value) ? (value as string[]) : []
  return (
    <div data-slot="filter-field" className={cn("flex flex-col gap-items", className)}>
      <OptionsLabel id={labelId}>{field.label}</OptionsLabel>
      <CheckboxGroup
        aria-labelledby={labelId}
        value={checked}
        onValueChange={(next) => onValueChange(next.length === 0 ? undefined : next)}
        className="flex flex-col gap-items"
      >
        {field.options.map((option) => (
          <Label
            key={option.value}
            className="flex items-center gap-items pointer-coarse:min-h-(--control-height-touch)"
          >
            <Checkbox value={option.value}>
              <CheckboxIndicator />
            </Checkbox>
            {option.label}
          </Label>
        ))}
      </CheckboxGroup>
    </div>
  )
}

function BooleanControl({
  field,
  value,
  onValueChange,
  labels,
  className,
}: FilterFieldProps & { labels: FilterFieldLabels }) {
  if (field.kind !== "boolean") return null
  const options = [
    { value: "true", label: field.trueLabel ?? labels.yes },
    { value: "false", label: field.falseLabel ?? labels.no },
  ]
  return (
    <Field className={className}>
      <FieldLabel>{field.label}</FieldLabel>
      <Select
        options={options}
        value={typeof value === "boolean" ? String(value) : null}
        onValueChange={(next) => onValueChange(next === null ? undefined : next === "true")}
        placeholder={labels.any}
        clearable={labels.any}
      />
    </Field>
  )
}

function NumberBox({
  label,
  locale,
  value,
  onChange,
  field,
  onSubmit,
}: {
  label: string
  locale?: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  field: NumberField
  onSubmit?: () => void
}) {
  return (
    <Field className="min-w-0 flex-1">
      <FieldLabel className={subLabelClassName}>{label}</FieldLabel>
      <NumberInput
        locale={locale}
        value={value ?? null}
        min={field.min}
        max={field.max}
        step={field.step}
        onValueChange={(next) => onChange(next ?? undefined)}
      >
        <NumberInputGroup>
          <NumberInputControl
            onKeyDown={(event) => {
              if (event.key === "Enter") onSubmit?.()
            }}
          />
        </NumberInputGroup>
      </NumberInput>
    </Field>
  )
}

const defaultOperators: readonly (NumberOp | "between")[] = ["eq", "gte", "lte", "between"]

function NumberControl({
  field,
  value,
  onValueChange,
  onSubmit,
  labels,
  className,
  locale,
}: FilterFieldProps & { labels: FilterFieldLabels }) {
  const current = value as NumberFilter | undefined
  const operators = field.kind === "number" ? (field.operators ?? defaultOperators) : defaultOperators
  const [op, setOp] = useState<NumberOp | "between">(current?.op ?? operators[0] ?? "eq")
  // A range applies once both ends are set; until then the end typed first waits here.
  const [bounds, setBounds] = useState<{ min?: number; max?: number }>(() =>
    current?.op === "between" ? { min: current.min, max: current.max } : {},
  )
  if (field.kind !== "number") return null
  const single = current && current.op !== "between" ? current.value : undefined
  const range = current?.op === "between" ? current : bounds
  const setSingle = (next: number | undefined) =>
    onValueChange(next === undefined ? undefined : { op: op === "between" ? "eq" : op, value: next })
  const setRange = (min: number | undefined, max: number | undefined) => {
    setBounds({ min, max })
    onValueChange(min === undefined || max === undefined ? undefined : { op: "between", min, max })
  }
  return (
    <FieldSet className={cn("@container gap-items", className)}>
      <FieldLegend className={legendClassName}>{field.label}</FieldLegend>
      {/* The comparison and the value share a row once the container has room; a range's two ends get their own. */}
      <div className={cn("flex flex-col gap-items", op !== "between" && "@xs:flex-row")}>
        {operators.length > 1 && (
          <Field className="min-w-0 flex-1">
            <FieldLabel className={subLabelClassName}>{labels.comparison}</FieldLabel>
            <Select
              options={operators.map((operator) => ({ value: operator, label: labels.operators[operator] }))}
              value={op}
              onValueChange={(next) => {
                if (!next) return
                setOp(next)
                if (next === "between") return onValueChange(undefined)
                const kept = single ?? range.min
                if (kept !== undefined) onValueChange({ op: next, value: kept })
              }}
            />
          </Field>
        )}
        {op === "between" ? (
          <div className="flex gap-items">
            <NumberBox
              locale={locale}
              label={labels.min}
              value={range.min}
              field={field}
              onSubmit={onSubmit}
              onChange={(min) => setRange(min, range.max)}
            />
            <NumberBox
              locale={locale}
              label={labels.max}
              value={range.max}
              field={field}
              onSubmit={onSubmit}
              onChange={(max) => setRange(range.min, max)}
            />
          </div>
        ) : (
          <NumberBox
            locale={locale}
            label={labels.value}
            value={single}
            field={field}
            onSubmit={onSubmit}
            onChange={setSingle}
          />
        )}
      </div>
    </FieldSet>
  )
}

function dateText(value: unknown) {
  if (typeof value === "string") return value.slice(0, 10)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value === undefined || value === null ? null : String(value).slice(0, 10)
}

function DateControl({
  field,
  value,
  onValueChange,
  labels,
  className,
  locale,
}: FilterFieldProps & { labels: FilterFieldLabels }) {
  if (field.kind === "date") {
    return (
      <Field className={className}>
        <FieldLabel>{field.label}</FieldLabel>
        <DatePicker
          locale={locale}
          clearable
          hint={false}
          value={dateText(value)}
          onValueChange={(next) => onValueChange(typeof next === "string" ? next : undefined)}
        />
      </Field>
    )
  }
  const range = (value ?? {}) as DateRange
  const set = (patch: DateRange) => {
    const next = { ...range, ...patch }
    onValueChange(next.from === undefined && next.to === undefined ? undefined : next)
  }
  return (
    <FieldSet className={cn("@container gap-items", className)}>
      <FieldLegend className={legendClassName}>{field.label}</FieldLegend>
      <div className="grid gap-items @sm:grid-cols-2">
        <Field className="min-w-0">
          <FieldLabel className={subLabelClassName}>{labels.from}</FieldLabel>
          <DatePicker
            locale={locale}
            clearable
            hint={false}
            value={dateText(range.from)}
            onValueChange={(next) => set({ from: typeof next === "string" ? next : undefined })}
          />
        </Field>
        <Field className="min-w-0">
          <FieldLabel className={subLabelClassName}>{labels.to}</FieldLabel>
          <DatePicker
            locale={locale}
            clearable
            hint={false}
            value={dateText(range.to)}
            onValueChange={(next) => set({ to: typeof next === "string" ? next : undefined })}
          />
        </Field>
      </div>
    </FieldSet>
  )
}

function RemoteControl({
  field,
  value,
  onValueChange,
  onValueLabels,
  valueLabels,
  labels,
  className,
  locale,
}: FilterFieldProps & { labels: FilterFieldLabels }) {
  if (field.kind !== "remoteOption") return null
  const getValue = field.getValue ? (option: unknown) => field.getValue?.(option) ?? "" : undefined
  return (
    <Field className={className}>
      <FieldLabel>{field.label}</FieldLabel>
      {field.multiple ? (
        <ServerCombobox
          locale={locale}
          multiple
          source={field.source}
          getLabel={(option) => field.getLabel(option)}
          getValue={getValue}
          valueLabels={valueLabels}
          placeholder={Array.isArray(value) && value.length > 0 ? undefined : labels.any}
          value={Array.isArray(value) ? (value as string[]) : []}
          onValueChange={(next, change) => {
            onValueLabels?.(change.labels)
            onValueChange(next.length === 0 ? undefined : next)
          }}
        />
      ) : (
        <ServerCombobox
          locale={locale}
          source={field.source}
          getLabel={(option) => field.getLabel(option)}
          getValue={getValue}
          valueLabels={valueLabels}
          placeholder={labels.any}
          value={typeof value === "string" ? value : null}
          onValueChange={(next, change) => {
            onValueLabels?.(change.labels)
            onValueChange(next ?? undefined)
          }}
        />
      )}
    </Field>
  )
}

/**
 * The control for one schema field, named by its label: an input, a select, checkboxes, a comparison and number,
 * date pickers, or a ServerCombobox for remote options. `FilterChips` and `FilterPanel` use it.
 */
function FilterField({ locale: localeProp, ...rest }: FilterFieldProps) {
  const props = { ...rest, locale: useLocale(localeProp) }
  const labels = { ...filterFieldLabels, ...props.labels }
  let control: ReactNode
  switch (props.field.kind) {
    case "text":
      control = <TextControl {...props} />
      break
    case "options":
      control = <OptionsControl {...props} labels={labels} />
      break
    case "boolean":
      control = <BooleanControl {...props} labels={labels} />
      break
    case "number":
      control = <NumberControl {...props} labels={labels} />
      break
    case "date":
    case "dateRange":
      control = <DateControl {...props} labels={labels} />
      break
    default:
      control = <RemoteControl {...props} labels={labels} />
  }
  return control
}

/** Whether a change to this field is a pick (applies at once) rather than typing (applies on Enter or close). */
function appliesAtOnce(field: FilterFieldDefinition) {
  return field.kind !== "text" && field.kind !== "number"
}

export { appliesAtOnce, FilterField, filterFieldLabels }
export type { FilterFieldLabels, FilterFieldProps }
