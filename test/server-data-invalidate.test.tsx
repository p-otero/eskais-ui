import { onlineManager } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { useRef, type ReactNode } from "react"
import { afterEach, describe, expect, test } from "vitest"

import { createDataClient, DataProvider } from "@/components/ui/server-data"
import {
  useInvalidateSource,
  useServerInfinite,
  useServerPage,
  useSourceMutation,
} from "@/components/ui/use-server-data"
import { useServerQuery } from "@/components/ui/use-server-query"
import { HttpError, type PageRequest, type PageResult, type PageSource } from "@/lib/page-source"

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
const abortError = () => new DOMException("The operation was aborted.", "AbortError")

function setup(client = createDataClient({ retryDelay: 0 })) {
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider client={client}>{children}</DataProvider>
  return { client, wrapper }
}

type Seen = { status: string; error: unknown }

/** Renders `hook` and records the status and error of every render, to catch a flash of error. */
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

describe("a write lands while the first read is pending", () => {
  test("useInvalidateSource restarts the first read of a useServerQuery; the old answer never lands", async () => {
    const detail = deferred<Row>()
    const { wrapper } = setup()
    const { result, seen } = renderTracked(
      () => ({
        ...useServerQuery(["rows", "detail", "a"], detail.fetch),
        invalidate: useInvalidateSource({ key: ["rows"] }),
      }),
      wrapper,
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    let reloaded: Promise<void> | undefined
    act(() => {
      reloaded = result.current.invalidate()
    })
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    expect(detail.calls[0]?.signal.aborted).toBe(true)
    expect(result.current).toMatchObject({ status: "pending", fetching: true })

    act(() => detail.calls[1]?.resolve(after))
    await act(() => reloaded)
    await waitFor(() => expect(result.current.data).toEqual(after))
    await act(async () => detail.calls[0]?.resolve(before))
    expect(result.current.data).toEqual(after)
    expect(detail.calls).toHaveLength(2)
    neverFailed(seen)
  })

  test("the old read's AbortError rejection surfaces nowhere, nor in throwOnError", async () => {
    const detail = deferred<Row>()
    const { wrapper } = setup()
    const { result, seen } = renderTracked(
      () => ({
        ...useServerQuery(["rows", "detail", "a"], detail.fetch),
        invalidate: useInvalidateSource({ key: ["rows"] }),
      }),
      wrapper,
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    let reloaded: Promise<void> | undefined
    act(() => {
      reloaded = result.current.invalidate({ throwOnError: true })
    })
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    await act(async () => detail.calls[0]?.reject(abortError()))
    expect(result.current).toMatchObject({ status: "pending", fetching: true, error: null })

    act(() => detail.calls[1]?.resolve(after))
    await act(() => reloaded)
    await waitFor(() => expect(result.current).toMatchObject({ status: "success", data: after }))
    expect(detail.calls).toHaveLength(2)
    neverFailed(seen)
  })

  test("throwOnError rejects with the restarted read's error, not the aborted one's", async () => {
    const detail = deferred<Row>()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        ...useServerQuery(["rows", "detail", "a"], detail.fetch),
        invalidate: useInvalidateSource({ key: ["rows"] }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    let reloaded: Promise<void> | undefined
    act(() => {
      reloaded = result.current.invalidate({ throwOnError: true })
    })
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    act(() => detail.calls[1]?.reject(new HttpError(404)))
    await act(() => expect(reloaded).rejects.toBeInstanceOf(HttpError))
    await waitFor(() => expect(result.current.status).toBe("error"))
    await act(async () => detail.calls[0]?.resolve(before))
    expect(result.current).toMatchObject({ status: "error", data: undefined })
  })

  test("a mutation's refresh after success restarts it", async () => {
    const detail = deferred<Row>()
    const { wrapper } = setup()
    const { result, seen } = renderTracked(
      () => ({
        ...useServerQuery(["rows", "detail", "a"], detail.fetch),
        save: useSourceMutation<Row, void, null>({ source: { key: ["rows"] }, mutationFn: async () => null }),
      }),
      wrapper,
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    act(() => result.current.save.mutate())
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    expect(detail.calls[0]?.signal.aborted).toBe(true)
    expect(result.current.save.pending).toBe(true)
    act(() => detail.calls[1]?.resolve(after))
    await waitFor(() => expect(result.current.save.status).toBe("success"))
    await act(async () => detail.calls[0]?.resolve(before))
    expect(result.current.data).toEqual(after)
    neverFailed(seen)
  })

  test("a failed mutation's refresh restarts it", async () => {
    const detail = deferred<Row>()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        detail: useServerQuery(["rows", "detail", "a"], detail.fetch),
        save: useSourceMutation<Row, void, null>({
          source: { key: ["rows"] },
          mutationFn: () => Promise.reject(new HttpError(409)),
        }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    act(() => result.current.save.mutate())
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    act(() => detail.calls[1]?.resolve(after))
    await waitFor(() => expect(result.current.save.status).toBe("error"))
    await act(async () => detail.calls[0]?.resolve(before))
    expect(result.current.detail).toMatchObject({ status: "success", data: after, error: null })
  })

  test("settle restarts the first reads it doesn't write", async () => {
    const detailA = deferred<Row>()
    const detailB = deferred<Row>()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        a: useServerQuery(["rows", "detail", "a"], detailA.fetch),
        b: useServerQuery(["rows", "detail", "b"], detailB.fetch),
        save: useSourceMutation<Row, void, Row>({
          source: { key: ["rows"] },
          mutationFn: async () => after,
          settle: (saved, _variables, current, queryKey) => (queryKey[2] === saved.id ? saved : current),
        }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(detailA.calls).toHaveLength(1))
    await waitFor(() => expect(detailB.calls).toHaveLength(1))
    await act(() => result.current.save.mutateAsync())
    await waitFor(() => expect(result.current.a.data).toEqual(after))
    await waitFor(() => expect(detailB.calls).toHaveLength(2))
    expect(detailB.calls[0]?.signal.aborted).toBe(true)
    act(() => detailB.calls[1]?.resolve({ id: "b", name: "after the write" }))
    await act(async () => detailB.calls[0]?.resolve({ id: "b", name: "before the write" }))
    await waitFor(() => expect(result.current.b.data).toEqual({ id: "b", name: "after the write" }))
    await act(async () => detailA.calls[0]?.resolve(before))
    expect(result.current.a.data).toEqual(after)
  })

  test("useServerPage restarts its first page", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const { result, seen } = renderTracked(
      () => ({ ...useServerPage(source, firstPage), invalidate: useInvalidateSource(source) }),
      wrapper,
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => void result.current.invalidate())
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[0]?.signal.aborted).toBe(true)
    await act(async () => calls[0]?.reject(abortError()))
    expect(result.current).toMatchObject({ status: "pending", fetching: true })
    act(() => calls[1]?.resolve({ items: [after], total: 1 }))
    await waitFor(() => expect(result.current.items).toEqual([after]))
    await act(async () => calls[0]?.resolve({ items: [before], total: 1 }))
    expect(result.current.items).toEqual([after])
    neverFailed(seen)
  })

  test("useServerInfinite restarts its first page", async () => {
    const { source, calls } = fakeSource()
    const { wrapper } = setup()
    const { result, seen } = renderTracked(
      () => ({
        ...useServerInfinite(source, { filter: {}, sort: [], size: 2 }),
        invalidate: useInvalidateSource(source),
      }),
      wrapper,
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => void result.current.invalidate())
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[0]?.signal.aborted).toBe(true)
    await act(async () => calls[0]?.resolve({ items: [before], total: 1 }))
    expect(result.current).toMatchObject({ status: "pending", fetching: true, items: [] })
    act(() => calls[1]?.resolve({ items: [after], total: 1 }))
    await waitFor(() => expect(result.current.items).toEqual([after]))
    neverFailed(seen)
  })

  test("a first read nothing observes, such as a prefetch, starts again too", async () => {
    const prefetch = deferred<Row>()
    const { client, wrapper } = setup()
    void client.prefetchQuery({ queryKey: ["rows", "detail", "a"], queryFn: prefetch.fetch })
    await waitFor(() => expect(prefetch.calls).toHaveLength(1))
    const { result } = renderHook(() => useInvalidateSource({ key: ["rows"] }), { wrapper })
    await act(async () => void result.current())
    expect(prefetch.calls).toHaveLength(2)
    expect(prefetch.calls[0]?.signal.aborted).toBe(true)
    act(() => prefetch.calls[1]?.resolve(after))
    await act(async () => prefetch.calls[0]?.resolve(before))
    await waitFor(() => expect(client.getQueryData(["rows", "detail", "a"])).toEqual(after))
  })
})

describe("networkMode", () => {
  afterEach(() => onlineManager.setOnline(true))

  test("offline, the default pauses the first read; always fetches and can reach its error", async () => {
    onlineManager.setOnline(false)
    const paused = deferred<Row>()
    const { wrapper } = setup(createDataClient({ retry: false }))
    const online = renderHook(() => useServerQuery(["rows", "detail", "a"], paused.fetch), { wrapper })
    await act(async () => {})
    expect(paused.calls).toHaveLength(0)
    expect(online.result.current).toMatchObject({ status: "pending", fetching: false })

    const always = deferred<Row>()
    const local = renderHook(() => useServerQuery(["rows", "detail", "b"], always.fetch, { networkMode: "always" }), {
      wrapper,
    })
    await waitFor(() => expect(always.calls).toHaveLength(1))
    act(() => always.calls[0]?.reject(new Error("unreachable")))
    await waitFor(() => expect(local.result.current.status).toBe("error"))
  })

  test("createDataClient sets it for every read and write", async () => {
    onlineManager.setOnline(false)
    const { source, calls } = fakeSource()
    const writes: number[] = []
    const { wrapper } = setup(createDataClient({ networkMode: "always" }))
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, firstPage),
        save: useSourceMutation<Row, number, null>({
          source,
          mutationFn: async (n) => {
            writes.push(n)
            return null
          },
          refreshOnError: false,
        }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ items: [before], total: 1 }))
    await waitFor(() => expect(result.current.page.status).toBe("success"))
    act(() => result.current.save.mutate(1))
    await waitFor(() => expect(writes).toEqual([1]))
  })

  test("a hook's own networkMode wins over the client's", async () => {
    onlineManager.setOnline(false)
    const { source, calls } = fakeSource()
    const { wrapper } = setup(createDataClient({ networkMode: "always" }))
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, firstPage, { networkMode: "online" }),
        infinite: useServerInfinite(source, { filter: {}, sort: [], size: 2 }, { networkMode: "online" }),
      }),
      { wrapper },
    )
    await act(async () => {})
    expect(calls).toHaveLength(0)
    expect(result.current.page.fetching).toBe(false)
    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(calls).toHaveLength(2))
  })
})

function writer() {
  const calls: Pending<null>[] = []
  const started: string[] = []
  const mutationFn = (name: string) =>
    new Promise<null>((resolve, reject) => {
      started.push(name)
      calls.push({ signal: new AbortController().signal, resolve, reject })
    })
  return { calls, started, mutationFn }
}

describe("mutation scope", () => {
  test("mutations in one scope run one at a time, in order, across hooks", async () => {
    const { calls, started, mutationFn } = writer()
    const { wrapper } = setup()
    const options = { source: { key: ["rows"] }, mutationFn, scope: { id: "rows" }, refreshOnError: false }
    const { result } = renderHook(
      () => ({
        one: useSourceMutation<Row, string, null>(options),
        two: useSourceMutation<Row, string, null>(options),
      }),
      { wrapper },
    )
    act(() => {
      result.current.one.mutate("first")
      result.current.two.mutate("second")
    })
    await waitFor(() => expect(started).toEqual(["first"]))
    await act(async () => calls[0]?.reject(new HttpError(409)))
    await waitFor(() => expect(started).toEqual(["first", "second"]))
    act(() => calls[1]?.resolve(null))
    await waitFor(() => expect(result.current.two.status).toBe("success"))
    expect(result.current.one.status).toBe("error")
  })

  test("different scopes, or none, run side by side", async () => {
    const { started, mutationFn } = writer()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        one: useSourceMutation<Row, string, null>({ source: { key: ["rows"] }, mutationFn, scope: { id: "a" } }),
        two: useSourceMutation<Row, string, null>({ source: { key: ["rows"] }, mutationFn, scope: { id: "b" } }),
        three: useSourceMutation<Row, string, null>({ source: { key: ["rows"] }, mutationFn }),
      }),
      { wrapper },
    )
    act(() => {
      result.current.one.mutate("a")
      result.current.two.mutate("b")
      result.current.three.mutate("none")
    })
    await waitFor(() => expect(started).toEqual(["a", "b", "none"]))
  })

  test("a flag set in onError stops the queue at the first failure", async () => {
    const saved: string[] = []
    const { wrapper } = setup()
    const { result } = renderHook(
      () => {
        const failed = useRef(false)
        const save = useSourceMutation<Row, string, null>({
          source: { key: ["rows"] },
          scope: { id: "steps" },
          refreshOnError: false,
          mutationFn: async (step) => {
            if (failed.current) throw new Error(`skipped ${step}`)
            if (step === "two") throw new HttpError(409)
            saved.push(step)
            return null
          },
          onError: () => {
            failed.current = true
          },
        })
        return save
      },
      { wrapper },
    )
    const steps = ["one", "two", "three", "four"]
    let results: PromiseSettledResult<null>[] = []
    await act(async () => {
      results = await Promise.allSettled(steps.map((step) => result.current.mutateAsync(step)))
    })
    expect(saved).toEqual(["one"])
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "rejected", "rejected"])
  })

  test("mutationKey reaches the mutation cache", async () => {
    const { mutationFn } = writer()
    const { client, wrapper } = setup()
    const { result } = renderHook(
      () =>
        useSourceMutation<Row, string, null>({ source: { key: ["rows"] }, mutationFn, mutationKey: ["rows", "save"] }),
      { wrapper },
    )
    act(() => result.current.mutate("x"))
    await waitFor(() => expect(client.isMutating({ mutationKey: ["rows", "save"] })).toBe(1))
  })
})
