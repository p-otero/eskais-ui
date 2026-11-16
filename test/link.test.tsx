import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { checkServer } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList } from "@/components/ui/breadcrumb"
import { Link } from "@/components/ui/link"
import { link } from "@/components/ui/link-primitive"

import { axeViolations } from "./axe"

const agent = createAgent()

test("an inline link is underlined at rest and names itself by its text", async () => {
  const { container } = render(
    <p>
      Read the <Link href="/docs">docs</Link>.
    </p>,
  )
  const anchor = screen.getByRole("link", { name: "docs" })
  expect(anchor.getAttribute("href")).toBe("/docs")
  expect(anchor.className).toMatch(/\bunderline\b/)
  expect(anchor.getAttribute("data-variant")).toBe("inline")
  expect(await axeViolations(container)).toEqual([])
})

test("external links get rel and an icon; only newTab opens a new tab and says so", () => {
  render(
    <>
      <Link href="https://example.com" external>
        Example
      </Link>
      <Link href="https://example.org" external newTab newTabLabel="(new tab)">
        Elsewhere
      </Link>
    </>,
  )
  const same = screen.getByRole("link", { name: "Example" })
  expect(same.getAttribute("rel")).toBe("noopener noreferrer")
  expect(same.hasAttribute("target")).toBe(false)
  expect(same.querySelector("[data-slot=link-external-icon]")?.getAttribute("aria-hidden")).toBe("true")
  const blank = screen.getByRole("link", { name: /^Elsewhere\s*\(new tab\)$/ })
  expect(blank.getAttribute("target")).toBe("_blank")
})

test("current marks the page, or another aria-current token", () => {
  render(
    <>
      <Link href="/a" variant="nav" current>
        A
      </Link>
      <Link href="#b" variant="nav" current="location">
        B
      </Link>
    </>,
  )
  expect(screen.getByRole("link", { name: "A" }).getAttribute("aria-current")).toBe("page")
  expect(screen.getByRole("link", { name: "B" }).getAttribute("aria-current")).toBe("location")
})

test("render swaps the element, for a router's link", () => {
  render(
    <Link href="/x" render={<a href="/x" aria-label="Router" data-router="" />}>
      Router
    </Link>,
  )
  expect(screen.getByRole("link", { name: "Router" }).getAttribute("data-router")).toBe("")
})

test("onFollow takes plain clicks; modified clicks keep the browser's behaviour", async () => {
  const onFollow = vi.fn()
  render(
    <Link href="/next" onFollow={onFollow}>
      Next
    </Link>,
  )
  const anchor = screen.getByRole("link", { name: "Next" })
  await userEvent.click(anchor)
  expect(onFollow).toHaveBeenCalledWith("/next", expect.objectContaining({ reason: "follow" }))
  onFollow.mockClear()
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true })
  anchor.dispatchEvent(event)
  expect(onFollow).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
})

test("agents see and follow only links with onFollow", async () => {
  const onFollow = vi.fn()
  render(
    <nav aria-label="Main">
      <Link href="/docs" onFollow={onFollow}>
        Documentation
      </Link>
      <Link href="/elsewhere">Elsewhere</Link>
    </nav>,
  )
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component === "link")
  expect(entries.map((entry) => [entry.label, entry.value, entry.actions])).toEqual([
    ["Documentation", "/docs", ["follow"]],
  ])
  const result = await agent.act({ steps: [{ ref: "Documentation", action: "follow" }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onFollow).toHaveBeenCalledWith("/docs", expect.objectContaining({ source: "agent" }))
})

test("BreadcrumbLink is a nav Link", () => {
  render(
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>,
  )
  const anchor = screen.getByRole("link", { name: "Home" })
  expect(anchor.getAttribute("data-slot")).toBe("breadcrumb-link")
  expect(anchor.getAttribute("data-variant")).toBe("nav")
})

test("primitive: renders on the server", () => {
  checkServer(link, { href: "/docs", onFollow: () => {} }, `<root>Docs</root>`)
})
