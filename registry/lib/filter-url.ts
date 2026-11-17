import { assertFieldName, hasGroups } from "@/lib/filter-ast"
import {
  isActiveValue,
  type DateInput,
  type DateRange,
  type FilterField,
  type FilterSchema,
  type FilterValues,
  type NumberFilter,
} from "@/lib/filter-schema"
import type { SortSpec } from "@/lib/page-source"

/** What a table keeps in the URL: schema values, never the wire format. */
type PageUrlState<F> = {
  filter: F
  sort: readonly SortSpec[]
  page: number
  size: number
  cursor?: string | null
}

type UrlCodecOptions = {
  /** `"fields"` (default) writes one readable param per filter, or `"encoded"` one `f` param for everything. */
  format?: "fields" | "encoded"
  /** Prefixes every param, for two tables on one page: `prefix: "tasks."`. */
  prefix?: string
  /** The encoded filter's param. Default `"f"`. */
  param?: string
  pageParam?: string
  sizeParam?: string
  sortParam?: string
  cursorParam?: string
  /** Values left out of the URL. Default size 25, no sort. */
  defaults?: { size?: number; sort?: readonly SortSpec[] }
}

type UrlCodec<F> = {
  encode(state: PageUrlState<F>): URLSearchParams
  decode(params: URLSearchParams): PageUrlState<F>
  /** `current` with this codec's params replaced by `state`'s, other params kept. */
  merge(current: URLSearchParams, state: PageUrlState<F>): URLSearchParams
  owns(name: string): boolean
}

const numberOps = new Set(["eq", "neq", "lt", "lte", "gt", "gte"])

function joinList(values: readonly string[]) {
  return values.map((value) => value.replaceAll("\\", "\\\\").replaceAll(",", "\\,")).join(",")
}

function splitList(text: string) {
  const values: string[] = []
  let current = ""
  for (let index = 0; index < text.length; index++) {
    const char = text.charAt(index)
    if (char === "\\" && index + 1 < text.length) {
      current += text.charAt(++index)
    } else if (char === ",") {
      values.push(current)
      current = ""
    } else current += char
  }
  values.push(current)
  return values.filter((value) => value !== "")
}

function dateText(value: DateInput | undefined) {
  if (value === undefined) return ""
  return value instanceof Date ? value.toISOString() : value.toString()
}

function parseNumber(text: string) {
  if (text.trim() === "") return undefined
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

function encodeField(field: FilterField, value: unknown): string | undefined {
  if (!isActiveValue(value)) return undefined
  switch (field.kind) {
    case "text":
      return String(value)
    case "options":
    case "remoteOption":
      return field.multiple ? joinList(value as readonly string[]) : String(value)
    case "boolean":
      return String(value === true)
    case "number": {
      const number = value as NumberFilter
      if (number.op === "between") return `${String(number.min)}..${String(number.max)}`
      return number.op === "eq" ? String(number.value) : `${number.op}:${String(number.value)}`
    }
    case "date":
      return dateText(value as DateInput)
    case "dateRange": {
      const range = value as DateRange
      return `${dateText(range.from)}..${dateText(range.to)}`
    }
    default:
      return undefined
  }
}

function decodeNumber(text: string): NumberFilter | undefined {
  const range = text.split("..")
  if (range.length === 2) {
    const min = parseNumber(range[0] ?? "")
    const max = parseNumber(range[1] ?? "")
    return min === undefined || max === undefined ? undefined : { op: "between", min, max }
  }
  const match = /^([a-z]+):(.*)$/.exec(text)
  if (match) {
    const op = match[1] ?? ""
    const value = parseNumber(match[2] ?? "")
    return numberOps.has(op) && value !== undefined ? ({ op, value } as NumberFilter) : undefined
  }
  const value = parseNumber(text)
  return value === undefined ? undefined : { op: "eq", value }
}

// Anything that doesn't fit the field is dropped: a URL is input from anyone.
function decodeField(field: FilterField, text: string): unknown {
  switch (field.kind) {
    case "text":
      return text === "" ? undefined : text
    case "options": {
      const known = new Set(field.options.map((option) => option.value))
      if (!field.multiple) return known.has(text) ? text : undefined
      const values = splitList(text).filter((value) => known.has(value))
      return values.length === 0 ? undefined : values
    }
    case "remoteOption": {
      if (!field.multiple) return text === "" ? undefined : text
      const values = splitList(text)
      return values.length === 0 ? undefined : values
    }
    case "boolean":
      return text === "true" ? true : text === "false" ? false : undefined
    case "number":
      return decodeNumber(text)
    case "date":
      return text === "" ? undefined : text
    case "dateRange": {
      const parts = text.split("..")
      if (parts.length !== 2) return undefined
      const range: DateRange = {}
      if (parts[0]) range.from = parts[0]
      if (parts[1]) range.to = parts[1]
      return isActiveValue(range) ? range : undefined
    }
    default:
      return undefined
  }
}

function base64UrlEncode(text: string) {
  let binary = ""
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCodePoint(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

function base64UrlDecode(text: string) {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"))
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0))
}

function encodeSort(sort: readonly SortSpec[]) {
  return sort.map((spec) => `${spec.field}.${spec.direction}`).join(",")
}

function decodeSort(text: string | null): SortSpec[] | undefined {
  if (text === null) return undefined
  const specs: SortSpec[] = []
  for (const part of text.split(",")) {
    const match = /^(.+)\.(asc|desc)$/.exec(part)
    const field = match?.[1] ?? part
    try {
      assertFieldName(field)
    } catch {
      continue
    }
    specs.push({ field, direction: match?.[2] === "desc" ? "desc" : "asc" })
  }
  return specs
}

function sameSort(a: readonly SortSpec[], b: readonly SortSpec[]) {
  return encodeSort(a) === encodeSort(b)
}

/**
 * Reads and writes a table's state as readable params (`?status=open,closed&created=2026-01-01..2026-02-01&q=…
 * &page=2&size=50&sort=name.asc`). A filter with `or` groups (`$where`) goes in one encoded param instead.
 * `decode(encode(state))` gives the state back.
 */
function createUrlCodec<S extends FilterSchema>(schema: S, options: UrlCodecOptions = {}): UrlCodec<FilterValues<S>> {
  const prefix = options.prefix ?? ""
  const name = (base: string) => `${prefix}${base}`
  const page = name(options.pageParam ?? "page")
  const size = name(options.sizeParam ?? "size")
  const sort = name(options.sortParam ?? "sort")
  const cursor = name(options.cursorParam ?? "cursor")
  const encoded = name(options.param ?? "f")
  const defaultSize = options.defaults?.size ?? 25
  const defaultSort = options.defaults?.sort ?? []
  const fields = Object.entries(schema)
  const reserved = [page, size, sort, cursor, encoded]
  for (const [key] of fields)
    if (reserved.includes(name(key))) throw new TypeError(`The filter "${key}" clashes with a paging param.`)
  const owned = new Set([...reserved, ...fields.map(([key]) => name(key))])

  const encode = (state: PageUrlState<FilterValues<S>>) => {
    const params = new URLSearchParams()
    const values = state.filter as Record<string, unknown>
    if (options.format === "encoded" || hasGroups(state.filter.$where)) {
      const active = Object.fromEntries(
        Object.entries(values).filter(([key, value]) => key === "$where" || isActiveValue(value)),
      )
      if (Object.keys(active).length > 0) params.set(encoded, base64UrlEncode(JSON.stringify(active)))
    } else {
      for (const [key, field] of fields) {
        const text = encodeField(field, values[key])
        if (text !== undefined) params.set(name(key), text)
      }
      if (state.filter.$where) params.set(encoded, base64UrlEncode(JSON.stringify({ $where: state.filter.$where })))
    }
    if (!sameSort(state.sort, defaultSort)) params.set(sort, encodeSort(state.sort))
    if (state.page > 1) params.set(page, String(state.page))
    if (state.size !== defaultSize) params.set(size, String(state.size))
    if (state.cursor) params.set(cursor, state.cursor)
    return params
  }

  const decodeEncoded = (text: string): Record<string, unknown> => {
    try {
      const parsed = JSON.parse(base64UrlDecode(text)) as unknown
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}
      const filter: Record<string, unknown> = {}
      for (const [key, field] of fields) {
        const value = (parsed as Record<string, unknown>)[key]
        const written = encodeField(field, value)
        const decoded = written === undefined ? undefined : decodeField(field, written)
        if (decoded !== undefined) filter[key] = decoded
      }
      const where = (parsed as Record<string, unknown>).$where
      if (typeof where === "object" && where !== null) filter.$where = where
      return filter
    } catch {
      return {}
    }
  }

  const decode = (params: URLSearchParams): PageUrlState<FilterValues<S>> => {
    const filter: Record<string, unknown> = {}
    for (const [key, field] of fields) {
      const text = params.get(name(key))
      if (text === null) continue
      const value = decodeField(field, text)
      if (value !== undefined) filter[key] = value
    }
    const packed = params.get(encoded)
    if (packed !== null) Object.assign(filter, decodeEncoded(packed))
    const pageNumber = Number(params.get(page) ?? "1")
    const sizeNumber = Number(params.get(size) ?? String(defaultSize))
    const state: PageUrlState<FilterValues<S>> = {
      filter: filter as FilterValues<S>,
      sort: decodeSort(params.get(sort)) ?? [...defaultSort],
      page: Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1,
      size: Number.isInteger(sizeNumber) && sizeNumber > 0 ? sizeNumber : defaultSize,
    }
    const at = params.get(cursor)
    if (at !== null && at !== "") state.cursor = at
    return state
  }

  return {
    encode,
    decode,
    merge(current, state) {
      const next = new URLSearchParams()
      for (const [key, value] of current) if (!owned.has(key)) next.append(key, value)
      for (const [key, value] of encode(state)) next.append(key, value)
      return next
    },
    owns: (param) => owned.has(param),
  }
}

export { createUrlCodec }
export type { PageUrlState, UrlCodec, UrlCodecOptions }
