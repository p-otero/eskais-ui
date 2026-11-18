import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import type { ReactNode } from "react"
import { describe, expect, test, vi } from "vitest"

import type { DataTableColumn } from "@/components/ui/data-table"
import { createDataClient, DataProvider } from "@/components/ui/server-data"
import { ServerDataTable, type ServerDataTableProps } from "@/components/ui/server-data-table"
import { arraySource } from "@/lib/array-source"
import { defineFilters, toFilterAst, type FilterValues } from "@/lib/filter-schema"
import { matchesFilter } from "@/lib/filter-ast"
import type { PageSource } from "@/lib/page-source"
import { memoryUrlState } from "@/lib/url-state"

import { axeViolations } from "./axe"

const agent = createAgent()

type Task = { id: string; title: string; status: "open" | "done"; points: number }

const tasks: Task[] = Array.from({ length: 7 }, (_, index) => ({
  id: `t${String(index + 1)}`,
  title: `Task ${String.fromCodePoint(65 + index)}`,
  status: index % 2 === 0 ? "open" : "done",
  points: index + 1,
}))

const schema = defineFilters({
  q: { kind: "text", label: "Search tasks" },
  status: {
    kind: "options",
    label: "Status",
    options: [
      { value: "open", label: "Open" },
      { value: "done", label: "Done" },
    ],
  },
})
type Values = FilterValues<typeof schema>

const columns: DataTableColumn<Task>[] = [
  { id: "title", header: "Title", cell: (task) => task.title, sortField: "title" },
  { id: "status", header: "Status", cell: (task) => task.status },
  { id: "points", header: "Points", cell: (task) => task.points, sortField: "points", align: "end" },
]

const labels = { errorTitle: "Couldn't load tasks", retry: "Try again", emptyTitle: "No tasks match" }

function source(options: Parameters<typeof arraySource<Task, Values>>[1] = {}) {
  return arraySource<Task, Values>(tasks, {
    search: { fields: ["title"] },
    filter: (task, filter) => matchesFilter(toFilterAst(schema, filter), task),
    ...options,
  })
}

function renderTable(props: Partial<ServerDataTableProps<Task, typeof schema>> & { source: PageSource<Task, Values> }) {
  const client = createDataClient({ retryDelay: 0 })
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider client={client}>{children}</DataProvider>
  return render(
    <ServerDataTable
      label="Tasks"
      columns={columns}
      filters={schema}
      labels={labels}
      pageSize={3}
      pageSizes={[3, 5]}
      {...props}
    />,
    { wrapper },
  )
}

function titles() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).queryAllByRole("cell")[0]?.textContent)
}

function status() {
  return document.querySelector("[data-slot=server-data-table-footer] output")?.textContent
}

describe("ServerDataTable", () => {
  test("loads, says what is shown, pages with the previous rows kept and focus on the pressed control", async () => {
    const user = userEvent.setup()
    renderTable({ source: source({ delay: 30 }) })
    expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true")
    await waitFor(() => expect(titles()).toEqual(["Task A", "Task B", "Task C"]))
    expect(status()).toBe("Showing 1–3 of 7")

    const next = screen.getByRole("button", { name: "Next page" })
    await user.click(next)
    expect(titles()).toEqual(["Task A", "Task B", "Task C"])
    expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true")
    await waitFor(() => expect(titles()).toEqual(["Task D", "Task E", "Task F"]))
    expect(status()).toBe("Showing 4–6 of 7")
    expect(document.activeElement).toBe(next)
    expect(screen.getByRole("table").hasAttribute("aria-busy")).toBe(false)

    await user.click(screen.getByRole("button", { name: "Page 3" }))
    await waitFor(() => expect(titles()).toEqual(["Task G"]))
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Page 3" }))
  })

  test("sorts on the server and goes back to page 1; multi sort adds with Shift", async () => {
    const user = userEvent.setup()
    const tableSource = source()
    const fetchPage = vi.spyOn(tableSource, "fetchPage")
    renderTable({ source: tableSource, sortMode: "multi" })
    await waitFor(() => expect(titles()).toHaveLength(3))
    await user.click(screen.getByRole("button", { name: "Page 2" }))
    await waitFor(() => expect(titles()[0]).toBe("Task D"))
    await user.click(screen.getByRole("button", { name: "Sort by Points" }))
    await user.click(screen.getByRole("button", { name: "Sort by Points" }))
    await waitFor(() => expect(titles()).toEqual(["Task G", "Task F", "Task E"]))
    expect(screen.getByRole("columnheader", { name: /Points/ }).getAttribute("aria-sort")).toBe("descending")
    await user.keyboard("{Shift>}")
    await user.click(screen.getByRole("button", { name: "Sort by Title" }))
    await user.keyboard("{/Shift}")
    expect(fetchPage.mock.lastCall?.[0]).toMatchObject({
      sort: [
        { field: "points", direction: "desc" },
        { field: "title", direction: "asc" },
      ],
      position: { page: 1 },
    })
    expect(screen.getByRole("button", { name: "Sort by Title, sorted second" })).toBeTruthy()
  })

  test("search is debounced and resets the page", async () => {
    const user = userEvent.setup()
    const tableSource = source()
    const fetchPage = vi.spyOn(tableSource, "fetchPage")
    renderTable({ source: tableSource })
    await waitFor(() => expect(titles()).toHaveLength(3))
    const search = screen.getByRole("searchbox", { name: "Search tasks" })
    expect(search.getAttribute("placeholder")).toBe("Search Tasks…")
    await user.type(search, "task g")
    expect(fetchPage.mock.calls.every((call) => call[0].filter.q === undefined)).toBe(true)
    await waitFor(() => expect(titles()).toEqual(["Task G"]))
    expect(fetchPage.mock.calls.filter((call) => call[0].filter.q !== undefined)).toHaveLength(1)
    expect(status()).toBe("Showing 1–1 of 1")
  })

  test("an error offers a retry, and empty is never shown while loading or after an error", async () => {
    const user = userEvent.setup()
    let failing = true
    renderTable({
      source: source({ fail: () => (failing ? Object.assign(new Error("Bad gateway"), { status: 400 }) : undefined) }),
    })
    await waitFor(() => expect(screen.getByText("Couldn't load tasks")).toBeTruthy())
    expect(screen.queryByText("No tasks match")).toBeNull()
    failing = false
    await user.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(titles()).toHaveLength(3))
  })

  test("empty results show the empty state and say so", async () => {
    renderTable({ source: source(), defaultFilters: { q: "nothing like this" } })
    await waitFor(() => expect(screen.getByText("No tasks match")).toBeTruthy())
    expect(status()).toBe("No results")
  })

  test("says Loading… only once a load has taken 400 ms", async () => {
    renderTable({ source: source({ delay: 700 }) })
    expect(status()).toBe("")
    await waitFor(() => expect(status()).toBe("Loading…"), { timeout: 1000 })
    await waitFor(() => expect(status()).toBe("Showing 1–3 of 7"), { timeout: 1500 })
  })

  test("reads and writes the URL", async () => {
    const user = userEvent.setup()
    const adapter = memoryUrlState("tab=1&status=done&sort=points.desc&page=1")
    renderTable({ source: source(), urlState: adapter })
    await waitFor(() => expect(titles()).toEqual(["Task F", "Task D", "Task B"]))
    await user.click(screen.getByRole("button", { name: "Sort by Title" }))
    await waitFor(() => expect(adapter.read().get("sort")).toBe("title.asc"))
    expect(adapter.read().get("tab")).toBe("1")
    act(() => adapter.write(new URLSearchParams("status=open"), { replace: false }))
    await waitFor(() => expect(titles()).toEqual(["Task A", "Task C", "Task E"]))
  })

  test("previous and next without a total; page size changes go back to page 1", async () => {
    const user = userEvent.setup()
    renderTable({ source: source({ total: "none" }) })
    await waitFor(() => expect(titles()).toHaveLength(3))
    expect(screen.queryByRole("button", { name: "Page 2" })).toBeNull()
    expect(status()).toBe("Showing 1–3")
    await user.click(screen.getByRole("button", { name: "Next page" }))
    await waitFor(() => expect(titles()[0]).toBe("Task D"))
    await user.click(screen.getByRole("combobox", { name: "Rows per page" }))
    await user.click(await screen.findByRole("option", { name: "5" }))
    await waitFor(() => expect(titles()).toEqual(["Task A", "Task B", "Task C", "Task D", "Task E"]))
  })

  test("a cursor source loads more into the table", async () => {
    const user = userEvent.setup()
    renderTable({ source: source({ position: "cursor", total: "none" }) })
    await waitFor(() => expect(titles()).toHaveLength(3))
    const loadMore = screen.getByRole("button", { name: "Load more" })
    await user.click(loadMore)
    await waitFor(() => expect(titles()).toHaveLength(6))
    expect(status()).toBe("Showing 1–6")
    await user.click(loadMore)
    await waitFor(() => expect(titles()).toHaveLength(7))
    expect(loadMore.getAttribute("aria-disabled")).toBe("true")
    expect(document.activeElement).toBe(loadMore)
  })

  test("agents sort, page and filter by name", async () => {
    renderTable({ source: source() })
    await waitFor(() => expect(titles()).toHaveLength(3))
    const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
    for (const entry of entries) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
    const names = entries.map((entry) => entry.label)
    for (const name of ["Tasks", "Tasks filters", "Search tasks", "Rows per page"]) expect(names).toContain(name)

    const filtered = await agent.act({ steps: [{ ref: "Tasks filters", action: "filter", args: ["Status", "Done"] }] })
    expect(filtered.ok, filtered.error?.message).toBe(true)
    await waitFor(() => expect(titles()).toEqual(["Task B", "Task D", "Task F"]))
    const sorted = await agent.act({ steps: [{ ref: "Tasks", action: "sortBy", args: ["points", "descending"] }] })
    expect(sorted.ok, sorted.error?.message).toBe(true)
    await waitFor(() => expect(titles()).toEqual(["Task F", "Task D", "Task B"]))
    const cleared = await agent.act({ steps: [{ ref: "Tasks filters", action: "clearFilters", args: [] }] })
    expect(cleared.ok).toBe(true)
    await waitFor(() => expect(status()).toBe("Showing 1–3 of 7"))
    const paged = await agent.act({ steps: [{ ref: "Tasks", action: "setPage", args: [3] }] })
    expect(paged.ok, paged.error?.message).toBe(true)
    await waitFor(() => expect(titles()).toEqual(["Task A"]))
    const searched = await agent.act({ steps: [{ ref: "Search tasks", action: "setValue", args: ["Task C"] }] })
    expect(searched.ok, searched.error?.message).toBe(true)
    await waitFor(() => expect(titles()).toEqual(["Task C"]))
    const wrong = await agent.act({ steps: [{ ref: "Tasks filters", action: "filter", args: ["Status", "Blocked"] }] })
    expect(wrong.ok).toBe(false)
    expect(wrong.error?.message).toMatch(/Open, Done/)
  })

  test("has no axe violations", async () => {
    const { container } = renderTable({ source: source() })
    await waitFor(() => expect(titles()).toHaveLength(3))
    expect(await axeViolations(container)).toEqual([])
  })
})
