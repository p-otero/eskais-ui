import { arraySource } from "@/lib/array-source"
import { matchesFilter } from "@/lib/filter-ast"
import { graphqlWhere } from "@/lib/filter-graphql"
import { odata } from "@/lib/filter-odata"
import { rsql } from "@/lib/filter-rsql"
import { defineFilters, remoteOption, searchTerms, toFilterAst, type FilterValues } from "@/lib/filter-schema"
import { jsonAst, queryParams, searchOnly } from "@/lib/filter-serializers"
import { springFilter } from "@/lib/filter-spring"
import type { PageRequest, PageResult, PageSource } from "@/lib/page-source"
import { cursorSource } from "@/lib/page-source-cursor"
import { pagedSource, springPageSource } from "@/lib/page-source-rest"

type TaskStatus = "open" | "in_progress" | "blocked" | "done"
type TaskPriority = "low" | "medium" | "high" | "urgent"

type ServerTask = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignee: string
  points: number
  created: string
  archived: boolean
}

const verbs = ["Fix", "Add", "Refactor", "Document", "Test", "Migrate", "Review", "Remove", "Speed up", "Translate"]
const things = [
  "login form",
  "billing export",
  "search index",
  "invoice PDF",
  "audit log",
  "webhook retries",
  "dark mode",
  "CSV import",
  "rate limiter",
  "onboarding email",
  "admin roles",
  "mobile nav",
  "cache warmup",
]
const people = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Edsger Dijkstra", "Barbara Liskov", "Ken Thompson"]
const statuses: TaskStatus[] = ["open", "in_progress", "blocked", "done"]
const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"]

const serverTasks: ServerTask[] = Array.from({ length: 312 }, (_, index) => {
  const day = new Date(Date.UTC(2026, 0, 1) + ((index * 7919) % 300) * 86_400_000)
  return {
    id: `T-${String(index + 1).padStart(3, "0")}`,
    title: `${verbs[index % verbs.length] ?? "Fix"} ${things[(index * 5) % things.length] ?? "bug"}`,
    status: statuses[(index * 3) % statuses.length] ?? "open",
    priority: priorities[(index * 7) % priorities.length] ?? "low",
    assignee: people[(index * 11) % people.length] ?? "Ada Lovelace",
    points: [1, 2, 3, 5, 8, 13][index % 6] ?? 1,
    created: day.toISOString().slice(0, 10),
    archived: index % 9 === 0,
  }
})

const peopleSource = arraySource(
  people.map((name) => ({ id: name, name })),
  { key: ["demo", "people"], search: { fields: ["name"] } },
)

const serverTaskFilters = defineFilters({
  q: { kind: "text", label: "Search" },
  status: {
    kind: "options",
    label: "Status",
    multiple: true,
    options: [
      { value: "open", label: "Open" },
      { value: "in_progress", label: "In progress" },
      { value: "blocked", label: "Blocked" },
      { value: "done", label: "Done" },
    ],
  },
  priority: {
    kind: "options",
    label: "Priority",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "urgent", label: "Urgent" },
    ],
  },
  assignee: remoteOption({
    label: "Assignee",
    source: peopleSource,
    getLabel: (person) => person.name,
    multiple: true,
  }),
  points: { kind: "number", label: "Points", min: 0, max: 13 },
  created: { kind: "dateRange", label: "Created" },
  archived: { kind: "boolean", label: "Archived", trueLabel: "Archived", falseLabel: "Active" },
})

type ServerTaskFilter = FilterValues<typeof serverTaskFilters>

function matchesTask(task: ServerTask, filter: ServerTaskFilter) {
  const text = filter.q?.trim().toLocaleLowerCase()
  if (text && !`${task.id} ${task.title} ${task.assignee}`.toLocaleLowerCase().includes(text)) return false
  return matchesFilter(toFilterAst(serverTaskFilters, filter), task)
}

type DemoSourceOptions = { delay?: number; fail?: () => boolean; key?: readonly unknown[] }

function taskSource(options: DemoSourceOptions = {}) {
  return arraySource<ServerTask, ServerTaskFilter>(serverTasks, {
    key: options.key ?? ["demo", "tasks"],
    filter: matchesTask,
    delay: options.delay ?? 0,
    fail: () => (options.fail?.() ? Object.assign(new Error("The server answered 503."), { status: 503 }) : undefined),
  })
}

type WireFormat = "params" | "rsql" | "odata" | "spring" | "graphql" | "json" | "q"

function wireFilter(format: WireFormat, filter: ServerTaskFilter): string {
  const ast = toFilterAst(serverTaskFilters, filter)
  const terms = searchTerms(serverTaskFilters, filter)
  try {
    if (format === "params") return new URLSearchParams([...Object.entries(terms), ...queryParams(ast)]).toString()
    if (format === "rsql") return new URLSearchParams({ ...terms, filter: rsql(ast) }).toString()
    if (format === "odata") return new URLSearchParams({ ...terms, $filter: odata(ast) }).toString()
    if (format === "spring") return new URLSearchParams({ ...terms, filter: springFilter(ast) }).toString()
    if (format === "graphql") return JSON.stringify({ where: graphqlWhere(ast, { dialect: "hasura" }) })
    if (format === "json") return JSON.stringify({ ...terms, where: jsonAst(ast) })
    return new URLSearchParams(searchOnly(serverTaskFilters, filter)).toString()
  } catch (error) {
    return error instanceof Error ? `(${error.message})` : String(error)
  }
}

type Backend = "page" | "cursor" | "spring"

function serve(request: PageRequest<ServerTaskFilter>, signal: AbortSignal, delay: number) {
  const all = taskSource()
  const position = "page" in request.position ? { page: 1 } : request.position
  return new Promise<ServerTask[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      all
        .fetchPage({ ...request, size: serverTasks.length, position }, { signal })
        .then((result) => resolve(result.items), reject)
    }, delay)
    signal.addEventListener("abort", () => clearTimeout(timer), { once: true })
  })
}

/** `onWire` gets each request as it would go over the network. */
function backendSource(
  backend: Backend,
  onWire: (wire: string) => void,
  delay = 250,
): PageSource<ServerTask, ServerTaskFilter> {
  const key = ["demo", "backend", backend]
  if (backend === "page")
    return pagedSource<ServerTask, ServerTaskFilter>({
      key,
      getId: (task) => task.id,
      params: (filter) => [
        ...Object.entries(searchTerms(serverTaskFilters, filter)),
        ...queryParams(toFilterAst(serverTaskFilters, filter)),
      ],
      request: async (call) => {
        onWire(`GET /tasks?${call.query}`)
        const rows = await serve(call.request, call.signal, delay)
        const page = "page" in call.request.position ? call.request.position.page : 1
        return { items: rows.slice((page - 1) * call.request.size, page * call.request.size), total: rows.length }
      },
    })
  if (backend === "cursor")
    return cursorSource<ServerTask, ServerTaskFilter, PageResult<ServerTask>>({
      key,
      getId: (task) => task.id,
      sortStyle: "sign",
      params: (filter) => ({
        filter: rsql(toFilterAst(serverTaskFilters, filter)) || undefined,
        ...searchTerms(serverTaskFilters, filter),
      }),
      keyset: { cursor: (task) => task.id },
      request: async (call) => {
        onWire(`GET /tasks?${call.query}`)
        const rows = await serve(call.request, call.signal, delay)
        const after = call.params.get("cursor")
        const start = after === null ? 0 : rows.findIndex((task) => task.id === after) + 1
        return { items: rows.slice(start, start + Number(call.params.get("limit"))) }
      },
    })
  return springPageSource<ServerTask, ServerTaskFilter>({
    key,
    getId: (task) => task.id,
    params: (filter) => ({
      filter: springFilter(toFilterAst(serverTaskFilters, filter)) || undefined,
      ...searchTerms(serverTaskFilters, filter),
    }),
    request: async (call) => {
      onWire(`GET /api/tasks?${call.query}`)
      const rows = await serve(call.request, call.signal, delay)
      const number = Number(call.params.get("page"))
      const size = Number(call.params.get("size"))
      return {
        content: rows.slice(number * size, number * size + size),
        totalElements: rows.length,
        totalPages: Math.ceil(rows.length / size),
        number,
        size,
        first: number === 0,
        last: (number + 1) * size >= rows.length,
      }
    },
  })
}

export { backendSource, peopleSource, serverTaskFilters, serverTasks, taskSource, wireFilter }
export type { Backend, ServerTask, ServerTaskFilter, TaskPriority, TaskStatus, WireFormat }
