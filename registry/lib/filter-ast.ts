import { isRecord } from "@/lib/narrow"

type FilterOp =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "nin"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "isNull"

/** A `Temporal` value or anything else whose `toString()` is ISO 8601; no Temporal dependency needed. */
type TemporalLike = { toString(): string; readonly epochMilliseconds?: number }

type FilterScalar = string | number | boolean | null | Date | TemporalLike

type FilterLeaf = {
  field: string
  op: FilterOp
  /** A list for `in` and `nin`; `true` (is null) or `false` (is not null) for `isNull`. */
  value: FilterScalar | readonly FilterScalar[]
  /** Marks a date, so serializers format it with their `dates` option. */
  type?: "date"
}

type FilterNode = { and: readonly FilterNode[] } | { or: readonly FilterNode[] } | { not: FilterNode } | FilterLeaf

/** `"iso"` keeps strings and writes `Date` as `toISOString()`; `"iso-date"` keeps the date part only. */
type DateFormat = "iso" | "iso-date" | "epoch-ms" | ((value: Date | TemporalLike | string) => string)

const filterOps: readonly FilterOp[] = [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "in",
  "nin",
  "contains",
  "startsWith",
  "endsWith",
  "isNull",
]

/** Thrown when a filter can't be written safely in a wire format. */
class FilterSerializeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FilterSerializeError"
  }
}

const fieldPattern = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/

/** Field names are identifiers with dotted paths, never free text: anything else is refused. */
function assertFieldName(field: unknown, allowed?: ReadonlySet<string>): string {
  if (typeof field !== "string" || !fieldPattern.test(field))
    throw new FilterSerializeError(`"${String(field)}" isn't a valid field name.`)
  if (allowed && !allowed.has(field)) throw new FilterSerializeError(`"${field}" isn't a field of this filter schema.`)
  return field
}

function isLeaf(node: FilterNode): node is FilterLeaf {
  return "field" in node
}

const negated: Partial<Record<FilterOp, FilterOp>> = {
  eq: "neq",
  neq: "eq",
  lt: "gte",
  lte: "gt",
  gt: "lte",
  gte: "lt",
  in: "nin",
  nin: "in",
}

/**
 * Pushes `not` down to the leaves (De Morgan), for formats without a `not`: `not(a and b)` becomes `not a or not b`.
 * A text match (`contains`…) stays wrapped in `not`; `isNull` flips its value.
 */
function negate(node: FilterNode): FilterNode {
  if ("and" in node) return { or: node.and.map(negate) }
  if ("or" in node) return { and: node.or.map(negate) }
  if ("not" in node) return node.not
  if (node.op === "isNull") return { ...node, value: node.value !== true }
  const op = negated[node.op]
  return op ? { ...node, op } : { not: node }
}

function isTemporalLike(value: unknown): value is TemporalLike {
  return typeof value === "object" && value !== null && !(value instanceof Date) && !Array.isArray(value)
}

function epochOf(value: Date | TemporalLike | string): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "string") return Date.parse(value)
  if (typeof value.epochMilliseconds === "number") return value.epochMilliseconds
  return Date.parse(value.toString())
}

/** Writes a date for the wire. A `Date` is written in UTC; strings and Temporal values keep their own form. */
function formatDate(value: Date | TemporalLike | string, format: DateFormat = "iso"): string {
  if (typeof format === "function") return format(value)
  if (format === "epoch-ms") {
    const ms = epochOf(value)
    if (!Number.isFinite(ms)) throw new FilterSerializeError(`"${String(value)}" isn't a date.`)
    return String(ms)
  }
  if (value instanceof Date && Number.isNaN(value.getTime())) throw new FilterSerializeError("Invalid Date.")
  const iso = value instanceof Date ? value.toISOString() : value.toString()
  return format === "iso-date" ? iso.slice(0, 10) : iso
}

/** A scalar as text for formats that write everything as strings; dates go through `formatDate`. */
function scalarText(value: FilterScalar, dates: DateFormat | undefined, isDate: boolean): string {
  if (value === null) return "null"
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new FilterSerializeError(`${String(value)} can't be sent as a filter value.`)
    return String(value)
  }
  if (typeof value === "boolean") return String(value)
  if (value instanceof Date || isTemporalLike(value) || (isDate && typeof value === "string"))
    return formatDate(value, dates)
  return value
}

function valuesOf(leaf: FilterLeaf): readonly FilterScalar[] {
  return Array.isArray(leaf.value) ? (leaf.value as readonly FilterScalar[]) : [leaf.value as FilterScalar]
}

function readPath(item: unknown, path: string): unknown {
  let current = item
  for (const key of path.split(".")) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

const dateOnly = /^\d{4}-\d{2}-\d{2}$/

function comparable(left: unknown, right: FilterScalar, isDate: boolean): [unknown, unknown] {
  if (!isDate && !(right instanceof Date) && !isTemporalLike(right)) return [left, right]
  // A date-only bound compares by calendar day, so `lte 2026-02-01` keeps the whole of that day.
  if (typeof right === "string" && dateOnly.test(right)) {
    const day = left instanceof Date ? left.toISOString() : typeof left === "string" ? left : ""
    return [day.slice(0, 10), right]
  }
  const ms = (value: unknown) =>
    value instanceof Date || isTemporalLike(value) || typeof value === "string" ? epochOf(value) : Number.NaN
  return [ms(left), ms(right)]
}

function compare(left: unknown, right: unknown) {
  if (typeof left === "string" && typeof right === "string") return left.localeCompare(right)
  if (typeof left === "number" && typeof right === "number") return left - right
  return Number.NaN
}

function text(value: unknown) {
  return String(value ?? "").toLocaleLowerCase()
}

function matchesLeaf(leaf: FilterLeaf, item: unknown): boolean {
  const actual = readPath(item, leaf.field)
  const isDate = leaf.type === "date"
  switch (leaf.op) {
    case "isNull":
      return (actual === null || actual === undefined) === (leaf.value === true)
    case "in":
    case "nin": {
      const found = valuesOf(leaf).some((value) => Object.is(actual, value) || String(actual) === String(value))
      return leaf.op === "in" ? found : !found
    }
    case "contains":
      return text(actual).includes(text(leaf.value))
    case "startsWith":
      return text(actual).startsWith(text(leaf.value))
    case "endsWith":
      return text(actual).endsWith(text(leaf.value))
    default: {
      const [left, right] = comparable(actual, leaf.value as FilterScalar, isDate)
      if (leaf.op === "eq") return left === right || (left !== undefined && String(left) === String(right))
      if (leaf.op === "neq") return !(left === right || String(left) === String(right))
      const order = compare(left, right)
      if (Number.isNaN(order)) return false
      if (leaf.op === "lt") return order < 0
      if (leaf.op === "lte") return order <= 0
      if (leaf.op === "gt") return order > 0
      return order >= 0
    }
  }
}

/** Evaluates a filter against an object in memory, for `arraySource` and tests. Text matches ignore case. */
function matchesFilter(node: FilterNode | null | undefined, item: unknown): boolean {
  if (!node) return true
  if ("and" in node) return node.and.every((child) => matchesFilter(child, item))
  if ("or" in node) return node.or.some((child) => matchesFilter(child, item))
  if ("not" in node) return !matchesFilter(node.not, item)
  return matchesLeaf(node, item)
}

function fieldsOf(node: FilterNode | null | undefined, into = new Set<string>()): Set<string> {
  if (!node) return into
  if ("and" in node) for (const child of node.and) fieldsOf(child, into)
  else if ("or" in node) for (const child of node.or) fieldsOf(child, into)
  else if ("not" in node) fieldsOf(node.not, into)
  else into.add(node.field)
  return into
}

/** Whether a filter holds an `or` or a `not`, which flat query params can't carry. */
function hasGroups(node: FilterNode | null | undefined): boolean {
  if (!node) return false
  if ("or" in node || "not" in node) return true
  if ("and" in node) return node.and.some(hasGroups)
  return false
}

function assertLeaf(leaf: FilterLeaf) {
  if (!filterOps.includes(leaf.op)) throw new FilterSerializeError(`Unknown operator "${String(leaf.op)}".`)
  const list = Array.isArray(leaf.value)
  if ((leaf.op === "in" || leaf.op === "nin") !== list)
    throw new FilterSerializeError(`"${leaf.op}" on "${leaf.field}" ${list ? "can't take" : "needs"} a list.`)
  if (leaf.op === "isNull" && typeof leaf.value !== "boolean")
    throw new FilterSerializeError(`"isNull" on "${leaf.field}" takes true or false.`)
}

export {
  assertFieldName,
  assertLeaf,
  epochOf,
  fieldsOf,
  FilterSerializeError,
  filterOps,
  formatDate,
  hasGroups,
  isLeaf,
  isTemporalLike,
  matchesFilter,
  negate,
  readPath,
  scalarText,
  valuesOf,
}
export type { DateFormat, FilterLeaf, FilterNode, FilterOp, FilterScalar, TemporalLike }
