import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { readEdges, revealTab } from "@/components/ui/tabs-scroll"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()
const views = ["Overview", "Deployments", "Logs", "Analytics", "Agents", "Usage", "Domains", "Secrets"]

let scrollLeft = 0
const scrollBy = vi.fn((options: ScrollToOptions) => {
  scrollLeft += options.left ?? 0
})

beforeEach(() => {
  scrollLeft = 0
  scrollBy.mockClear()
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.dataset.slot === "tabs-list" ? 800 : 0
  })
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.dataset.slot === "tabs-list" ? 300 : 0
  })
  vi.spyOn(HTMLElement.prototype, "scrollLeft", "get").mockImplementation(() => scrollLeft)
  HTMLElement.prototype.scrollBy = scrollBy as unknown as HTMLElement["scrollBy"]
})

afterEach(() => vi.restoreAllMocks())

function Views({ scrollable }: { scrollable?: false }) {
  return (
    <Tabs defaultValue="Overview">
      <TabsList aria-label="Project views" scrollable={scrollable}>
        {views.map((view) => (
          <TabsTab key={view} value={view}>
            {view}
          </TabsTab>
        ))}
      </TabsList>
      {views.map((view) => (
        <TabsPanel key={view} value={view}>
          {view} panel
        </TabsPanel>
      ))}
    </Tabs>
  )
}

function wrapper() {
  return document.querySelector('[data-slot="tabs-scroll"]') as HTMLElement
}

test("readEdges reads both sides from the offset, mirrored under rtl", () => {
  const element = document.createElement("div")
  element.dataset.slot = "tabs-list"
  document.body.append(element)
  expect(readEdges(element)).toEqual({ left: false, right: true })
  scrollLeft = 250
  expect(readEdges(element)).toEqual({ left: true, right: true })
  scrollLeft = 500
  expect(readEdges(element)).toEqual({ left: true, right: false })
  element.style.direction = "rtl"
  scrollLeft = -500
  expect(readEdges(element)).toEqual({ left: false, right: true })
  element.remove()
})

test("an overflowing list marks the edges it can scroll to, and the buttons scroll by most of its width", async () => {
  render(<Views />)
  await settle()
  expect(wrapper().hasAttribute("data-overflow-left")).toBe(false)
  expect(wrapper().hasAttribute("data-overflow-right")).toBe(true)

  const right = wrapper().querySelector('[data-side="right"] button') as HTMLButtonElement
  expect(right.getAttribute("aria-hidden")).toBe("true")
  expect(right.tabIndex).toBe(-1)
  expect(right.hasAttribute("data-agent-hidden")).toBe(true)
  fireEvent.click(right)
  expect(scrollBy).toHaveBeenLastCalledWith({ left: 240, behavior: "smooth" })
  act(() => {
    screen.getByRole("tablist").dispatchEvent(new Event("scroll"))
  })
  expect(wrapper().hasAttribute("data-overflow-left")).toBe(true)

  fireEvent.click(wrapper().querySelector('[data-side="left"] button') as HTMLButtonElement)
  expect(scrollBy).toHaveBeenLastCalledWith({ left: -240, behavior: "smooth" })
})

test("the buttons stay out of the tab order and the accessibility tree; arrow keys still move through every tab", async () => {
  const user = userEvent.setup()
  const { container } = render(<Views />)
  await settle()
  expect(screen.queryByRole("button", { name: /Scroll tabs/ })).toBeNull()
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Overview" }))
  await user.keyboard("{End}")
  expect(screen.getByRole("tab", { name: "Secrets" }).getAttribute("aria-selected")).toBe("true")
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole("tabpanel"))
  expect(await axeViolations(container)).toEqual([])
})

test("scrollable={false} keeps a plain list", () => {
  render(<Views scrollable={false} />)
  expect(wrapper()).toBeNull()
  expect(screen.getByRole("tablist").className).not.toContain("overflow-x-auto")
})

test("an agent sees only the tablist and selects a tab by name", async () => {
  render(<Views />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).not.toContain("Scroll tabs right")
  const result = await act(() =>
    agent.act({ steps: [{ ref: "Project views", action: "setValue", args: ["Domains"] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("tab", { name: "Domains" }).getAttribute("aria-selected")).toBe("true")
})

function rect(left: number, right: number) {
  return { left, right, top: 0, bottom: 32, width: right - left, height: 32, x: left, y: 0, toJSON: () => ({}) }
}

function revealFixture(direction: "ltr" | "rtl" = "ltr") {
  const list = document.createElement("div")
  list.style.scrollPaddingLeft = "40px"
  list.style.scrollPaddingRight = "40px"
  list.style.direction = direction
  list.dataset.slot = "tabs-list"
  const tab = document.createElement("button")
  tab.setAttribute("role", "tab")
  list.append(tab)
  document.body.append(list)
  vi.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(0, 300) as DOMRect)
  const scrollTo = vi.fn()
  list.scrollTo = scrollTo as unknown as HTMLElement["scrollTo"]
  const place = (left: number, right: number) =>
    vi.spyOn(tab, "getBoundingClientRect").mockReturnValue(rect(left, right) as DOMRect)
  return { list, tab, scrollTo, place }
}

test("revealTab scrolls a tab under the end fade clear of it, by the list's scroll padding", () => {
  const { list, tab, scrollTo, place } = revealFixture()
  scrollLeft = 100
  place(250, 330)
  revealTab(list, tab, true)
  expect(scrollTo).toHaveBeenCalledWith({ left: 100 + 70, behavior: "smooth" })
  place(10, 90)
  revealTab(list, tab, true)
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 100 - 30, behavior: "smooth" })
  scrollTo.mockClear()
  place(60, 200)
  revealTab(list, tab, true)
  expect(scrollTo).not.toHaveBeenCalled()
  list.remove()
})

test("revealTab jumps without animating under reduced motion, and a wide tab shows its start in rtl", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const { list, tab, scrollTo, place } = revealFixture("rtl")
  scrollLeft = -100
  place(-20, 320)
  revealTab(list, tab, true)
  expect(scrollTo).toHaveBeenCalledWith({ left: -100 + 60, behavior: "auto" })
  list.remove()
  vi.unstubAllGlobals()
})

test("a tab an agent selects is revealed", async () => {
  const scrollTo = vi.fn()
  HTMLElement.prototype.scrollTo = scrollTo as unknown as HTMLElement["scrollTo"]
  render(<Views />)
  await settle()
  const list = screen.getByRole("tablist", { name: "Project views" })
  vi.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(0, 300) as DOMRect)
  const secrets = screen.getByRole("tab", { name: "Secrets" })
  vi.spyOn(secrets, "getBoundingClientRect").mockReturnValue(rect(700, 790) as DOMRect)
  const result = await act(() =>
    agent.act({ steps: [{ ref: "Project views", action: "setValue", args: ["Secrets"] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  await settle()
  expect(secrets.getAttribute("aria-selected")).toBe("true")
  expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 490 }))
})
