import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { PageLayout } from "@/components/ui/page-layout"
import { SkipLink } from "@/components/ui/skip-link"

import { axeViolations } from "./axe"

const agent = createAgent()

test("a skip link is the first tab stop, hidden until focused, and targets #main", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <>
      <SkipLink>Skip to content</SkipLink>
      <nav aria-label="Primary">
        <a href="/projects">Projects</a>
      </nav>
      <PageLayout as="main">Body</PageLayout>
    </>,
  )
  const link = screen.getByRole("link", { name: "Skip to content" })
  expect(link.getAttribute("href")).toBe("#main")
  expect(link.className).toContain("sr-only")
  expect(link.className).toContain("focus:not-sr-only")
  expect(link.className).toContain("focus:z-toast")
  await user.tab()
  expect(document.activeElement).toBe(link)
  expect(document.getElementById("main")).toBe(screen.getByRole("main"))
  expect(await axeViolations(container)).toEqual([])
})

test("href points it at another target", () => {
  render(<SkipLink href="#results">Skip to results</SkipLink>)
  expect(screen.getByRole("link", { name: "Skip to results" }).getAttribute("href")).toBe("#results")
})

test("the label is required by type", () => {
  // @ts-expect-error children is required: a skip link has no default copy
  const missing = <SkipLink />
  expect(missing).toBeTruthy()
})

test("agents see no control in a skip link", () => {
  render(<SkipLink>Skip to content</SkipLink>)
  expect(agent.snapshot().filter((entry) => !entry.offPage)).toEqual([])
})
