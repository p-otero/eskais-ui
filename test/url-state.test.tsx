import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { hashUrlState, historyUrlState, memoryUrlState, useUrlState } from "@/lib/url-state"

afterEach(() => {
  window.history.replaceState(null, "", "/")
})

describe("historyUrlState", () => {
  test("reads and writes the query string, keeping the path and hash", () => {
    window.history.replaceState(null, "", "/tasks?status=open#top")
    const adapter = historyUrlState()
    expect(adapter.read().get("status")).toBe("open")
    const length = window.history.length
    adapter.write(new URLSearchParams("status=closed&page=2"), { replace: true })
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/tasks?status=closed&page=2#top",
    )
    expect(window.history.length).toBe(length)
    adapter.write(new URLSearchParams(), { replace: false })
    expect(window.location.search).toBe("")
    expect(window.history.length).toBe(length + 1)
  })

  test("notifies on its own writes and on popstate", () => {
    const adapter = historyUrlState()
    const listener = vi.fn()
    const unsubscribe = adapter.subscribe(listener)
    adapter.write(new URLSearchParams("a=1"), { replace: true })
    window.dispatchEvent(new PopStateEvent("popstate"))
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    adapter.write(new URLSearchParams("a=2"), { replace: true })
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe("hashUrlState", () => {
  test("keeps the route and edits the query inside the hash", () => {
    window.history.replaceState(null, "", "/app/?v=1#/tasks/list?status=open")
    const adapter = hashUrlState()
    expect(adapter.read().get("status")).toBe("open")
    adapter.write(new URLSearchParams("status=closed"), { replace: true })
    expect(window.location.hash).toBe("#/tasks/list?status=closed")
    expect(window.location.search).toBe("?v=1")
    adapter.write(new URLSearchParams(), { replace: true })
    expect(window.location.hash).toBe("#/tasks/list")
  })

  test("follows hashchange", () => {
    const adapter = hashUrlState()
    const listener = vi.fn()
    adapter.subscribe(listener)
    window.dispatchEvent(new HashChangeEvent("hashchange"))
    expect(listener).toHaveBeenCalledOnce()
  })

  test("without a window it reads nothing and writes nowhere", () => {
    const adapter = hashUrlState(undefined)
    expect(adapter.read().toString()).toBe("")
    expect(() => adapter.write(new URLSearchParams("a=1"), { replace: true })).not.toThrow()
  })
})

test("memoryUrlState records its writes", () => {
  const adapter = memoryUrlState("a=1")
  adapter.write(new URLSearchParams("a=2"), { replace: false })
  expect(adapter.read().get("a")).toBe("2")
  expect(adapter.history).toEqual([{ query: "a=2", replace: false }])
})

test("useUrlState re-renders on change and keeps params stable otherwise", () => {
  const adapter = memoryUrlState("q=x")
  const { result, rerender } = renderHook(() => useUrlState(adapter))
  const first = result.current[0]
  rerender()
  expect(result.current[0]).toBe(first)
  act(() => result.current[1](new URLSearchParams("q=y")))
  expect(result.current[0].get("q")).toBe("y")
  expect(adapter.history.at(-1)).toEqual({ query: "q=y", replace: true })
})
