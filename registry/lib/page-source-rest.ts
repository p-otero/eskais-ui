import {
  appendParams,
  isPagePosition,
  writeSort,
  type PageRequest,
  type PageResult,
  type PageSource,
  type ParamsInit,
  type SortStyle,
  type SourceCapabilities,
  type SourceContext,
} from "@/lib/page-source"

/** What an adapter hands your `request`: the query to send, and the request it came from. */
type RestCall<F> = {
  params: URLSearchParams
  /** `params` as a query string, without the `?`. */
  query: string
  request: PageRequest<F>
  signal: AbortSignal
}

type RestSourceOptions<T, F, Raw> = {
  key: readonly unknown[]
  getId: (item: T) => string
  /** Sends the call: `fetch(\`/api/tasks?${call.query}\`, { signal: call.signal }).then(readJson)`. */
  request: (call: RestCall<F>) => Promise<Raw>
  /** The filter as query params, usually a serializer's output. */
  params?: (filter: F) => ParamsInit
  sortStyle?: SortStyle
  sortParam?: string
  maxPageSize?: number
  /** Whether responses carry an exact total. Default `"exact"`. */
  total?: SourceCapabilities["total"]
  fetchTotal?: (filter: F, context: SourceContext) => Promise<number>
}

function pageOf<F>(request: PageRequest<F>) {
  if (!isPagePosition(request.position)) throw new TypeError("This source pages by number; it got a cursor.")
  return Math.max(1, Math.trunc(request.position.page))
}

function callOf<F>(request: PageRequest<F>, context: SourceContext, params: URLSearchParams): RestCall<F> {
  return { params, query: params.toString(), request, signal: context.signal }
}

function baseParams<T, F, Raw>(options: RestSourceOptions<T, F, Raw>, request: PageRequest<F>) {
  const params = appendParams(new URLSearchParams(), options.params?.(request.filter))
  writeSort(params, request.sort, options.sortStyle, options.sortParam)
  return params
}

function asResult<T>(raw: unknown, where: string): PageResult<T> {
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { items?: unknown }).items))
    throw new TypeError(`${where} expected { items, total? }; pass \`read\` to map your response.`)
  return raw as PageResult<T>
}

// Without a total, a full page is taken to mean there may be more; a short one is the last.
function withPaging<T>(result: PageResult<T>, page: number, size: number): PageResult<T> {
  const total = result.total ?? result.totalEstimate
  return {
    ...result,
    hasMore: result.hasMore ?? (total === undefined ? result.items.length >= size : page * size < total),
    hasPrevious: result.hasPrevious ?? page > 1,
  }
}

function source<T, F>(
  options: RestSourceOptions<T, F, unknown>,
  capabilities: SourceCapabilities,
  fetchPage: PageSource<T, F>["fetchPage"],
): PageSource<T, F> {
  return {
    key: options.key,
    getId: options.getId,
    capabilities,
    fetchPage,
    ...(options.fetchTotal ? { fetchTotal: options.fetchTotal } : {}),
  }
}

type PagedSourceOptions<T, F, Raw> = RestSourceOptions<T, F, Raw> & {
  /** The first page's number on the wire. Default 1. */
  base?: 0 | 1
  pageParam?: string
  sizeParam?: string
  /** Maps the response; by default it must be `{ items, total?, hasMore? }`. */
  read?: (raw: Raw, request: PageRequest<F>) => PageResult<T>
}

/** `?page=2&size=25`, 1-based unless `base: 0`. */
function pagedSource<T, F = unknown, Raw = PageResult<T>>(options: PagedSourceOptions<T, F, Raw>): PageSource<T, F> {
  const { base = 1, pageParam = "page", sizeParam = "size" } = options
  return source(
    options as RestSourceOptions<T, F, unknown>,
    { position: "page", total: options.total ?? "exact", maxPageSize: options.maxPageSize },
    async (request, context) => {
      const page = pageOf(request)
      const params = baseParams(options, request)
      params.set(pageParam, String(page - 1 + base))
      params.set(sizeParam, String(request.size))
      const raw = await options.request(callOf(request, context, params))
      const result = options.read ? options.read(raw, request) : asResult<T>(raw, "pagedSource")
      return withPaging(result, page, request.size)
    },
  )
}

type OffsetSourceOptions<T, F, Raw> = RestSourceOptions<T, F, Raw> & {
  offsetParam?: string
  limitParam?: string
  read?: (raw: Raw, request: PageRequest<F>) => PageResult<T>
}

/** `?offset=20&limit=20`: the page number becomes an offset. */
function offsetSource<T, F = unknown, Raw = PageResult<T>>(options: OffsetSourceOptions<T, F, Raw>): PageSource<T, F> {
  const { offsetParam = "offset", limitParam = "limit" } = options
  return source(
    options as RestSourceOptions<T, F, unknown>,
    { position: "page", total: options.total ?? "exact", maxPageSize: options.maxPageSize },
    async (request, context) => {
      const page = pageOf(request)
      const params = baseParams(options, request)
      params.set(offsetParam, String((page - 1) * request.size))
      params.set(limitParam, String(request.size))
      const raw = await options.request(callOf(request, context, params))
      const result = options.read ? options.read(raw, request) : asResult<T>(raw, "offsetSource")
      return withPaging(result, page, request.size)
    },
  )
}

/** Spring Data's `Page<T>` as JSON, or the `PagedModel` that `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)` writes. */
type SpringPage<T> = {
  content: T[]
  totalElements?: number
  totalPages?: number
  number?: number
  size?: number
  first?: boolean
  last?: boolean
  page?: { size: number; number: number; totalElements: number; totalPages: number }
}

/** Spring Data's `Slice<T>`: no count query, only whether another slice follows. */
type SpringSlice<T> = {
  content: T[]
  number?: number
  size?: number
  first?: boolean
  last?: boolean
  hasNext?: boolean
}

type SpringSourceOptions<T, F, Raw> = Omit<RestSourceOptions<T, F, Raw>, "sortStyle" | "total"> & {
  /** Where the page sits in your response, when it isn't the body itself. */
  select?: (raw: Raw) => SpringPage<T>
}

function springContent<T>(raw: unknown, where: string): SpringPage<T> {
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as { content?: unknown }).content))
    throw new TypeError(`${where} expected a Spring page with \`content\`; pass \`select\` to find it.`)
  return raw as SpringPage<T>
}

function springParams<T, F, Raw>(options: SpringSourceOptions<T, F, Raw>, request: PageRequest<F>) {
  const params = appendParams(new URLSearchParams(), options.params?.(request.filter))
  writeSort(params, request.sort, "comma", options.sortParam)
  params.set("page", String(pageOf(request) - 1))
  params.set("size", String(request.size))
  return params
}

/** Spring Data REST and `Pageable` controllers: `?page=0&size=25&sort=name,asc`, read from `Page<T>` or `PagedModel`. */
function springPageSource<T, F = unknown, Raw = SpringPage<T>>(
  options: SpringSourceOptions<T, F, Raw>,
): PageSource<T, F> {
  return source(
    options as RestSourceOptions<T, F, unknown>,
    { position: "page", total: "exact", maxPageSize: options.maxPageSize },
    async (request, context) => {
      const raw = await options.request(callOf(request, context, springParams(options, request)))
      const page = options.select ? options.select(raw) : springContent<T>(raw, "springPageSource")
      const total = page.page?.totalElements ?? page.totalElements
      const number = page.page?.number ?? page.number ?? pageOf(request) - 1
      const totalPages = page.page?.totalPages ?? page.totalPages
      return {
        items: page.content,
        total,
        hasMore: page.last === undefined ? totalPages !== undefined && number + 1 < totalPages : !page.last,
        hasPrevious: page.first === undefined ? number > 0 : !page.first,
      }
    },
  )
}

/** A Spring `Slice<T>`: previous and next only, since it has no total. */
function springSliceSource<T, F = unknown, Raw = SpringSlice<T>>(
  options: Omit<SpringSourceOptions<T, F, Raw>, "select"> & { select?: (raw: Raw) => SpringSlice<T> },
): PageSource<T, F> {
  return source(
    options as RestSourceOptions<T, F, unknown>,
    { position: "page", total: "none", maxPageSize: options.maxPageSize },
    async (request, context) => {
      const raw = await options.request(callOf(request, context, springParams(options, request)))
      const slice = options.select
        ? options.select(raw)
        : (springContent<T>(raw, "springSliceSource") as SpringSlice<T>)
      const number = slice.number ?? pageOf(request) - 1
      return {
        items: slice.content,
        hasMore: slice.hasNext ?? (slice.last === undefined ? slice.content.length >= request.size : !slice.last),
        hasPrevious: slice.first === undefined ? number > 0 : !slice.first,
      }
    },
  )
}

export { offsetSource, pagedSource, springPageSource, springSliceSource }
export type {
  OffsetSourceOptions,
  PagedSourceOptions,
  RestCall,
  RestSourceOptions,
  SpringPage,
  SpringSlice,
  SpringSourceOptions,
}
