import { focusManager } from "@tanstack/react-query"
import { act, render, renderHook, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { createDataClient, DataProvider } from "@/components/ui/server-data"
import { holdSource } from "@/components/ui/server-data-hold"
import { ServerDataTable } from "@/components/ui/server-data-table"
import { ServerList } from "@/components/ui/server-list"
import { useInvalidateSource, useServerInfinite, useServerPage } from "@/components/ui/use-server-data"
import { useServerQuery, type ServerQueryState } from "@/components/ui/use-server-query"
import type { PageRequest, PageSource } from "@/lib/page-source"

type Login = { status: "pending" | "done"; read: number }
type Row = { id: string; name: string }
type Filter = Record<string, never>

function server(options: { latencyMs?: number; doneAfter?: number } = {}) {
  const latencyMs = options.latencyMs ?? 0
  const log = { calls: 0, inFlight: 0, mostInFlight: 0, keys: [] as unknown[] }
  const fetch = (key: unknown) => async () => {
    log.calls += 1
    log.keys.push(key)
    log.inFlight += 1
    log.mostInFlight = Math.max(log.mostInFlight, log.inFlight)
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
    log.inFlight -= 1
    const done = options.doneAfter !== undefined && log.calls >= options.doneAfter
    return { status: done ? "done" : "pending", read: log.calls } satisfies Login
  }
  return { fetch, log }
}

function setup() {
  const client = createDataClient({ staleTime: Infinity, retry: false })
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider client={client}>{children}</DataProvider>
  return { client, wrapper }
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

let visibility: DocumentVisibilityState = "visible"

function showDocument(state: DocumentVisibilityState) {
  visibility = state
  act(() => {
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }))
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = "visible"
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  focusManager.setFocused(undefined)
})

describe("refetchInterval", () => {
  test("off: no timer is set and nothing reloads", async () => {
    const { fetch, log } = server()
    const { wrapper } = setup()
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout")
    const { result } = renderHook(() => useServerQuery(["login"], fetch("login")), { wrapper })
    await advance(10)
    expect(result.current.status).toBe("success")
    const gcTimeMs = 5 * 60_000
    const delays = setTimeoutSpy.mock.calls.map(([, delay]) => delay ?? 0)
    expect(delays.filter((delay) => delay > 0 && delay !== gcTimeMs)).toEqual([])
    await advance(60_000)
    expect(log.calls).toBe(1)
  })

  test("a number reloads every interval after the last read settled", async () => {
    const { fetch, log } = server()
    const { wrapper } = setup()
    renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 1000 }), { wrapper })
    await advance(10)
    expect(log.calls).toBe(1)
    await advance(1000)
    expect(log.calls).toBe(2)
    await advance(1000)
    expect(log.calls).toBe(3)
  })

  test("a function polls while its condition holds and stops when it ends", async () => {
    const { fetch, log } = server({ doneAfter: 3 })
    const { wrapper } = setup()
    const { result } = renderHook(
      () =>
        useServerQuery<Login>(["login"], fetch("login"), {
          refetchInterval: (state) => (state.data?.status === "pending" ? 2000 : false),
        }),
      { wrapper },
    )
    await advance(10)
    expect(result.current.data?.status).toBe("pending")
    await advance(2000)
    expect(log.calls).toBe(2)
    await advance(2000)
    expect(log.calls).toBe(3)
    expect(result.current.data?.status).toBe("done")
    await advance(20_000)
    expect(log.calls).toBe(3)
  })

  test("a function gets the hook's state", async () => {
    const { fetch } = server()
    const { wrapper } = setup()
    const seen: ServerQueryState<string>[] = []
    renderHook(
      () =>
        useServerQuery(["login"], fetch("login"), {
          select: (login) => login.status,
          refetchInterval: (state) => {
            seen.push(state)
            return false
          },
        }),
      { wrapper },
    )
    await advance(10)
    expect(seen.at(-1)).toMatchObject({ data: "pending", status: "success", fetching: false, polling: false })
  })

  test("a poll keeps the data: fetching and polling are true, status stays success", async () => {
    const { fetch } = server({ latencyMs: 500 })
    const { wrapper } = setup()
    const { result } = renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 1000 }), {
      wrapper,
    })
    await advance(510)
    expect(result.current).toMatchObject({ status: "success", fetching: false, polling: false, data: { read: 1 } })
    await advance(1100)
    expect(result.current).toMatchObject({ status: "success", fetching: true, polling: true, data: { read: 1 } })
    await advance(500)
    expect(result.current).toMatchObject({ status: "success", fetching: false, polling: false, data: { read: 2 } })
  })

  test("a reload someone asked for isn't a poll", async () => {
    const { fetch } = server({ latencyMs: 500 })
    const { wrapper } = setup()
    const { result } = renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 10_000 }), {
      wrapper,
    })
    await advance(510)
    act(() => result.current.retry())
    await advance(10)
    expect(result.current).toMatchObject({ fetching: true, polling: false })
  })

  test("requests never stack: the next poll waits for the slow one to settle", async () => {
    const { fetch, log } = server({ latencyMs: 3000 })
    const { wrapper } = setup()
    renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 1000 }), { wrapper })
    await advance(3000)
    expect(log.calls).toBe(1)
    await advance(999)
    expect(log.calls).toBe(1)
    await advance(1)
    expect(log.calls).toBe(2)
    await advance(3999)
    expect(log.calls).toBe(2)
    await advance(1)
    expect(log.calls).toBe(3)
    expect(log.mostInFlight).toBe(1)
  })

  test("a hold pauses the poll's request until it ends", async () => {
    const { fetch, log } = server()
    const { client, wrapper } = setup()
    renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 1000 }), { wrapper })
    await advance(10)
    const hold = holdSource(client, { key: ["login"] })
    await advance(5000)
    expect(log.calls).toBe(1)
    act(() => hold.release())
    await advance(10)
    expect(log.calls).toBe(2)
    await advance(1000)
    expect(log.calls).toBe(3)
  })

  test("a reload from elsewhere restarts the count from when it settles", async () => {
    const { fetch, log } = server()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        login: useServerQuery(["login"], fetch("login"), { refetchInterval: 1000 }),
        invalidate: useInvalidateSource({ key: ["login"] }),
      }),
      { wrapper },
    )
    await advance(700)
    await act(() => result.current.invalidate())
    expect(log.calls).toBe(2)
    await advance(700)
    expect(log.calls).toBe(2)
    await advance(300)
    expect(log.calls).toBe(3)
  })
})

describe("hidden document", () => {
  test("stops while hidden and, visible again, reloads at once when an interval went by", async () => {
    const { fetch, log } = server()
    const { wrapper } = setup()
    renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 1000 }), { wrapper })
    await advance(10)
    showDocument("hidden")
    await advance(10_000)
    expect(log.calls).toBe(1)
    showDocument("visible")
    await advance(0)
    expect(log.calls).toBe(2)
    await advance(1000)
    expect(log.calls).toBe(3)
  })

  test("visible again before the interval went by, it waits for the rest of it", async () => {
    const { fetch, log } = server()
    const { wrapper } = setup()
    renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 1000 }), { wrapper })
    await advance(10)
    showDocument("hidden")
    await advance(400)
    showDocument("visible")
    await advance(500)
    expect(log.calls).toBe(1)
    await advance(100)
    expect(log.calls).toBe(2)
  })

  test("refetchIntervalInBackground keeps polling while hidden", async () => {
    const { fetch, log } = server()
    const { wrapper } = setup()
    renderHook(
      () => useServerQuery(["login"], fetch("login"), { refetchInterval: 1000, refetchIntervalInBackground: true }),
      { wrapper },
    )
    await advance(10)
    showDocument("hidden")
    await advance(3000)
    expect(log.calls).toBe(4)
  })
})

describe("lifecycle", () => {
  test("stops on unmount", async () => {
    const { fetch, log } = server()
    const { wrapper } = setup()
    const { unmount } = renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 1000 }), {
      wrapper,
    })
    await advance(1010)
    expect(log.calls).toBe(2)
    unmount()
    await advance(5000)
    expect(log.calls).toBe(2)
  })

  test("a new key stops the old poll and polls the new key", async () => {
    const { fetch, log } = server()
    const { wrapper } = setup()
    const { rerender } = renderHook(
      ({ id }: { id: string }) => useServerQuery(["login", id], fetch(id), { refetchInterval: 1000 }),
      { wrapper, initialProps: { id: "a" } },
    )
    await advance(1010)
    rerender({ id: "b" })
    await advance(10)
    expect(log.keys).toEqual(["a", "a", "b"])
    await advance(1000)
    await advance(1000)
    expect(log.keys).toEqual(["a", "a", "b", "b", "b"])
  })

  test("hooks reading the same key share one timer, at the shortest interval", async () => {
    const { fetch, log } = server()
    const { wrapper } = setup()
    const first = renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 1000 }), {
      wrapper,
    })
    await advance(400)
    const second = renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 1000 }), {
      wrapper,
    })
    await advance(5000)
    expect(log.calls).toBe(6)
    const third = renderHook(() => useServerQuery(["login"], fetch("login"), { refetchInterval: 500 }), {
      wrapper,
    })
    await advance(2000)
    expect(log.calls).toBe(10)
    third.unmount()
    await advance(2000)
    expect(log.calls).toBe(12)
    first.unmount()
    second.unmount()
    await advance(5000)
    expect(log.calls).toBe(12)
  })
})

const request: PageRequest<Filter> = { filter: {}, sort: [], size: 2, position: { page: 1 } }

function pagedSource(latencyMs = 0) {
  const counts = { pages: 0, totals: 0 }
  const source: PageSource<Row, Filter> = {
    key: ["rows"],
    getId: (row) => row.id,
    capabilities: { position: "page", total: "exact" },
    fetchPage: async () => {
      counts.pages += 1
      if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
      return { items: [{ id: "a", name: `read ${String(counts.pages)}` }], hasMore: false, total: 1 }
    },
    fetchTotal: async () => {
      counts.totals += 1
      return 1
    },
  }
  return { source, counts }
}

function statusText() {
  return document.querySelector("output[aria-live=polite]")?.textContent
}

describe("pages", () => {
  test("useServerPage polls the page and its total, keeping the rows", async () => {
    const { source, counts } = pagedSource(300)
    const { wrapper } = setup()
    const { result } = renderHook(() => useServerPage(source, request, { refetchInterval: 1000 }), { wrapper })
    await advance(310)
    await advance(1100)
    expect(result.current).toMatchObject({ status: "success", fetching: true, polling: true, previous: false })
    expect(result.current.items).toEqual([{ id: "a", name: "read 1" }])
    await advance(300)
    expect(result.current.items).toEqual([{ id: "a", name: "read 2" }])
    expect(counts.totals).toBe(2)
  })

  test("useServerInfinite polls every loaded page", async () => {
    const { source, counts } = pagedSource()
    const { wrapper } = setup()
    const { result } = renderHook(
      () => useServerInfinite(source, { filter: {}, sort: [], size: 2 }, { refetchInterval: 1000 }),
      { wrapper },
    )
    await advance(10)
    expect(result.current.items).toEqual([{ id: "a", name: "read 1" }])
    await advance(1000)
    expect(counts.pages).toBe(2)
    expect(result.current.items).toEqual([{ id: "a", name: "read 2" }])
  })

  test("ServerList's status doesn't announce a slow poll", async () => {
    const { source, counts } = pagedSource(800)
    const client = createDataClient({ staleTime: Infinity, retry: false })
    render(
      <DataProvider client={client}>
        <ServerList<Row>
          aria-label="Rows"
          source={source}
          itemText={(row) => row.name}
          renderItem={(row) => <span>{row.name}</span>}
          refetchInterval={1000}
          labels={{ errorTitle: "Couldn't load rows", retry: "Try again", emptyTitle: "No rows" }}
        />
      </DataProvider>,
    )
    await advance(810)
    const settled = statusText()
    expect(settled).toMatch(/1/)
    await advance(1000)
    for (let step = 0; step < 8; step += 1) {
      await advance(100)
      expect(statusText()).toBe(settled)
      expect(document.querySelector("[aria-busy]")).toBeNull()
    }
    expect(counts.pages).toBe(2)
  })

  test("ServerDataTable's status doesn't announce a slow poll, and the rows aren't marked busy", async () => {
    const { source, counts } = pagedSource(800)
    const client = createDataClient({ staleTime: Infinity, retry: false })
    render(
      <DataProvider client={client}>
        <ServerDataTable<Row>
          label="Rows"
          source={source}
          columns={[{ id: "name", header: "Name", cell: (row) => row.name }]}
          refetchInterval={1000}
          labels={{ errorTitle: "Couldn't load rows", retry: "Try again", emptyTitle: "No rows" }}
        />
      </DataProvider>,
    )
    await advance(810)
    const settled = statusText()
    expect(settled).toMatch(/1/)
    await advance(1000)
    for (let step = 0; step < 8; step += 1) {
      await advance(100)
      expect(statusText()).toBe(settled)
      expect(document.querySelector("[aria-busy]")).toBeNull()
    }
    expect(counts.pages).toBe(2)
    expect(screen.getByText("read 2")).toBeTruthy()
  })
})
