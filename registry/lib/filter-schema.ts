import {
  assertFieldName,
  fieldsOf,
  FilterSerializeError,
  isTemporalLike,
  type FilterLeaf,
  type FilterNode,
  type FilterOp,
  type TemporalLike,
} from "@/lib/filter-ast"
import { assumeType, isOneOf, isRecord, isStringArray } from "@/lib/narrow"
import type { PageSource } from "@/lib/page-source"

type FilterOption = { value: string; label: string }

type TextMatchOp = Extract<FilterOp, "contains" | "startsWith" | "endsWith" | "eq">

/** `{ param: "q" }` sends the text as its own param; `{ fields, op }` matches it against fields, joined by `or`. */
type SearchMapping = { param: string } | { fields: readonly string[]; op?: TextMatchOp }

type FieldBase = {
  /** The field's name in the UI, for chips, the panel and agents. */
  label: string
  /** The field's name on the wire, when it differs from the key. A dotted path reaches a nested field. */
  field?: string
}

type TextField = FieldBase & { kind: "text"; search?: SearchMapping; placeholder?: string }
type OptionsField = FieldBase & { kind: "options"; options: readonly FilterOption[]; multiple?: boolean }
type BooleanField = FieldBase & { kind: "boolean"; trueLabel?: string; falseLabel?: string }
type NumberOp = Extract<FilterOp, "eq" | "neq" | "lt" | "lte" | "gt" | "gte">
type NumberField = FieldBase & {
  kind: "number"
  /** The comparisons offered. Default `["eq", "gte", "lte", "between"]`. */
  operators?: readonly (NumberOp | "between")[]
  min?: number
  max?: number
  step?: number
}
type DateField = FieldBase & { kind: "date"; op?: Extract<FilterOp, "eq" | "lt" | "lte" | "gt" | "gte"> }
type DateRangeField = FieldBase & {
  kind: "dateRange"
  /**
   * The range's end is inclusive. `"lte"` (default) sends `field lte to`, which keeps the whole day when the backend
   * compares dates; `"next-day"` sends `field lt to + 1 day`, for a backend that stores date-times.
   */
  end?: "lte" | "next-day"
}
type RemoteOptionField<Option = unknown> = FieldBase & {
  kind: "remoteOption"
  /** Where the options come from; its filter gets the typed text as `q`. */
  source: PageSource<Option, { q?: string }>
  getLabel(option: Option): string
  /** The value stored for an option. Default: the source's `getId`. */
  getValue?(option: Option): string
  multiple?: boolean
}

type FilterField =
  | TextField
  | OptionsField
  | BooleanField
  | NumberField
  | DateField
  | DateRangeField
  | RemoteOptionField
type FilterSchema = Readonly<Record<string, FilterField>>

type DateInput = string | Date | TemporalLike
type DateRange = { from?: DateInput; to?: DateInput }
type NumberFilter = { op: NumberOp; value: number } | { op: "between"; min: number; max: number }

type FieldValue<Field> = Field extends { kind: "text" }
  ? string
  : Field extends { kind: "options" | "remoteOption"; multiple: true }
    ? readonly string[]
    : Field extends { kind: "options" | "remoteOption" }
      ? string
      : Field extends { kind: "boolean" }
        ? boolean
        : Field extends { kind: "number" }
          ? NumberFilter
          : Field extends { kind: "date" }
            ? DateInput
            : Field extends { kind: "dateRange" }
              ? DateRange
              : never

/** The values of a schema: every field optional, unset means no filter. `$where` adds an expression with groups. */
type FilterValues<S extends FilterSchema> = { -readonly [Key in keyof S]?: FieldValue<S[Key]> } & {
  $where?: FilterNode
}

const reserved = new Set(["$where"])

const numberOps = ["eq", "neq", "lt", "lte", "gt", "gte"] as const satisfies readonly NumberOp[]

/** A comparison a number field offers besides `between`: `eq`, `neq`, `lt`, `lte`, `gt` or `gte`. */
function isNumberOp(value: unknown): value is NumberOp {
  return isOneOf(numberOps, value)
}

/** A number field's value: `{ op, value }` or `{ op: "between", min, max }`. */
function isNumberFilter(value: unknown): value is NumberFilter {
  if (!isRecord(value)) return false
  if (value.op === "between") return typeof value.min === "number" && typeof value.max === "number"
  return isNumberOp(value.op) && typeof value.value === "number"
}

/** A date field's value: an ISO string, a `Date` or a Temporal-like object. */
function isDateInput(value: unknown): value is DateInput {
  return typeof value === "string" || value instanceof Date || isTemporalLike(value)
}

/** A date range's value: `{ from?, to? }`, each a date input. */
function isDateRange(value: unknown): value is DateRange {
  return (
    isRecord(value) &&
    !(value instanceof Date) &&
    ("from" in value || "to" in value) &&
    (value.from === undefined || isDateInput(value.from)) &&
    (value.to === undefined || isDateInput(value.to))
  )
}

type AddsDays = { add(duration: { days: number }): TemporalLike }

const addsDays = (value: object): value is AddsDays => "add" in value && typeof value.add === "function"

/** A `remoteOption` field typed by its source, so `getLabel` knows the option: `owner: remoteOption({ … })`. */
function remoteOption<Option, const Multiple extends boolean = false>(
  field: Omit<RemoteOptionField<Option>, "kind" | "multiple"> & { multiple?: Multiple },
): RemoteOptionField<Option> & { kind: "remoteOption"; multiple: Multiple } {
  // `Multiple` defaults to false when `multiple` is left out, a link TypeScript can't draw from the property.
  return { ...field, kind: "remoteOption", multiple: assumeType<Multiple>(field.multiple ?? false) }
}

/** Declares the filters a source accepts. Keys and wire fields must be identifiers: they are the whitelist. */
function defineFilters<const S extends FilterSchema>(schema: S): S {
  for (const [key, field] of Object.entries(schema)) {
    if (reserved.has(key)) throw new FilterSerializeError(`"${key}" is reserved.`)
    assertFieldName(key)
    assertFieldName(field.field ?? key)
    if (field.kind === "text" && field.search && "fields" in field.search)
      for (const name of field.search.fields) assertFieldName(name)
    if (field.kind === "text" && field.search && "param" in field.search) assertFieldName(field.search.param)
  }
  return schema
}

function wireName(key: string, field: FilterField) {
  return field.field ?? key
}

const defaultSearch: SearchMapping = { param: "q" }

function searchOf(field: TextField): SearchMapping {
  return field.search ?? defaultSearch
}

/** Every wire field the schema can produce: the whitelist a `$where` is checked against. */
function schemaFields(schema: FilterSchema): Set<string> {
  const fields = new Set<string>()
  for (const [key, field] of Object.entries(schema)) {
    if (field.kind !== "text") fields.add(wireName(key, field))
    else {
      const search = searchOf(field)
      if ("fields" in search) for (const name of search.fields) fields.add(name)
    }
  }
  return fields
}

/** Whether a value filters anything: unset, empty text, an empty list or an empty range doesn't. */
function isActiveValue(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === "string") return value.trim() !== ""
  if (Array.isArray(value)) return value.length > 0
  if (isRecord(value) && !(value instanceof Date) && ("from" in value || "to" in value))
    return isActiveValue(value.from) || isActiveValue(value.to)
  return true
}

/** The keys of the schema with an active value, in schema order. */
function activeFilterKeys<S extends FilterSchema>(schema: S, values: FilterValues<S>): (keyof S & string)[] {
  return Object.keys(schema).filter((key) => isActiveValue((values as Record<string, unknown>)[key]))
}

function nextDay(value: DateInput): DateInput {
  if (value instanceof Date) return new Date(value.getTime() + 24 * 60 * 60 * 1000)
  if (typeof value === "string") {
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!day) throw new FilterSerializeError(`"next-day" needs a date like 2026-01-31, not "${value}".`)
    return new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]) + 1)).toISOString().slice(0, 10)
  }
  if (!addsDays(value)) throw new FilterSerializeError(`"next-day" can't add a day to ${String(value)}.`)
  return value.add({ days: 1 })
}

function leaf(field: string, op: FilterOp, value: FilterLeaf["value"], type?: "date"): FilterLeaf {
  return type ? { field, op, value, type } : { field, op, value }
}

function fieldNodes(key: string, field: FilterField, value: unknown): FilterNode[] {
  if (!isActiveValue(value)) return []
  const name = wireName(key, field)
  switch (field.kind) {
    case "text": {
      const search = searchOf(field)
      if ("param" in search) return []
      const text = String(value).trim()
      const nodes = search.fields.map((fieldName) => leaf(fieldName, search.op ?? "contains", text))
      return nodes.length === 1 ? nodes : [{ or: nodes }]
    }
    case "options":
    case "remoteOption":
      if (field.multiple) return isStringArray(value) ? [leaf(name, "in", [...value])] : []
      return [leaf(name, "eq", String(value))]
    case "boolean":
      return [leaf(name, "eq", value === true)]
    case "number": {
      if (!isNumberFilter(value)) return []
      if (value.op === "between") return [leaf(name, "gte", value.min), leaf(name, "lte", value.max)]
      return [leaf(name, value.op, value.value)]
    }
    case "date":
      return isDateInput(value) ? [leaf(name, field.op ?? "eq", value, "date")] : []
    case "dateRange": {
      if (!isRecord(value)) return []
      const { from, to } = value
      const nodes: FilterNode[] = []
      if (isActiveValue(from) && isDateInput(from)) nodes.push(leaf(name, "gte", from, "date"))
      if (isActiveValue(to) && isDateInput(to)) {
        nodes.push(field.end === "next-day" ? leaf(name, "lt", nextDay(to), "date") : leaf(name, "lte", to, "date"))
      }
      return nodes
    }
    default:
      return []
  }
}

/**
 * The values as one canonical filter, joined by `and`; `null` when nothing filters. Text fields mapped to a param
 * stay out of it: read them with `searchTerms`. Field names come only from the schema.
 */
function toFilterAst<S extends FilterSchema>(schema: S, values: FilterValues<S>): FilterNode | null {
  const nodes = Object.entries(schema).flatMap(([key, field]) =>
    fieldNodes(key, field, (values as Record<string, unknown>)[key]),
  )
  if (values.$where) {
    const allowed = schemaFields(schema)
    for (const name of fieldsOf(values.$where)) assertFieldName(name, allowed)
    nodes.push(values.$where)
  }
  if (nodes.length === 0) return null
  return nodes.length === 1 ? nodes[0]! : { and: nodes }
}

/** Text fields mapped to their own param (`{ param: "q" }`, the default), as `{ q: "text" }`. */
function searchTerms<S extends FilterSchema>(schema: S, values: FilterValues<S>): Record<string, string> {
  const terms: Record<string, string> = {}
  for (const [key, field] of Object.entries(schema)) {
    if (field.kind !== "text") continue
    const search = searchOf(field)
    const value = (values as Record<string, unknown>)[key]
    if ("param" in search && typeof value === "string" && value.trim() !== "") terms[search.param] = value.trim()
  }
  return terms
}

/** The schema's text fields, in order: the first is what a search box edits. */
function searchFieldOf<S extends FilterSchema>(schema: S): (keyof S & string) | undefined {
  return Object.keys(schema).find((key) => schema[key]?.kind === "text")
}

export {
  activeFilterKeys,
  defineFilters,
  isActiveValue,
  isDateInput,
  isDateRange,
  isNumberFilter,
  isNumberOp,
  remoteOption,
  schemaFields,
  searchFieldOf,
  searchOf,
  searchTerms,
  toFilterAst,
  wireName,
}
export type {
  BooleanField,
  DateField,
  DateInput,
  DateRange,
  DateRangeField,
  FieldValue,
  FilterField,
  FilterOption,
  FilterSchema,
  FilterValues,
  NumberField,
  NumberFilter,
  NumberOp,
  OptionsField,
  RemoteOptionField,
  SearchMapping,
  TextField,
  TextMatchOp,
}
