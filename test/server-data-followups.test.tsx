import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, test, vi } from "vitest"

import { createDataClient, DataProvider } from "@/components/ui/server-data"
import { pageKey, useServerPage, useSourceMutation } from "@/components/ui/use-server-data"
import { defineResource, useServerQuery, useServerResource } from "@/components/ui/use-server-query"
import { HttpError, type PageRequest, type PageResult, type PageSource } from "@/lib/page-source"

type Row = { id: string; name: string }
type Filter = Record<string, never>
type Pending<T> = { signal: AbortSignal; resolve: (value: T) => void; reject: (error: unknown) => void }

function fakeSource() {
  const calls: Pending<PageResult<Row>>[] = []
  const source: PageSource<Row, Filter> = {
    key: ["rows"],
    getId: (row) => row.id,
    capabilities: { position: "page", total: "exact" },
    fetchPage: (_request, { signal }) =>
      new Promise((resolve, reject) => {
        calls.push({ signal, resolve, reject })
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

const firstPage: PageRequest<Filter> = { filter: {}, sort: [], size: 2, position: { page: 1 } }

function setup(client = createDataClient({ retryDelay: 0 })) {
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider client={client}>{children}</DataProvider>
  return { client, wrapper }
}

describe("refreshOnError", () => {
  test("by default a failed mutation reloads the key before it rejects", async () => {
    const detail = fakeFetch<Row>()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        detail: useServerQuery(["rows", "detail", "a"], detail.fetch),
        save: useSourceMutation<Row, void, Row>({
          source: { key: ["rows"] },
          mutationFn: () => Promise.reject(new Error("x")),
          settle: (saved) => saved,
        }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    act(() => detail.calls[0]?.resolve({ id: "a", name: "a" }))
    await waitFor(() => expect(result.current.detail.status).toBe("success"))
    act(() => result.current.save.mutate())
    await waitFor(() => expect(detail.calls).toHaveLength(2))
    expect(result.current.save.status).toBe("pending")
    act(() => detail.calls[1]?.resolve({ id: "a", name: "a" }))
    await waitFor(() => expect(result.current.save.status).toBe("error"))
  })

  test("false: a failed command adds no read, and optimistic rows still roll back", async () => {
    const { source, calls } = fakeSource()
    const detail = fakeFetch<Row>()
    const { client, wrapper } = setup()
    const { result } = renderHook(
      () => ({
        page: useServerPage(source, firstPage),
        detail: useServerQuery([...source.key, "detail", "a"], detail.fetch),
        rename: useSourceMutation<Row, string, Row>({
          source,
          mutationFn: () => Promise.reject(new HttpError(409)),
          optimistic: (items, name) => items.map((row) => ({ ...row, name })),
          refreshOnError: false,
        }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(calls).toHaveLength(1))
    await waitFor(() => expect(detail.calls).toHaveLength(1))
    act(() => {
      calls[0]?.resolve({ items: [{ id: "a", name: "a" }], total: 1 })
      detail.calls[0]?.resolve({ id: "a", name: "a" })
    })
    await waitFor(() => expect(result.current.page.status).toBe("success"))
    await waitFor(() => expect(result.current.detail.status).toBe("success"))
    await act(() => expect(result.current.rename.mutateAsync("Renamed")).rejects.toBeInstanceOf(HttpError))
    expect(result.current.page.items).toEqual([{ id: "a", name: "a" }])
    expect(calls).toHaveLength(1)
    expect(detail.calls).toHaveLength(1)
    expect(client.getQueryState([...source.key, "detail", "a"])?.isInvalidated).toBe(false)
  })
})

describe("settle reaches queries nothing observes", () => {
  test("seeded, prefetched and unmounted queries are written; totals are only marked stale", async () => {
    const { source } = fakeSource()
    const { client, wrapper } = setup()
    const mounted = fakeFetch<Row>()
    const detailKey = (id: string) => [...source.key, "detail", id]
    client.setQueryData(detailKey("a"), { id: "a", name: "a" })
    client.setQueryData(pageKey(source, firstPage), { items: [{ id: "a", name: "a" }], total: 1 })
    client.setQueryData([...source.key, "total", {}], 1)
    const prefetch = fakeFetch<Row>()
    void client.prefetchQuery({ queryKey: detailKey("b"), queryFn: prefetch.fetch })
    await waitFor(() => expect(prefetch.calls).toHaveLength(1))

    const once = renderHook(() => useServerQuery(detailKey("c"), mounted.fetch), { wrapper })
    await waitFor(() => expect(mounted.calls).toHaveLength(1))
    act(() => mounted.calls[0]?.resolve({ id: "c", name: "c" }))
    await waitFor(() => expect(once.result.current.status).toBe("success"))
    once.unmount()

    const { result } = renderHook(
      () =>
        useSourceMutation<Row, void, Row[], Row>({
          source,
          mutationFn: async () => [
            { id: "a", name: "A" },
            { id: "b", name: "B" },
            { id: "c", name: "C" },
          ],
          settleItems: (items, saved) => items.map((row) => saved.find((s) => s.id === row.id) ?? row),
          settle: (saved, _variables, current, queryKey) => saved.find((s) => s.id === queryKey[2]) ?? current,
        }),
      { wrapper },
    )
    await act(() => result.current.mutateAsync())

    expect(client.getQueryData(detailKey("a"))).toEqual({ id: "a", name: "A" })
    expect(client.getQueryData(detailKey("b"))).toEqual({ id: "b", name: "B" })
    expect(client.getQueryData(detailKey("c"))).toEqual({ id: "c", name: "C" })
    expect(prefetch.calls[0]?.signal.aborted).toBe(true)
    act(() => prefetch.calls[0]?.resolve({ id: "b", name: "late" }))
    expect(client.getQueryData(detailKey("b"))).toEqual({ id: "b", name: "B" })
    for (const id of ["a", "b", "c"]) expect(client.getQueryState(detailKey(id))?.isInvalidated).toBe(false)
    expect(client.getQueryData(pageKey(source, firstPage))).toEqual({ items: [{ id: "a", name: "A" }], total: 1 })
    expect(client.getQueryData([...source.key, "total", {}])).toBe(1)
    expect(client.getQueryState([...source.key, "total", {}])?.isInvalidated).toBe(true)
  })
})

type Task = { id: string; title: string; comments: string[] }
type TaskSummary = { id: string; title: string }

function taskResources() {
  const full = fakeFetch<Task>()
  const summaryFetch = vi.fn(async (id: string): Promise<TaskSummary> => ({ id, title: "fetched" }))
  const summary = defineResource({
    key: (id: string) => ["tasks", "summary", id],
    fetch: (id: string) => summaryFetch(id),
    staleTime: Infinity,
  })
  const detail = defineResource({
    key: (id: string) => ["tasks", "detail", id],
    fetch: (_id: string, context: { signal: AbortSignal }) => full.fetch(context),
    seeds: (task: Task) => [summary.seed(task.id, { id: task.id, title: task.title })],
  })
  return { full, summary, summaryFetch, detail }
}

describe("seeds", () => {
  test("fill a resource nothing has mounted, which then reads them without a fetch", async () => {
    const { full, summary, summaryFetch, detail } = taskResources()
    const { client, wrapper } = setup()
    const a = renderHook(() => useServerResource(detail, "1"), { wrapper })
    await waitFor(() => expect(full.calls).toHaveLength(1))
    act(() => full.calls[0]?.resolve({ id: "1", title: "Write docs", comments: [] }))
    await waitFor(() => expect(a.result.current.status).toBe("success"))
    expect(client.getQueryData(summary.key("1"))).toEqual({ id: "1", title: "Write docs" })

    const b = renderHook(() => useServerResource(summary, "1"), { wrapper })
    expect(b.result.current).toMatchObject({ status: "success", data: { id: "1", title: "Write docs" } })
    expect(summaryFetch).not.toHaveBeenCalled()
  })

  test("an aborted fetch seeds nothing, even when it resolves anyway", async () => {
    const { full, summary, detail } = taskResources()
    const { client, wrapper } = setup()
    const a = renderHook(() => useServerResource(detail, "1"), { wrapper })
    await waitFor(() => expect(full.calls).toHaveLength(1))
    a.unmount()
    expect(full.calls[0]?.signal.aborted).toBe(true)
    await act(async () => full.calls[0]?.resolve({ id: "1", title: "Stale", comments: [] }))
    expect(client.getQueryData(summary.key("1"))).toBeUndefined()
  })

  test("data written after the fetch started is kept; older data is replaced", async () => {
    const { full, summary, detail } = taskResources()
    const { client, wrapper } = setup()
    client.setQueryData(summary.key("old"), { id: "old", title: "before" }, { updatedAt: Date.now() - 1_000 })
    const a = renderHook(() => [useServerResource(detail, "old"), useServerResource(detail, "new")], { wrapper })
    await waitFor(() => expect(full.calls).toHaveLength(2))
    client.setQueryData(summary.key("new"), { id: "new", title: "fresher" }, { updatedAt: Date.now() + 1_000 })
    act(() => {
      full.calls[0]?.resolve({ id: "old", title: "seeded", comments: [] })
      full.calls[1]?.resolve({ id: "new", title: "seeded", comments: [] })
    })
    await waitFor(() => expect(a.result.current.every((state) => state.status === "success")).toBe(true))
    expect(client.getQueryData(summary.key("old"))).toEqual({ id: "old", title: "seeded" })
    expect(client.getQueryData(summary.key("new"))).toEqual({ id: "new", title: "fresher" })
  })

  test("two screens reading one resource share its fetch; useServerQuery takes seeds too", async () => {
    const { full, summary, detail } = taskResources()
    const { client, wrapper } = setup()
    const list = fakeFetch<Task[]>()
    const { result } = renderHook(
      () => ({
        one: useServerResource(detail, "1"),
        two: useServerResource(detail, "1", { select: (task) => task.comments.length }),
        list: useServerQuery(["tasks", "list"], list.fetch, {
          seeds: (tasks) => tasks.map((task) => summary.seed(task.id, { id: task.id, title: task.title })),
        }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(full.calls).toHaveLength(1))
    await waitFor(() => expect(list.calls).toHaveLength(1))
    act(() => {
      full.calls[0]?.resolve({ id: "1", title: "A", comments: ["x", "y"] })
      list.calls[0]?.resolve([{ id: "2", title: "B", comments: [] }])
    })
    await waitFor(() => expect(result.current.two.status).toBe("success"))
    expect(result.current.one.data?.title).toBe("A")
    expect(result.current.two.data).toBe(2)
    expect(full.calls).toHaveLength(1)
    await waitFor(() => expect(client.getQueryData(summary.key("2"))).toEqual({ id: "2", title: "B" }))
  })
})

describe("select", () => {
  test("data is the selection, recomputed only when the answer changes, and an equal one keeps its identity", async () => {
    const { fetch, calls } = fakeFetch<Task>()
    const { client, wrapper } = setup()
    const select = vi.fn((task: Task) => ({ title: task.title }))
    const { result, rerender } = renderHook(() => useServerQuery(["tasks", "detail", "1"], fetch, { select }), {
      wrapper,
    })
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.resolve({ id: "1", title: "A", comments: [] }))
    await waitFor(() => expect(result.current.data).toEqual({ title: "A" }))
    const first = result.current.data
    const runs = select.mock.calls.length
    rerender()
    rerender()
    expect(select).toHaveBeenCalledTimes(runs)
    act(() => result.current.retry())
    await waitFor(() => expect(calls).toHaveLength(2))
    act(() => calls[1]?.resolve({ id: "1", title: "A", comments: ["new"] }))
    await waitFor(() => expect(client.getQueryData<Task>(["tasks", "detail", "1"])?.comments).toEqual(["new"]))
    await waitFor(() => expect(select.mock.calls.length).toBeGreaterThan(runs))
    expect(result.current.data).toBe(first)
  })
})

describe("createDataClient retry false", () => {
  test("never retries, like 0", async () => {
    const { wrapper } = setup(createDataClient({ retry: false }))
    const { fetch, calls } = fakeFetch<string>()
    const { result } = renderHook(() => useServerQuery(["down"], fetch), { wrapper })
    await waitFor(() => expect(calls).toHaveLength(1))
    act(() => calls[0]?.reject(new HttpError(503)))
    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(calls).toHaveLength(1)
  })
})
