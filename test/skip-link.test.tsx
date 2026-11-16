import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useRef } from "react"
import { expect, test, vi } from "vitest"

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

test("activating it focuses the target and keeps the URL, so hash routes survive", async () => {
  const user = userEvent.setup()
  window.location.hash = "#/projects/42"
  render(
    <>
      <SkipLink>Skip to content</SkipLink>
      <PageLayout as="main">Body</PageLayout>
    </>,
  )
  const scroll = vi.spyOn(Element.prototype, "scrollIntoView")
  await user.click(screen.getByRole("link", { name: "Skip to content" }))
  expect(window.location.hash).toBe("#/projects/42")
  expect(document.activeElement).toBe(screen.getByRole("main"))
  expect(scroll.mock.contexts.at(-1)).toBe(screen.getByRole("main"))
  scroll.mockRestore()
  window.location.hash = ""
})

test("Enter on the focused link moves focus without touching the hash", async () => {
  const user = userEvent.setup()
  window.location.hash = "#/inbox"
  render(
    <>
      <SkipLink>Skip to content</SkipLink>
      <PageLayout as="main">Body</PageLayout>
    </>,
  )
  await user.tab()
  await user.keyboard("{Enter}")
  expect(window.location.hash).toBe("#/inbox")
  expect(document.activeElement).toBe(screen.getByRole("main"))
  window.location.hash = ""
})

test("a target without a tabindex gets tabIndex -1 so it can take focus", async () => {
  const user = userEvent.setup()
  render(
    <>
      <SkipLink target="results">Skip to results</SkipLink>
      <section id="results" aria-label="Results">
        Results
      </section>
    </>,
  )
  const link = screen.getByRole("link", { name: "Skip to results" })
  expect(link.getAttribute("href")).toBe("#results")
  await user.click(link)
  const results = screen.getByRole("region", { name: "Results" })
  expect(results.getAttribute("tabindex")).toBe("-1")
  expect(document.activeElement).toBe(results)
})

function RefPage() {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <>
      <SkipLink target={ref}>Skip to content</SkipLink>
      <div ref={ref} data-testid="content">
        Body
      </div>
    </>
  )
}

test("target takes a ref", async () => {
  const user = userEvent.setup()
  render(<RefPage />)
  const link = screen.getByRole("link", { name: "Skip to content" })
  expect(link.getAttribute("href")).toBe("#main")
  await user.click(link)
  expect(document.activeElement).toBe(screen.getByTestId("content"))
})

test("it stays a plain link when the target is missing or the click opens elsewhere", () => {
  render(<SkipLink target="nowhere">Skip to content</SkipLink>)
  const link = screen.getByRole("link", { name: "Skip to content" })
  const click = (init: MouseEventInit) => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...init })
    link.dispatchEvent(event)
    return event.defaultPrevented
  }
  expect(click({})).toBe(false)
  cleanup()
  render(
    <>
      <SkipLink>Skip to content</SkipLink>
      <PageLayout as="main">Body</PageLayout>
    </>,
  )
  const real = screen.getByRole("link", { name: "Skip to content" })
  const press = (init: MouseEventInit) => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...init })
    real.dispatchEvent(event)
    return event.defaultPrevented
  }
  expect(press({ ctrlKey: true })).toBe(false)
  expect(press({ metaKey: true })).toBe(false)
  expect(press({ shiftKey: true })).toBe(false)
  expect(press({ button: 1 })).toBe(false)
  expect(press({})).toBe(true)
})

test("an onClick that prevents default keeps the link from moving focus", async () => {
  const user = userEvent.setup()
  render(
    <>
      <SkipLink onClick={(event) => event.preventDefault()}>Skip to content</SkipLink>
      <PageLayout as="main">Body</PageLayout>
    </>,
  )
  const link = screen.getByRole("link", { name: "Skip to content" })
  await user.click(link)
  expect(document.activeElement).toBe(link)
})
