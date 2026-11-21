import { focusManager, type QueryKey } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, test } from "vitest"

import { createDataClient, DataProvider } from "@/components/ui/server-data"
import {
  holdSource,
  patchSource,
  useHoldSource,
  useInvalidateSource,
  usePatchSource,
  useServerInfinite,
  useServerPage,
} from "@/components/ui/use-server-data"
import { useServerQuery } from "@/components/ui/use-server-query"
import { HttpError, type PageRequest, type PageResult, type PageSource } from "@/lib/page-source"

// Every test counts the calls of its fetch: a consumer whose every read overwrites per-item ETags can't afford a read
// the hold or the patch result added.

type Row = { id: string; name: string }
type Filter = Record<string, never>
type Pending<T> = { signal: AbortSignal; resolve: (value: T) => void; reject: (error: unknown) => void }
type Wrapper = (props: { children: ReactNode }) => ReactNode

function deferred<T>() {
  const calls: Pending<T>[] = []
  const fetch = ({ signal }: { signal: AbortSignal }) =>
    new Promise<T>((resolve, reject) => {
      calls.push({ signal, resolve, reject })
    })
  return { fetch, calls }
}

const source = { key: ["rows"] }
const detailKey = ["rows", "detail", "a"]
const otherKey = ["rows", "detail", "b"]
const before = { id: "a", name: "before the write" }
const after = { id: "a", name: "after the write" }
const patched = { id: "a", name: "patched" }
const other = { id: "b", name: "another row" }
const rename = (rows: Row[]) => rows.map((row) => (row.id === "a" ? { ...row, name: "patched" } : row))
const renameDetail = (current: Row | undefined) => (current?.id === "a" ? { ...current, name: "patched" } : undefined)
const fillDetail = (current: Row | undefined, queryKey: readonly unknown[]) =>
  queryKey[2] === "a" ? (current ?? patched) : undefined

function setup(client = createDataClient({ retryDelay: 0 })) {
  const wrapper: Wrapper = ({ children }) => <DataProvider client={client}>{children}</DataProvider>
  return { client, wrapper }
}

type Seen = { status: string; error: unknown }

function renderDetail(wrapper: Wrapper, key: readonly unknown[] = detailKey, options = {}) {
  const detail = deferred<Row>()
  const seen: Seen[] = []
  const rendered = renderHook(
    () => {
      const state = {
        ...useServerQuery<Row, HttpError>(key, detail.fetch, options),
        patch: usePatchSource<Row, Row>(source),
        hold: useHoldSource<Row, Row>(source),
        invalidate: useInvalidateSource(source),
      }
      seen.push({ status: state.status, error: state.error })
      return state
    },
    { wrapper },
  )
  return { ...rendered, detail, seen }
}

function neverFailed(seen: Seen[]) {
  expect(seen.some((state) => state.status === "error" || state.error !== null)).toBe(false)
}

/** A promise's outcome, read without awaiting it. */
function track<T>(promise: Promise<T>) {
  const outcome: { state: "pending" | "resolved" | "rejected"; value?: T; error?: unknown } = { state: "pending" }
  promise.then(
    (value) => {
      outcome.state = "resolved"
      outcome.value = value
    },
    (error: unknown) => {
      outcome.state = "rejected"
      outcome.error = error
    },
  )
  return outcome
}

/** A detail with data. */
async function loaded(wrapper: Wrapper, options = {}) {
  const rendered = renderDetail(wrapper, detailKey, options)
  const { result, detail } = rendered
  await waitFor(() => expect(detail.calls).toHaveLength(1))
  act(() => detail.calls[0]?.resolve(before))
  await waitFor(() => expect(result.current.data).toEqual(before))
  return rendered
}

/** A detail with data and a reload in flight. */
async function reloading(wrapper: Wrapper) {
  const rendered = await loaded(wrapper)
  act(() => rendered.result.current.retry())
  await waitFor(() => expect(rendered.detail.calls).toHaveLength(2))
  return rendered
}

const none: readonly QueryKey[] = []

afterEach(() => {
  focusManager.setFocused(undefined)
})

describe("patch resolves with what it did", () => {
  test("a patch with nothing in flight restarted nothing; one over a reload lists it", async () => {
    const { wrapper } = setup()
    const { result, detail } = await loaded(wrapper)
    let done: Awaited<ReturnType<typeof result.current.patch>> | undefined
    await act(async () => {
      done = await result.current.patch({ resource: renameDetail })
    })
    expect(done).toEqual({ written: [detailKey], cancelled: none, restarted: none, refetched: none })

    act(() => result.current.retry())
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    await act(async () => {
      done = await result.current.patch({ resource: () => after })
    })
    expect(done).toEqual({ written: [detailKey], cancelled: none, restarted: [detailKey], refetched: none })
    expect(detail.calls).toHaveLength(3)
  })

  test('inFlight: "cancel" lists the read it stopped, and a first read it left empty as restarted', async () => {
    const { wrapper } = setup()
    const { result, detail } = await reloading(wrapper)
    const cancelled = await act(() => result.current.patch({ resource: renameDetail }, { inFlight: "cancel" }))
    expect(cancelled).toEqual({ written: [detailKey], cancelled: [detailKey], restarted: none, refetched: none })

    const b = renderDetail(wrapper, otherKey)
    await waitFor(() => expect(b.detail.calls).toHaveLength(1))
    const empty = await act(() => result.current.patch({ resource: renameDetail }, { inFlight: "cancel" }))
    expect(empty).toEqual({ written: [detailKey], cancelled: none, restarted: [otherKey], refetched: none })
    expect(detail.calls).toHaveLength(2)
    expect(b.detail.calls).toHaveLength(2)
  })

  test("with refetch, reads in flight are restarted and idle shown queries refetched, each read once", async () => {
    const { wrapper } = setup()
    const { result, detail } = await reloading(wrapper)
    const b = renderDetail(wrapper, otherKey)
    await waitFor(() => expect(b.detail.calls).toHaveLength(1))
    act(() => b.detail.calls[0]?.resolve(other))
    await waitFor(() => expect(b.result.current.data).toEqual(other))

    const outcome = track(result.current.patch({ resource: renameDetail }, { refetch: true }))
    await waitFor(() => expect(b.detail.calls).toHaveLength(2))
    expect(detail.calls).toHaveLength(3)
    act(() => {
      detail.calls[2]?.resolve(after)
      b.detail.calls[1]?.resolve(other)
    })
    await waitFor(() => expect(outcome.state).toBe("resolved"))
    expect(outcome.value).toEqual({
      written: [detailKey],
      cancelled: none,
      restarted: [detailKey],
      refetched: [otherKey],
    })
  })

  test("cancel with refetch: the cancelled shown query is read again by the reload, and listed as both", async () => {
    const { wrapper } = setup()
    const { result, detail } = await reloading(wrapper)
    const outcome = track(result.current.patch({ resource: renameDetail }, { inFlight: "cancel", refetch: true }))
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    act(() => detail.calls[2]?.resolve(after))
    await waitFor(() => expect(outcome.state).toBe("resolved"))
    expect(outcome.value).toEqual({
      written: [detailKey],
      cancelled: [detailKey],
      restarted: none,
      refetched: [detailKey],
    })
  })
})

describe("holdSource: cancel now, write later", () => {
  test("cancels the read in flight now; the query stays fetching, nothing is requested, and the patch lands", async () => {
    const { client, wrapper } = setup()
    const { result, detail, seen } = await reloading(wrapper)
    let hold: ReturnType<typeof result.current.hold> | undefined
    act(() => {
      hold = result.current.hold()
    })
    expect(hold?.cancelled).toEqual([detailKey])
    expect(hold?.active).toBe(true)
    expect(detail.calls[1]?.signal.aborted).toBe(true)
    expect(result.current).toMatchObject({ data: before, fetching: true })
    await act(async () => detail.calls[1]?.resolve(before))
    expect(detail.calls).toHaveLength(2)

    const done = await act(() => (hold as NonNullable<typeof hold>).patch({ resource: () => after }))
    expect(done).toEqual({ written: [detailKey], cancelled: [detailKey], restarted: none, refetched: none })
    await waitFor(() => expect(result.current).toMatchObject({ data: after, fetching: false }))
    expect(hold?.active).toBe(false)
    expect(client.isFetching()).toBe(0)
    expect(detail.calls).toHaveLength(2)
    neverFailed(seen)
  })

  test("a first load: the caller's own fetch gives the first value, and the query's read never runs", async () => {
    const { client, wrapper } = setup()
    const { result, detail, seen } = renderDetail(wrapper)
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    const hold = holdSource<Row, Row>(client, source)
    expect(hold.cancelled).toEqual([detailKey])
    expect(detail.calls[0]?.signal.aborted).toBe(true)
    await waitFor(() => expect(result.current).toMatchObject({ status: "pending", fetching: true }))

    const own = deferred<Row>()
    const answer = own.fetch({ signal: new AbortController().signal })
    act(() => own.calls[0]?.resolve(patched))
    const saved = await answer
    await act(() => hold.patch({ resource: (current, queryKey) => fillDetail(current ?? saved, queryKey) }))
    await waitFor(() => expect(result.current).toMatchObject({ status: "success", data: patched, fetching: false }))
    await act(async () => detail.calls[0]?.resolve(before))
    expect(result.current.data).toEqual(patched)
    expect(detail.calls).toHaveLength(1)
    neverFailed(seen)
  })

  test("the caller's fetch fails: release lets the first load run once, and nothing stays pending", async () => {
    const { client, wrapper } = setup()
    const { result, detail, seen } = renderDetail(wrapper)
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    const hold = holdSource<Row, Row>(client, source)
    const failed = Promise.reject(new HttpError(500))
    await expect(failed).rejects.toBeInstanceOf(HttpError)
    act(() => hold.release())
    expect(hold.active).toBe(false)
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    act(() => hold.release())
    act(() => detail.calls[1]?.resolve(after))
    await waitFor(() => expect(result.current).toMatchObject({ status: "success", data: after, fetching: false }))
    expect(detail.calls).toHaveLength(2)
    neverFailed(seen)
  })

  test("a patch after release still writes, as a cancelling patch", async () => {
    const { client, wrapper } = setup()
    const { result, detail } = await loaded(wrapper)
    const hold = holdSource<Row, Row>(client, source)
    hold.release()
    const done = await act(() => hold.patch({ resource: renameDetail }))
    expect(done.written).toEqual([detailKey])
    await waitFor(() => expect(result.current.data).toEqual(patched))
    expect(detail.calls).toHaveLength(1)
  })

  test("a focus refetch and a retry during the hold wait, and the patch answers them without a request", async () => {
    const { wrapper } = setup()
    const { result, detail } = await loaded(wrapper, { refetchOnWindowFocus: "always" })
    const hold = result.current.hold()
    expect(hold.cancelled).toEqual(none)
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(result.current.fetching).toBe(true))
    act(() => result.current.retry())
    await act(async () => {
      await Promise.resolve()
    })
    expect(detail.calls).toHaveLength(1)

    const done = await act(() => hold.patch({ resource: renameDetail }))
    expect(done).toMatchObject({ written: [detailKey], restarted: none })
    await waitFor(() => expect(result.current).toMatchObject({ data: patched, fetching: false }))
    expect(detail.calls).toHaveLength(1)
  })

  test("a read paused by the hold runs once on release, and a mount under the key waits too", async () => {
    const { wrapper } = setup()
    const { result, detail } = await loaded(wrapper, { refetchOnWindowFocus: "always" })
    const hold = result.current.hold()
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    const b = renderDetail(wrapper, otherKey)
    await waitFor(() => expect(b.result.current).toMatchObject({ status: "pending", fetching: true }))
    expect(b.detail.calls).toHaveLength(0)
    expect(detail.calls).toHaveLength(1)

    act(() => hold.release())
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    await waitFor(() => expect(b.detail.calls).toHaveLength(1))
    act(() => {
      detail.calls[1]?.resolve(after)
      b.detail.calls[0]?.resolve(other)
    })
    await waitFor(() => expect(b.result.current.data).toEqual(other))
    expect(result.current.data).toEqual(after)
    expect(detail.calls).toHaveLength(2)
    expect(b.detail.calls).toHaveLength(1)
  })

  test("a hold's patch lets the reads it doesn't write run, lists them, and can await them with typed errors", async () => {
    const { wrapper } = setup()
    const { result, detail } = await loaded(wrapper)
    const hold = result.current.hold()
    const b = renderDetail(wrapper, otherKey)
    await waitFor(() => expect(b.result.current.fetching).toBe(true))
    const outcome = track(hold.patch({ resource: renameDetail }, { awaitRestarted: true, throwOnError: true }))
    await waitFor(() => expect(b.detail.calls).toHaveLength(1))
    expect(result.current.data).toEqual(patched)
    const gone = new HttpError(404)
    act(() => b.detail.calls[0]?.reject(gone))
    await waitFor(() => expect(outcome.state).toBe("rejected"))
    expect(outcome.error).toBe(gone)
    expect(detail.calls).toHaveLength(1)
    expect(b.detail.calls).toHaveLength(1)
  })

  test("an invalidation during the hold sends nothing and settles with the patch", async () => {
    const { wrapper } = setup()
    const { result, detail } = await loaded(wrapper)
    const hold = result.current.hold()
    const invalidated = track(result.current.invalidate())
    await waitFor(() => expect(result.current.fetching).toBe(true))
    expect(detail.calls).toHaveLength(1)
    await act(() => hold.patch({ resource: renameDetail }))
    await waitFor(() => expect(invalidated.state).toBe("resolved"))
    expect(result.current).toMatchObject({ data: patched, fetching: false })
    expect(detail.calls).toHaveLength(1)
  })

  test("a hold's patch with refetch reads each shown query once, unpaused", async () => {
    const { wrapper } = setup()
    const { result, detail } = await reloading(wrapper)
    const hold = result.current.hold()
    const outcome = track(hold.patch({ resource: renameDetail }, { refetch: true }))
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    act(() => detail.calls[2]?.resolve(after))
    await waitFor(() => expect(outcome.state).toBe("resolved"))
    expect(outcome.value).toMatchObject({ cancelled: [detailKey], refetched: [detailKey] })
    expect(result.current.data).toEqual(after)
    expect(detail.calls).toHaveLength(3)
  })

  test("overlapping holds: a read waits until every hold over it has ended", async () => {
    const { client, wrapper } = setup()
    const { result, detail } = await reloading(wrapper)
    const outer = holdSource<Row, Row>(client, source)
    const inner = holdSource<Row, Row>(client, { key: detailKey })
    expect(outer.cancelled).toEqual([detailKey])
    expect(inner.cancelled).toEqual(none)
    const b = renderDetail(wrapper, otherKey)
    await waitFor(() => expect(b.result.current.fetching).toBe(true))

    const done = await act(() => outer.patch({ resource: () => undefined }))
    expect(done.restarted).toEqual([otherKey])
    await waitFor(() => expect(b.detail.calls).toHaveLength(1))
    expect(result.current.fetching).toBe(true)
    expect(detail.calls).toHaveLength(2)

    act(() => inner.release())
    await waitFor(() => expect(detail.calls).toHaveLength(3))
    act(() => detail.calls[2]?.resolve(after))
    await waitFor(() => expect(result.current).toMatchObject({ data: after, fetching: false }))
    expect(detail.calls).toHaveLength(3)
    expect(b.detail.calls).toHaveLength(1)
  })

  test("two holds on the same key: the read waits for the second, whose patch answers it", async () => {
    const { client, wrapper } = setup()
    const { result, detail } = await reloading(wrapper)
    const first = holdSource<Row, Row>(client, source)
    const second = holdSource<Row, Row>(client, source)
    act(() => first.release())
    await act(async () => {
      await Promise.resolve()
    })
    expect(detail.calls).toHaveLength(2)
    expect(result.current.fetching).toBe(true)
    await act(() => second.patch({ resource: renameDetail }))
    await waitFor(() => expect(result.current).toMatchObject({ data: patched, fetching: false }))
    expect(detail.calls).toHaveLength(2)
  })

  test("unmounting the component that began a hold releases it; its later patch still writes", async () => {
    const { client, wrapper } = setup()
    const reader = renderDetail(wrapper)
    await waitFor(() => expect(reader.detail.calls).toHaveLength(1))
    const holder = renderHook(() => useHoldSource<Row, Row>(source), { wrapper })
    const hold = holder.result.current()
    expect(reader.detail.calls[0]?.signal.aborted).toBe(true)
    holder.unmount()
    expect(hold.active).toBe(false)
    await waitFor(() => expect(reader.detail.calls).toHaveLength(2))
    await act(() => hold.patch({ resource: fillDetail }))
    await waitFor(() => expect(reader.result.current.data).toEqual(patched))
    act(() => reader.detail.calls[1]?.resolve(after))
    expect(reader.result.current.data).toEqual(patched)
    expect(reader.detail.calls).toHaveLength(2)
    expect(client.isFetching()).toBe(0)
  })

  test("pages and infinite lists pause too, and the hold's patch writes their rows", async () => {
    const { calls, fetch } = deferred<PageResult<Row>>()
    const rows: PageSource<Row, Filter> = {
      key: ["rows"],
      getId: (row) => row.id,
      capabilities: { position: "page", total: "exact" },
      fetchPage: (_request, context) => fetch(context),
    }
    const firstPage: PageRequest<Filter> = { filter: {}, sort: [], size: 2, position: { page: 1 } }
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        page: useServerPage(rows, firstPage),
        infinite: useServerInfinite(rows, { filter: {}, sort: [], size: 2 }),
        hold: useHoldSource<Row>(rows),
      }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(2))
    let hold: ReturnType<typeof result.current.hold> | undefined
    act(() => {
      hold = result.current.hold()
    })
    expect(hold?.cancelled).toHaveLength(2)
    expect(calls.every((call) => call.signal.aborted)).toBe(true)
    const seed = { items: [before, other], total: 2 }
    const done = await act(() => (hold as NonNullable<typeof hold>).patch({ items: rename, resource: () => undefined }))
    // Neither has data yet, so nothing is written and both first loads run once now.
    expect(done.written).toEqual(none)
    expect(done.restarted).toHaveLength(2)
    await waitFor(() => expect(calls).toHaveLength(4))
    act(() => {
      calls[2]?.resolve(seed)
      calls[3]?.resolve({ items: [before, other], hasMore: false })
    })
    await waitFor(() => expect(result.current.page.items).toEqual([before, other]))
    await waitFor(() => expect(result.current.infinite.items).toEqual([before, other]))

    act(() => {
      result.current.page.retry()
    })
    await waitFor(() => expect(calls).toHaveLength(5))
    const again = result.current.hold()
    expect(again.cancelled).toHaveLength(1)
    await act(() => again.patch({ items: rename }))
    await waitFor(() => expect(result.current.page.items).toEqual([patched, other]))
    expect(result.current.infinite.items).toEqual([patched, other])
    expect(result.current.page.fetching).toBe(false)
    expect(calls).toHaveLength(5)
  })

  test("a read no hook owns is stopped and runs again on release; one the patch writes doesn't", async () => {
    const client = createDataClient({ retryDelay: 0 })
    const unmounted = deferred<Row>()
    client.setQueryData(detailKey, before)
    void client.fetchQuery({ queryKey: detailKey, queryFn: unmounted.fetch, staleTime: 0 })
    const released = holdSource<Row, Row>(client, source)
    expect(client.getQueryState(detailKey)?.fetchStatus).toBe("idle")
    expect(unmounted.calls).toHaveLength(1)
    released.release()
    expect(unmounted.calls).toHaveLength(2)

    const written = holdSource<Row, Row>(client, source)
    const done = await written.patch({ resource: renameDetail })
    expect(done).toMatchObject({ written: [detailKey], restarted: none })
    expect(client.getQueryData(detailKey)).toEqual(patched)
    expect(unmounted.calls).toHaveLength(2)
    expect(client.isFetching()).toBe(0)
  })

  test("patchSource during a hold doesn't list a read the hold still pauses", async () => {
    const { client, wrapper } = setup()
    const b = renderDetail(wrapper, otherKey)
    await waitFor(() => expect(b.detail.calls).toHaveLength(1))
    const hold = holdSource<Row, Row>(client, source)
    const done = await patchSource<Row, Row>(client, source, { resource: () => undefined })
    expect(done.restarted).toEqual(none)
    expect(b.detail.calls).toHaveLength(1)
    hold.release()
    await waitFor(() => expect(b.detail.calls).toHaveLength(2))
  })
})
