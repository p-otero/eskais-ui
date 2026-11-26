import {
  appendParams,
  cursorPositionOf,
  HttpError,
  pageNumberOf,
  restCallOf,
  writeSort,
  type PageResult,
  type PageSource,
  type ParamsInit,
  type RestCall,
  type SortStyle,
} from "@/lib/page-source"
import { assumeType } from "@/lib/narrow"

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
        page = pageNumberOf(request)
        params.set(pageParam, String(page - 1 + base))
      } else url = cursorPositionOf(request).cursor
      const response = await options.request({ ...restCallOf(request, context, params), url })
      const { headers, body } = await bodyOf(response)
      const items = options.read ? options.read(body) : body
      if (!Array.isArray(items)) throw new TypeError("linkHeaderSource expected an array body; pass `read`.")
      const links = parseLinkHeader(headers.get("link"))
      const result: PageResult<T> = {
        // Workaround: the body (or what `read` returned) is checked as an array above; its items are typed by the source's `T`.
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

export { linkHeaderSource, parseLinkHeader }
export type { LinkHeaderCall, LinkHeaderResponse, LinkHeaderSourceOptions, LinkRelations }
