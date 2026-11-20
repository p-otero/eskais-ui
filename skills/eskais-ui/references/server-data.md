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

## Hooks without a component

```tsx
const page = useServerPage(tasks, state.request) // items, status, fetching, previous, total, navigation, error, retry
const more = useServerInfinite(tasks, { filter, sort, size: 25 }) // items, loadMore, hasMore, loadingMore

// A resource that isn't paged: a detail, a snapshot, a short list. Same shape, with `data`.
// import { useServerQuery } from "@/components/ui/use-server-query"
const detail = useServerQuery([...tasks.key, "detail", id], ({ signal }) => api.task(id, { signal }), {
  enabled, // default true
  staleTime, // the client's default otherwise
  keepPrevious, // default false: a detail never shows another id's data
  placeholder, // shown before the first load, never cached
  select, // (task) => task.title: data is the selection, memoised; the cache keeps the whole answer
  seeds, // (task) => [taskSummary.seed(task.id, summaryOf(task))]: fill other resources from this answer
})

// A resource two screens read: declare it once, so both share key, fetch and options.
// import { defineResource, useServerResource } from "@/components/ui/use-server-query"
const taskSummary = defineResource({
  key: (id: string) => [...tasks.key, "summary", id],
  fetch: (id: string, { signal }) => api.taskSummary(id, { signal }),
  staleTime: 60_000,
})
const taskDetail = defineResource({
  key: (id: string) => [...tasks.key, "detail", id],
  fetch: (id: string, { signal }) => api.task(id, { signal }),
  seeds: (task) => [taskSummary.seed(task.id, summaryOf(task))], // `seed` checks the data's type
})
const summary = useServerResource(taskSummary, id, { select: (s) => s.title })
```

- Put a resource's key under its source's key, so `useInvalidateSource(tasks)` and `useSourceMutation({ source: tasks })` reach it. `fetch` must not resolve to `undefined` (use `null`).
- Seed instead of calling `setQueryData` in a fetch: `seeds` skips an aborted fetch, writes resources nothing has mounted, and never overwrites data written after the fetch started.
- `useSourceMutation` refreshes the key after the change by default. `optimistic: (items, variables) => items` shows it before and rolls back on failure. `refreshOnError: false` adds no read after a failed command (the rollback still happens).
- When the server answers with the saved state, write it instead of refreshing: `settleItems: (items, saved) => items.map((t) => (t.id === saved.id ? saved : t))` for page and infinite queries (totals stay), `settle: (saved, variables, current) => (current?.id === saved.id ? saved : undefined)` for each `useServerQuery` (`undefined` leaves it). They reach every cached query under the key, mounted or not (one filled by `setQueryData` or `seeds` too). Each written query's read in flight is cancelled first; nothing is requested; the rest of the key is marked stale (a read already in flight restarts). A failure still refreshes, unless `refreshOnError: false`.
- `useInvalidateSource(tasks, { throwOnError: true })` (or `invalidate({ throwOnError: true })`) rejects on a failed reload: `invalidate().catch(() => toast.error("Couldn't reload"))`. By default it resolves.
- Every reload the hooks make (`useInvalidateSource`, a mutation's refresh, the restart after `settle`) restarts any read in flight under the key, a first load included: its signal aborts, the query stays pending without an error, and its late answer is dropped. `client.invalidateQueries` joins a first load in flight instead, so it can show the answer from before the write: invalidate through the hooks.
- `scope: { id }` runs mutations with that id one at a time, in call order, across hooks; each waits for the one before to settle, its refresh included. A failure doesn't stop the queue: to stop at the first, set a flag in `onError` and reject in `mutationFn` when it's set. `mutationKey` finds them with `useMutationState`.

## Offline

TanStack's default `networkMode: "online"` pauses reads and writes after the browser's `offline` event: a page stays pending and never reaches its error state. For a local backend (Electron IPC, localhost) or an app with its own offline UI:

```ts
createDataClient({ networkMode: "always" }) // queries and mutations
useServerQuery(key, fetch, { networkMode: "always" }) // or per hook: resources, page, infinite, total, useSourceMutation
```

## Typed errors

`error` is `unknown` by default. Type it app-wide with TanStack's `Register`, or per call after the data type:

```ts
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError // every hook's error: ApiError | null
  }
}

useServerQuery<Task, ApiError>(key, fetch) // useServerPage<T, F, E>, useServerInfinite<T, F, E>, useSourceMutation<…, E>
```

## Retries

`createDataClient({ retry, retryDelay })`. A number keeps the 4xx rule; `false` never retries; a function decides alone. Default: two retries for anything without a 4xx `status` (fetch's network failure is a `TypeError` with no status). When your errors carry no status (IPC, domain or parse errors), retry only what may pass:

```ts
createDataClient({ retry: (failures, error) => failures < 3 && isTransientError(error) }) // TypeError, 408, 425, 429, 5xx
```

Mutations never retry.

## Testing

Results reach React through TanStack Query's `notifyManager`, scheduled with `setTimeout(0)` after the query settles, so a test that awaits one `act()` can still see the previous state. In the test setup:

```ts
import { notifyManager } from "@tanstack/react-query"

notifyManager.setScheduler(queueMicrotask)
```

Or wait with `findBy…`/`waitFor`. Back the screen with `arraySource(fixtures, { key, delay, fail })` and a `DataProvider client={createDataClient({ retry: 0 })}` so an error shows at once.

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
| Mutations      | `useSourceMutation` invalidates `source.key`; `optimistic`, `settle` on request |
| Dates          | ISO 8601                                                                        |
| Query client   | the app's; a shared default, or `DataProvider`                                  |
| Query defaults | keep previous data, 2 retries except 4xx, `staleTime` 30 s, no refetch on focus |
| Network mode   | TanStack's `online`: paused while the browser is offline                        |
