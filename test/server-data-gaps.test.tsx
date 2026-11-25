import { notifyManager } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, test, vi } from "vitest"

import { createDataClient, DataProvider, isTransientError } from "@/components/ui/server-data"
import {
  useInvalidateSource,
  useServerInfinite,
  useServerPage,
  useSourceMutation,
} from "@/components/ui/use-server-data"
import { useServerQuery } from "@/components/ui/use-server-query"
import { arraySource } from "@/lib/array-source"
import { HttpError, type PageRequest, type PageResult, type PageSource } from "@/lib/page-source"

type Row = { id: string; name: string }
type Filter = Record<string, never>

type Pending<T> = { signal: AbortSignal; resolve: (value: T) => void; reject: (error: unknown) => void }

function fakeSource() {
  const calls: (Pending<PageResult<Row>> & { request: PageRequest<Filter> })[] = []
  const source: PageSource<Row, Filter> = {
    key: ["rows"],
    getId: (row) => row.id,
    capabilities: { position: "page", total: "exact" },
    fetchPage: (request, { signal }) =>
      new Promise((resolve, reject) => {
        calls.push({ request, signal, resolve, reject })
      }),
  }
  return { source, calls }
}

function fakeFetch<T>() {
  const calls: Pending<T>[] = []
  const fetch = ({ signal }: { signal: AbortSignal }) =>
    new Promise<T>((resolve, reject) => {
      calls.push({ signal, resolve, reject })
    })
  return { fetch, calls }
}

function rows(...names: string[]): Row[] {
  return names.map((name) => ({ id: name, name }))
}

const firstPage: PageRequest<Filter> = { filter: {}, sort: [], size: 2, position: { page: 1 } }

function setup(client = createDataClient({ retryDelay: 0 })) {
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider client={client}>{children}</DataProvider>
  return { client, wrapper }
}

describe("useServerQuery", () => {
  test("pending, then success with the data; retry reloads", async () => {
    const { fetch, calls } = fakeFetch<Row>()
    const { wrapper } = setup()
    const { result } = renderHook(() => useServerQuery(["rows", "detail", "a"], fetch), { wrapper })
    expect(result.current).toMatchObject({ status: "pending", fetching: true, data: undefined, previous: false })
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ id: "a", name: "A" }))
    await waitFor(() => expect(result.current.status).toBe("success"))
    expect(result.current).toMatchObject({ data: { id: "a", name: "A" }, fetching: false, error: null })
    act(() => result.current.retry())
    await waitFor(() => expect(calls).toHaveLength(2))
  })

  test("aborts the request when the key changes and on unmount", async () => {
    const { fetch, calls } = fakeFetch<Row>()
    const { wrapper } = setup()
    const { result, rerender, unmount } = renderHook(({ id }) => useServerQuery(["rows", "detail", id], fetch), {
      wrapper,
      initialProps: { id: "a" },
    })
    await waitFor(() => expect(calls).toHaveLength(1))
    rerender({ id: "b" })
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[0]?.signal.aborted).toBe(true)
    expect(result.current).toMatchObject({ data: undefined, status: "pending" })
    unmount()
    expect(calls[1]?.signal.aborted).toBe(true)
  })

  test("keepPrevious keeps the last key's data while the next loads; placeholder shows before the first", async () => {
    const { fetch, calls } = fakeFetch<Row>()
    const { wrapper } = setup()
    const placeholder = { id: "", name: "Loading" }
    const { result, rerender } = renderHook(
      ({ id }) => useServerQuery(["rows", "detail", id], fetch, { keepPrevious: true, placeholder }),
      { wrapper, initialProps: { id: "a" } },
    )
    expect(result.current).toMatchObject({ data: placeholder, previous: true, status: "success" })
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ id: "a", name: "A" }))
    await waitFor(() => expect(result.current.previous).toBe(false))
    rerender({ id: "b" })
    expect(result.current).toMatchObject({ data: { id: "a", name: "A" }, previous: true, fetching: true })
  })

  test("enabled false never fetches; staleTime decides when a remount reloads", async () => {
    const { fetch, calls } = fakeFetch<string>()
    const { wrapper } = setup()
    const idle = renderHook(() => useServerQuery(["idle"], fetch, { enabled: false }), { wrapper })
    expect(idle.result.current).toMatchObject({ status: "pending", fetching: false })
    expect(calls).toHaveLength(0)

    const first = renderHook(() => useServerQuery(["stale"], fetch, { staleTime: 0 }), { wrapper })
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve("one"))
    await waitFor(() => expect(first.result.current.data).toBe("one"))
    renderHook(() => useServerQuery(["stale"], fetch, { staleTime: 0 }), { wrapper })
    await waitFor(() => expect(calls).toHaveLength(2))
  })

  test("renders on the server: pending without data, success with data the client already holds", () => {
    const { fetch, calls } = fakeFetch<Row>()
    function Detail() {
      const detail = useServerQuery(["rows", "detail", "a"], fetch)
      return <p data-status={detail.status}>{detail.data?.name}</p>
    }
    const empty = createDataClient()
    expect(
      renderToString(
        <DataProvider client={empty}>
          <Detail />
        </DataProvider>,
      ),
    ).toContain('data-status="pending"')
    const prefetched = createDataClient()
    prefetched.setQueryData(["rows", "detail", "a"], { id: "a", name: "Ada" })
    const html = renderToString(
      <DataProvider client={prefetched}>
        <Detail />
      </DataProvider>,
    )
    expect(html).toContain('data-status="success"')
    expect(html).toContain("Ada")
    expect(calls).toHaveLength(0)
  })

  test("useInvalidateSource reloads it under the source's key", async () => {
    const { fetch, calls } = fakeFetch<string>()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({ query: useServerQuery(["rows", "summary"], fetch), invalidate: useInvalidateSource({ key: ["rows"] }) }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve("one"))
    await waitFor(() => expect(result.current.query.data).toBe("one"))
    act(() => {
      void result.current.invalidate()
    })
    await waitFor(() => expect(calls).toHaveLength(2))
  })
})

describe("retry rule", () => {
  test("a function decides alone, called with the failures so far and the error", async () => {
    const rule = vi.fn((failures: number, error: unknown) => failures < 2 && isTransientError(error))
    const { wrapper } = setup(createDataClient({ retry: rule, retryDelay: 0 }))
    const { fetch, calls } = fakeFetch<string>()
    const { result } = renderHook(() => useServerQuery(["flaky"], fetch), { wrapper })
    await waitFor(() => expect(calls).toHaveLength(1))
    const offline = new TypeError("Failed to fetch")
    act(() => calls[0]?.reject(offline))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(rule).toHaveBeenLastCalledWith(0, offline)
    const ipc = Object.assign(new Error("No handler registered"), { code: "ENOHANDLER" })
    act(() => calls[1]?.reject(ipc))
    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(rule).toHaveBeenLastCalledWith(1, ipc)
    expect(calls).toHaveLength(2)
  })

  test("a number keeps the 4xx rule; retryDelay can be a function", async () => {
    const retryDelay = vi.fn(() => 0)
    const client = createDataClient({ retry: 1, retryDelay })
    const retry = client.getDefaultOptions().queries?.retry as (failures: number, error: unknown) => boolean
    expect(retry(0, new HttpError(404))).toBe(false)
    expect(retry(0, new HttpError(503))).toBe(true)
    expect(retry(1, new HttpError(503))).toBe(false)
    const { wrapper } = setup(client)
    const { fetch, calls } = fakeFetch<string>()
    renderHook(() => useServerQuery(["delayed"], fetch), { wrapper })
    await waitFor(() => expect(calls).toHaveLength(1))
    const error = new HttpError(500)
    act(() => calls[0]?.reject(error))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(retryDelay).toHaveBeenCalledWith(0, error)
  })

  test("isTransientError: network failures, timeouts, rate limits and 5xx", () => {
    expect(isTransientError(new TypeError("Failed to fetch"))).toBe(true)
    expect(isTransientError(new HttpError(503))).toBe(true)
    expect(isTransientError({ status: 429 })).toBe(true)
    expect(isTransientError({ status: 408 })).toBe(true)
    expect(isTransientError(new HttpError(404))).toBe(false)
    expect(isTransientError(new Error("IPC channel closed"))).toBe(false)
    expect(isTransientError(new SyntaxError("Unexpected token"))).toBe(false)
  })

  test("mutations never retry", () => {
    const client = createDataClient({ retry: 5 })
    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
  })
})

describe("settle", () => {
  test("writes the answer to page, infinite and resource queries, cancelling reads in flight, without a refetch", async () => {
    const { source, calls } = fakeSource()
    const detail = fakeFetch<Row>()
    const other = fakeFetch<Row>()
    const { client, wrapper } = setup()
    const saves: Pending<Row>[] = []
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, firstPage),
        infinite: useServerInfinite(source, { filter: {}, sort: [], size: 2 }),
        detail: useServerQuery([...source.key, "detail", "a"], detail.fetch),
        other: useServerQuery([...source.key, "detail", "b"], other.fetch),
        rename: useSourceMutation<Row, { id: string; name: string }, Row>({
          source,
          mutationFn: () =>
            new Promise<Row>((resolve, reject) => {
              saves.push({ signal: new AbortController().signal, resolve, reject })
            }),
          settleItems: (items, saved) => items.map((row) => (row.id === saved.id ? saved : row)),
          settle: (saved, _variables, current) => (current?.id === saved.id ? saved : undefined),
        }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(2))
    act(() => {
      for (const call of calls) call.resolve({ items: rows("a", "b"), total: 2 })
      detail.calls[0]?.resolve({ id: "a", name: "a" })
      other.calls[0]?.resolve({ id: "b", name: "b" })
    })
    await waitFor(() => expect(result.current.detail.status).toBe("success"))
    await waitFor(() => expect(result.current.other.status).toBe("success"))
    await waitFor(() => expect(result.current.infinite.status).toBe("success"))

    act(() => {
      void client.refetchQueries({ queryKey: source.key, predicate: (query) => query.queryKey[1] !== "infinite" })
    })
    await waitFor(() => expect(calls).toHaveLength(3))
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    await waitFor(() => expect(other.calls).toHaveLength(2))
    const reloads = { page: calls[2], detail: detail.calls[1], other: other.calls[1] }

    act(() => result.current.rename.mutate({ id: "a", name: "Renamed" }))
    await waitFor(() => expect(saves).toHaveLength(1))
    act(() => saves[0]?.resolve({ id: "a", name: "Saved" }))
    await waitFor(() => expect(result.current.rename.status).toBe("success"))

    expect(reloads.page?.signal.aborted).toBe(true)
    expect(reloads.detail?.signal.aborted).toBe(true)
    expect(result.current.page.items[0]).toEqual({ id: "a", name: "Saved" })
    expect(result.current.page.total).toEqual({ kind: "exact", value: 2 })
    expect(result.current.infinite.items[0]).toEqual({ id: "a", name: "Saved" })
    expect(result.current.detail).toMatchObject({ data: { id: "a", name: "Saved" }, fetching: false })
    expect(result.current.other.data).toEqual({ id: "b", name: "b" })
    act(() => reloads.page?.resolve({ items: rows("a", "b"), total: 2 }))
    expect(calls).toHaveLength(3)
    expect(detail.calls).toHaveLength(2)
    expect(result.current.page.items[0]?.name).toBe("Saved")
    expect(client.getQueryState([...source.key, "detail", "a"])?.isInvalidated).toBe(false)
    expect(reloads.other?.signal.aborted).toBe(true)
    expect(other.calls).toHaveLength(3)
    act(() => other.calls[2]?.resolve({ id: "b", name: "B" }))
    await waitFor(() => expect(result.current.other.data).toEqual({ id: "b", name: "B" }))
  })

  test("settle alone leaves the pages as they are, stale for their next mount, and requests nothing", async () => {
    const { source, calls } = fakeSource()
    const { client, wrapper } = setup()
    const onSuccess = vi.fn()
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, firstPage),
        archive: useSourceMutation<Row, string, { archived: number }>({
          source,
          mutationFn: async () => ({ archived: 1 }),
          settle: () => undefined,
          onSuccess,
        }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: rows("a"), total: 1 }))
    await waitFor(() => expect(result.current.page.status).toBe("success"))
    await act(() => result.current.archive.mutateAsync("a"))
    expect(onSuccess).toHaveBeenCalledWith({ archived: 1 }, "a")
    expect(calls).toHaveLength(1)
    expect(result.current.page.items).toEqual(rows("a"))
    expect(client.getQueryState(client.getQueryCache().getAll()[0]?.queryKey ?? [])?.isInvalidated).toBe(true)
  })

  test("a failed mutation with settleItems rolls the optimistic rows back and refreshes", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, firstPage),
        rename: useSourceMutation<Row, { id: string; name: string }, Row>({
          source,
          mutationFn: () => Promise.reject(new HttpError(409)),
          optimistic: (items, change) => items.map((row) => (row.id === change.id ? { ...row, ...change } : row)),
          settleItems: (items, saved) => items.map((row) => (row.id === saved.id ? saved : row)),
        }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: rows("a", "b"), total: 2 }))
    await waitFor(() => expect(result.current.page.status).toBe("success"))
    act(() => result.current.rename.mutate({ id: "a", name: "Renamed" }))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(result.current.page.items[0]?.name).toBe("a")
    act(() => calls[1]?.resolve({ items: rows("a", "b"), total: 2 }))
    await waitFor(() => expect(result.current.rename.status).toBe("error"))
  })
})

describe("useInvalidateSource throwOnError", () => {
  test("by default a failed reload resolves; with throwOnError it rejects with the error", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup(createDataClient({ retry: () => false }))
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, firstPage),
        quiet: useInvalidateSource(source),
        loud: useInvalidateSource(source, { throwOnError: true }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: rows("a"), total: 1 }))
    await waitFor(() => expect(result.current.page.status).toBe("success"))

    const quiet = result.current.quiet()
    await waitFor(() => expect(calls).toHaveLength(2))
    calls[1]?.reject(new HttpError(500))
    await expect(quiet).resolves.toBeUndefined()

    const loud = result.current.loud()
    await waitFor(() => expect(calls).toHaveLength(3))
    calls[2]?.reject(new HttpError(500))
    await expect(loud).rejects.toMatchObject({ status: 500 })

    const perCall = result.current.quiet({ throwOnError: true })
    await waitFor(() => expect(calls).toHaveLength(4))
    calls[3]?.reject(new HttpError(502))
    await expect(perCall).rejects.toMatchObject({ status: 502 })
    await waitFor(() => expect(result.current.page.status).toBe("error"))
  })
})

async function settledAfterOneAct() {
  const source = arraySource(rows("a", "b"))
  const { wrapper } = setup()
  const { result } = renderHook(() => useServerPage(source, firstPage), { wrapper })
  await act(async () => {
    await source.fetchPage(firstPage, { signal: new AbortController().signal })
  })
  return result.current.status
}

describe("notifyManager scheduling", () => {
  test("results reach React one setTimeout(0) after the query settles, so a single act() can see stale state", async () => {
    expect(await settledAfterOneAct()).toBe("pending")
  })

  test("setScheduler(queueMicrotask) delivers them within the act()", async () => {
    notifyManager.setScheduler(queueMicrotask)
    try {
      expect(await settledAfterOneAct()).toBe("success")
    } finally {
      notifyManager.setScheduler((callback) => setTimeout(callback, 0))
    }
  })
})
