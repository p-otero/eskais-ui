import type { QueryClient } from "@tanstack/react-query"
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
  type PatchOptions,
} from "@/components/ui/use-server-data"
import { useServerQuery } from "@/components/ui/use-server-query"
import { HttpError, type PageRequest, type PageResult, type PageSource } from "@/lib/page-source"

// A consumer whose every read overwrites per-item ETags can't afford a read the patch didn't need, so every test here
// counts the calls of its fetch.

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
const detailKey = ["rows", "detail", "a"]
const before = { id: "a", name: "before the write" }
const after = { id: "a", name: "after the write" }
const patched = { id: "a", name: "patched" }
const second = { id: "a", name: "second write" }
const other = { id: "b", name: "another row" }
const abortError = () => new DOMException("The operation was aborted.", "AbortError")
const rename = (rows: Row[]) => rows.map((row) => (row.id === "a" ? { ...row, name: "patched" } : row))
const renameDetail = (current: Row | undefined) => (current?.id === "a" ? { ...current, name: "patched" } : undefined)
const awaited: PatchOptions = { awaitRestarted: true, throwOnError: true }

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

/** Every error the cache records, to check a failure is reported once and an aborted read never. */
function errorsOf(client: QueryClient) {
  const errors: unknown[] = []
  client.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "error") errors.push(event.action.error)
  })
  return errors
}

/** A promise's outcome, read without awaiting it. */
function track(promise: Promise<void>) {
  const outcome: { state: "pending" | "resolved" | "rejected"; error?: unknown } = { state: "pending" }
  promise.then(
    () => {
      outcome.state = "resolved"
    },
    (error: unknown) => {
      outcome.state = "rejected"
      outcome.error = error
    },
  )
  return outcome
}

function renderDetail(wrapper: (props: { children: ReactNode }) => ReactNode) {
  const detail = deferred<Row>()
  const rendered = renderTracked(
    () => ({
      ...useServerQuery<Row, HttpError>(detailKey, detail.fetch),
      patch: usePatchSource<Row, Row>({ key: ["rows"] }),
    }),
    wrapper,
  )
  return { ...rendered, detail }
}

/** A detail with data and a reload in flight, the case where a reload that left before a write could undo it. */
async function reloading(wrapper: (props: { children: ReactNode }) => ReactNode) {
  const rendered = renderDetail(wrapper)
  const { result, detail } = rendered
  await waitFor(() => expect(detail.calls).toHaveLength(1))
  act(() => detail.calls[0]?.resolve(before))
  await waitFor(() => expect(result.current.data).toEqual(before))
  act(() => result.current.retry())
  await waitFor(() => expect(detail.calls).toHaveLength(2))
  return rendered
}

describe("awaitRestarted: the reads the patch restarted", () => {
  test("resolves once the restarted read lands, with no read the plain patch wouldn't make", async () => {
    const { wrapper } = setup()
    const { result, detail, seen } = await reloading(wrapper)
    let outcome: ReturnType<typeof track> | undefined
    act(() => {
      outcome = track(result.current.patch({ resource: renameDetail }, awaited))
    })
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    expect(result.current.data).toEqual(patched)
    await act(async () => detail.calls[1]?.resolve(before))
    expect(outcome?.state).toBe("pending")
    expect(result.current.data).toEqual(patched)

    await act(async () => detail.calls[2]?.resolve(after))
    await waitFor(() => expect(outcome?.state).toBe("resolved"))
    expect(result.current).toMatchObject({ data: after, fetching: false })
    expect(detail.calls).toHaveLength(3)
    neverFailed(seen)
  })

  test("a failed restarted read rejects with its typed error, reported once; the aborted one never", async () => {
    const { client, wrapper } = setup()
    const { result, detail } = await reloading(wrapper)
    const errors = errorsOf(client)
    let outcome: ReturnType<typeof track> | undefined
    act(() => {
      outcome = track(result.current.patch({ resource: renameDetail }, awaited))
    })
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    await act(async () => detail.calls[1]?.reject(abortError()))
    expect(outcome?.state).toBe("pending")

    const gone = new HttpError(404)
    await act(async () => detail.calls[2]?.reject(gone))
    await waitFor(() => expect(outcome?.state).toBe("rejected"))
    expect(outcome?.error).toBe(gone)
    expect(outcome?.error).toBeInstanceOf(HttpError)
    expect(errors).toEqual([gone])
    expect(result.current.error).toBe(gone)
    expect(detail.calls).toHaveLength(3)
  })

  test("a read that retries is awaited through its retries and fails once", async () => {
    const { client, wrapper } = setup(createDataClient({ retryDelay: 0, retry: 1 }))
    const { result, detail } = await reloading(wrapper)
    const errors = errorsOf(client)
    let outcome: ReturnType<typeof track> | undefined
    act(() => {
      outcome = track(result.current.patch({ resource: renameDetail }, awaited))
    })
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    await act(async () => detail.calls[2]?.reject(new HttpError(503)))
    await waitFor(() => expect(detail.calls).toHaveLength(4))
    expect(outcome?.state).toBe("pending")
    const down = new HttpError(503)
    await act(async () => detail.calls[3]?.reject(down))
    await waitFor(() => expect(outcome?.state).toBe("rejected"))
    expect(outcome?.error).toBe(down)
    expect(errors).toEqual([down])
  })

  test("without throwOnError it resolves once the read has settled, failed or not", async () => {
    const { wrapper } = setup()
    const { result, detail } = await reloading(wrapper)
    let outcome: ReturnType<typeof track> | undefined
    act(() => {
      outcome = track(result.current.patch({ resource: renameDetail }, { awaitRestarted: true }))
    })
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    expect(outcome?.state).toBe("pending")
    await act(async () => detail.calls[2]?.reject(new HttpError(404)))
    await waitFor(() => expect(outcome?.state).toBe("resolved"))
  })

  test("a second write during the awaited read: the first patch follows the restart and reports its failure", async () => {
    const { client, wrapper } = setup()
    const { result, detail } = await reloading(wrapper)
    const errors = errorsOf(client)
    let first: ReturnType<typeof track> | undefined
    let then: ReturnType<typeof track> | undefined
    act(() => {
      first = track(result.current.patch({ resource: renameDetail }, awaited))
    })
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    act(() => {
      then = track(result.current.patch({ resource: () => second }, awaited))
    })
    await waitFor(() => expect(detail.calls).toHaveLength(4))
    expect(detail.calls[2]?.signal.aborted).toBe(true)
    expect(result.current.data).toEqual(second)

    await act(async () => detail.calls[2]?.resolve(after))
    expect(result.current.data).toEqual(second)
    expect(first?.state).toBe("pending")
    const failed = new HttpError(409)
    await act(async () => detail.calls[3]?.reject(failed))
    await waitFor(() => expect(first?.state).toBe("rejected"))
    expect(then).toMatchObject({ state: "rejected", error: failed })
    expect(first?.error).toBe(failed)
    expect(errors).toEqual([failed])
    expect(detail.calls).toHaveLength(4)
  })

  test("a second write that cancels the awaited read settles it with the written answer", async () => {
    const { wrapper } = setup()
    const { result, detail, seen } = await reloading(wrapper)
    let first: ReturnType<typeof track> | undefined
    act(() => {
      first = track(result.current.patch({ resource: renameDetail }, awaited))
    })
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    await act(() => result.current.patch({ resource: () => second }, { inFlight: "cancel" }))
    await waitFor(() => expect(first?.state).toBe("resolved"))
    expect(result.current).toMatchObject({ data: second, fetching: false })
    await act(async () => detail.calls[2]?.resolve(after))
    expect(result.current.data).toEqual(second)
    expect(detail.calls).toHaveLength(3)
    neverFailed(seen)
  })

  test("an invalidation during the awaited read is followed to its own read", async () => {
    const { wrapper } = setup()
    const detail = deferred<Row>()
    const { result } = renderHook(
      () => ({
        ...useServerQuery<Row>(detailKey, detail.fetch),
        patch: usePatchSource<Row, Row>({ key: ["rows"] }),
        invalidate: useInvalidateSource({ key: ["rows"] }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    let outcome: ReturnType<typeof track> | undefined
    act(() => {
      outcome = track(result.current.patch({ resource: renameDetail }, awaited))
    })
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    act(() => void result.current.invalidate())
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    await act(async () => detail.calls[1]?.resolve(before))
    expect(outcome?.state).toBe("pending")
    await act(async () => detail.calls[2]?.resolve(after))
    await waitFor(() => expect(outcome?.state).toBe("resolved"))
    expect(result.current.data).toEqual(after)
  })

  test("a first read and a cached query nothing observes are awaited; the selection follows", async () => {
    const { client, wrapper } = setup()
    const shown = deferred<Row>()
    const unmounted = deferred<Row>()
    const { result } = renderHook(
      () => ({
        name: useServerQuery<Row, unknown, string>(detailKey, shown.fetch, { select: (row) => row.name }),
        patch: usePatchSource<Row, Row>({ key: ["rows"] }),
      }),
      { wrapper },
    )
    void client.prefetchQuery({ queryKey: ["rows", "detail", "b"], queryFn: unmounted.fetch })
    await waitFor(() => expect(shown.calls).toHaveLength(1))
    expect(unmounted.calls).toHaveLength(1)

    let outcome: ReturnType<typeof track> | undefined
    act(() => {
      outcome = track(result.current.patch({ resource: renameDetail }, awaited))
    })
    expect(shown.calls).toHaveLength(2)
    expect(unmounted.calls).toHaveLength(2)
    await act(async () => shown.calls[1]?.resolve(after))
    await waitFor(() => expect(result.current.name.data).toBe("after the write"))
    expect(outcome?.state).toBe("pending")
    await act(async () => unmounted.calls[1]?.resolve(other))
    await waitFor(() => expect(outcome?.state).toBe("resolved"))
    expect(client.getQueryData(["rows", "detail", "b"])).toEqual(other)
    expect(shown.calls).toHaveLength(2)
    expect(unmounted.calls).toHaveLength(2)
  })

  test("a query removed while awaited resolves the patch", async () => {
    const client = createDataClient({ retryDelay: 0 })
    const unmounted = deferred<Row>()
    void client.prefetchQuery({ queryKey: detailKey, queryFn: unmounted.fetch })
    const outcome = track(patchSource<Row, Row>(client, { key: ["rows"] }, { resource: () => undefined }, awaited))
    expect(unmounted.calls).toHaveLength(2)
    client.removeQueries({ queryKey: detailKey })
    await waitFor(() => expect(outcome.state).toBe("resolved"))
    expect(unmounted.calls).toHaveLength(2)
  })

  test("with nothing in flight it resolves at once and reads nothing", async () => {
    const { wrapper } = setup()
    const { result, detail } = renderDetail(wrapper)
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    act(() => detail.calls[0]?.resolve(before))
    await waitFor(() => expect(result.current.data).toEqual(before))
    await act(() => result.current.patch({ resource: renameDetail }, awaited))
    await waitFor(() => expect(result.current).toMatchObject({ data: patched, fetching: false }))
    expect(detail.calls).toHaveLength(1)
  })

  test("with refetch, a read in flight is restarted once, by the reload, and both are awaited", async () => {
    const { wrapper } = setup()
    const { result, detail } = await reloading(wrapper)
    let outcome: ReturnType<typeof track> | undefined
    act(() => {
      outcome = track(result.current.patch({ resource: renameDetail }, { ...awaited, refetch: true }))
    })
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    expect(detail.calls[1]?.signal.aborted).toBe(true)
    expect(detail.calls[2]?.signal.aborted).toBe(false)
    expect(result.current.data).toEqual(patched)
    const failed = new HttpError(409)
    await act(async () => detail.calls[2]?.reject(failed))
    await waitFor(() => expect(outcome).toMatchObject({ state: "rejected", error: failed }))
    expect(detail.calls).toHaveLength(3)
  })
})

describe('inFlight: "cancel": write the answer and stop the read', () => {
  test("a detail's reload is cancelled, not restarted; its late answer never lands", async () => {
    const { client, wrapper } = setup()
    const { result, detail, seen } = await reloading(wrapper)
    const errors = errorsOf(client)
    await act(() => result.current.patch({ resource: renameDetail }, { inFlight: "cancel" }))
    await waitFor(() => expect(result.current).toMatchObject({ status: "success", data: patched, fetching: false }))
    expect(detail.calls[1]?.signal.aborted).toBe(true)
    expect(client.isFetching({ queryKey: ["rows"] })).toBe(0)

    await act(async () => detail.calls[1]?.reject(abortError()))
    await act(async () => detail.calls[1]?.resolve(before))
    expect(result.current).toMatchObject({ data: patched, fetching: false, error: null })
    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(false)
    expect(detail.calls).toHaveLength(2)
    expect(errors).toEqual([])
    neverFailed(seen)
  })

  test("a first read the patch fills is cancelled and shows the patch", async () => {
    const { client, wrapper } = setup()
    const { result, detail, seen } = renderDetail(wrapper)
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    await act(() => result.current.patch({ resource: () => patched }, { inFlight: "cancel", awaitRestarted: true }))
    await waitFor(() => expect(result.current).toMatchObject({ status: "success", data: patched, fetching: false }))
    await act(async () => detail.calls[0]?.resolve(before))
    expect(result.current.data).toEqual(patched)
    expect(detail.calls).toHaveLength(1)
    expect(client.isFetching()).toBe(0)
    neverFailed(seen)
  })

  test("a first read the patch leaves empty still restarts, as it would without the option", async () => {
    const { wrapper } = setup()
    const { result, detail } = renderDetail(wrapper)
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    let outcome: ReturnType<typeof track> | undefined
    act(() => {
      outcome = track(result.current.patch({ resource: renameDetail }, { inFlight: "cancel", ...awaited }))
    })
    expect(detail.calls).toHaveLength(2)
    expect(result.current).toMatchObject({ status: "pending", fetching: true })
    await act(async () => detail.calls[1]?.resolve(after))
    await waitFor(() => expect(outcome?.state).toBe("resolved"))
    expect(result.current.data).toEqual(after)
    expect(detail.calls).toHaveLength(2)
  })

  test("pages, infinite lists and a selection end patched and idle", async () => {
    const { source, calls } = fakeSource()
    const { client, wrapper } = setup()
    const detail = deferred<Row>()
    const { result, seen } = renderTracked(() => {
      const page = useServerPage(source, firstPage)
      const infinite = useServerInfinite(source, { filter: {}, sort: [], size: 2 })
      const name = useServerQuery<Row, unknown, string>(detailKey, detail.fetch, { select: (row) => row.name })
      const failed = [page, infinite, name].find((state) => state.error !== null || state.status === "error")
      return {
        page,
        infinite,
        name,
        patch: usePatchSource<Row, Row>(source),
        status: failed?.status ?? "success",
        error: failed?.error ?? null,
      }
    }, wrapper)
    await waitFor(() => expect(calls).toHaveLength(2))
    act(() => {
      calls[0]?.resolve({ items: [before, other], total: 2 })
      calls[1]?.resolve({ items: [before, other], hasMore: false })
      detail.calls[0]?.resolve(before)
    })
    await waitFor(() => expect(result.current.infinite.items).toHaveLength(2))
    await waitFor(() => expect(result.current.name.data).toBe("before the write"))
    act(() => {
      result.current.page.retry()
      result.current.infinite.retry()
      void result.current.name.retry()
    })
    await waitFor(() => expect(calls).toHaveLength(4))
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    expect(client.isFetching({ queryKey: ["rows"] })).toBe(3)

    await act(() =>
      result.current.patch(
        { items: rename, resource: (current) => (current?.id === "a" ? patched : undefined) },
        { inFlight: "cancel" },
      ),
    )
    await waitFor(() => expect(result.current.page.items).toEqual([patched, other]))
    expect(result.current.infinite.items).toEqual([patched, other])
    expect(result.current.name.data).toBe("patched")
    expect(client.isFetching({ queryKey: ["rows"] })).toBe(0)
    await act(async () => {
      calls[2]?.resolve({ items: [before, other], total: 2 })
      calls[3]?.resolve({ items: [before, other], hasMore: false })
      detail.calls[1]?.resolve(before)
    })
    expect(result.current.page.items).toEqual([patched, other])
    expect(result.current.infinite.items).toEqual([patched, other])
    expect(result.current.page.total).toMatchObject({ kind: "exact", value: 2 })
    expect(calls).toHaveLength(4)
    expect(detail.calls).toHaveLength(2)
    neverFailed(seen)
  })

  test("a cached query nothing observes is cancelled outside React, its late answer dropped", async () => {
    const client = createDataClient({ retryDelay: 0 })
    const unmounted = deferred<Row>()
    client.setQueryData(detailKey, before)
    void client.fetchQuery({ queryKey: detailKey, queryFn: unmounted.fetch, staleTime: 0 })
    expect(unmounted.calls).toHaveLength(1)
    await patchSource<Row, Row>(client, { key: ["rows"] }, { resource: () => patched }, { inFlight: "cancel" })
    expect(client.getQueryState(detailKey)?.fetchStatus).toBe("idle")
    expect(client.getQueryData(detailKey)).toEqual(patched)
    unmounted.calls[0]?.resolve(after)
    await Promise.resolve()
    expect(client.getQueryData(detailKey)).toEqual(patched)
    expect(unmounted.calls).toHaveLength(1)
  })

  test("a reload of a query the patch leaves alone goes on", async () => {
    const a = deferred<Row>()
    const b = deferred<Row>()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        a: useServerQuery<Row>(detailKey, a.fetch),
        b: useServerQuery<Row>(["rows", "detail", "b"], b.fetch),
        patch: usePatchSource<Row, Row>({ key: ["rows"] }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(b.calls).toHaveLength(1))
    act(() => {
      a.calls[0]?.resolve(before)
      b.calls[0]?.resolve(other)
    })
    await waitFor(() => expect(result.current.b.data).toEqual(other))
    act(() => void result.current.b.retry())
    await waitFor(() => expect(b.calls).toHaveLength(2))
    await act(() => result.current.patch({ resource: renameDetail }, { inFlight: "cancel" }))
    expect(b.calls[1]?.signal.aborted).toBe(false)
    expect(result.current.b.fetching).toBe(true)
    act(() => b.calls[1]?.resolve({ ...other, name: "reloaded" }))
    await waitFor(() => expect(result.current.b.data?.name).toBe("reloaded"))
    expect(a.calls).toHaveLength(1)
    expect(b.calls).toHaveLength(2)
  })
})
