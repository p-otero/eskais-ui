import {
  adapterSource,
  appendParams,
  pageNumberOf,
  restCallOf,
  writeSort,
  type PageRequest,
  type PageResult,
  type PageSource,
  type RestSourceOptions,
} from "@/lib/page-source"
import { assumeType, isRecord } from "@/lib/narrow"

function baseParams<T, F, Raw>(options: RestSourceOptions<T, F, Raw>, request: PageRequest<F>) {
  const params = appendParams(new URLSearchParams(), options.params?.(request.filter))
  writeSort(params, request.sort, options.sortStyle, options.sortParam)
  return params
}

function asResult<T>(raw: unknown, where: string): PageResult<T> {
  if (!isRecord(raw) || !Array.isArray(raw.items))
    throw new TypeError(`${where} expected { items, total? }; pass \`read\` to map your response.`)
  // Workaround: the envelope is checked above; its items are the server's, typed by the source's `T`.
  return assumeType<PageResult<T>>(raw)
}

function withPaging<T>(result: PageResult<T>, page: number, size: number): PageResult<T> {
  const total = result.total ?? result.totalEstimate
  return {
    ...result,
    hasMore: result.hasMore ?? (total === undefined ? result.items.length >= size : page * size < total),
    hasPrevious: result.hasPrevious ?? page > 1,
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
  return adapterSource(
    options,
    { position: "page", total: options.total ?? "exact", maxPageSize: options.maxPageSize },
    async (request, context) => {
      const page = pageNumberOf(request)
      const params = baseParams(options, request)
      params.set(pageParam, String(page - 1 + base))
      params.set(sizeParam, String(request.size))
      const raw = await options.request(restCallOf(request, context, params))
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
  return adapterSource(
    options,
    { position: "page", total: options.total ?? "exact", maxPageSize: options.maxPageSize },
    async (request, context) => {
      const page = pageNumberOf(request)
      const params = baseParams(options, request)
      params.set(offsetParam, String((page - 1) * request.size))
      params.set(limitParam, String(request.size))
      const raw = await options.request(restCallOf(request, context, params))
      const result = options.read ? options.read(raw, request) : asResult<T>(raw, "offsetSource")
      return withPaging(result, page, request.size)
    },
  )
}

export { offsetSource, pagedSource }
export type { OffsetSourceOptions, PagedSourceOptions }
