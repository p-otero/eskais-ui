import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"
import { readEdges } from "@/components/ui/tabs-scroll"

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
