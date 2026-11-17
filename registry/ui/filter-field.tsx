"use client"

import { useId, useState, type ReactNode } from "react"

import { Checkbox, CheckboxGroup, CheckboxIndicator } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumberInput, NumberInputControl, NumberInputGroup } from "@/components/ui/number-input"
import { Select } from "@/components/ui/select"
import { ServerCombobox } from "@/components/ui/server-combobox"
import type {
  DateRange,
  FilterField as FilterFieldDefinition,
  NumberField,
  NumberFilter,
  NumberOp,
} from "@/lib/filter-schema"
import { cn } from "@/lib/utils"

type FilterFieldLabels = {
  /** The choice that clears a single option or a boolean. */
  any: string
  yes: string
  no: string
  from: string
  to: string
  min: string
  max: string
  value: string
  comparison: string
  operators: Record<NumberOp | "between", string>
}

const filterFieldLabels: FilterFieldLabels = {
  any: "Any",
  yes: "Yes",
  no: "No",
  from: "From",
  to: "To",
  min: "Minimum",
  max: "Maximum",
  value: "Value",
  comparison: "Comparison",
  operators: {
    eq: "Equals",
    neq: "Is not",
    lt: "Less than",
    lte: "At most",
    gt: "More than",
    gte: "At least",
    between: "Between",
  },
}

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
  className?: string
}

const legendClassName = "text-body-sm font-medium"

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
  value,
  onChange,
  field,
  onSubmit,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  field: NumberField
  onSubmit?: () => void
}) {
  return (
    <NumberInput
      value={value ?? null}
      min={field.min}
      max={field.max}
      step={field.step}
      onValueChange={(next) => onChange(next ?? undefined)}
      className="min-w-0 flex-1"
    >
      <NumberInputGroup>
        <NumberInputControl
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit?.()
          }}
        />
      </NumberInputGroup>
    </NumberInput>
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
    <FieldSet className={cn("gap-items", className)}>
      <FieldLegend className={legendClassName}>{field.label}</FieldLegend>
      {operators.length > 1 && (
        <Select
          aria-label={labels.comparison}
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
      )}
      {op === "between" ? (
        <div className="flex items-center gap-inline">
          <NumberBox
            label={labels.min}
            value={range.min}
            field={field}
            onSubmit={onSubmit}
            onChange={(min) => setRange(min, range.max)}
          />
          <NumberBox
            label={labels.max}
            value={range.max}
            field={field}
            onSubmit={onSubmit}
            onChange={(max) => setRange(range.min, max)}
          />
        </div>
      ) : (
        <NumberBox label={labels.value} value={single} field={field} onSubmit={onSubmit} onChange={setSingle} />
      )}
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
}: FilterFieldProps & { labels: FilterFieldLabels }) {
  if (field.kind === "date") {
    return (
      <Field className={className}>
        <FieldLabel>{field.label}</FieldLabel>
        <DatePicker
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
    <FieldSet className={cn("gap-items", className)}>
      <FieldLegend className={legendClassName}>{field.label}</FieldLegend>
      <div className="grid gap-items sm:grid-cols-2">
        <DatePicker
          label={labels.from}
          clearable
          hint={false}
          value={dateText(range.from)}
          onValueChange={(next) => set({ from: typeof next === "string" ? next : undefined })}
        />
        <DatePicker
          label={labels.to}
          clearable
          hint={false}
          value={dateText(range.to)}
          onValueChange={(next) => set({ to: typeof next === "string" ? next : undefined })}
        />
      </div>
    </FieldSet>
  )
}

function RemoteControl({ field, value, onValueChange, onValueLabels, valueLabels, className }: FilterFieldProps) {
  if (field.kind !== "remoteOption") return null
  const getValue = field.getValue ? (option: unknown) => field.getValue?.(option) ?? "" : undefined
  return (
    <Field className={className}>
      <FieldLabel>{field.label}</FieldLabel>
      {field.multiple ? (
        <ServerCombobox
          multiple
          source={field.source}
          getLabel={(option) => field.getLabel(option)}
          getValue={getValue}
          valueLabels={valueLabels}
          value={Array.isArray(value) ? (value as string[]) : []}
          onValueChange={(next, change) => {
            onValueLabels?.(change.labels)
            onValueChange(next.length === 0 ? undefined : next)
          }}
        />
      ) : (
        <ServerCombobox
          source={field.source}
          getLabel={(option) => field.getLabel(option)}
          getValue={getValue}
          valueLabels={valueLabels}
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
function FilterField(props: FilterFieldProps) {
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
      control = <RemoteControl {...props} />
  }
  return control
}

/** Whether a change to this field is a pick (applies at once) rather than typing (applies on Enter or close). */
function appliesAtOnce(field: FilterFieldDefinition) {
  return field.kind !== "text" && field.kind !== "number"
}

export { appliesAtOnce, FilterField, filterFieldLabels }
export type { FilterFieldLabels, FilterFieldProps }
