import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { SiteHeader, type SiteHeaderItem } from "@/components/ui/site-header"
import { fitCount } from "@/components/ui/site-header-overflow"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

const items: SiteHeaderItem[] = [
  { label: "Product", href: "#product", current: true },
  {
    label: "Solutions",
    items: [
      { label: "Startups", href: "#startups", description: "Ship the first version fast." },
      { label: "Enterprise", href: "#enterprise" },
    ],
  },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
  { label: "Blog", href: "#blog" },
]

let navWidth = 1000
const observers: { callback: ResizeObserverCallback }[] = []
let intersect: ((entries: { isIntersecting: boolean }[]) => void) | undefined

function resize(width: number) {
  navWidth = width
  act(() => {
    for (const observer of observers) observer.callback([], {} as ResizeObserver)
  })
}

beforeEach(() => {
  observers.length = 0
  navWidth = 1000
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        observers.push({ callback })
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        intersect = callback
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const slot = this.dataset.slot
    const width =
      slot === "site-header-nav"
        ? navWidth
        : slot === "site-header-measure-item" || slot === "site-header-measure-more"
          ? 100
          : 0
    return { width, height: 36, top: 0, left: 0, right: width, bottom: 36, x: 0, y: 0, toJSON: () => ({}) }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function RouterLink({ to, children, ...props }: { to?: string; children?: ReactNode }) {
  return (
    <a href={`/app${to ?? ""}`} data-router="" {...props}>
      {children}
    </a>
  )
}

function Header(props: Partial<Parameters<typeof SiteHeader>[0]>) {
  return (
    <SiteHeader
      label="Main"
      brand={<a href="#home">Acme</a>}
      items={items}
      actions={<Button>Sign in</Button>}
      {...props}
    />
  )
}

test("fitCount keeps the order and leaves room for More", () => {
  expect(fitCount([100, 100, 100], 80, 10, 320)).toBe(3)
  expect(fitCount([100, 100, 100], 80, 10, 319)).toBe(2)
  expect(fitCount([100, 100, 100], 80, 10, 190)).toBe(1)
  expect(fitCount([100, 100, 100], 80, 10, 50)).toBe(0)
})

test("is a header landmark with a named navigation, the current page and a dropdown", async () => {
  const user = userEvent.setup()
  const { container } = render(<Header />)
  resize(1000)
  expect(screen.getByRole("banner")).toBeTruthy()
  const nav = screen.getByRole("navigation", { name: "Main" })
  expect(within(nav).getByRole("link", { name: "Product" }).getAttribute("aria-current")).toBe("page")
  expect(within(nav).queryByRole("button", { name: "More" })).toBeNull()
  expect(await axeViolations(container)).toEqual([])

  await user.click(within(nav).getByRole("button", { name: "Solutions" }))
  const startups = screen.getByRole("link", { name: /Startups/ })
  expect(startups.getAttribute("href")).toBe("#startups")
  expect(await axeViolations(document.body)).toEqual([])
})

test("links that don't fit move into More, in order, and come back as the bar grows", async () => {
  const user = userEvent.setup()
  render(<Header />)
  resize(1000)
  const nav = screen.getByRole("navigation", { name: "Main" })
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Product", "Pricing", "Docs", "Blog"])

  resize(320)
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Product"])
  expect(within(nav).getByRole("button", { name: "Solutions" })).toBeTruthy()
  const more = within(nav).getByRole("button", { name: "More" })
  await user.click(more)
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Product", "Pricing", "Docs", "Blog"])

  resize(200)
  expect(within(nav).queryByRole("button", { name: "Solutions" })).toBeNull()
  expect(within(nav).getByRole("button", { name: "More" }).hasAttribute("data-current")).toBe(false)

  resize(100)
  expect(within(nav).getByRole("button", { name: "More" }).hasAttribute("data-current")).toBe(true)

  resize(1000)
  expect(within(nav).queryByRole("button", { name: "More" })).toBeNull()
  expect(within(nav).getAllByRole("link")).toHaveLength(4)
})

test("renderLink and an item's own render use the router's link", () => {
  render(
    <Header
      items={[
        { label: "Pricing", href: "/pricing" },
        { label: "Docs", href: "/docs", render: <RouterLink to="/docs/v2" /> },
      ]}
      renderLink={(item) => <RouterLink to={item.href} />}
    />,
  )
  resize(1000)
  const pricing = screen.getByRole("link", { name: "Pricing" })
  expect(pricing.getAttribute("href")).toBe("/app/pricing")
  expect(pricing.hasAttribute("data-router")).toBe(true)
  expect(screen.getByRole("link", { name: "Docs" }).getAttribute("href")).toBe("/app/docs/v2")
})

test("data-scrolled follows the sentinel leaving the viewport", () => {
  render(<Header />)
  const header = screen.getByRole("banner")
  expect(header.hasAttribute("data-scrolled")).toBe(false)
  act(() => intersect?.([{ isIntersecting: false }]))
  expect(header.hasAttribute("data-scrolled")).toBe(true)
  act(() => intersect?.([{ isIntersecting: true }]))
  expect(header.hasAttribute("data-scrolled")).toBe(false)
})

test("the menu button opens every link in a drawer, grouped, and a link closes it", async () => {
  const user = userEvent.setup()
  render(<Header menuLabel="Open site menu" />)
  await user.click(screen.getByRole("button", { name: "Open site menu" }))
  await settle()
  const drawer = screen.getByRole("dialog", { name: "Main" })
  const nav = within(drawer).getByRole("navigation", { name: "Main" })
  expect(within(nav).getByRole("list", { name: "Solutions" })).toBeTruthy()
  expect(
    within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent?.replace(/\s+/g, " ").trim()),
  ).toEqual(["Product", "StartupsShip the first version fast.", "Enterprise", "Pricing", "Docs", "Blog"])
  expect(within(nav).getByRole("link", { name: "Product" }).getAttribute("aria-current")).toBe("page")
  // jsdom has no styles, so the bar's own navigation, display: none on narrow screens, would count as a second one.
  expect(await axeViolations(drawer)).toEqual([])

  await user.click(within(nav).getByRole("link", { name: "Docs" }))
  await settle(50)
  expect(screen.queryByRole("dialog", { name: "Main" })).toBeNull()
})

test("an agent finds every control by name and opens More", async () => {
  render(<Header />)
  resize(320)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const nav = components.find((entry) => entry.label === "Main")
  expect(nav?.items?.map((item) => item.value)).toEqual(expect.arrayContaining(["Solutions", "more"]))

  const result = await act(() => agent.act({ steps: [{ ref: "Main", action: "setValue", args: ["more"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("button", { name: "More" }).getAttribute("aria-expanded")).toBe("true")
  expect(screen.getByRole("link", { name: "Blog" })).toBeTruthy()
})
