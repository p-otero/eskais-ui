import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState, type CSSProperties } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { List, ListItem } from "@/components/ui/list-item"
import { MasterDetail, type MasterDetailProps } from "@/components/ui/master-detail"
import { createUrlParam } from "@/lib/url-param"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const devices = [
  { id: "d1", name: "Kitchen sensor", room: "Kitchen" },
  { id: "d2", name: "Hall camera", room: "Hall" },
  { id: "d3", name: "Garage door", room: "Garage" },
]

let width = 1200
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth")
beforeEach(() => {
  width = 1200
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.slot === "master-detail" ? width : 0
    },
  })
  history.replaceState(null, "", "/")
  localStorage.clear()
})
afterEach(() => {
  if (clientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidth)
})

function Devices(props: Partial<MasterDetailProps>) {
  return (
    <MasterDetail
      label="Devices"
      items={devices.map((device) => ({ id: device.id, label: device.name }))}
      labels={{ list: "Device list" }}
      renderList={(state) => (
        <List aria-label="All devices">
          {devices.map((device) => (
            <ListItem key={device.id} title={device.name} subtitle={device.room} {...state.itemProps(device.id)} />
          ))}
        </List>
      )}
      renderDetail={(id) => {
        const device = devices.find((candidate) => candidate.id === id)
        return device ? { title: device.name, description: device.room, content: <p>Online</p> } : null
      }}
      emptyDetail={<p>Pick a device</p>}
      {...props}
    />
  )
}

const row = (name: string) => screen.getByRole("button", { name })

test("MasterDetail: a click opens the detail and focuses its heading; Close returns focus to the row", async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  const { container } = render(<Devices onSelectedIdChange={onChange} />)
  expect(screen.getByRole("region", { name: "Device list" })).toBeTruthy()
  expect(screen.getByRole("region", { name: "Detail" }).textContent).toContain("Pick a device")

  await user.click(row("Hall camera"))
  const detail = screen.getByRole("region", { name: "Hall camera" })
  expect(document.activeElement).toBe(within(detail).getByRole("heading", { name: "Hall camera" }))
  expect(row("Hall camera").getAttribute("aria-current")).toBe("true")
  expect(onChange).toHaveBeenLastCalledWith("d2", expect.objectContaining({ reason: "item-press" }))
  expect(await axeViolations(container)).toEqual([])

  await user.click(within(detail).getByRole("button", { name: "Close detail" }))
  expect(screen.queryByRole("region", { name: "Hall camera" })).toBeNull()
  expect(document.activeElement).toBe(row("Hall camera"))
  expect(onChange).toHaveBeenLastCalledWith(null, expect.objectContaining({ reason: "close-press" }))
})

test("MasterDetail: Enter opens; with followFocus, j/k move the open item and focus stays in the list", async () => {
  const user = userEvent.setup()
  render(<Devices followFocus />)
  row("Kitchen sensor").focus()
  await user.keyboard("{Enter}")
  expect(screen.getByRole("region", { name: "Kitchen sensor" })).toBeTruthy()
  expect(document.activeElement).toBe(row("Kitchen sensor"))
  await user.keyboard("j")
  expect(screen.getByRole("region", { name: "Hall camera" })).toBeTruthy()
  expect(document.activeElement).toBe(row("Hall camera"))
  await user.keyboard("{Enter}")
  expect(document.activeElement?.getAttribute("data-slot")).toBe("master-detail-title")
})

test("MasterDetail: stacked, only one pane shows; Back and Escape return to the row", async () => {
  width = 390
  const user = userEvent.setup()
  render(<Devices />)
  const root = document.querySelector('[data-slot="master-detail"]')!
  expect(root.hasAttribute("data-stacked")).toBe(true)
  expect(document.querySelector("[data-idle]")).toBeTruthy()

  await user.click(row("Garage door"))
  expect(document.querySelector("[data-covered]")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Close detail" })).toBeNull()
  await user.click(screen.getByRole("button", { name: "Back" }))
  expect(document.activeElement).toBe(row("Garage door"))

  await user.click(row("Kitchen sensor"))
  await user.keyboard("{Escape}")
  expect(screen.queryByRole("region", { name: "Kitchen sensor" })).toBeNull()
  expect(document.activeElement).toBe(row("Kitchen sensor"))
})

function Controlled() {
  const [id, setId] = useState<string | null>("d1")
  return (
    <Devices
      selectedId={id}
      onSelectedIdChange={(next, details) => {
        if (next === "d3") details.cancel()
        else setId(next)
      }}
    />
  )
}

test("MasterDetail: controlled selection follows the parent, which can refuse a change", async () => {
  const user = userEvent.setup()
  render(<Controlled />)
  expect(screen.getByRole("region", { name: "Kitchen sensor" })).toBeTruthy()
  await user.click(row("Garage door"))
  expect(screen.getByRole("region", { name: "Kitchen sensor" })).toBeTruthy()
  await user.click(row("Hall camera"))
  expect(screen.getByRole("region", { name: "Hall camera" })).toBeTruthy()
})

test("MasterDetail: URL sync writes the selection, reads deep links and follows Back, in a hash route too", async () => {
  const user = userEvent.setup()
  history.replaceState(null, "", "/#/devices?device=d2")
  const url = createUrlParam("device", { in: "hash" })
  render(<Devices url={url} />)
  expect(screen.getByRole("region", { name: "Hall camera" })).toBeTruthy()

  await user.click(row("Garage door"))
  expect(location.hash).toBe("#/devices?device=d3")
  await user.click(screen.getByRole("button", { name: "Close detail" }))
  expect(location.hash).toBe("#/devices")
  expect(document.activeElement).toBe(row("Garage door"))

  await act(async () => {
    history.back()
    await new Promise((done) => addEventListener("popstate", done, { once: true }))
  })
  expect(screen.getByRole("region", { name: "Garage door" })).toBeTruthy()
})

test("createUrlParam: search mode keeps the hash route and replace mode adds no entry", () => {
  history.replaceState(null, "", "/app#/devices")
  const length = history.length
  const param = createUrlParam("device", { history: "replace" })
  const listener = vi.fn()
  const off = param.subscribe(listener)
  param.write("a b")
  expect(location.search).toBe("?device=a+b")
  expect(location.hash).toBe("#/devices")
  expect(param.read()).toBe("a b")
  expect(history.length).toBe(length)
  expect(listener).toHaveBeenCalledTimes(1)
  param.write(null)
  expect(location.search).toBe("")
  off()
})

test("MasterDetail: collapses to a rail and remembers it; a press on a row expands it", async () => {
  const user = userEvent.setup()
  const { unmount } = render(<Devices collapsible storageKey="devices" defaultSelectedId="d1" />)
  await user.click(screen.getByRole("button", { name: "Collapse detail" }))
  const expand = screen.getByRole("button", { name: "Expand detail" })
  expect(expand.getAttribute("aria-expanded")).toBe("false")
  expect(localStorage.getItem("devices:collapsed")).toBe("true")
  unmount()

  render(<Devices collapsible storageKey="devices" />)
  expect(screen.getByRole("button", { name: "Expand detail" })).toBeTruthy()
  await user.click(row("Hall camera"))
  expect(screen.getByRole("region", { name: "Hall camera" })).toBeTruthy()
  expect(localStorage.getItem("devices:collapsed")).toBe("false")
})

test("MasterDetail: resizable renders a named handle", () => {
  render(<Devices resizable />)
  expect(screen.getByRole("separator", { name: "Resize detail" })).toBeTruthy()
})

test("MasterDetail: agents open and close items by the block's name", async () => {
  render(<Devices />)
  await settle()
  const agent = createAgent()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(components.map((entry) => entry.label)).toContain("Devices")

  let result = await act(() => agent.act({ steps: [{ ref: "Devices", action: "open", args: ["d3"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("region", { name: "Garage door" })).toBeTruthy()

  result = await act(() => agent.act({ steps: [{ ref: "Devices", action: "open", args: ["nope"] }] }))
  expect(result.ok).toBe(false)

  result = await act(() => agent.act({ steps: [{ ref: "Devices", action: "close" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.queryByRole("region", { name: "Garage door" })).toBeNull()
})

test("MasterDetail: idleDetail visible keeps the idle detail under a stacked list, collapsible to its bar", async () => {
  width = 390
  const user = userEvent.setup()
  render(<Devices idleDetail="visible" emptyDetailTitle="Monitor" storageKey="monitor" />)
  const pane = screen.getByRole("region", { name: "Monitor" })
  expect(pane.textContent).toContain("Pick a device")
  expect(pane.parentElement?.className).not.toContain("data-idle:hidden")

  const collapse = within(pane).getByRole("button", { name: "Collapse detail" })
  expect(collapse.getAttribute("aria-expanded")).toBe("true")
  await user.click(collapse)
  expect(document.activeElement).toBe(collapse)
  expect(collapse.getAttribute("aria-label")).toBe("Expand detail")
  expect(collapse.getAttribute("aria-expanded")).toBe("false")
  expect(screen.queryByText("Pick a device")).toBeNull()
  expect(localStorage.getItem("monitor:collapsed")).toBe("true")

  await user.click(row("Hall camera"))
  expect(screen.getByRole("region", { name: "Hall camera" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Back" }))
  expect(screen.getByRole("button", { name: "Expand detail" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Expand detail" }))
  expect(screen.getByText("Pick a device")).toBeTruthy()
})

test("MasterDetail: by default a stacked idle detail is hidden and has no collapse button", () => {
  width = 390
  render(<Devices />)
  expect(document.querySelector("[data-idle]")?.className).toContain("data-idle:hidden")
  expect(screen.queryByRole("button", { name: "Collapse detail" })).toBeNull()
})

test("MasterDetail: beside the list, a visible collapsible idle detail collapses to the rail", async () => {
  const user = userEvent.setup()
  render(<Devices idleDetail="visible" collapsible labels={{ collapse: "Hide monitor", expand: "Show monitor" }} />)
  await user.click(screen.getByRole("button", { name: "Hide monitor" }))
  expect(document.querySelector('[data-slot="master-detail-rail"]')).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Show monitor" }))
  expect(screen.getByText("Pick a device")).toBeTruthy()
})

test("MasterDetail: agents collapse and expand a visible idle detail by name", async () => {
  width = 390
  render(<Devices idleDetail="visible" />)
  await settle()
  const agent = createAgent()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  let result = await act(() => agent.act({ steps: [{ ref: "Collapse detail", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.queryByText("Pick a device")).toBeNull()
  result = await act(() => agent.act({ steps: [{ ref: "Expand detail", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByText("Pick a device")).toBeTruthy()
})

test("MasterDetail: height auto sizes to content between a min and a max", () => {
  render(<Devices height="auto" style={{ "--master-detail-max-height": "30rem" } as CSSProperties} />)
  const root = document.querySelector<HTMLElement>('[data-slot="master-detail"]')!
  expect(root.dataset.height).toBe("auto")
  expect(root.className).toContain("max-h-(--master-detail-max-height)")
  expect(root.className).not.toContain("h-(--master-detail-height)")
  expect(root.style.getPropertyValue("--master-detail-max-height")).toBe("30rem")
})
