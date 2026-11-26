import {
  adapterSource,
  appendParams,
  cursorPositionOf,
  restCallOf,
  writeSort,
  type CursorPosition,
  type PageRequest,
  type PageResult,
  type PageSource,
  type ParamsInit,
  type RestCall,
  type SortStyle,
  type SourceContext,
} from "@/lib/page-source"
import { assumeType } from "@/lib/narrow"

type CursorSourceOptions<T, F, Raw> = {
  key: readonly unknown[]
  getId: (item: T) => string
  request: (call: RestCall<F>) => Promise<Raw>
  params?: (filter: F) => ParamsInit
  sortStyle?: SortStyle
  sortParam?: string
  /** The param a forward cursor goes in. Default `"cursor"`. */
  afterParam?: string
  /** The param a backward cursor goes in. Default `"before"`. */
  beforeParam?: string
  sizeParam?: string
  maxPageSize?: number
  /**
   * Keyset paging: the cursor is built from the last (or first) row's sort key, and one row more than the page is
   * asked for, to know whether another page follows. The server returns a backward page in display order.
   */
  keyset?: { cursor: (item: T) => string }
  /** Maps the response; by default `{ items, nextCursor?, prevCursor?, hasMore?, hasPrevious? }`. */
  read?: (raw: Raw, request: PageRequest<F>) => PageResult<T>
  fetchTotal?: (filter: F, context: SourceContext) => Promise<number>
}

function keysetResult<T>(
  items: T[],
  size: number,
  position: CursorPosition,
  cursor: (item: T) => string,
): PageResult<T> {
  const extra = items.length > size
  const forward = position.direction === "forward"
  const page = extra ? (forward ? items.slice(0, size) : items.slice(items.length - size)) : items
  const first = page[0]
  const last = page.at(-1)
  const hasMore = forward ? extra : true
  const hasPrevious = forward ? position.cursor !== null : extra
  return {
    items: page,
    hasMore,
    hasPrevious,
    nextCursor: hasMore && last !== undefined ? cursor(last) : null,
    prevCursor: hasPrevious && first !== undefined ? cursor(first) : null,
  }
}

/** Opaque cursors from the server (`nextCursor`), or keyset cursors built from the rows with `keyset`. */
function cursorSource<T, F = unknown, Raw = PageResult<T>>(options: CursorSourceOptions<T, F, Raw>): PageSource<T, F> {
  const { afterParam = "cursor", beforeParam = "before", sizeParam = "limit", keyset } = options
  return adapterSource(
    options,
    { position: "cursor", total: "none", maxPageSize: options.maxPageSize },
    async (request, context) => {
      const position = cursorPositionOf(request)
      const params = appendParams(new URLSearchParams(), options.params?.(request.filter))
      writeSort(params, request.sort, options.sortStyle, options.sortParam)
      if (position.cursor !== null)
        params.set(position.direction === "forward" ? afterParam : beforeParam, position.cursor)
      params.set(sizeParam, String(keyset ? request.size + 1 : request.size))
      const raw = await options.request(restCallOf(request, context, params))
      // Workaround: without `read` the body is the page: its `items` is checked below, and they are typed by the source's `T`.
      const result = options.read ? options.read(raw, request) : assumeType<PageResult<T>>(raw)
      if (!Array.isArray(result.items)) throw new TypeError("cursorSource expected { items }; pass `read`.")
      if (keyset) return keysetResult(result.items, request.size, position, keyset.cursor)
      return { ...result, hasMore: result.hasMore ?? (result.nextCursor ?? null) !== null }
    },
  )
}

export { cursorSource }
export type { CursorSourceOptions }
