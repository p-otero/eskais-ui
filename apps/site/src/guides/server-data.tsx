import { lazy, Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"

import { A, Article, Code, DocTable, DocTitle, H2, P, Pre, Ul } from "../docs/prose"

const LatencyDemo = lazy(() => import("../examples/server-data-table"))
const BackendSwitcher = lazy(() => import("./server-data/backend-switcher"))

const quickStart = `import { ServerDataTable } from "@/components/ui/server-data-table"
import { defineFilters, searchTerms, toFilterAst } from "@/lib/filter-schema"
import { rsql } from "@/lib/filter-rsql"
import { readJson } from "@/lib/page-source"
import { springPageSource } from "@/lib/page-source-rest"
import { hashUrlState } from "@/lib/url-state"

const taskFilters = defineFilters({
  q: { kind: "text", label: "Search" },
  status: { kind: "options", label: "Status", multiple: true, options: statusOptions },
  created: { kind: "dateRange", label: "Created" },
})

// One adapter per endpoint: here a Spring controller taking Pageable and an RSQL filter.
const tasks = springPageSource<Task, FilterValues<typeof taskFilters>>({
  key: ["tasks"],
  getId: (task) => task.id,
  params: (filter) => ({ ...searchTerms(taskFilters, filter), filter: rsql(toFilterAst(taskFilters, filter)) || undefined }),
  request: ({ query, signal }) => fetch(\`/api/tasks?\${query}\`, { signal }).then(readJson),
})

<ServerDataTable
  label="Tasks"
  source={tasks}
  columns={columns}            // give a column sortField to sort it on the server
  filters={taskFilters}
  filterUi="chips"             // "search" (default), "chips" or "panel"
  urlState={hashUrlState()}    // ?status=open,blocked&created=2026-01-01..2026-01-31&page=2&sort=title.asc
  labels={{ errorTitle: "Couldn't load tasks", retry: "Try again", emptyTitle: "No tasks match" }}
/>`

const effectRecipe = `import { Effect } from "effect"

const tasks = pagedSource<Task, TaskFilter>({
  key: ["tasks"],
  getId: (task) => task.id,
  request: ({ query, signal }) => Effect.runPromise(fetchTasks(query), { signal }),
})

// Or a source by hand: fetchPage is any (request, { signal }) => Promise.
const custom: PageSource<Task, TaskFilter> = {
  key: ["tasks"],
  getId: (task) => task.id,
  capabilities: { position: "page", total: "exact" },
  fetchPage: (request, { signal }) => Effect.runPromise(loadPage(request), { signal }),
}`

const hooksCode = `const { state, controller } = usePageController(tasks, { search: { key: "q" }, url: { adapter, codec } })
const page = useServerPage(tasks, state.request)
// page.items, page.status ("pending" | "error" | "success"), page.fetching, page.total, page.navigation, page.retry

const rename = useSourceMutation({
  source: tasks,
  mutationFn: (change: { id: string; title: string }) => api.rename(change),
  optimistic: (items, change) => items.map((task) => (task.id === change.id ? { ...task, title: change.title } : task)),
})`

const resourceCode = `import { useServerQuery } from "@/components/ui/use-server-query"

// A detail, a snapshot or a short list: no paging. Its key sits under the source's, so the hooks below reach it.
const detail = useServerQuery([...tasks.key, "detail", id], ({ signal }) => api.task(id, { signal }))
// detail.data, detail.status, detail.fetching, detail.previous, detail.error, detail.retry

// The server answers with the saved task: write it everywhere, with no optimistic step and no refetch.
const save = useSourceMutation({
  source: tasks,
  mutationFn: (change: TaskChange) => api.save(change), // resolves to the saved Task
  settleItems: (items, saved) => items.map((task) => (task.id === saved.id ? saved : task)), // pages, infinite lists
  settle: (saved, _change, current) => (current?.id === saved.id ? saved : undefined), // useServerQuery; undefined skips
})

// A reload the caller hears about when it fails.
const reload = useInvalidateSource(tasks, { throwOnError: true })
reload().catch(() => toast.error("Couldn't reload tasks"))`

const retryCode = `import { createDataClient, isTransientError } from "@/components/ui/server-data"

// Retry only what may pass next time: a network failure, 408, 425, 429 or a 5xx.
const client = createDataClient({
  retry: (failures, error) => failures < 3 && isTransientError(error),
  retryDelay: (failures) => Math.min(500 * 2 ** failures, 5_000),
})`

const testCode = `// test/setup.ts
import { notifyManager } from "@tanstack/react-query"

// Deliver query results within the act() that settled them, not one setTimeout(0) later.
notifyManager.setScheduler(queueMicrotask)

// a test
const tasks = arraySource(fixtures, { key: ["tasks"] })
render(<DataProvider client={createDataClient({ retry: 0 })}><TaskScreen source={tasks} /></DataProvider>)
expect(await screen.findByRole("row", { name: /Write the docs/ })).toBeVisible()`

const styles = [
  [
    "Page and size, limit and offset",
    "Page numbers, Showing 21–40 of 312",
    "Jump to any page; easy to cache and share",
    "Rows drift when others insert; a COUNT per query; deep pages are slow",
    "pagedSource({ base }), offsetSource",
  ],
  [
    "Cursor or keyset",
    "Load more, or infinite",
    "Stable and fast at any depth",
    "No jump to page N; needs a unique, ordered key",
    "cursorSource (opaque, or keyset)",
  ],
  [
    "Relay",
    "Load more, or previous and next",
    "Cursors plus pageInfo and an optional totalCount",
    "Same as cursors",
    "relaySource",
  ],
  [
    "Link header (RFC 8288)",
    "Previous and next, about N from last",
    "Navigation the server already wrote",
    "A total only on the last page",
    "linkHeaderSource",
  ],
  [
    "Spring Page and Slice",
    "Page numbers (Page), previous and next (Slice)",
    "Pageable controllers as they are",
    "Page runs a count query; Slice has no total",
    "springPageSource, springSliceSource",
  ],
]

const formats = [
  [
    "Flat params (DTO, suffix, bracket)",
    "and only",
    "A request DTO, json-server, Django filters",
    "queryParams",
    "URL-friendly; refuses or",
  ],
  [
    "RSQL / FIQL",
    "and, or, nesting",
    "rsql-jpa-specification, many Java and .NET APIs",
    "rsql",
    "Compact; quoted, escaped arguments",
  ],
  ["OData $filter", "the full grammar", "ASP.NET OData, SAP, Dynamics", "odata", "Verbose; dates unquoted"],
  ["Spring Filter", "and, or, not", "turkraft/springfilter", "springFilter", "Java only; refuses wildcards in text"],
  ["JSON AST", "the full grammar", "A POST body for any backend", "jsonAst", "Safest: nothing to escape"],
  ["GraphQL where", "typed, nested", "Hasura, Prisma", "graphqlWhere", "Goes in variables, never in the query"],
  ["q only", "free text", "A search endpoint", "searchOnly", "Ignores every other field"],
]

const navigation = [
  ["An exact total (or fetchTotal)", "Page numbers and Showing 21–40 of 312"],
  ["totalEstimate", "Previous and next, Showing 21–40 of about 300"],
  ["Only hasMore", "Previous and next, Showing 21–40"],
  ["A cursor", 'Load more, or infinite with navigation="infinite"'],
]

export default function ServerData() {
  return (
    <Article>
      <DocTitle
        eyebrow="Guides"
        title="Server data"
        description="Tables, lists and comboboxes over any backend: one contract for paging, one schema for filters, adapters and serializers for each wire format."
      />

      <H2 id="layers">Four layers, no backend assumed</H2>
      <Ul>
        <li>
          A <A to="/docs/components/page-source">PageSource</A> is the contract:{" "}
          <Code>fetchPage(request, {"{ signal }"})</Code> returns rows and whatever the backend knows (a total, an
          estimate, <Code>hasMore</Code>, cursors). An adapter per wire format builds one from your <Code>request</Code>{" "}
          function; none of them fetches by itself or depends on a backend library.
        </li>
        <li>
          A <A to="/docs/components/filter-schema">filter schema</A> declares the filters once. It types the values,
          drives the filter UIs, keeps them in the URL, and is the whitelist the serializers check every field against.
        </li>
        <li>
          <A to="/docs/components/server-data">Server data hooks</A> run on TanStack Query, which never shows in their
          types: previous rows stay while the next page loads, superseded requests are aborted, a 4xx is never retried.
        </li>
        <li>
          Components: <A to="/docs/components/server-data-table">ServerDataTable</A>,{" "}
          <A to="/docs/components/server-list">ServerList</A> and{" "}
          <A to="/docs/components/server-combobox">ServerCombobox</A>, with the filter UIs{" "}
          <A to="/docs/components/filter-search">FilterSearch</A>, <A to="/docs/components/filter-chips">FilterChips</A>{" "}
          and <A to="/docs/components/filter-panel">FilterPanel</A>.
        </li>
      </Ul>
      <Pre code={quickStart} title="tasks-page.tsx" />

      <H2 id="pagination">Pagination styles</H2>
      <DocTable
        label="Pagination styles"
        head={["Style", "The table shows", "Good at", "Costs", "Adapter"]}
        rows={styles.map(([style, shows, good, costs, adapter]) => [
          style,
          shows,
          good,
          costs,
          <Code key="a">{adapter}</Code>,
        ])}
      />
      <P>
        Navigation follows what the source gives (<Code>navigation="auto"</Code>); pass <Code>pages</Code>,{" "}
        <Code>prev-next</Code>, <Code>load-more</Code> or <Code>infinite</Code> to choose. A source's{" "}
        <Code>fetchTotal</Code> runs as its own cached query, so a slow count never holds back the rows.
      </P>
      <DocTable
        label="Navigation by what the source gives"
        head={["The source gives", "The UI shows"]}
        rows={navigation.map(([gives, shows]) => [gives, shows])}
      />

      <H2 id="wire-formats">Wire formats</H2>
      <DocTable
        label="Wire formats"
        head={["Format", "Grammar", "Spoken by", "Serializer", "Notes"]}
        rows={formats.map(([format, grammar, who, serializer, notes]) => [
          format,
          grammar,
          who,
          <Code key="s">{serializer}</Code>,
          notes,
        ])}
      />
      <Ul>
        <li>
          Field names come only from the schema, never from what someone types, and every serializer checks them again.
        </li>
        <li>
          Each serializer escapes per its grammar (RSQL and Spring Filter backslashes, OData doubled quotes, LIKE
          escapes for Hasura) or throws a <Code>FilterSerializeError</Code> for a value it can't write safely, like a
          wildcard inside a text match. The table then shows its error state instead of sending a broken query.
        </li>
        <li>
          Dates go out as ISO 8601 unless you pass <Code>dates: "iso-date" | "epoch-ms" | fn</Code>; strings,{" "}
          <Code>Date</Code> and Temporal values all work. A date range's end is inclusive: <Code>lte</Code> the last
          day, or <Code>end: "next-day"</Code> for <Code>lt</Code> the day after when the backend stores date-times.
        </li>
      </Ul>

      <H2 id="latency">Latency and errors</H2>
      <P>
        <Code>arraySource</Code> pages an array in memory with <Code>delay</Code> and <Code>fail</Code>, for demos,
        tests and mockups. Page through this table, then switch failures on: the previous rows stay while a page loads,
        the status says "Loading…" only past 400 ms, and an error offers a retry instead of an empty table.
      </P>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LatencyDemo />
      </Suspense>

      <H2 id="backends">One table, three backends</H2>
      <P>
        The same tasks behind a page-and-size API with a total, keyset cursors and a Spring <Code>Page</Code>. Filter,
        sort and page, and watch the request each adapter sends and the filter in every wire format.
      </P>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <BackendSwitcher />
      </Suspense>

      <H2 id="url">The URL</H2>
      <P>
        <Code>urlState</Code> takes <Code>hashUrlState()</Code>, <Code>historyUrlState()</Code> or your router wrapped
        in the same three methods. The URL keeps schema values, not the wire format, in readable params, and falls back
        to one encoded <Code>f</Code> param when a filter has <Code>or</Code> groups. Writes replace the entry by
        default; <Code>history: "push-page"</Code> adds one per page so Back steps through them.
      </P>

      <H2 id="hooks">Hooks and mutations</H2>
      <Pre code={hooksCode} />
      <P>
        The hooks use your app's <Code>QueryClient</Code> when it has one, and a shared default otherwise.{" "}
        <Code>DataProvider</Code> provides the registry's defaults: two retries except on a 4xx, read from the error's{" "}
        <Code>status</Code> (<Code>readJson</Code> throws an <Code>HttpError</Code> with it), 30 s fresh, no refetch on
        focus. Mount one per request when rendering on a server.
      </P>

      <H2 id="resources">Resources that aren't paged</H2>
      <P>
        <Code>useServerQuery(key, fetch, options)</Code> loads one resource and returns what the page hooks return, with{" "}
        <Code>data</Code> in place of the rows: <Code>status</Code>, <Code>fetching</Code>, <Code>previous</Code>,{" "}
        <Code>error</Code> and <Code>retry</Code>. <Code>fetch</Code> gets the signal, aborted when the key changes or
        the component unmounts. It takes <Code>enabled</Code>, <Code>staleTime</Code>, <Code>placeholder</Code> and{" "}
        <Code>keepPrevious</Code> (off by default, so a detail never shows another id's data). On a server it renders
        pending, or the data the request's client already holds.
      </P>
      <Pre code={resourceCode} />
      <Ul>
        <li>
          <Code>settleItems(items, result, variables)</Code> maps each page's rows, in page and infinite queries; totals
          stay. <Code>settle(result, variables, current, queryKey)</Code> writes each <Code>useServerQuery</Code> under
          the key, and <Code>undefined</Code> leaves one alone.
        </li>
        <li>
          On success they cancel the read in flight of each query they write, so an answer sent before the change can't
          overwrite it, and request nothing. The other queries under the key are marked stale and reload when next
          shown; one that was already loading starts again. A failed mutation still refreshes the key and rolls back{" "}
          <Code>optimistic</Code> rows.
        </li>
        <li>
          <Code>useInvalidateSource(source)</Code> resolves once the shown queries have reloaded, failed or not;{" "}
          <Code>{"{ throwOnError: true }"}</Code>, on the hook or on one call, rejects with the error instead.
        </li>
      </Ul>

      <H2 id="retry">Retries</H2>
      <P>
        <Code>createDataClient({"{ retry, retryDelay }"})</Code>: a number of retries keeps the 4xx rule, a function{" "}
        <Code>(failures, error) =&gt; boolean</Code> decides alone. The default stays two retries for anything without a
        4xx <Code>status</Code>, because <Code>fetch</Code> reports a dropped connection as a <Code>TypeError</Code>{" "}
        with no status. When your errors carry no status (IPC, a domain error, a parse error), retrying only{" "}
        <Code>isTransientError</Code> fails them at once instead of after the backoff. Mutations never retry: a write
        that failed may still have reached the server.
      </P>
      <Pre code={retryCode} />

      <H2 id="testing">Testing</H2>
      <P>
        Query results reach React through TanStack Query's <Code>notifyManager</Code>, which schedules them with{" "}
        <Code>setTimeout(0)</Code>. So when a test awaits one <Code>act()</Code> around a source settling, the query is
        done but the component still shows the state before it. Set the scheduler to <Code>queueMicrotask</Code> in your
        test setup, or wait with <Code>findBy…</Code> and <Code>waitFor</Code>. An <Code>arraySource</Code> with{" "}
        <Code>delay</Code> and <Code>fail</Code> stands in for the backend, and a client with <Code>retry: 0</Code>{" "}
        shows an error at once.
      </P>
      <Pre code={testCode} title="tasks.test.tsx" />

      <H2 id="effect">Effect</H2>
      <P>
        There is no Effect dependency: run a program to a Promise and pass the signal, so a superseded request
        interrupts its fiber.
      </P>
      <Pre code={effectRecipe} />

      <H2 id="accessibility">Accessibility and agents</H2>
      <Ul>
        <li>A polite status says what is shown after each load; focus stays on the control you pressed.</li>
        <li>Row navigation starts again at the first row without moving focus; new rows never take it.</li>
        <li>
          Agents sort and page through the table's own actions and filter by label through its filters group:{" "}
          <Code>filter("Status", ["Open"])</Code>.
        </li>
      </Ul>
    </Article>
  )
}
