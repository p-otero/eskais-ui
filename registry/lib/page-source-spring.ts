import {
  adapterSource,
  appendParams,
  pageNumberOf,
  restCallOf,
  writeSort,
  type PageRequest,
  type PageSource,
  type RestSourceOptions,
} from "@/lib/page-source"
import { assumeType, isRecord } from "@/lib/narrow"

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
  if (!isRecord(raw) || !Array.isArray(raw.content))
    throw new TypeError(`${where} expected a Spring page with \`content\`; pass \`select\` to find it.`)
  // Workaround: the envelope is checked above; its content is the server's, typed by the source's `T`.
  return assumeType<SpringPage<T>>(raw)
}

function springParams<T, F, Raw>(options: SpringSourceOptions<T, F, Raw>, request: PageRequest<F>) {
  const params = appendParams(new URLSearchParams(), options.params?.(request.filter))
  writeSort(params, request.sort, "comma", options.sortParam)
  params.set("page", String(pageNumberOf(request) - 1))
  params.set("size", String(request.size))
  return params
}

/** Spring Data REST and `Pageable` controllers: `?page=0&size=25&sort=name,asc`, read from `Page<T>` or `PagedModel`. */
function springPageSource<T, F = unknown, Raw = SpringPage<T>>(
  options: SpringSourceOptions<T, F, Raw>,
): PageSource<T, F> {
  return adapterSource(
    options,
    { position: "page", total: "exact", maxPageSize: options.maxPageSize },
    async (request, context) => {
      const raw = await options.request(restCallOf(request, context, springParams(options, request)))
      const page = options.select ? options.select(raw) : springContent<T>(raw, "springPageSource")
      const total = page.page?.totalElements ?? page.totalElements
      const number = page.page?.number ?? page.number ?? pageNumberOf(request) - 1
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
  return adapterSource(
    options,
    { position: "page", total: "none", maxPageSize: options.maxPageSize },
    async (request, context) => {
      const raw = await options.request(restCallOf(request, context, springParams(options, request)))
      const slice = options.select
        ? options.select(raw)
        : (springContent<T>(raw, "springSliceSource") as SpringSlice<T>)
      const number = slice.number ?? pageNumberOf(request) - 1
      return {
        items: slice.content,
        hasMore: slice.hasNext ?? (slice.last === undefined ? slice.content.length >= request.size : !slice.last),
        hasPrevious: slice.first === undefined ? number > 0 : !slice.first,
      }
    },
  )
}

export { springPageSource, springSliceSource }
export type { SpringPage, SpringSlice, SpringSourceOptions }
