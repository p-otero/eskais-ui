import {
  appendParams,
  HttpError,
  isPagePosition,
  writeSort,
  type PageRequest,
  type PageResult,
  type PageSource,
  type ParamsInit,
  type SortStyle,
  type SourceContext,
} from "@/lib/page-source"
import type { RestCall } from "@/lib/page-source-rest"
import { assumeType } from "@/lib/narrow"

type CursorPosition = { cursor: string | null; direction: "forward" | "backward" }

function cursorOf<F>(request: PageRequest<F>): CursorPosition {
  if (isPagePosition(request.position)) throw new TypeError("This source pages by cursor; it got a page number.")
  return request.position
}

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
  return {
    key: options.key,
    getId: options.getId,
    capabilities: { position: "cursor", total: "none", maxPageSize: options.maxPageSize },
    async fetchPage(request, context) {
      const position = cursorOf(request)
      const params = appendParams(new URLSearchParams(), options.params?.(request.filter))
      writeSort(params, request.sort, options.sortStyle, options.sortParam)
      if (position.cursor !== null)
        params.set(position.direction === "forward" ? afterParam : beforeParam, position.cursor)
      params.set(sizeParam, String(keyset ? request.size + 1 : request.size))
      const raw = await options.request({ params, query: params.toString(), request, signal: context.signal })
      // Without `read` the body is the page: its `items` is checked below, and they are typed by the source's `T`.
      const result = options.read ? options.read(raw, request) : assumeType<PageResult<T>>(raw)
      if (!Array.isArray(result.items)) throw new TypeError("cursorSource expected { items }; pass `read`.")
      if (keyset) return keysetResult(result.items, request.size, position, keyset.cursor)
      return { ...result, hasMore: result.hasMore ?? (result.nextCursor ?? null) !== null }
    },
    ...(options.fetchTotal ? { fetchTotal: options.fetchTotal } : {}),
  }
}

/** A GraphQL connection as the Relay spec defines it. */
type RelayConnection<T> = {
  edges?: readonly ({ node: T; cursor?: string } | null)[] | null
  nodes?: readonly T[] | null
  pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean; startCursor?: string | null; endCursor?: string | null }
  totalCount?: number | null
}

type RelayVariables = { first?: number; after?: string; last?: number; before?: string }

type RelayCall<F> = { variables: RelayVariables; request: PageRequest<F>; signal: AbortSignal }

type RelaySourceOptions<T, F, Raw> = {
  key: readonly unknown[]
  getId: (item: T) => string
  /** Runs the query with `variables` (`first`/`after` forward, `last`/`before` backward) and your filter and sort. */
  request: (call: RelayCall<F>) => Promise<Raw>
  /** Where the connection sits in the response: `(data) => data.repository.issues`. */
  connection?: (raw: Raw) => RelayConnection<T>
  maxPageSize?: number
  /** `"exact"` when the connection has `totalCount`. Default `"none"`. */
  total?: "exact" | "none"
  fetchTotal?: (filter: F, context: SourceContext) => Promise<number>
}

/** `first`/`after` and `last`/`before` over `edges` and `pageInfo`, with `totalCount` when the schema has one. */
function relaySource<T, F = unknown, Raw = RelayConnection<T>>(
  options: RelaySourceOptions<T, F, Raw>,
): PageSource<T, F> {
  return {
    key: options.key,
    getId: options.getId,
    capabilities: { position: "cursor", total: options.total ?? "none", maxPageSize: options.maxPageSize },
    async fetchPage(request, context) {
      const position = cursorOf(request)
      const variables: RelayVariables =
        position.direction === "forward"
          ? { first: request.size, ...(position.cursor === null ? {} : { after: position.cursor }) }
          : { last: request.size, ...(position.cursor === null ? {} : { before: position.cursor }) }
      const raw = await options.request({ variables, request, signal: context.signal })
      // Without `connection` the body is the connection: its `pageInfo` is checked below, its nodes typed by `T`.
      const connection = options.connection ? options.connection(raw) : assumeType<RelayConnection<T>>(raw)
      if (typeof connection !== "object" || connection === null || typeof connection.pageInfo !== "object")
        throw new TypeError("relaySource expected a connection with `pageInfo`; pass `connection` to find it.")
      const items = connection.edges
        ? connection.edges.flatMap((edge) => (edge ? [edge.node] : []))
        : [...(connection.nodes ?? [])]
      const { pageInfo } = connection
      return {
        items,
        ...(typeof connection.totalCount === "number" ? { total: connection.totalCount } : {}),
        hasMore: pageInfo.hasNextPage,
        hasPrevious: pageInfo.hasPreviousPage,
        nextCursor: pageInfo.hasNextPage ? (pageInfo.endCursor ?? null) : null,
        prevCursor: pageInfo.hasPreviousPage ? (pageInfo.startCursor ?? null) : null,
      }
    },
    ...(options.fetchTotal ? { fetchTotal: options.fetchTotal } : {}),
  }
}

type LinkRelations = Record<string, string>

// Spec: RFC 8288: `<uri>; rel="next last"; title="x", <uri>; rel=prev`. A URI may hold commas and semicolons; parameter
// values may be quoted, with backslash escapes. Relation names are case-insensitive and one link may carry several.
function parseLinkHeader(header: string | null | undefined): LinkRelations {
  const links: LinkRelations = {}
  if (!header) return links
  let index = 0
  const length = header.length
  while (index < length) {
    const open = header.indexOf("<", index)
    if (open === -1) break
    const close = header.indexOf(">", open + 1)
    if (close === -1) break
    const uri = header.slice(open + 1, close).trim()
    index = close + 1
    const relations: string[] = []
    while (index < length) {
      while (index < length && /\s/.test(header.charAt(index))) index++
      if (header.charAt(index) !== ";") break
      index++
      const nameMatch = /^\s*([^\s=;,]+)\s*/.exec(header.slice(index))
      if (!nameMatch) break
      const name = (nameMatch[1] ?? "").toLowerCase()
      index += nameMatch[0].length
      let value = ""
      if (header.charAt(index) === "=") {
        index++
        while (index < length && /\s/.test(header.charAt(index))) index++
        if (header.charAt(index) === '"') {
          index++
          while (index < length && header.charAt(index) !== '"') {
            if (header.charAt(index) === "\\") index++
            value += header.charAt(index)
            index++
          }
          index++
        } else {
          const token = /^[^;,\s]*/.exec(header.slice(index))?.[0] ?? ""
          value = token
          index += token.length
        }
      }
      if (name === "rel") relations.push(...value.toLowerCase().split(/\s+/).filter(Boolean))
    }
    for (const relation of relations) links[relation] ??= uri
    const comma = header.indexOf(",", index)
    if (comma === -1) break
    index = comma + 1
  }
  return links
}

type LinkHeaderResponse = Response | { headers: Headers | { get(name: string): string | null }; body: unknown }

type LinkHeaderCall<F> = RestCall<F> & {
  /** The `next` or `prev` link to follow, in cursor mode; null for the first page. */
  url: string | null
}

type LinkHeaderSourceOptions<T, F> = {
  key: readonly unknown[]
  getId: (item: T) => string
  /** Fetches `call.url` when set, or your endpoint with `call.query`; return the `Response` itself. */
  request: (call: LinkHeaderCall<F>) => Promise<LinkHeaderResponse>
  /** The rows in the body. Default: the body, which must be an array. */
  read?: (body: unknown) => T[]
  params?: (filter: F) => ParamsInit
  sortStyle?: SortStyle
  sortParam?: string
  /** `"page"` (default) sends page numbers and reads them back from the links; `"cursor"` follows the links. */
  position?: "page" | "cursor"
  pageParam?: string
  sizeParam?: string
  base?: 0 | 1
  maxPageSize?: number
}

function pageInLink(link: string | undefined, pageParam: string) {
  if (link === undefined) return undefined
  const query = link.includes("?") ? link.slice(link.indexOf("?") + 1).split("#")[0] : ""
  const value = new URLSearchParams(query).get(pageParam)
  const page = value === null ? Number.NaN : Number(value)
  return Number.isInteger(page) ? page : undefined
}

async function bodyOf(response: LinkHeaderResponse) {
  if (typeof Response !== "undefined" && response instanceof Response) {
    if (!response.ok) throw new HttpError(response.status, response.statusText || undefined, response)
    return { headers: response.headers, body: (await response.json()) as unknown }
  }
  return response as Exclude<LinkHeaderResponse, Response>
}

/**
 * Paging from an RFC 8288 `Link` header, as GitHub and many REST APIs send it. With a `last` link on another page,
 * the total is an estimate (whole pages); on the last page it is exact.
 */
function linkHeaderSource<T, F = unknown>(options: LinkHeaderSourceOptions<T, F>): PageSource<T, F> {
  const { position = "page", pageParam = "page", sizeParam = "per_page", base = 1 } = options
  return {
    key: options.key,
    getId: options.getId,
    capabilities: { position, total: position === "page" ? "estimate" : "none", maxPageSize: options.maxPageSize },
    async fetchPage(request, context) {
      const params = appendParams(new URLSearchParams(), options.params?.(request.filter))
      writeSort(params, request.sort, options.sortStyle, options.sortParam)
      params.set(sizeParam, String(request.size))
      let url: string | null = null
      let page = 1
      if (position === "page") {
        if (!isPagePosition(request.position)) throw new TypeError("This source pages by number; it got a cursor.")
        page = Math.max(1, Math.trunc(request.position.page))
        params.set(pageParam, String(page - 1 + base))
      } else url = cursorOf(request).cursor
      const response = await options.request({ params, query: params.toString(), request, signal: context.signal, url })
      const { headers, body } = await bodyOf(response)
      const items = options.read ? options.read(body) : body
      if (!Array.isArray(items)) throw new TypeError("linkHeaderSource expected an array body; pass `read`.")
      const links = parseLinkHeader(headers.get("link"))
      const result: PageResult<T> = {
        // The body (or what `read` returned) is checked as an array above; its items are typed by the source's `T`.
        items: assumeType<T[]>(items),
        hasMore: links.next !== undefined,
        hasPrevious: links.prev !== undefined || links.previous !== undefined,
      }
      if (position === "cursor")
        return { ...result, nextCursor: links.next ?? null, prevCursor: links.prev ?? links.previous ?? null }
      const lastPage = pageInLink(links.last, pageParam)
      if (links.next === undefined) return { ...result, total: (page - 1) * request.size + items.length }
      if (lastPage !== undefined) return { ...result, totalEstimate: (lastPage - base + 1) * request.size }
      return result
    },
  }
}

export { cursorSource, linkHeaderSource, parseLinkHeader, relaySource }
export type {
  CursorSourceOptions,
  LinkHeaderCall,
  LinkHeaderResponse,
  LinkHeaderSourceOptions,
  LinkRelations,
  RelayCall,
  RelayConnection,
  RelaySourceOptions,
  RelayVariables,
}
