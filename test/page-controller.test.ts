import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { arraySource } from "@/lib/array-source"
import { defineFilters, type FilterValues } from "@/lib/filter-schema"
import { createUrlCodec } from "@/lib/filter-url"
import { createPageController } from "@/lib/page-controller"
import { capPageSizes, resolveNavigation, writeSort, type PageResult } from "@/lib/page-source"
import { memoryUrlState } from "@/lib/url-state"

const schema = defineFilters({
  q: { kind: "text", label: "Search" },
  status: { kind: "options", label: "Status", options: [{ value: "open", label: "Open" }] },
})
type Values = FilterValues<typeof schema>

const rows = Array.from({ length: 312 }, (_, index) => ({ id: String(index + 1) }))
const pages = arraySource<{ id: string }, Values>(rows)
const cursors = arraySource<{ id: string }, Values>(rows, { position: "cursor", total: "none" })

function result(count: number, extra: Partial<PageResult<unknown>> = {}): PageResult<unknown> {
  return { items: Array.from({ length: count }, (_, index) => index), ...extra }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("the request", () => {
  test("starts on page 1 with the defaults", () => {
    const controller = createPageController(pages)
    expect(controller.getState().request).toEqual({ filter: {}, sort: [], size: 25, position: { page: 1 } })
    expect(controller.pageSizes).toEqual([10, 25, 50, 100])
  })

  test("a new filter, sort or size goes back to page 1; the same one changes nothing", () => {
    const controller = createPageController(pages)
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.setPage(4)
    controller.setFilterValue("status", "open")
    expect(controller.getState().page).toBe(1)
    controller.setPage(3)
    controller.setFilter({ status: "open" })
    expect(controller.getState().page).toBe(3)
    controller.setSort([{ field: "id", direction: "asc" }])
    expect(controller.getState().page).toBe(1)
    controller.setPage(2)
    controller.setPageSize(50)
    expect(controller.getState().request).toMatchObject({ size: 50, position: { page: 1 } })
    expect(listener).toHaveBeenCalledTimes(6)
  })

  test("the page size is capped by maxPageSize", () => {
    const capped = arraySource(rows, { maxPageSize: 40 })
    const controller = createPageController(capped, { pageSize: 100 })
    expect(controller.getState().size).toBe(40)
    expect(controller.pageSizes).toEqual([10, 25, 40])
    expect(capPageSizes([0.5, 7.9], { position: "page" })).toEqual([1, 7])
  })
})

describe("search", () => {
  test("debounces 250 ms, shows the text at once, resets the page", () => {
    const controller = createPageController(pages, { search: { key: "q" } })
    controller.setPage(5)
    controller.setSearch("lo")
    controller.setSearch("login")
    expect(controller.getState()).toMatchObject({ searchText: "login", filter: {}, page: 5 })
    vi.advanceTimersByTime(249)
    expect(controller.getState().filter).toEqual({})
    vi.advanceTimersByTime(1)
    expect(controller.getState()).toMatchObject({ filter: { q: "login" }, page: 1 })
    controller.setSearch("")
    controller.flushSearch()
    expect(controller.getState().filter).toEqual({})
  })

  test("needs the search option", () => {
    expect(() => createPageController(pages).setSearch("x")).toThrow(/search/)
  })
})

describe("sort", () => {
  test("single: a new field sorts ascending, the same one flips", () => {
    const controller = createPageController(pages)
    controller.toggleSort("name")
    controller.toggleSort("name")
    expect(controller.getState().sort).toEqual([{ field: "name", direction: "desc" }])
    controller.toggleSort("date", { additive: true })
    expect(controller.getState().sort).toEqual([{ field: "date", direction: "asc" }])
  })

  test("multi: additive adds or flips in place", () => {
    const controller = createPageController(pages, { sortMode: "multi" })
    controller.toggleSort("name")
    controller.toggleSort("date", { additive: true })
    controller.toggleSort("name", { additive: true })
    expect(controller.getState().sort).toEqual([
      { field: "name", direction: "desc" },
      { field: "date", direction: "asc" },
    ])
  })
})

describe("navigation and status", () => {
  test("auto picks pages, prev-next or load more from what the source gives", () => {
    expect(resolveNavigation({ position: "page", total: "exact" })).toBe("pages")
    expect(resolveNavigation({ position: "page" }, "auto", { kind: "estimate", value: 300 })).toBe("prev-next")
    expect(resolveNavigation({ position: "page", total: "none" })).toBe("prev-next")
    expect(resolveNavigation({ position: "cursor" })).toBe("load-more")
    expect(resolveNavigation({ position: "cursor" }, "infinite")).toBe("infinite")
    const controller = createPageController(pages)
    expect(controller.navigation(result(25, { total: 312 }))).toBe("pages")
    expect(controller.navigation(result(25, { hasMore: true }), 312)).toBe("pages")
  })

  test("the status text says the range and the total", () => {
    const controller = createPageController(pages, { pageSize: 20 })
    controller.setPage(2)
    expect(controller.statusText(result(20, { total: 312 }))).toBe("Showing 21–40 of 312")
    expect(controller.statusText(result(20, { totalEstimate: 1300 }))).toBe("Showing 21–40 of about 1,300")
    expect(controller.statusText(result(20, { hasMore: true }))).toBe("Showing 21–40")
    expect(controller.statusText(result(0))).toBe("No results")
    expect(controller.statusText(undefined)).toBeUndefined()
    const custom = createPageController(pages, { labels: { range: ({ from, to }) => `${String(from)}-${String(to)}` } })
    expect(custom.statusText(result(3))).toBe("1-3")
  })

  test("cursor paging steps with the result's cursors and counts its offset", () => {
    const controller = createPageController(cursors, { pageSize: 20 })
    expect(controller.getState().request.position).toEqual({ cursor: null, direction: "forward" })
    controller.next(result(20, { nextCursor: "20" }))
    controller.next(result(20, { nextCursor: "40" }))
    expect(controller.getState()).toMatchObject({ cursor: "40", cursorIndex: 2 })
    expect(controller.statusText(result(20))).toBe("Showing 41–60")
    controller.previous(result(20, { prevCursor: "40" }))
    expect(controller.getState().request.position).toEqual({ cursor: "40", direction: "backward" })
    controller.previous(result(20, { prevCursor: "20" }))
    expect(controller.getState()).toMatchObject({ cursor: null, cursorIndex: 0, direction: "forward" })
    controller.next(result(20, { nextCursor: null }))
    expect(controller.getState().cursor).toBeNull()
  })
})

describe("URL", () => {
  const codec = createUrlCodec(schema)

  test("starts from the URL, writes changes with replace by default, keeps other params", () => {
    const adapter = memoryUrlState("tab=list&status=open&page=3")
    const controller = createPageController(pages, { url: { adapter, codec } })
    expect(controller.getState()).toMatchObject({ filter: { status: "open" }, page: 3 })
    controller.setPage(4)
    expect(adapter.history).toEqual([{ query: "tab=list&status=open&page=4", replace: true }])
  })

  test("push-page pushes paging and replaces the rest; search text alone writes nothing", () => {
    const adapter = memoryUrlState()
    const controller = createPageController(pages, {
      search: { key: "q" },
      url: { adapter, codec, history: "push-page" },
    })
    controller.setPage(2)
    controller.setSearch("abc")
    expect(adapter.history).toEqual([{ query: "page=2", replace: false }])
    vi.advanceTimersByTime(250)
    expect(adapter.history.at(-1)).toEqual({ query: "q=abc", replace: true })
  })

  test("follows back and forward without writing back", () => {
    const adapter = memoryUrlState("page=2")
    const controller = createPageController(pages, { search: { key: "q" }, url: { adapter, codec } })
    const disconnect = controller.connect()
    adapter.write(new URLSearchParams("q=hello&page=5"), { replace: false })
    expect(controller.getState()).toMatchObject({ filter: { q: "hello" }, searchText: "hello", page: 5 })
    adapter.write(new URLSearchParams(""), { replace: false })
    expect(controller.getState()).toMatchObject({ filter: {}, page: 1 })
    expect(adapter.history).toHaveLength(2)
    disconnect()
    adapter.write(new URLSearchParams("page=9"), { replace: false })
    expect(controller.getState().page).toBe(1)
  })
})

test("writeSort styles", () => {
  const sort = [
    { field: "name", direction: "asc" as const },
    { field: "id", direction: "desc" as const },
  ]
  const write = (style: Parameters<typeof writeSort>[2]) => {
    const params = new URLSearchParams()
    writeSort(params, sort, style)
    return decodeURIComponent(params.toString())
  }
  expect(write("comma")).toBe("sort=name,asc&sort=id,desc")
  expect(write("dot")).toBe("sort=name.asc,id.desc")
  expect(write("sign")).toBe("sort=name,-id")
  expect(write((specs, params) => params.set("ordering", String(specs.length)))).toBe("ordering=2")
})
