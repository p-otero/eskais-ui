import type { DateRange, FilterField, FilterSchema, NumberFilter } from "@/lib/filter-schema"
import { isOneOf, isRecord } from "@/lib/narrow"

const numberOps = ["eq", "neq", "lt", "lte", "gt", "gte"] as const
type NumberOp = Exclude<NumberFilter["op"], "between">

const symbols: Record<string, NumberOp> = { "=": "eq", "!=": "neq", "<": "lt", "<=": "lte", ">": "gt", ">=": "gte" }

function fail(field: FilterField, expected: string, input: unknown): never {
  throw new RangeError(`${field.label} takes ${expected}; got ${JSON.stringify(input) ?? String(input)}.`)
}

function optionValue(field: FilterField & { kind: "options" }, input: unknown) {
  const text = String(input).trim()
  const lower = text.toLocaleLowerCase()
  const match =
    field.options.find((option) => option.value === text) ??
    field.options.find((option) => option.label.toLocaleLowerCase() === lower)
  if (!match) fail(field, `one of ${field.options.map((option) => option.label).join(", ")}`, input)
  return match.value
}

function list(input: unknown): unknown[] {
  if (Array.isArray(input)) return input
  if (typeof input === "string")
    return input
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  return [input]
}

function parseNumber(field: FilterField, input: unknown): NumberFilter {
  if (typeof input === "number" && Number.isFinite(input)) return { op: "eq", value: input }
  if (isRecord(input)) {
    const { op, min, max, value } = input
    if (op === "between" && typeof min === "number" && typeof max === "number") return { op: "between", min, max }
    if (isOneOf(numberOps, op) && typeof value === "number" && Number.isFinite(value)) return { op, value }
  }
  if (typeof input === "string") {
    const text = input.trim()
    const range = /^(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)$/.exec(text)
    if (range) return { op: "between", min: Number(range[1]), max: Number(range[2]) }
    const symbol = /^(!=|<=|>=|<|>|=)\s*(-?[\d.]+)$/.exec(text)
    if (symbol) return { op: symbols[symbol[1] ?? "="] ?? "eq", value: Number(symbol[2]) }
    const named = /^([a-z]+):\s*(-?[\d.]+)$/.exec(text)
    const namedOp = named?.[1]
    if (named && isOneOf(numberOps, namedOp)) return { op: namedOp, value: Number(named[2]) }
    if (text !== "" && Number.isFinite(Number(text))) return { op: "eq", value: Number(text) }
  }
  return fail(field, 'a number, ">= 10", "gte:10" or "10..20"', input)
}

const isoDate = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?$/

function parseDate(field: FilterField, input: unknown): string {
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input.toISOString().slice(0, 10)
  if (typeof input === "string" && isoDate.test(input.trim())) return input.trim()
  return fail(field, "an ISO date like 2026-01-31", input)
}

function parseRange(field: FilterField, input: unknown): DateRange {
  let from: unknown
  let to: unknown
  if (typeof input === "string" && input.includes("..")) [from, to] = input.split("..")
  else if (Array.isArray(input)) [from, to] = input
  else if (typeof input === "object" && input !== null) ({ from, to } = input as { from?: unknown; to?: unknown })
  else fail(field, 'a range like "2026-01-01..2026-01-31" or { from, to }', input)
  const range: DateRange = {}
  if (from !== undefined && from !== null && from !== "") range.from = parseDate(field, from)
  if (to !== undefined && to !== null && to !== "") range.to = parseDate(field, to)
  return range
}

function parseBoolean(field: FilterField & { kind: "boolean" }, input: unknown): boolean {
  if (typeof input === "boolean") return input
  const text = String(input).trim().toLocaleLowerCase()
  if (["true", "yes", "on", "1", field.trueLabel?.toLocaleLowerCase()].includes(text)) return true
  if (["false", "no", "off", "0", field.falseLabel?.toLocaleLowerCase()].includes(text)) return false
  return fail(field, "true or false", input)
}

/**
 * Turns loose input, as an agent or a person writes it, into a field's value: option labels or values, `"yes"`,
 * `">= 10"`, `"2026-01-01..2026-01-31"`. `null`, `undefined` and `""` clear the field. Anything else throws a
 * `RangeError` that says what the field takes.
 */
function parseFilterInput(field: FilterField, input: unknown): unknown {
  if (input === null || input === undefined || input === "") return undefined
  if (Array.isArray(input) && input.length === 0) return undefined
  switch (field.kind) {
    case "text":
      return String(input)
    case "options": {
      const values = list(input).map((item) => optionValue(field, item))
      if (field.multiple) return [...new Set(values)]
      if (values.length !== 1) fail(field, "one option", input)
      return values[0]
    }
    case "remoteOption": {
      const values = list(input).map((item) => String(item))
      if (field.multiple) return [...new Set(values)]
      if (values.length !== 1) fail(field, "one option", input)
      return values[0]
    }
    case "boolean":
      return parseBoolean(field, input)
    case "number":
      return parseNumber(field, input)
    case "date":
      return parseDate(field, input)
    case "dateRange":
      return parseRange(field, input)
    default:
      return undefined
  }
}

/** The key of a schema field named by its key or its label, ignoring case; throws with the choices otherwise. */
function findFilterKey<S extends FilterSchema>(schema: S, name: unknown): keyof S & string {
  const text = String(name).trim()
  const lower = text.toLocaleLowerCase()
  const keys = Object.keys(schema)
  const key =
    keys.find((candidate) => candidate === text) ??
    keys.find((candidate) => schema[candidate]?.label.toLocaleLowerCase() === lower)
  if (key === undefined)
    throw new RangeError(
      `No filter "${text}". Filters: ${keys.map((candidate) => schema[candidate]?.label).join(", ")}.`,
    )
  return key
}

export { findFilterKey, parseFilterInput }
