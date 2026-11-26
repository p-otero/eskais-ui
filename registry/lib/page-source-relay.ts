import {
  adapterSource,
  cursorPositionOf,
  type PageRequest,
  type PageSource,
  type SourceContext,
} from "@/lib/page-source"
import { assumeType } from "@/lib/narrow"

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
  return adapterSource(
    options,
    { position: "cursor", total: options.total ?? "none", maxPageSize: options.maxPageSize },
    async (request, context) => {
      const position = cursorPositionOf(request)
      const variables: RelayVariables =
        position.direction === "forward"
          ? { first: request.size, ...(position.cursor === null ? {} : { after: position.cursor }) }
          : { last: request.size, ...(position.cursor === null ? {} : { before: position.cursor }) }
      const raw = await options.request({ variables, request, signal: context.signal })
      // Workaround: without `connection` the body is the connection: its `pageInfo` is checked below, its nodes typed by `T`.
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
  )
}

export { relaySource }
export type { RelayCall, RelayConnection, RelaySourceOptions, RelayVariables }
