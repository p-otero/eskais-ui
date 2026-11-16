import { act, render, screen, within } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import { DocsBreadcrumb, DocsLayout, DocsPager, DocsToc } from "@/components/ui/docs-layout"

afterEach(() => {
  vi.unstubAllGlobals()
})

test("DocsLayout renders main, its slots and the header bar", () => {
  render(
    <DocsLayout
      sidebar={<nav aria-label="Docs">Sidebar</nav>}
      toc={<p>Toc</p>}
      header={<DocsBreadcrumb items={[{ label: "Docs", href: "/docs" }, { label: "Button" }]} />}
    >
      <h1>Button</h1>
    </DocsLayout>,
  )
  const main = screen.getByRole("main")
  expect(main.id).toBe("main")
  expect(within(main).getByRole("heading", { name: "Button" })).toBeTruthy()
  const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" })
  expect(within(crumbs).getByRole("link", { name: "Docs" }).getAttribute("href")).toBe("/docs")
  expect(within(crumbs).getByText("Button").getAttribute("aria-current")).toBe("page")
})

test("DocsToc marks the heading being read", () => {
  const observers: { callback: IntersectionObserverCallback }[] = []
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observers.push({ callback })
      }
      observe() {}
      disconnect() {}
    },
  )
  render(
    <>
      <h2 id="usage">Usage</h2>
      <h2 id="api">API</h2>
      <DocsToc
        title="On this page"
        items={[
          { id: "usage", label: "Usage" },
          { id: "api", label: "API" },
        ]}
      />
    </>,
  )
  const api = document.getElementById("api")!
  act(() => {
    observers[0]?.callback(
      [{ target: api, isIntersecting: true } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
  })
  const nav = screen.getByRole("navigation", { name: "On this page" })
  expect(within(nav).getByRole("link", { name: "API" }).getAttribute("aria-current")).toBe("location")
  expect(within(nav).getByRole("link", { name: "Usage" }).hasAttribute("aria-current")).toBe(false)
})

test("DocsPager links the neighbours with overridable labels", () => {
  render(
    <DocsPager
      previous={{ href: "/a", title: "Alpha" }}
      next={{ href: "/b", title: "Beta" }}
      labels={{ next: "Siguiente" }}
    />,
  )
  const nav = screen.getByRole("navigation", { name: "Previous and next pages" })
  expect(
    within(nav)
      .getByRole("link", { name: /Previous\s*Alpha/ })
      .getAttribute("href"),
  ).toBe("/a")
  expect(
    within(nav)
      .getByRole("link", { name: /Siguiente\s*Beta/ })
      .getAttribute("href"),
  ).toBe("/b")
})
