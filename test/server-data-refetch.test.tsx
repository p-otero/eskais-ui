import { focusManager, onlineManager } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, test } from "vitest"

import { createDataClient, DataProvider, type DataClientOptions } from "@/components/ui/server-data"
import { useServerInfinite, useServerPage, type ReadOptions } from "@/components/ui/use-server-data"
import { defineResource, useServerQuery, useServerResource } from "@/components/ui/use-server-query"
import type { PageRequest, PageSource } from "@/lib/page-source"

type Row = { id: string; name: string }
type Filter = Record<string, never>

function counted() {
  let calls = 0
  const fetch = async () => {
    calls += 1
    return { id: "a", name: `read ${String(calls)}` }
  }
  return { fetch, calls: () => calls }
}

function countedSource() {
  const counts = { pages: 0, totals: 0 }
  const source: PageSource<Row, Filter> = {
    key: ["rows"],
    getId: (row) => row.id,
    capabilities: { position: "page", total: "exact" },
    fetchPage: async () => {
      counts.pages += 1
      return { items: [{ id: "a", name: "a" }], hasMore: false }
    },
    fetchTotal: async () => {
      counts.totals += 1
      return 1
    },
  }
  return { source, counts }
}

const firstPage: PageRequest<Filter> = { filter: {}, sort: [], size: 2, position: { page: 1 } }

function setup(options: DataClientOptions = {}) {
  const client = createDataClient({ staleTime: 0, ...options })
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider client={client}>{children}</DataProvider>
  return { client, wrapper }
}

function refocus() {
  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
}

function reconnect() {
  act(() => {
    onlineManager.setOnline(false)
    onlineManager.setOnline(true)
  })
}

// Lets a refetch the event should not start show up before asserting nothing ran.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)))

afterEach(() => {
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})

describe("window focus", () => {
  test("the client's default doesn't reload on focus; a query's refetchOnWindowFocus does", async () => {
    const quiet = counted()
    const eager = counted()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        quiet: useServerQuery(["rows", "quiet"], quiet.fetch),
        eager: useServerQuery(["rows", "eager"], eager.fetch, { refetchOnWindowFocus: true }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.eager.status).toBe("success"))
    await waitFor(() => expect(result.current.quiet.status).toBe("success"))
    refocus()
    await waitFor(() => expect(eager.calls()).toBe(2))
    await settle()
    expect(quiet.calls()).toBe(1)
  })

  test('a fresh query reloads on focus only with "always"', async () => {
    const stale = counted()
    const always = counted()
    const { wrapper } = setup({ staleTime: 60_000 })
    const { result } = renderHook(
      () => ({
        stale: useServerQuery(["rows", "stale"], stale.fetch, { refetchOnWindowFocus: true }),
        always: useServerQuery(["rows", "always"], always.fetch, { refetchOnWindowFocus: "always" }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.always.status).toBe("success"))
    await waitFor(() => expect(result.current.stale.status).toBe("success"))
    refocus()
    await waitFor(() => expect(always.calls()).toBe(2))
    await settle()
    expect(stale.calls()).toBe(1)
  })

  test("a client that reloads on focus is overridden by a query's false", async () => {
    const quiet = counted()
    const other = counted()
    const { wrapper } = setup({ refetchOnWindowFocus: true })
    const { result } = renderHook(
      () => ({
        quiet: useServerQuery(["rows", "quiet"], quiet.fetch, { refetchOnWindowFocus: false }),
        other: useServerQuery(["rows", "other"], other.fetch),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.quiet.status).toBe("success"))
    await waitFor(() => expect(result.current.other.status).toBe("success"))
    refocus()
    await waitFor(() => expect(other.calls()).toBe(2))
    await settle()
    expect(quiet.calls()).toBe(1)
  })

  test("a page and its total, and an infinite list, take refetchOnWindowFocus", async () => {
    const { source, counts } = countedSource()
    const { wrapper } = setup()
    const options: ReadOptions = { refetchOnWindowFocus: true }
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, firstPage, options),
        infinite: useServerInfinite(source, { filter: {}, sort: [], size: 2 }, options),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.page.total).toMatchObject({ kind: "exact", value: 1 }))
    await waitFor(() => expect(result.current.infinite.status).toBe("success"))
    expect(counts).toEqual({ pages: 2, totals: 1 })
    refocus()
    await waitFor(() => expect(counts).toEqual({ pages: 4, totals: 2 }))
  })
})

describe("reconnect", () => {
  test("a stale query reloads on reconnect by default; refetchOnReconnect: false keeps it", async () => {
    const eager = counted()
    const quiet = counted()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        eager: useServerQuery(["rows", "eager"], eager.fetch),
        quiet: useServerQuery(["rows", "quiet"], quiet.fetch, { refetchOnReconnect: false }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.eager.status).toBe("success"))
    await waitFor(() => expect(result.current.quiet.status).toBe("success"))
    reconnect()
    await waitFor(() => expect(eager.calls()).toBe(2))
    await settle()
    expect(quiet.calls()).toBe(1)
  })

  test('with networkMode "always" the default is not to reload on reconnect, as TanStack\'s', async () => {
    const local = counted()
    const asked = counted()
    const { wrapper } = setup({ networkMode: "always" })
    const { result } = renderHook(
      () => ({
        local: useServerQuery(["rows", "local"], local.fetch),
        asked: useServerQuery(["rows", "asked"], asked.fetch, { refetchOnReconnect: true }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.local.status).toBe("success"))
    await waitFor(() => expect(result.current.asked.status).toBe("success"))
    reconnect()
    await waitFor(() => expect(asked.calls()).toBe(2))
    await settle()
    expect(local.calls()).toBe(1)
  })

  test("createDataClient({ refetchOnReconnect: false }) is the default a hook's true overrides", async () => {
    const quiet = counted()
    const eager = counted()
    const { source, counts } = countedSource()
    const { wrapper } = setup({ refetchOnReconnect: false, networkMode: "always" })
    const { result } = renderHook(
      () => ({
        quiet: useServerQuery(["rows", "quiet"], quiet.fetch),
        eager: useServerQuery(["rows", "eager"], eager.fetch, { refetchOnReconnect: true }),
        page: useServerPage(source, firstPage, { refetchOnReconnect: true }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.page.total).toMatchObject({ kind: "exact", value: 1 }))
    await waitFor(() => expect(result.current.quiet.status).toBe("success"))
    await waitFor(() => expect(result.current.eager.status).toBe("success"))
    reconnect()
    await waitFor(() => expect(eager.calls()).toBe(2))
    await waitFor(() => expect(counts).toEqual({ pages: 2, totals: 2 }))
    await settle()
    expect(quiet.calls()).toBe(1)
  })
})

describe("resources", () => {
  test("a resource's definition sets them for every screen; the call's option wins", async () => {
    const fetched: string[] = []
    const detail = defineResource({
      key: (id: string) => ["rows", "detail", id],
      fetch: async (id: string) => {
        fetched.push(id)
        return { id, name: id }
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: false,
    })
    const { wrapper } = setup({ networkMode: "always" })
    const { result } = renderHook(
      () => ({
        a: useServerResource(detail, "a"),
        b: useServerResource(detail, "b", { refetchOnWindowFocus: false, refetchOnReconnect: true }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.a.status).toBe("success"))
    await waitFor(() => expect(result.current.b.status).toBe("success"))
    refocus()
    await waitFor(() => expect(fetched).toEqual(["a", "b", "a"]))
    reconnect()
    await waitFor(() => expect(fetched).toEqual(["a", "b", "a", "b"]))
    await settle()
    expect(fetched).toEqual(["a", "b", "a", "b"])
  })

  test("refetchOnMount: false keeps a stale resource's data when another screen mounts it", async () => {
    const detail = counted()
    const { wrapper } = setup()
    const first = renderHook(() => useServerQuery(["rows", "detail", "a"], detail.fetch), { wrapper })
    await waitFor(() => expect(first.result.current.status).toBe("success"))
    const second = renderHook(() => useServerQuery(["rows", "detail", "a"], detail.fetch, { refetchOnMount: false }), {
      wrapper,
    })
    expect(second.result.current.data).toEqual({ id: "a", name: "read 1" })
    await settle()
    expect(detail.calls()).toBe(1)
    renderHook(() => useServerQuery(["rows", "detail", "a"], detail.fetch), { wrapper })
    await waitFor(() => expect(detail.calls()).toBe(2))
  })
})
