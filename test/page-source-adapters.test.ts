import { describe, expect, test, vi } from "vitest"

import { arraySource } from "@/lib/array-source"
import { HttpError, readJson, type PageRequest, type RestCall } from "@/lib/page-source"
import { cursorSource } from "@/lib/page-source-cursor"
import { linkHeaderSource, parseLinkHeader } from "@/lib/page-source-link"
import { relaySource } from "@/lib/page-source-relay"
import { offsetSource, pagedSource } from "@/lib/page-source-rest"
import { springPageSource, springSliceSource } from "@/lib/page-source-spring"

type Task = { id: number; title: string }
type Filter = { status?: string }

const signal = new AbortController().signal
const tasks: Task[] = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, title: `Task ${String(index + 1)}` }))

function pageRequest(page: number, size = 3, extra: Partial<PageRequest<Filter>> = {}): PageRequest<Filter> {
  return { filter: {}, sort: [], size, position: { page }, ...extra }
}

function cursorRequest(cursor: string | null, direction: "forward" | "backward" = "forward", size = 3) {
  return { filter: {}, sort: [], size, position: { cursor, direction } } satisfies PageRequest<Filter>
}

describe("pagedSource", () => {
  test("sends a 1-based page, the size, the sort and the filter's params", async () => {
    const calls: RestCall<Filter>[] = []
    const source = pagedSource<Task, Filter>({
      key: ["tasks"],
      getId: (task) => String(task.id),
      params: (filter) => ({ status: filter.status }),
      request: async (call) => {
        calls.push(call)
        return { items: tasks.slice(3, 6), total: 7 }
      },
    })
    const result = await source.fetchPage(
      pageRequest(2, 3, { filter: { status: "open" }, sort: [{ field: "title", direction: "desc" }] }),
      { signal },
    )
    expect(calls[0]?.query).toBe("status=open&sort=title%2Cdesc&page=2&size=3")
    expect(calls[0]?.signal).toBe(signal)
    expect(result).toEqual({ items: tasks.slice(3, 6), total: 7, hasMore: true, hasPrevious: true })
    expect(source.capabilities).toEqual({ position: "page", total: "exact", maxPageSize: undefined })
  })

  test("base 0 sends the first page as 0; a short page without a total is the last", async () => {
    const request = vi.fn(async (_call: RestCall<Filter>) => ({ items: tasks.slice(0, 2) }))
    const source = pagedSource<Task, Filter>({ key: ["t"], getId: (task) => String(task.id), base: 0, request })
    const result = await source.fetchPage(pageRequest(1), { signal })
    expect(request.mock.calls[0]?.[0].params.get("page")).toBe("0")
    expect(result.hasMore).toBe(false)
    expect(result.hasPrevious).toBe(false)
  })

  test("`read` maps another response shape, and a wrong shape says how to fix it", async () => {
    const source = pagedSource<Task, Filter, { data: Task[]; meta: { count: number } }>({
      key: ["t"],
      getId: (task) => String(task.id),
      request: async () => ({ data: tasks.slice(0, 3), meta: { count: 7 } }),
      read: (raw) => ({ items: raw.data, total: raw.meta.count }),
    })
    expect((await source.fetchPage(pageRequest(1), { signal })).total).toBe(7)
    const wrong = pagedSource<Task, Filter, unknown>({ key: ["t"], getId: String, request: async () => ({ data: [] }) })
    await expect(wrong.fetchPage(pageRequest(1), { signal })).rejects.toThrow(/pass `read`/)
  })

  test("a cursor request is refused", async () => {
    const source = pagedSource<Task, Filter>({ key: ["t"], getId: String, request: async () => ({ items: [] }) })
    await expect(source.fetchPage(cursorRequest(null), { signal })).rejects.toThrow(/cursor/)
  })
})

test("offsetSource turns the page into an offset", async () => {
  const request = vi.fn(async (_call: RestCall<Filter>) => ({ items: tasks.slice(6), total: 7 }))
  const source = offsetSource<Task, Filter>({ key: ["t"], getId: (task) => String(task.id), request })
  const result = await source.fetchPage(pageRequest(3), { signal })
  expect(request.mock.calls[0]?.[0].query).toBe("offset=6&limit=3")
  expect(result).toMatchObject({ total: 7, hasMore: false, hasPrevious: true })
})

describe("Spring", () => {
  const springPage = {
    content: tasks.slice(3, 6),
    pageable: { pageNumber: 1, pageSize: 3 },
    totalElements: 7,
    totalPages: 3,
    number: 1,
    size: 3,
    first: false,
    last: false,
    numberOfElements: 3,
    empty: false,
  }

  test("Page<T>: 0-based page, repeated sort params, totalElements", async () => {
    const request = vi.fn(async (_call: RestCall<Filter>) => springPage)
    const source = springPageSource<Task, Filter>({ key: ["t"], getId: (task) => String(task.id), request })
    const result = await source.fetchPage(
      pageRequest(2, 3, {
        sort: [
          { field: "status", direction: "asc" },
          { field: "title", direction: "desc" },
        ],
      }),
      { signal },
    )
    expect(request.mock.calls[0]?.[0].params.getAll("sort")).toEqual(["status,asc", "title,desc"])
    expect(request.mock.calls[0]?.[0].params.get("page")).toBe("1")
    expect(result).toEqual({ items: tasks.slice(3, 6), total: 7, hasMore: true, hasPrevious: true })
  })

  test("PagedModel (VIA_DTO) reads the nested page", async () => {
    const source = springPageSource<Task, Filter>({
      key: ["t"],
      getId: (task) => String(task.id),
      request: async () => ({
        content: tasks.slice(6),
        page: { size: 3, number: 2, totalElements: 7, totalPages: 3 },
      }),
    })
    expect(await source.fetchPage(pageRequest(3), { signal })).toEqual({
      items: tasks.slice(6),
      total: 7,
      hasMore: false,
      hasPrevious: true,
    })
  })

  test("Slice<T> has no total, only whether more follows", async () => {
    const source = springSliceSource<Task, Filter>({
      key: ["t"],
      getId: (task) => String(task.id),
      request: async () => ({ content: tasks.slice(0, 3), number: 0, size: 3, first: true, last: false }),
    })
    expect(source.capabilities.total).toBe("none")
    expect(await source.fetchPage(pageRequest(1), { signal })).toEqual({
      items: tasks.slice(0, 3),
      hasMore: true,
      hasPrevious: false,
    })
  })

  test("a body without content is refused", async () => {
    const source = springPageSource<Task, Filter, unknown>({ key: ["t"], getId: String, request: async () => [] })
    await expect(source.fetchPage(pageRequest(1), { signal })).rejects.toThrow(/content/)
  })
})

describe("cursorSource", () => {
  test("opaque cursors: sends the cursor and limit, reads nextCursor", async () => {
    const request = vi.fn(async (_call: RestCall<Filter>) => ({ items: tasks.slice(3, 6), nextCursor: "c6" }))
    const source = cursorSource<Task, Filter>({ key: ["t"], getId: (task) => String(task.id), request })
    const result = await source.fetchPage(cursorRequest("c3"), { signal })
    expect(request.mock.calls[0]?.[0].query).toBe("cursor=c3&limit=3")
    expect(result).toMatchObject({ nextCursor: "c6", hasMore: true })
    await source.fetchPage(cursorRequest("c3", "backward"), { signal })
    expect(request.mock.calls[1]?.[0].query).toBe("before=c3&limit=3")
    expect(source.capabilities).toMatchObject({ position: "cursor", total: "none" })
  })

  test("keyset: asks for one row more, trims it and builds cursors from the rows", async () => {
    const request = vi.fn(async (call: RestCall<Filter>) => {
      const after = Number(call.params.get("cursor") ?? "0")
      const limit = Number(call.params.get("limit"))
      return { items: tasks.filter((task) => task.id > after).slice(0, limit) }
    })
    const source = cursorSource<Task, Filter>({
      key: ["t"],
      getId: (task) => String(task.id),
      keyset: { cursor: (task) => String(task.id) },
      request,
    })
    const first = await source.fetchPage(cursorRequest(null), { signal })
    expect(request.mock.calls[0]?.[0].params.get("limit")).toBe("4")
    expect(first).toEqual({
      items: tasks.slice(0, 3),
      hasMore: true,
      hasPrevious: false,
      nextCursor: "3",
      prevCursor: null,
    })
    const last = await source.fetchPage(cursorRequest("6"), { signal })
    expect(last).toEqual({
      items: tasks.slice(6),
      hasMore: false,
      hasPrevious: true,
      nextCursor: null,
      prevCursor: "7",
    })
  })

  test("keyset backward keeps the rows nearest the cursor", async () => {
    const source = cursorSource<Task, Filter>({
      key: ["t"],
      getId: (task) => String(task.id),
      keyset: { cursor: (task) => String(task.id) },
      request: async () => ({ items: tasks.slice(1, 5) }),
    })
    const result = await source.fetchPage(cursorRequest("6", "backward"), { signal })
    expect(result.items).toEqual(tasks.slice(2, 5))
    expect(result).toMatchObject({ hasPrevious: true, prevCursor: "3", nextCursor: "5" })
  })
})

describe("relaySource", () => {
  const connection = {
    edges: [{ node: tasks[0], cursor: "a" }, { node: tasks[1], cursor: "b" }, null],
    pageInfo: { hasNextPage: true, hasPreviousPage: false, startCursor: "a", endCursor: "b" },
    totalCount: 7,
  }

  test("first/after forward, edges to items, totalCount to total", async () => {
    const request = vi.fn(async () => ({ data: { repository: { issues: connection } } }))
    const source = relaySource<Task, Filter, { data: { repository: { issues: typeof connection } } }>({
      key: ["issues"],
      getId: (task) => String(task.id),
      request,
      connection: (raw) => raw.data.repository.issues as never,
    })
    const result = await source.fetchPage(cursorRequest(null, "forward", 2), { signal })
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ variables: { first: 2 } }))
    expect(result).toEqual({
      items: [tasks[0], tasks[1]],
      total: 7,
      hasMore: true,
      hasPrevious: false,
      nextCursor: "b",
      prevCursor: null,
    })
  })

  test("last/before backward, and nodes instead of edges", async () => {
    const request = vi.fn(async () => ({
      nodes: [tasks[2] as Task],
      pageInfo: { hasNextPage: true, hasPreviousPage: true, startCursor: "c", endCursor: "c" },
    }))
    const source = relaySource<Task, Filter>({ key: ["t"], getId: (task) => String(task.id), request })
    const result = await source.fetchPage(cursorRequest("d", "backward", 1), { signal })
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ variables: { last: 1, before: "d" } }))
    expect(result).toMatchObject({ items: [tasks[2]], prevCursor: "c", nextCursor: "c" })
    expect(result.total).toBeUndefined()
  })

  test("a response without pageInfo is refused", async () => {
    const source = relaySource<Task, Filter, unknown>({ key: ["t"], getId: String, request: async () => ({}) })
    await expect(source.fetchPage(cursorRequest(null), { signal })).rejects.toThrow(/pageInfo/)
  })
})

describe("parseLinkHeader", () => {
  test("GitHub's header", () => {
    const header =
      '<https://api.github.com/repositories/1300192/issues?page=2>; rel="prev", <https://api.github.com/repositories/1300192/issues?page=4>; rel="next", <https://api.github.com/repositories/1300192/issues?page=515>; rel="last", <https://api.github.com/repositories/1300192/issues?page=1>; rel="first"'
    expect(parseLinkHeader(header)).toEqual({
      prev: "https://api.github.com/repositories/1300192/issues?page=2",
      next: "https://api.github.com/repositories/1300192/issues?page=4",
      last: "https://api.github.com/repositories/1300192/issues?page=515",
      first: "https://api.github.com/repositories/1300192/issues?page=1",
    })
  })

  test("commas and semicolons inside the URI, several relations, unquoted values and other params", () => {
    const header =
      '<https://x.test/a?ids=1,2;3&page=2>; title="Next, please"; REL="next last", </b>;rel=prev;type="text/html"'
    expect(parseLinkHeader(header)).toEqual({
      next: "https://x.test/a?ids=1,2;3&page=2",
      last: "https://x.test/a?ids=1,2;3&page=2",
      prev: "/b",
    })
  })

  test("escapes in quoted values, empty and broken headers", () => {
    expect(parseLinkHeader('<a>; title="say \\"hi\\""; rel="next"')).toEqual({ next: "a" })
    expect(parseLinkHeader("")).toEqual({})
    expect(parseLinkHeader(null)).toEqual({})
    expect(parseLinkHeader("<unterminated; rel=next")).toEqual({})
  })
})

function response(body: unknown, link: string | null, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: link === null ? {} : { link, "content-type": "application/json" },
  })
}

describe("linkHeaderSource", () => {
  test("page mode: page and per_page, an estimate from `last`", async () => {
    const request = vi.fn(async (_call: unknown) =>
      response(
        tasks.slice(0, 3),
        '<https://x.test/t?page=2&per_page=3>; rel="next", <https://x.test/t?page=3&per_page=3>; rel="last"',
      ),
    )
    const source = linkHeaderSource<Task, Filter>({ key: ["t"], getId: (task) => String(task.id), request })
    const result = await source.fetchPage(pageRequest(1), { signal })
    expect(request.mock.calls[0]?.[0]).toMatchObject({ query: "per_page=3&page=1", url: null })
    expect(result).toEqual({ items: tasks.slice(0, 3), hasMore: true, hasPrevious: false, totalEstimate: 9 })
  })

  test("on the last page the total is exact", async () => {
    const source = linkHeaderSource<Task, Filter>({
      key: ["t"],
      getId: (task) => String(task.id),
      request: async () => response(tasks.slice(6), '<https://x.test/t?page=2>; rel="prev"'),
    })
    expect(await source.fetchPage(pageRequest(3), { signal })).toMatchObject({
      total: 7,
      hasPrevious: true,
      hasMore: false,
    })
  })

  test("cursor mode follows the links themselves, from a { headers, body } response too", async () => {
    const request = vi.fn(async (_call: { url: string | null }) => ({
      headers: new Headers({ link: '<https://x.test/t?after=xyz>; rel="next"' }),
      body: { rows: tasks.slice(0, 3) },
    }))
    const source = linkHeaderSource<Task, Filter>({
      key: ["t"],
      getId: (task) => String(task.id),
      position: "cursor",
      read: (body) => (body as { rows: Task[] }).rows,
      request,
    })
    const result = await source.fetchPage(cursorRequest("https://x.test/t?after=abc"), { signal })
    expect(request.mock.calls[0]?.[0].url).toBe("https://x.test/t?after=abc")
    expect(result).toMatchObject({ nextCursor: "https://x.test/t?after=xyz", prevCursor: null, hasMore: true })
  })

  test("a failed response throws an HttpError with its status", async () => {
    const source = linkHeaderSource<Task, Filter>({
      key: ["t"],
      getId: String,
      request: async () => response({ message: "Not found" }, null, 404),
    })
    const error = await source.fetchPage(pageRequest(1), { signal }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(HttpError)
    expect((error as HttpError).status).toBe(404)
  })
})

test("readJson reads a body or throws an HttpError", async () => {
  expect(await readJson(new Response('{"a":1}'))).toEqual({ a: 1 })
  await expect(readJson(new Response("", { status: 503 }))).rejects.toMatchObject({ status: 503 })
})

describe("arraySource", () => {
  const people = [
    { id: "1", name: "Ada", team: "core", joined: "2024-03-01" },
    { id: "2", name: "Grace", team: "web", joined: null },
    { id: "3", name: "Alan", team: "core", joined: "2023-01-10" },
    { id: "4", name: "Edsger", team: "web", joined: "2025-07-15" },
  ]

  test("filters, searches, sorts with missing values last, and pages with a total", async () => {
    const source = arraySource(people, {
      filter: (person, filter: { team?: string; q?: string }) => !filter.team || person.team === filter.team,
      search: { fields: ["name"] },
    })
    const result = await source.fetchPage(
      { filter: { q: "a" }, sort: [{ field: "joined", direction: "desc" }], size: 2, position: { page: 1 } },
      { signal },
    )
    expect(result.items.map((person) => person.name)).toEqual(["Ada", "Alan"])
    expect(result).toMatchObject({ total: 3, hasMore: true, hasPrevious: false })
    const next = await source.fetchPage(
      { filter: { q: "a" }, sort: [{ field: "joined", direction: "desc" }], size: 2, position: { page: 2 } },
      { signal },
    )
    expect(next.items.map((person) => person.name)).toEqual(["Grace"])
    const core = await source.fetchPage(
      { filter: { team: "core" }, sort: [{ field: "name", direction: "asc" }], size: 5, position: { page: 1 } },
      { signal },
    )
    expect(core.items.map((person) => person.name)).toEqual(["Ada", "Alan"])
    expect(source.getId(people[0] as (typeof people)[number])).toBe("1")
  })

  test("each source has its own key", () => {
    expect(arraySource([]).key).not.toEqual(arraySource([]).key)
  })

  test("cursor position: index cursors both ways", async () => {
    const source = arraySource(people, { position: "cursor", total: "none" })
    const first = await source.fetchPage(
      { filter: {}, sort: [], size: 3, position: { cursor: null, direction: "forward" } },
      { signal },
    )
    expect(first).toMatchObject({ nextCursor: "3", prevCursor: null, hasMore: true })
    expect(first.total).toBeUndefined()
    const back = await source.fetchPage(
      { filter: {}, sort: [], size: 2, position: { cursor: "3", direction: "backward" } },
      { signal },
    )
    expect(back.items.map((person) => person.id)).toEqual(["2", "3"])
  })

  test("latency honours abort; `fail` fails chosen calls; `count` adds fetchTotal", async () => {
    vi.useFakeTimers()
    try {
      const source = arraySource(people, {
        delay: 500,
        total: "estimate",
        fail: (_request, call) => (call === 1 ? new Error("Flaky") : undefined),
        count: { delay: 10 },
      })
      const controller = new AbortController()
      const pending = source.fetchPage(pageRequest(1) as never, { signal: controller.signal })
      controller.abort()
      await expect(pending).rejects.toMatchObject({ name: "AbortError" })
      const failing = source.fetchPage(pageRequest(1) as never, { signal })
      const caught = failing.catch((error: unknown) => error)
      await vi.advanceTimersByTimeAsync(500)
      expect(await caught).toMatchObject({ message: "Flaky" })
      const ok = source.fetchPage(pageRequest(1) as never, { signal })
      await vi.advanceTimersByTimeAsync(500)
      expect(await ok).toMatchObject({ totalEstimate: 10 })
      const counted = source.fetchTotal?.({} as never, { signal })
      await vi.advanceTimersByTimeAsync(10)
      expect(await counted).toBe(4)
    } finally {
      vi.useRealTimers()
    }
  })
})
