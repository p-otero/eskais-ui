import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, test, vi } from "vitest"

import { createDataClient, DataProvider, isClientError, useDataClient } from "@/components/ui/server-data"
import {
  useInvalidateSource,
  usePageController,
  useServerInfinite,
  useServerPage,
  useSourceMutation,
} from "@/components/ui/use-server-data"
import { arraySource } from "@/lib/array-source"
import { HttpError, type PageRequest, type PageResult, type PageSource } from "@/lib/page-source"
import { memoryUrlState } from "@/lib/url-state"

type Row = { id: string; name: string }
type Filter = { q?: string }

type Call = {
  request: PageRequest<Filter>
  signal: AbortSignal
  resolve: (result: PageResult<Row>) => void
  reject: (error: unknown) => void
}

function fakeSource(options: { total?: boolean } = {}) {
  const calls: Call[] = []
  const totals: { filter: Filter; resolve: (total: number) => void }[] = []
  const source: PageSource<Row, Filter> = {
    key: ["rows"],
    getId: (row) => row.id,
    capabilities: { position: "page", total: "exact" },
    fetchPage: (request, { signal }) =>
      new Promise((resolve, reject) => {
        calls.push({ request, signal, resolve, reject })
      }),
    ...(options.total
      ? {
          fetchTotal: (filter: Filter) =>
            new Promise<number>((resolve) => {
              totals.push({ filter, resolve })
            }),
        }
      : {}),
  }
  return { source, calls, totals }
}

function rows(...names: string[]): Row[] {
  return names.map((name) => ({ id: name, name }))
}

function pageRequest(page: number, filter: Filter = {}): PageRequest<Filter> {
  return { filter, sort: [], size: 2, position: { page } }
}

function setup(client = createDataClient({ retryDelay: 0 })) {
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider client={client}>{children}</DataProvider>
  return { client, wrapper }
}

describe("useServerPage", () => {
  test("pending, then success with the page, the total and page navigation", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const { result } = renderHook(() => useServerPage(source, pageRequest(1)), { wrapper })
    expect(result.current).toMatchObject({ status: "pending", fetching: true, items: [] })
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: rows("a", "b"), total: 5 }))
    await waitFor(() => expect(result.current.status).toBe("success"))
    expect(result.current).toMatchObject({
      items: rows("a", "b"),
      total: { kind: "exact", value: 5 },
      navigation: "pages",
      previous: false,
    })
  })

  test("keeps the previous rows while the next page loads, and aborts a superseded request", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const { result, rerender } = renderHook(({ page }) => useServerPage(source, pageRequest(page)), {
      wrapper,
      initialProps: { page: 1 },
    })
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: rows("a", "b"), total: 6 }))
    await waitFor(() => expect(result.current.status).toBe("success"))

    rerender({ page: 2 })
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(result.current).toMatchObject({ items: rows("a", "b"), previous: true, fetching: true, status: "success" })

    rerender({ page: 3 })
    await waitFor(() => expect(calls).toHaveLength(3))
    expect(calls[1]?.signal.aborted).toBe(true)
    act(() => calls[1]?.resolve({ items: rows("stale"), total: 6 }))
    act(() => calls[2]?.resolve({ items: rows("e", "f"), total: 6 }))
    await waitFor(() => expect(result.current.previous).toBe(false))
    expect(result.current.items).toEqual(rows("e", "f"))
  })

  test("a 4xx fails at once; a 5xx is retried twice", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const { result, rerender } = renderHook(({ page }) => useServerPage(source, pageRequest(page)), {
      wrapper,
      initialProps: { page: 1 },
    })
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.reject(new HttpError(404)))
    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(calls).toHaveLength(1)
    expect((result.current.error as HttpError).status).toBe(404)

    rerender({ page: 2 })
    await waitFor(() => expect(calls).toHaveLength(2))
    act(() => calls[1]?.reject(new HttpError(503)))
    await waitFor(() => expect(calls).toHaveLength(3))
    act(() => calls[2]?.reject(new HttpError(503)))
    await waitFor(() => expect(calls).toHaveLength(4))
    act(() => calls[3]?.resolve({ items: rows("c"), total: 3 }))
    await waitFor(() => expect(result.current.status).toBe("success"))

    act(() => result.current.retry())
    await waitFor(() => expect(calls).toHaveLength(5))
  })

  test("fetchTotal runs as its own query and never holds the rows back", async () => {
    const { source, calls, totals } = fakeSource({ total: true })
    const { wrapper } = setup()
    const { result } = renderHook(() => useServerPage(source, pageRequest(1, { q: "x" })), { wrapper })
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: rows("a", "b"), hasMore: true }))
    await waitFor(() => expect(result.current.status).toBe("success"))
    expect(result.current.total).toEqual({ kind: "none" })
    expect(totals[0]?.filter).toEqual({ q: "x" })
    act(() => totals[0]?.resolve(41))
    await waitFor(() => expect(result.current.total).toEqual({ kind: "exact", value: 41 }))
    expect(result.current.navigation).toBe("pages")
  })

  test("the query key is the source key, then the request", async () => {
    const { source, calls } = fakeSource()
    const { client, wrapper } = setup()
    renderHook(() => useServerPage(source, pageRequest(2, { q: "x" })), { wrapper })
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(client.getQueryCache().getAll()[0]?.queryKey).toEqual(["rows", "page", { q: "x" }, [], { page: 2 }, 2])
  })
})

describe("invalidation and mutations", () => {
  test("useInvalidateSource refreshes every query under the key", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({ page: useServerPage(source, pageRequest(1)), invalidate: useInvalidateSource(source) }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: rows("a"), total: 1 }))
    await waitFor(() => expect(result.current.page.status).toBe("success"))
    act(() => {
      void result.current.invalidate()
    })
    await waitFor(() => expect(calls).toHaveLength(2))
  })

  test("optimistic updates show at once and roll back on failure; settling refreshes", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const saves: { resolve: () => void; reject: (error: unknown) => void }[] = []
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, pageRequest(1)),
        rename: useSourceMutation<Row, { id: string; name: string }>({
          source,
          mutationFn: () =>
            new Promise<void>((resolve, reject) => {
              saves.push({ resolve, reject })
            }),
          optimistic: (items, change) =>
            items.map((row) => (row.id === change.id ? { ...row, name: change.name } : row)),
        }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: rows("a", "b"), total: 2 }))
    await waitFor(() => expect(result.current.page.status).toBe("success"))

    act(() => result.current.rename.mutate({ id: "a", name: "Renamed" }))
    await waitFor(() => expect(result.current.page.items[0]?.name).toBe("Renamed"))
    expect(result.current.rename.pending).toBe(true)
    await waitFor(() => expect(saves).toHaveLength(1))
    act(() => saves[0]?.reject(new HttpError(409)))
    await waitFor(() => expect(result.current.page.items[0]?.name).toBe("a"))
    await waitFor(() => expect(calls).toHaveLength(2))
    act(() => calls[1]?.resolve({ items: rows("a", "b"), total: 2 }))
    await waitFor(() => expect(result.current.rename.status).toBe("error"))

    act(() => result.current.rename.mutate({ id: "b", name: "Saved" }))
    await waitFor(() => expect(saves).toHaveLength(2))
    expect(result.current.page.items[1]?.name).toBe("Saved")
    act(() => saves[1]?.resolve())
    await waitFor(() => expect(calls).toHaveLength(3))
    act(() => calls[2]?.resolve({ items: [rows("a")[0] as Row, { id: "b", name: "Saved" }], total: 2 }))
    await waitFor(() => expect(result.current.rename.status).toBe("success"))
    expect(result.current.page.items[1]?.name).toBe("Saved")
  })

  test("without optimistic it only invalidates", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const onSuccess = vi.fn()
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, pageRequest(1)),
        remove: useSourceMutation<Row, string>({ source, mutationFn: async (id) => id, onSuccess }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: rows("a"), total: 1 }))
    await waitFor(() => expect(result.current.page.status).toBe("success"))
    act(() => result.current.remove.mutate("a"))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(onSuccess).toHaveBeenCalledWith("a", "a")
    expect(result.current.page.items).toEqual(rows("a"))
    expect(result.current.remove.pending).toBe(true)
    act(() => calls[1]?.resolve({ items: [], total: 0 }))
    await waitFor(() => expect(result.current.remove.status).toBe("success"))
    expect(result.current.page.items).toEqual([])
  })
})

describe("useServerInfinite", () => {
  test("appends page after page until the source has no more", async () => {
    const source = arraySource(rows("a", "b", "c", "d", "e"))
    const { wrapper } = setup()
    const { result } = renderHook(() => useServerInfinite(source, { filter: {}, sort: [], size: 2 }), { wrapper })
    await waitFor(() => expect(result.current.status).toBe("success"))
    expect(result.current).toMatchObject({ items: rows("a", "b"), hasMore: true, total: { kind: "exact", value: 5 } })
    await act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.pages).toHaveLength(2))
    await act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.items.map((row) => row.id)).toEqual(["a", "b", "c", "d", "e"]))
    expect(result.current.hasMore).toBe(false)
    await act(() => result.current.loadMore())
    expect(result.current.pages).toHaveLength(3)
  })

  test("follows cursors", async () => {
    const source = arraySource(rows("a", "b", "c"), { position: "cursor", total: "none" })
    const { wrapper } = setup()
    const { result } = renderHook(() => useServerInfinite(source, { filter: {}, sort: [], size: 2 }), { wrapper })
    await waitFor(() => expect(result.current.status).toBe("success"))
    await act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.items.map((row) => row.id)).toEqual(["a", "b", "c"]))
    expect(result.current.hasMore).toBe(false)
  })
})

describe("DataProvider", () => {
  test("uses the app's client when there is one", () => {
    const app = new QueryClient()
    const { result } = renderHook(() => useDataClient(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={app}>
          <DataProvider>{children}</DataProvider>
        </QueryClientProvider>
      ),
    })
    expect(result.current).toBe(app)
  })

  test("creates one with the defaults otherwise, and the hooks work with no provider at all", () => {
    const provided = renderHook(() => useDataClient(), {
      wrapper: ({ children }) => <DataProvider>{children}</DataProvider>,
    })
    const defaults = provided.result.current.getDefaultOptions().queries
    expect(defaults).toMatchObject({ staleTime: 30_000, refetchOnWindowFocus: false })
    const retry = defaults?.retry as (failures: number, error: unknown) => boolean
    expect(retry(0, new HttpError(400))).toBe(false)
    expect(retry(1, new Error("offline"))).toBe(true)
    expect(retry(2, new Error("offline"))).toBe(false)
    const bare = renderHook(() => useDataClient())
    expect(bare.result.current).toBeInstanceOf(QueryClient)
    expect(bare.result.current).not.toBe(provided.result.current)
    expect(isClientError({ status: 422 })).toBe(true)
    expect(isClientError({ status: 500 })).toBe(false)
  })
})

test("usePageController follows the URL while mounted", async () => {
  const adapter = memoryUrlState("page=3")
  const source = arraySource(rows("a"))
  const codec = {
    decode: (params: URLSearchParams) => ({ filter: {}, sort: [], page: Number(params.get("page") ?? 1), size: 25 }),
    merge: (_current: URLSearchParams, state: { page: number }) => new URLSearchParams(`page=${String(state.page)}`),
    owns: (name: string) => name === "page",
  }
  const { result, unmount } = renderHook(() => usePageController(source, { url: { adapter, codec } }))
  expect(result.current.state.page).toBe(3)
  act(() => adapter.write(new URLSearchParams("page=5"), { replace: false }))
  await waitFor(() => expect(result.current.state.page).toBe(5))
  act(() => result.current.controller.setPage(6))
  expect(adapter.read().get("page")).toBe("6")
  unmount()
})
