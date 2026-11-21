import {
  abortError,
  isPagePosition,
  type PageRequest,
  type PageResult,
  type PageSource,
  type SortSpec,
  type SourceCapabilities,
} from "@/lib/page-source"
import { isRecord } from "@/lib/narrow"

type ArraySortValue = string | number | bigint | boolean | Date | null | undefined

type ArraySourceOptions<T, F> = {
  /** Default `["array-source", n]`, one per source. Pass your own to invalidate it by name. */
  key?: readonly unknown[]
  /** Default: the item's `id`, as a string. */
  getId?: (item: T) => string
  /** Keeps an item for the request's filter. */
  filter?: (item: T, filter: F) => boolean
  /** Free-text search: `fields` read from each item, matched case-insensitively against `filter[param]` (`"q"`). */
  search?: { fields: readonly (keyof T & string)[]; param?: string } | ((item: T, filter: F) => boolean)
  /** Sort values by field; any other field sorts by the item's property of that name. */
  sort?: Readonly<Record<string, (item: T) => ArraySortValue>>
  /** `"page"` (default) or `"cursor"`, to try cursor paging. */
  position?: SourceCapabilities["position"]
  /** What totals to report: `"exact"` (default), `"estimate"` (rounded up to tens) or `"none"` (only `hasMore`). */
  total?: "exact" | "estimate" | "none"
  maxPageSize?: number
  /** Simulated latency in ms. Default 0. */
  delay?: number | ((request: PageRequest<F>) => number)
  /** Return an error to fail that request: `(request, call) => call % 3 === 2 ? new Error("Flaky") : undefined`. */
  fail?: (request: PageRequest<F>, call: number) => unknown
  /** Adds a separate `fetchTotal`, with its own latency. */
  count?: { delay?: number }
}

let sources = 0

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

function compareValues(a: ArraySortValue, b: ArraySortValue) {
  const missingA = a === null || a === undefined
  const missingB = b === null || b === undefined
  if (missingA || missingB) return missingA === missingB ? 0 : missingA ? 1 : -1
  if (typeof a === "string" && typeof b === "string") return collator.compare(a, b)
  const left = a instanceof Date ? a.getTime() : a
  const right = b instanceof Date ? b.getTime() : b
  if (left === right) return 0
  return lessThan(left, right) ? -1 : 1
}

// `<` on mixed primitives compares them as numbers, which TypeScript only allows on numbers, bigints or two strings.
function lessThan(left: string | number | bigint | boolean, right: string | number | bigint | boolean) {
  if (typeof left === "bigint" && typeof right === "bigint") return left < right
  return Number(left) < Number(right)
}

function asSortValue(value: unknown): ArraySortValue {
  if (value === null || value === undefined || value instanceof Date) return value
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean")
    return value
  return String(value)
}

function defaultId(item: unknown) {
  if (typeof item === "object" && item !== null && "id" in item) return String((item as { id: unknown }).id)
  return String(item)
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(abortError(signal))
    if (ms <= 0) return resolve()
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError(signal))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

/** An in-memory `PageSource` for demos, tests and mockups: filters, searches, sorts and pages an array. */
function arraySource<T, F = Record<string, unknown>>(
  items: readonly T[],
  options: ArraySourceOptions<T, F> = {},
): PageSource<T, F> {
  const { getId = defaultId, position = "page", total = "exact" } = options
  const key = options.key ?? ["array-source", ++sources]
  let calls = 0

  const sortValue = (field: string) =>
    options.sort?.[field] ?? ((item: T) => asSortValue(isRecord(item) ? item[field] : undefined))

  const matches = (item: T, filter: F) => {
    if (options.filter && !options.filter(item, filter)) return false
    const search = options.search
    if (search === undefined) return true
    if (typeof search === "function") return search(item, filter)
    const text = isRecord(filter) ? filter[search.param ?? "q"] : undefined
    if (typeof text !== "string" || text.trim() === "") return true
    const needle = text.trim().toLocaleLowerCase()
    return search.fields.some((field) =>
      String(item[field] ?? "")
        .toLocaleLowerCase()
        .includes(needle),
    )
  }

  const select = (filter: F, sort: readonly SortSpec[]) => {
    const kept = items.filter((item) => matches(item, filter))
    if (sort.length === 0) return kept
    const readers = sort.map((spec) => ({ read: sortValue(spec.field), sign: spec.direction === "desc" ? -1 : 1 }))
    return kept
      .map((item, index) => ({ item, index }))
      .toSorted((a, b) => {
        for (const { read, sign } of readers) {
          const left = read(a.item)
          const right = read(b.item)
          // Missing values stay last in both directions.
          const missing = left === null || left === undefined || right === null || right === undefined
          const order = missing ? compareValues(left, right) : sign * compareValues(left, right)
          if (order !== 0) return order
        }
        return a.index - b.index
      })
      .map((entry) => entry.item)
  }

  const settle = async (request: PageRequest<F>, signal: AbortSignal) => {
    const call = calls++
    const ms = typeof options.delay === "function" ? options.delay(request) : (options.delay ?? 0)
    await wait(ms, signal)
    const error = options.fail?.(request, call)
    if (error !== undefined && error !== null) throw error
  }

  const source: PageSource<T, F> = {
    key,
    getId,
    capabilities: { position, total, maxPageSize: options.maxPageSize },
    async fetchPage(request, { signal }) {
      await settle(request, signal)
      const rows = select(request.filter, request.sort)
      const size = Math.max(1, request.size)
      let start: number
      if (isPagePosition(request.position)) start = (Math.max(1, request.position.page) - 1) * size
      else {
        const at = request.position.cursor === null ? Number.NaN : Number(request.position.cursor)
        if (request.position.direction === "forward") start = Number.isInteger(at) ? at : 0
        else start = Number.isInteger(at) ? Math.max(0, at - size) : Math.max(0, rows.length - size)
      }
      const end = Math.min(rows.length, start + size)
      const result: PageResult<T> = {
        items: rows.slice(start, end),
        hasMore: end < rows.length,
        hasPrevious: start > 0,
      }
      if (!isPagePosition(request.position)) {
        result.nextCursor = end < rows.length ? String(end) : null
        result.prevCursor = start > 0 ? String(start) : null
      }
      if (total === "exact" && options.count === undefined) result.total = rows.length
      if (total === "estimate") result.totalEstimate = Math.ceil(rows.length / 10) * 10
      return result
    },
  }
  if (options.count) {
    const countDelay = options.count.delay ?? 0
    source.fetchTotal = async (filter, { signal }) => {
      await wait(countDelay, signal)
      return select(filter, []).length
    }
  }
  return source
}

export { arraySource }
export type { ArraySortValue, ArraySourceOptions }
