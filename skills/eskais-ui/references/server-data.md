# Server data

Tables, lists and comboboxes over any backend. Four layers, each its own registry item:

| Layer                 | Item                                                                                                                   | What it is                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Contract and adapters | `page-source`                                                                                                          | `PageSource`, `PageRequest`, `PageResult`; an adapter per paging style; `createPageController`     |
| Filters               | `filter-schema`                                                                                                        | `defineFilters`, `FilterValues`, the canonical AST, serializers, the URL codec, `parseFilterInput` |
| Data layer            | `server-data`                                                                                                          | Hooks on TanStack Query 5 with return types of their own, `DataProvider`                           |
| UI                    | `server-data-table`, `server-list`, `server-combobox`, `filter-search`, `filter-chips`, `filter-panel`, `filter-field` | Components built on the hooks                                                                      |

`url-state` is a router-agnostic URL adapter (`historyUrlState`, `hashUrlState`, `memoryUrlState`, `useUrlState`) that the table uses and other screens can share; `routerUrlState(router)` goes through a `UrlRouter` from `url-router` (`hashRouter()`, `historyRouter()` or your router's own API wrapped in `{ read, navigate, href, subscribe }`), so a router that owns the URL keeps it.

## 1. Wrap the endpoint in a source

Pick the adapter for how the backend pages. Adapters never fetch: they build the call and read the answer.

```ts
import { readJson } from "@/lib/page-source"
import { pagedSource } from "@/lib/page-source-rest"

const tasks = pagedSource<Task, TaskFilter>({
  key: ["tasks"], // every query of this source starts with it
  getId: (task) => task.id,
  base: 1, // 0 for 0-based pages
  params: (filter) => wireParams(filter), // a serializer's output, see 2
  request: ({ query, signal }) => fetch(`/api/tasks?${query}`, { signal }).then(readJson),
  read: (raw) => ({ items: raw.data, total: raw.meta.total }), // when the body isn't { items, total }
})
```

| Backend           | Adapter                                                            | Request                                             | Response read                                          |
| ----------------- | ------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------ |
| `?page=&size=`    | `pagedSource({ base })`                                            | `page`, `size`, `sort`                              | `{ items, total?, hasMore? }` or `read`                |
| `?offset=&limit=` | `offsetSource`                                                     | `offset`, `limit`                                   | same                                                   |
| Opaque cursors    | `cursorSource`                                                     | `cursor` forward, `before` backward, `limit`        | `{ items, nextCursor, prevCursor, hasMore }`           |
| Keyset            | `cursorSource({ keyset: { cursor: (row) => key } })`               | asks for one more row than the page                 | builds cursors from the first and last row             |
| GraphQL Relay     | `relaySource({ connection })`                                      | `first`/`after` or `last`/`before`                  | `edges` (or `nodes`), `pageInfo`, `totalCount`         |
| RFC 8288 `Link`   | `linkHeaderSource({ position })`                                   | `page`, `per_page`, or follows the links            | the body as rows, `next`/`prev`/`last` from the header |
| Spring `Page<T>`  | `springPageSource`                                                 | `page` (0-based), `size`, `sort=field,asc` repeated | `content`, `totalElements`, or `PagedModel`'s `page`   |
| Spring `Slice<T>` | `springSliceSource`                                                | same                                                | `content`, `last`, `first`                             |
| Memory            | `arraySource(items, { filter, search, sort, delay, fail, count })` | none                                                | pages the array; honours abort                         |

`sortStyle` writes the sort: `"comma"` (`sort=name,asc`, repeated), `"dot"` (`sort=name.asc,id.desc`), `"sign"` (`sort=name,-id`) or a function. `fetchTotal` (any adapter's option) counts separately; the hooks run it as its own query.

Effect, without a dependency: `request: ({ query, signal }) => Effect.runPromise(program(query), { signal })`.

## 2. Declare the filters

```ts
const taskFilters = defineFilters({
  q: { kind: "text", label: "Search" }, // { param: "q" } by default
  title: { kind: "text", label: "Title", search: { fields: ["title", "body"], op: "contains" } },
  status: { kind: "options", label: "Status", multiple: true, options },
  archived: { kind: "boolean", label: "Archived" },
  points: { kind: "number", label: "Points", operators: ["eq", "gte", "lte", "between"] },
  due: { kind: "date", label: "Due", op: "lte" },
  created: { kind: "dateRange", label: "Created", field: "createdAt" },
  owner: remoteOption({ label: "Owner", source: people, getLabel: (person) => person.name }),
})
type TaskFilter = FilterValues<typeof taskFilters>
```

- Keys and `field` names are the whitelist; `toFilterAst(schema, values)` only ever uses them, and serializers refuse any other field (pass `fields: schemaFields(schema)` to check a hand-built filter).
- `toFilterAst` joins active values with `and`. Text fields mapped to a param stay out of it: send `searchTerms(schema, values)` beside it.
- `$where` adds an expression with `or`/`not` groups, checked against the schema's fields.
- A date range's end is inclusive (`lte`); `end: "next-day"` sends `lt` the day after for date-time columns.

| Wire format   | Serializer                                                            | Grammar          | Use for                            |
| ------------- | --------------------------------------------------------------------- | ---------------- | ---------------------------------- |
| Flat params   | `queryParams(ast, { style: "suffix" \| "dto" \| "bracket", arrays })` | `and` only       | DTOs, json-server, Django filters  |
| RSQL / FIQL   | `rsql(ast, { isNull })`                                               | and, or, nesting | rsql-jpa-specification and similar |
| OData         | `odata(ast, { inOperator })`                                          | full             | ASP.NET OData, SAP                 |
| Spring Filter | `springFilter(ast, { module, like })`                                 | and, or, not     | turkraft/springfilter              |
| JSON          | `jsonAst(ast)`                                                        | full             | a POST body                        |
| GraphQL       | `graphqlWhere(ast, { dialect: "hasura" \| "prisma" })`                | typed            | Hasura, Prisma                     |
| Search only   | `searchOnly(schema, values, { param })`                               | text             | a `q` endpoint                     |

Every serializer escapes for its grammar, or throws `FilterSerializeError` for what it can't write safely (a wildcard inside a text match, `NaN`, a date OData can't write). Dates: `dates: "iso" | "iso-date" | "epoch-ms" | (value) => string`, ISO 8601 by default, from strings, `Date` (in UTC) or Temporal values.

## 3. Put it on screen

```tsx
<ServerDataTable
  label="Tasks"
  source={tasks}
  columns={[{ id: "title", header: "Title", cell: (task) => task.title, sortField: "title" }]}
  filters={taskFilters}
  filterUi="chips"
  urlState={hashUrlState()}
  labels={{ errorTitle: "Couldn't load tasks", retry: "Try again", emptyTitle: "No tasks match" }}
/>
```

- `navigation="auto"` (default): page numbers with an exact total, previous and next with an estimate or only `hasMore`, load more for a cursor; `"infinite"` loads at the end too.
- `pageSize` 25, `pageSizes` `[10, 25, 50, 100]`, capped by the source's `maxPageSize`. `sortMode="multi"`: Shift+click adds a column.
- `filterUi`: `"search"` (default with a text field), `"chips"`, `"panel"`; or `toolbar` with your own composition of `FilterSearch`, `FilterChips`, `FilterPanelTrigger`, which find the schema and controller from the table.
- To drive it from outside: `const { state, controller } = usePageController(source, options)` and pass `controller`.
- `ServerList` (infinite list of `ListItem` rows) and `ServerCombobox` (remote options, `multiple` chips) follow the same rules.
- `DocumentQuickOpen source={notes} getItem={(note) => ({ value: note.id, label: note.title, description: note.folder, snippet: note.match })} onOpen` takes the same source for a notes app's Ctrl/Cmd+P: the query goes out as `filter.q`, debounced, a newer one aborts the last, the server's matches and order are kept (a note found by its body shows although its title lacks the query) and the next page loads at the end. `snippet` is the passage your search matched, as plain text: it shows under the title on up to two lines with each word of the query marked, and agents read it with the label. A search that isn't a `PageSource` passes `items`, `filter={false}`, `onQueryChange` and `status` instead.

## Locale

Counts, page sizes and the chips' numbers and dates follow the page's `<html lang>` (`useLocale` from `locale`); pass `locale` to `ServerDataTable`, `ServerList`, `FilterChips`, `FilterPanel`, `FilterField` or `ServerCombobox` to override it. A date-only value (`2026-01-31`) is shown as the day it names, whatever the viewer's time zone. Your own `labels.range(range, locale)` receives the locale.

## Guarantees to keep

- Never empty while loading or after an error; the previous page's rows stay (`aria-busy`) while the next loads.
- A polite status says "Showing 21–40 of 312" after each load and "Loading…" only past 400 ms.
- Focus stays on the control pressed (pagination, Load more); row navigation restarts at the first row without moving focus.
- Agents: `sortBy`/`setPage` on the table, `filter(field, value)`/`clearFilters()` on the "{label} filters" group, `select(id)` on a list, Load more by name.

## Defaults

| Option         | Default                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| Sort           | `single`; `multi` adds with Shift+click                                         |
| Text search    | `{ param: "q" }`, 250 ms debounce                                               |
| Totals         | from capabilities and the response, plus `fetchTotal`; `navigation="auto"`      |
| URL history    | `replace`; `push`, `push-page`                                                  |
| URL format     | readable fields; one encoded `f` param for `or` groups                          |
| Page size      | 25 of `[10, 25, 50, 100]`, capped by `maxPageSize`                              |
| Mutations      | `useSourceMutation` invalidates `source.key`; `optimistic` on request           |
| Dates          | ISO 8601                                                                        |
| Query client   | the app's; a shared default, or `DataProvider`                                  |
| Query defaults | keep previous data, 2 retries except 4xx, `staleTime` 30 s, no refetch on focus |
