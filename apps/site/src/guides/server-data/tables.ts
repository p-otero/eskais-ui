const styles = [
  [
    "Page and size, limit and offset",
    "Page numbers, Showing 21–40 of 312",
    "Jump to any page; easy to cache and share",
    "Rows drift when others insert; a COUNT per query; deep pages are slow",
    "pagedSource({ base }), offsetSource",
    "page-source-rest",
  ],
  [
    "Cursor or keyset",
    "Load more, or infinite",
    "Stable and fast at any depth",
    "No jump to page N; needs a unique, ordered key",
    "cursorSource (opaque, or keyset)",
    "page-source-cursor",
  ],
  [
    "Relay",
    "Load more, or previous and next",
    "Cursors plus pageInfo and an optional totalCount",
    "Same as cursors",
    "relaySource",
    "page-source-relay",
  ],
  [
    "Link header (RFC 8288)",
    "Previous and next, about N from last",
    "Navigation the server already wrote",
    "A total only on the last page",
    "linkHeaderSource",
    "page-source-link",
  ],
  [
    "Spring Page and Slice",
    "Page numbers (Page), previous and next (Slice)",
    "Pageable controllers as they are",
    "Page runs a count query; Slice has no total",
    "springPageSource, springSliceSource",
    "page-source-spring",
  ],
]

const formats = [
  [
    "Flat params (DTO, suffix, bracket)",
    "and only",
    "A request DTO, json-server, Django filters",
    "queryParams",
    "URL-friendly; refuses or",
    "filter-schema",
  ],
  [
    "RSQL / FIQL",
    "and, or, nesting",
    "rsql-jpa-specification, many Java and .NET APIs",
    "rsql",
    "Compact; quoted, escaped arguments",
    "filter-rsql",
  ],
  [
    "OData $filter",
    "the full grammar",
    "ASP.NET OData, SAP, Dynamics",
    "odata",
    "Verbose; dates unquoted",
    "filter-odata",
  ],
  [
    "Spring Filter",
    "and, or, not",
    "turkraft/springfilter",
    "springFilter",
    "Java only; refuses wildcards in text",
    "filter-spring",
  ],
  [
    "JSON AST",
    "the full grammar",
    "A POST body for any backend",
    "jsonAst",
    "Safest: nothing to escape",
    "filter-schema",
  ],
  [
    "GraphQL where",
    "typed, nested",
    "Hasura, Prisma",
    "graphqlWhere",
    "Goes in variables, never in the query",
    "filter-graphql",
  ],
  ["q only", "free text", "A search endpoint", "searchOnly", "Ignores every other field", "filter-schema"],
]

const navigation = [
  ["An exact total (or fetchTotal)", "Page numbers and Showing 21–40 of 312"],
  ["totalEstimate", "Previous and next, Showing 21–40 of about 300"],
  ["Only hasMore", "Previous and next, Showing 21–40"],
  ["A cursor", 'Load more, or infinite with navigation="infinite"'],
]

export { formats, navigation, styles }
