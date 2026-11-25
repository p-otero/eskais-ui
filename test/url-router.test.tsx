import { act, render, renderHook, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useSyncExternalStore } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { List, ListItem } from "@/components/ui/list-item"
import { MasterDetail } from "@/components/ui/master-detail"
import { createUrlParam } from "@/lib/url-param"
import { hashRouter, historyRouter, memoryRouter, withParam, type UrlRouter } from "@/lib/url-router"
import { routerUrlState, useUrlState } from "@/lib/url-state"

afterEach(() => {
  history.replaceState(null, "", "/")
})

describe("hashRouter", () => {
  test("reads a hash route and changes its query without touching the path", () => {
    history.replaceState({ key: "k1" }, "", "/app?x=1#/devices?sort=name")
    const router = hashRouter()
    expect(router.read().path).toBe("/devices")
    expect(router.read().params.get("sort")).toBe("name")
    const length = history.length
    router.navigate(withParam(router.read(), "device", "a1"), { replace: false })
    expect(location.pathname + location.search + location.hash).toBe("/app?x=1#/devices?sort=name&device=a1")
    expect(history.length).toBe(length + 1)
    expect(history.state).toEqual({ key: "k1" })
    router.navigate(withParam(router.read(), "device", null), { replace: true })
    expect(location.hash).toBe("#/devices?sort=name")
    expect(history.length).toBe(length + 1)
  })

  test("builds #/path?query hrefs and reads an empty hash as /", () => {
    const router = hashRouter()
    expect(router.read().path).toBe("/")
    expect(router.href({ path: "/settings", params: new URLSearchParams("section=security") })).toBe(
      "#/settings?section=security",
    )
    expect(router.href({ path: "", params: new URLSearchParams() })).toBe("#/")
  })

  test("a write through one router notifies the others, and Back notifies all", () => {
    const writer = hashRouter()
    const reader = hashRouter()
    const listener = vi.fn()
    const off = reader.subscribe(listener)
    writer.navigate({ path: "/a", params: new URLSearchParams() }, { replace: false })
    dispatchEvent(new PopStateEvent("popstate"))
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    writer.navigate({ path: "/b", params: new URLSearchParams() }, { replace: false })
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

describe("historyRouter", () => {
  test("changes the query string, keeps the hash on writes and leaves it out of hrefs", () => {
    history.replaceState(null, "", "/devices?sort=name#top")
    const router = historyRouter()
    router.navigate(withParam(router.read(), "device", "a1"), { replace: true })
    expect(location.pathname + location.search + location.hash).toBe("/devices?sort=name&device=a1#top")
    expect(router.href(withParam(router.read(), "device", "b2"))).toBe("/devices?sort=name&device=b2")
  })
})

test("memoryRouter records navigations and notifies its subscribers", () => {
  const router = memoryRouter("/settings?tab=1")
  const listener = vi.fn()
  router.subscribe(listener)
  router.navigate(withParam(router.read(), "section", "danger"), { replace: true })
  expect(router.entries).toEqual([{ href: "/settings?tab=1&section=danger", replace: true }])
  expect(listener).toHaveBeenCalledTimes(1)
})

test("createUrlParam with a router reads, writes and builds hrefs through it", () => {
  history.replaceState(null, "", "/#/devices?sort=name")
  const param = createUrlParam("device", { router: hashRouter(), history: "replace" })
  const length = history.length
  param.write("a1")
  expect(location.hash).toBe("#/devices?sort=name&device=a1")
  expect(location.search).toBe("")
  expect(history.length).toBe(length)
  expect(param.read()).toBe("a1")
  expect(param.href?.("b2")).toBe("#/devices?sort=name&device=b2")
  param.write(null)
  expect(location.hash).toBe("#/devices?sort=name")
})

test("createUrlParam without a router still builds hrefs for its own mode", () => {
  history.replaceState(null, "", "/app#/devices")
  expect(createUrlParam("device").href?.("a1")).toBe("/app?device=a1#/devices")
  expect(createUrlParam("device", { in: "hash" }).href?.("a1")).toBe("#/devices?device=a1")
})

test("routerUrlState keeps the router's path and goes through it", () => {
  const router = memoryRouter("/tasks?status=open")
  const { result } = renderHook(() => useUrlState(routerUrlState(router)))
  expect(result.current[0].get("status")).toBe("open")
  act(() => result.current[1](new URLSearchParams("status=closed&page=2")))
  expect(router.read().path).toBe("/tasks")
  expect(result.current[0].get("page")).toBe("2")
  expect(router.entries.at(-1)).toEqual({ href: "/tasks?status=closed&page=2", replace: true })
})

const devices = [
  { id: "d1", name: "Kitchen sensor" },
  { id: "d2", name: "Hall camera" },
]

function Devices(props: {
  selectedId?: string | null
  onSelectedIdChange?: (id: string | null) => void
  router?: UrlRouter
}) {
  return (
    <MasterDetail
      label="Devices"
      items={devices.map((device) => ({ id: device.id, label: device.name }))}
      url={props.router ? createUrlParam("device", { router: props.router }) : undefined}
      selectedId={props.selectedId}
      onSelectedIdChange={props.onSelectedIdChange}
      renderList={(state) => (
        <List aria-label="All devices">
          {devices.map((device) => (
            <ListItem key={device.id} title={device.name} {...state.itemProps(device.id)} />
          ))}
        </List>
      )}
      renderDetail={(id) => {
        const device = devices.find((candidate) => candidate.id === id)
        return device ? { title: device.name, content: <p>Online</p> } : null
      }}
    />
  )
}

test("MasterDetail keeps its selection in an app router's query through the adapter", async () => {
  const user = userEvent.setup()
  const router = memoryRouter("/devices?view=grid")
  render(<Devices router={router} />)
  await user.click(screen.getByRole("button", { name: "Hall camera" }))
  expect(router.entries.at(-1)).toEqual({ href: "/devices?view=grid&device=d2", replace: false })
  expect(screen.getByRole("region", { name: "Hall camera" })).toBeTruthy()
  act(() => router.navigate({ path: "/devices", params: new URLSearchParams("device=d1") }, { replace: true }))
  expect(screen.getByRole("region", { name: "Kitchen sensor" })).toBeTruthy()
})

function RoutedDevices({ router }: { router: UrlRouter }) {
  const path = useSyncExternalStore(router.subscribe, () => router.read().path)
  const id = /^\/devices\/([^/]+)$/.exec(path)?.[1] ?? null
  return (
    <Devices
      selectedId={id}
      onSelectedIdChange={(next) =>
        router.navigate(
          { path: next === null ? "/devices" : `/devices/${next}`, params: new URLSearchParams() },
          {
            replace: false,
          },
        )
      }
    />
  )
}

test("controlled selection follows a route of the app's own shape", async () => {
  const user = userEvent.setup()
  history.replaceState(null, "", "/#/devices/d2")
  const router = hashRouter()
  render(<RoutedDevices router={router} />)
  expect(screen.getByRole("region", { name: "Hall camera" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Kitchen sensor" }))
  expect(location.hash).toBe("#/devices/d1")
  await user.click(screen.getByRole("button", { name: "Close detail" }))
  expect(location.hash).toBe("#/devices")
})
