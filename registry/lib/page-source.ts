type SortDirection = "asc" | "desc"

type SortSpec = { field: string; direction: SortDirection }

type PagePosition = { page: number } | { cursor: string | null; direction: "forward" | "backward" }

type PageRequest<F> = {
  filter: F
  sort: readonly SortSpec[]
  size: number
  position: PagePosition
}

type PageResult<T> = {
  items: T[]
  total?: number
  totalEstimate?: number
  hasMore?: boolean
  hasPrevious?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

type SourceContext = { signal: AbortSignal }

type SourceCapabilities = {
  position: "page" | "cursor"
  total?: "exact" | "estimate" | "none"
  maxPageSize?: number
}

type PageSource<T, F = unknown> = {
  /** The query key prefix: every query of this source starts with it, so invalidating it refreshes them all. */
  key: readonly unknown[]
  getId(item: T): string
  capabilities: SourceCapabilities
  fetchPage(request: PageRequest<F>, context: SourceContext): Promise<PageResult<T>>
  /** A count of its own, run as a separate query that never holds back the rows. */
  fetchTotal?(filter: F, context: SourceContext): Promise<number>
}

type Navigation = "pages" | "prev-next" | "load-more" | "infinite"
type NavigationMode = Navigation | "auto"

/** What the source said about the size of the result: exact, estimated or unknown. */
type TotalInfo = { kind: "exact"; value: number } | { kind: "estimate"; value: number } | { kind: "none" }

function isPagePosition(position: PagePosition): position is { page: number } {
  return "page" in position
}

function totalOf(result: PageResult<unknown> | undefined, counted?: number): TotalInfo {
  if (result?.total !== undefined && Number.isFinite(result.total)) return { kind: "exact", value: result.total }
  if (counted !== undefined && Number.isFinite(counted)) return { kind: "exact", value: counted }
  if (result?.totalEstimate !== undefined && Number.isFinite(result.totalEstimate))
    return { kind: "estimate", value: result.totalEstimate }
  return { kind: "none" }
}

/**
 * `"auto"` follows what the source gives: page numbers with an exact total, previous and next with an estimate or
 * only `hasMore`, and load more for a cursor. Before the first result it goes by the declared capabilities.
 */
function resolveNavigation(
  capabilities: SourceCapabilities,
  mode: NavigationMode = "auto",
  total: TotalInfo = { kind: "none" },
): Navigation {
  if (mode !== "auto") return mode
  if (capabilities.position === "cursor") return "load-more"
  if (total.kind === "exact") return "pages"
  if (total.kind === "none" && capabilities.total === "exact") return "pages"
  return "prev-next"
}

function pageCountOf(total: number, size: number) {
  return size > 0 ? Math.max(1, Math.ceil(total / size)) : 1
}

/** Caps a page size at the source's `maxPageSize` and keeps it a positive integer. */
function capPageSize(size: number, capabilities: SourceCapabilities) {
  const whole = Number.isFinite(size) ? Math.max(1, Math.trunc(size)) : 1
  return capabilities.maxPageSize === undefined ? whole : Math.min(whole, capabilities.maxPageSize)
}

function capPageSizes(sizes: readonly number[], capabilities: SourceCapabilities) {
  return [...new Set(sizes.map((size) => capPageSize(size, capabilities)))].toSorted((a, b) => a - b)
}

type PageRange = { from: number; to: number; total: TotalInfo }

type PageStatusLabels = {
  /** "Showing 21–40 of 312", "Showing 21–40 of about 300" or "Showing 21–40". */
  range: (range: PageRange) => string
  empty: string
  loading: string
}

const numberFormat = new Intl.NumberFormat("en-US")

const pageStatusLabels: PageStatusLabels = {
  range: ({ from, to, total }) => {
    const shown = `Showing ${numberFormat.format(from)}–${numberFormat.format(to)}`
    if (total.kind === "exact") return `${shown} of ${numberFormat.format(total.value)}`
    if (total.kind === "estimate") return `${shown} of about ${numberFormat.format(total.value)}`
    return shown
  },
  empty: "No results",
  loading: "Loading…",
}

/** The first and last row shown, 1-based, for the live region. `offset` is how many rows come before the page. */
function pageRange(offset: number, count: number, total: TotalInfo): PageRange | undefined {
  if (count === 0) return undefined
  return { from: offset + 1, to: offset + count, total }
}

type ParamValue = string | number | boolean | null | undefined
type ParamsInit =
  | URLSearchParams
  | Iterable<readonly [string, string]>
  | Readonly<Record<string, ParamValue | readonly ParamValue[]>>

function appendParams(target: URLSearchParams, init: ParamsInit | undefined) {
  if (init === undefined) return target
  const entries: Iterable<readonly [string, unknown]> =
    init instanceof URLSearchParams || Symbol.iterator in init
      ? (init as Iterable<readonly [string, string]>)
      : Object.entries(init)
  for (const [name, value] of entries) {
    for (const item of Array.isArray(value) ? (value as unknown[]) : [value]) {
      if (item === undefined || item === null) continue
      target.append(name, String(item as string | number | boolean))
    }
  }
  return target
}

type SortStyle = "comma" | "dot" | "sign" | ((sort: readonly SortSpec[], params: URLSearchParams) => void)

/**
 * How sort goes on the wire: `"comma"` repeats `sort=name,asc` (Spring), `"dot"` writes `sort=name.asc,id.desc`,
 * `"sign"` writes `sort=name,-id` (JSON:API).
 */
function writeSort(params: URLSearchParams, sort: readonly SortSpec[], style: SortStyle = "comma", name = "sort") {
  if (typeof style === "function") return style(sort, params)
  if (sort.length === 0) return
  if (style === "comma") for (const spec of sort) params.append(name, `${spec.field},${spec.direction}`)
  else if (style === "dot") params.set(name, sort.map((spec) => `${spec.field}.${spec.direction}`).join(","))
  else params.set(name, sort.map((spec) => (spec.direction === "desc" ? `-${spec.field}` : spec.field)).join(","))
}

/** A failed HTTP response. `status` is what DataProvider's retry reads: a 4xx is never retried. */
class HttpError extends Error {
  readonly status: number
  readonly response: Response | undefined

  constructor(status: number, message?: string, response?: Response) {
    super(message ?? `Request failed with status ${String(status)}`)
    this.name = "HttpError"
    this.status = status
    this.response = response
  }
}

/** Reads a response's JSON body, or throws an `HttpError` with its status. */
async function readJson<Raw>(response: Response): Promise<Raw> {
  if (!response.ok) throw new HttpError(response.status, response.statusText || undefined, response)
  return (await response.json()) as Raw
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted.", "AbortError")
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

export {
  abortError,
  appendParams,
  capPageSize,
  capPageSizes,
  HttpError,
  isAbortError,
  isPagePosition,
  pageCountOf,
  pageRange,
  pageStatusLabels,
  readJson,
  resolveNavigation,
  totalOf,
  writeSort,
}
export type {
  Navigation,
  NavigationMode,
  PagePosition,
  PageRange,
  PageRequest,
  PageResult,
  PageSource,
  PageStatusLabels,
  ParamsInit,
  ParamValue,
  SortDirection,
  SortSpec,
  SortStyle,
  SourceCapabilities,
  SourceContext,
  TotalInfo,
}
