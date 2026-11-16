import { act, render, screen, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { SiteDocsLayout } from "../apps/site/src/docs/docs-layout"

const agent = createAgent()

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  history.replaceState(null, "", "/")
})

function crumbs() {
  return within(screen.getByRole("navigation", { name: "Breadcrumb" }))
}

test("every crumb but the current page is a link agents can follow to its route", async () => {
  render(
    <SiteDocsLayout route="/docs/components/button">
      <h1>Button</h1>
    </SiteDocsLayout>,
  )
  expect(crumbs().getByText("Button").getAttribute("aria-current")).toBe("page")
  expect(crumbs().queryByRole("link", { name: "Button" })).toBeNull()
  const links = crumbs()
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")])
  expect(links).toEqual([
    ["Docs", "/docs/installation/"],
    ["Foundations", "/docs/components/#foundations"],
  ])

  const followable = agent.snapshot().filter((entry) => entry.component === "link" && !entry.offPage)
  expect(followable.map((entry) => [entry.label, entry.actions])).toEqual(
    expect.arrayContaining([
      ["Docs", ["follow"]],
      ["Foundations", ["follow"]],
    ]),
  )
  for (const [label, path, hash] of [
    ["Foundations", "/docs/components/", "#foundations"],
    ["Docs", "/docs/installation/", ""],
  ] as const) {
    const result = await act(() => agent.act({ steps: [{ ref: label, action: "follow" }] }))
    expect(result.ok, result.error?.message).toBe(true)
    expect(location.pathname + location.hash).toBe(path + hash)
  }
})

test("a guide links to the docs home and leaves out a crumb that leads back to itself", () => {
  const { unmount } = render(
    <SiteDocsLayout route="/docs/theming">
      <h1>Theming</h1>
    </SiteDocsLayout>,
  )
  expect(
    crumbs()
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Docs"])
  unmount()
  render(
    <SiteDocsLayout route="/docs/installation">
      <h1>Installation</h1>
    </SiteDocsLayout>,
  )
  expect(crumbs().queryAllByRole("link")).toEqual([])
  expect(crumbs().getByText("Installation").getAttribute("aria-current")).toBe("page")
})
