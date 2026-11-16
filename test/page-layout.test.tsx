import { act, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageLayout } from "@/components/ui/page-layout"

import { axeViolations } from "./axe"

const agent = createAgent()

test("a page layout is a centered column with the header first and no landmark of its own", async () => {
  const { container } = render(
    <PageLayout header={<PageHeader title="Projects" />}>
      <p>Body</p>
    </PageLayout>,
  )
  const root = container.querySelector("[data-slot=page-layout]")!
  const content = root.querySelector("[data-slot=page-layout-content]")!
  expect(root.tagName).toBe("DIV")
  expect(root.getAttribute("data-width")).toBe("dense")
  expect(root.className).toContain("px-section")
  expect(content.className).toContain("gap-section")
  expect(content.className).toContain("max-w-295")
  expect(content.firstElementChild?.getAttribute("data-slot")).toBe("page-header")
  expect(screen.queryByRole("main")).toBeNull()
  expect(await axeViolations(container)).toEqual([])
})

test("widths cap the content, and the workspace variant drops padding and cap", () => {
  const { container, rerender } = render(<PageLayout width="wide">x</PageLayout>)
  const content = () => container.querySelector("[data-slot=page-layout-content]")!
  expect(content().className).toContain("max-w-360")
  rerender(<PageLayout width="full">x</PageLayout>)
  expect(content().className).not.toMatch(/max-w-/)
  rerender(
    <PageLayout variant="workspace" width="dense">
      x
    </PageLayout>,
  )
  const root = container.querySelector("[data-slot=page-layout]")!
  expect(root.getAttribute("data-variant")).toBe("workspace")
  expect(root.className).not.toMatch(/\bp[xy]-/)
  expect(content().className).not.toMatch(/max-w-|gap-section/)
})

test("as main renders the main landmark with a focusable #main target", async () => {
  const { container, rerender } = render(<PageLayout as="main">Body</PageLayout>)
  const main = screen.getByRole("main")
  expect(main.id).toBe("main")
  expect(main.tabIndex).toBe(-1)
  expect(await axeViolations(container)).toEqual([])
  rerender(
    <PageLayout as="main" id="content">
      Body
    </PageLayout>,
  )
  expect(screen.getByRole("main").id).toBe("content")
})

test("the layout is never a live region, even while its content changes", () => {
  const { container, rerender } = render(<PageLayout as="main">Loading</PageLayout>)
  rerender(<PageLayout as="main">Loaded</PageLayout>)
  const root = container.querySelector("[data-slot=page-layout]")!
  for (const element of [root, ...root.querySelectorAll("*")]) {
    expect(element.hasAttribute("aria-live")).toBe(false)
    expect(element.getAttribute("role") ?? "").not.toMatch(/status|alert|log/)
  }
})

test("an agent finds the controls inside a page by name", async () => {
  const create = vi.fn()
  render(
    <PageLayout
      as="main"
      header={<PageHeader title="Projects" actions={<Button onClick={create}>New project</Button>} />}
    >
      <p>Body</p>
    </PageLayout>,
  )
  const entries = agent.snapshot().filter((entry) => !entry.offPage)
  for (const entry of entries) expect(entry.label, `${entry.component} has no name`).toBeTruthy()
  const result = await act(() => agent.act({ steps: [{ ref: "New project", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(create).toHaveBeenCalledOnce()
})
