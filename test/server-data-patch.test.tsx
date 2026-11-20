import type { InfiniteData } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, test } from "vitest"

import { createDataClient, DataProvider } from "@/components/ui/server-data"
import {
  patchSource,
  useInvalidateSource,
  usePatchSource,
  useServerInfinite,
  useServerPage,
} from "@/components/ui/use-server-data"
import { useServerQuery } from "@/components/ui/use-server-query"
import type { PageRequest, PageResult, PageSource } from "@/lib/page-source"

type Row = { id: string; name: string }
type Filter = Record<string, never>
type Pending<T> = { signal: AbortSignal; resolve: (value: T) => void; reject: (error: unknown) => void }

function deferred<T>() {
  const calls: Pending<T>[] = []
  const fetch = ({ signal }: { signal: AbortSignal }) =>
    new Promise<T>((resolve, reject) => {
      calls.push({ signal, resolve, reject })
    })
  return { fetch, calls }
}

function fakeSource() {
  const { fetch, calls } = deferred<PageResult<Row>>()
  const source: PageSource<Row, Filter> = {
    key: ["rows"],
    getId: (row) => row.id,
    capabilities: { position: "page", total: "exact" },
    fetchPage: (_request, context) => fetch(context),
  }
  return { source, calls }
}

const firstPage: PageRequest<Filter> = { filter: {}, sort: [], size: 2, position: { page: 1 } }
const before = { id: "a", name: "before the write" }
const after = { id: "a", name: "after the write" }
const patched = { id: "a", name: "patched" }
const other = { id: "b", name: "another row" }
const abortError = () => new DOMException("The operation was aborted.", "AbortError")
const rename = (rows: Row[]) => rows.map((row) => (row.id === "a" ? { ...row, name: "patched" } : row))
const renameDetail = (current: Row | undefined) => (current?.id === "a" ? { ...current, name: "patched" } : undefined)

function setup(client = createDataClient({ retryDelay: 0 })) {
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider client={client}>{children}</DataProvider>
  return { client, wrapper }
}

type Seen = { status: string; error: unknown }

function renderTracked<R extends Seen>(hook: () => R, wrapper: (props: { children: ReactNode }) => ReactNode) {
  const seen: Seen[] = []
  const rendered = renderHook(
    () => {
      const state = hook()
      seen.push({ status: state.status, error: state.error })
      return state
    },
    { wrapper },
  )
  return { ...rendered, seen }
}

function neverFailed(seen: Seen[]) {
  expect(seen.some((state) => state.status === "error" || state.error !== null)).toBe(false)
}

describe("patch while the first read is in flight", () => {
  test("nothing to patch yet: the first read starts again, and its old answer never lands", async () => {
    const detail = deferred<Row>()
    const { wrapper } = setup()
    const { result, seen } = renderTracked(
      () => ({
        ...useServerQuery<Row>(["rows", "detail", "a"], detail.fetch),
        patch: usePatchSource<Row, Row>({ key: ["rows"] }),
      }),
      wrapper,
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    await act(() => result.current.patch({ resource: renameDetail }))
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    expect(detail.calls[0]?.signal.aborted).toBe(true)
    expect(result.current).toMatchObject({ status: "pending", fetching: true, data: undefined })

    await act(async () => detail.calls[0]?.resolve(before))
    expect(result.current.data).toBeUndefined()
    act(() => detail.calls[1]?.resolve(after))
    await waitFor(() => expect(result.current).toMatchObject({ status: "success", data: after }))
    expect(detail.calls).toHaveLength(2)
    neverFailed(seen)
  })

  test("a patch that writes data shows at once; the read starts again and the old answer is dropped", async () => {
    const detail = deferred<Row>()
    const { wrapper } = setup()
    const { result, seen } = renderTracked(
      () => ({
        ...useServerQuery<Row>(["rows", "detail", "a"], detail.fetch),
        patch: usePatchSource<Row, Row>({ key: ["rows"] }),
      }),
      wrapper,
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    await act(() => result.current.patch({ resource: () => patched }, { refetch: false }))
    await waitFor(() => expect(result.current).toMatchObject({ status: "success", data: patched, fetching: true }))
    expect(detail.calls).toHaveLength(2)

    await act(async () => detail.calls[0]?.reject(abortError()))
    await act(async () => detail.calls[0]?.resolve(before))
    expect(result.current.data).toEqual(patched)
    act(() => detail.calls[1]?.resolve(after))
    await waitFor(() => expect(result.current).toMatchObject({ data: after, fetching: false }))
    neverFailed(seen)
  })

  test("a reload of a query the patch leaves alone goes on; a first read under the key starts again", async () => {
    const a = deferred<Row>()
    const b = deferred<Row>()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        a: useServerQuery<Row>(["rows", "detail", "a"], a.fetch),
        b: useServerQuery<Row>(["rows", "detail", "b"], b.fetch),
        patch: usePatchSource<Row, Row>({ key: ["rows"] }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(a.calls).toHaveLength(1))
    act(() => b.calls[0]?.resolve(other))
    await waitFor(() => expect(result.current.b.data).toEqual(other))
    act(() => void result.current.b.retry())
    await waitFor(() => expect(b.calls).toHaveLength(2))

    await act(() => result.current.patch({ resource: renameDetail }))
    expect(b.calls[1]?.signal.aborted).toBe(false)
    expect(b.calls).toHaveLength(2)
    expect(a.calls).toHaveLength(2)
    act(() => b.calls[1]?.resolve({ ...other, name: "reloaded" }))
    await waitFor(() => expect(result.current.b.data?.name).toBe("reloaded"))
  })

  test("a page's refetch in flight: the rows are patched at once and its old answer is dropped", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const { result, seen } = renderTracked(
      () => ({ ...useServerPage(source, firstPage), patch: usePatchSource(source) }),
      wrapper,
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: [before, other], total: 2 }))
    await waitFor(() => expect(result.current.items).toEqual([before, other]))
    act(() => result.current.retry())
    await waitFor(() => expect(calls).toHaveLength(2))

    await act(() => result.current.patch({ items: rename }))
    await waitFor(() => expect(result.current.items).toEqual([patched, other]))
    expect(calls[1]?.signal.aborted).toBe(true)
    expect(calls).toHaveLength(3)
    await act(async () => calls[1]?.resolve({ items: [before, other], total: 2 }))
    expect(result.current.items).toEqual([patched, other])
    act(() => calls[2]?.resolve({ items: [after, other], total: 2 }))
    await waitFor(() => expect(result.current.items).toEqual([after, other]))
    expect(result.current.total).toMatchObject({ kind: "exact", value: 2 })
    neverFailed(seen)
  })

  test("an infinite list's first read starts again; the restarted answer lands", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const { result, seen } = renderTracked(
      () => ({ ...useServerInfinite(source, { filter: {}, sort: [], size: 2 }), patch: usePatchSource(source) }),
      wrapper,
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    await act(() => result.current.patch({ items: rename }))
    await waitFor(() => expect(calls).toHaveLength(2))
    await act(async () => calls[0]?.resolve({ items: [before], hasMore: false }))
    expect(result.current.items).toEqual([])
    act(() => calls[1]?.resolve({ items: [after], hasMore: false }))
    await waitFor(() => expect(result.current.items).toEqual([after]))
    neverFailed(seen)
  })
})

describe("patch with nothing in flight", () => {
  test("writes pages, infinite lists, resources and queries nothing observes, with no request", async () => {
    const { source, calls } = fakeSource()
    const detail = deferred<Row>()
    const { client, wrapper } = setup()
    client.setQueryData(["rows", "detail", "seeded"], { id: "a", name: "seeded" })
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, firstPage),
        infinite: useServerInfinite(source, { filter: {}, sort: [], size: 2 }),
        detail: useServerQuery<Row>(["rows", "detail", "a"], detail.fetch),
        patch: usePatchSource<Row, Row>(source),
      }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(2))
    act(() => {
      calls[0]?.resolve({ items: [before, other], total: 2 })
      calls[1]?.resolve({ items: [before, other], hasMore: false })
      detail.calls[0]?.resolve(before)
    })
    await waitFor(() => expect(result.current.detail.data).toEqual(before))
    await waitFor(() => expect(result.current.infinite.items).toHaveLength(2))

    await act(() => result.current.patch({ items: rename, resource: renameDetail }))
    await waitFor(() => expect(result.current.page.items).toEqual([patched, other]))
    expect(result.current.infinite.items).toEqual([patched, other])
    expect(result.current.detail.data).toEqual(patched)
    expect(client.getQueryData(["rows", "detail", "seeded"])).toEqual(patched)
    expect(result.current.page.total).toMatchObject({ kind: "exact", value: 2 })
    expect(calls).toHaveLength(2)
    expect(detail.calls).toHaveLength(1)
    expect(client.getQueryState(["rows", "detail", "a"])?.isInvalidated).toBe(false)
  })

  test("refetch reloads the key after the patch and resolves once it has", async () => {
    const detail = deferred<Row>()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        ...useServerQuery<Row>(["rows", "detail", "a"], detail.fetch),
        patch: usePatchSource<Row, Row>({ key: ["rows"] }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    act(() => detail.calls[0]?.resolve(before))
    await waitFor(() => expect(result.current.data).toEqual(before))

    let reloaded = false
    act(() => {
      void result.current.patch({ resource: renameDetail }, { refetch: true }).then(() => {
        reloaded = true
      })
    })
    await waitFor(() => expect(result.current).toMatchObject({ data: patched, fetching: true }))
    expect(detail.calls).toHaveLength(2)
    expect(reloaded).toBe(false)
    act(() => detail.calls[1]?.resolve(after))
    await waitFor(() => expect(reloaded).toBe(true))
    expect(result.current.data).toEqual(after)
  })

  test("patchSource works outside React, on the client, for a push event", () => {
    const client = createDataClient()
    const page: PageResult<Row> = { items: [before], total: 1 }
    const infinite: InfiniteData<PageResult<Row>> = { pages: [page], pageParams: [1] }
    client.setQueryData(["rows", "page", {}, [], { page: 1 }, 2], page)
    client.setQueryData(["rows", "infinite", {}, [], 2], infinite)
    client.setQueryData(["rows", "total", {}], 1)
    void patchSource<Row>(client, { key: ["rows"] }, { items: rename })
    expect(client.getQueryData(["rows", "page", {}, [], { page: 1 }, 2])).toEqual({ items: [patched], total: 1 })
    expect(
      client.getQueryData<InfiniteData<PageResult<Row>>>(["rows", "infinite", {}, [], 2])?.pages[0]?.items,
    ).toEqual([patched])
    expect(client.getQueryData(["rows", "total", {}])).toBe(1)
  })

  test("a reload already running when the patch lands is joined by useInvalidateSource, not doubled", async () => {
    const detail = deferred<Row>()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        ...useServerQuery<Row>(["rows", "detail", "a"], detail.fetch),
        patch: usePatchSource<Row, Row>({ key: ["rows"] }),
        invalidate: useInvalidateSource({ key: ["rows"] }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    act(() => detail.calls[0]?.resolve(before))
    await waitFor(() => expect(result.current.data).toEqual(before))
    let reloaded: Promise<void> | undefined
    act(() => {
      reloaded = result.current.invalidate({ throwOnError: true })
    })
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    await act(() => result.current.patch({ resource: renameDetail }))
    expect(detail.calls).toHaveLength(3)
    await waitFor(() => expect(result.current.data).toEqual(patched))
    act(() => detail.calls[2]?.resolve(after))
    await act(() => reloaded)
    await waitFor(() => expect(result.current.data).toEqual(after))
  })
})
