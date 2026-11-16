import { act, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/card"
import { Section } from "@/components/ui/section"

import { axeViolations } from "./axe"

const agent = createAgent()

test("a card with a title is a section labelled by it", async () => {
  const { container } = render(
    <Card>
      <CardHeader>
        <CardEyebrow>Usage</CardEyebrow>
        <CardTitle headingLevel={3}>Build minutes</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline">
            Export minutes
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>420</CardContent>
    </Card>,
  )
  const region = screen.getByRole("region", { name: "Build minutes" })
  expect(region.tagName).toBe("SECTION")
  const heading = screen.getByRole("heading", { level: 3, name: "Build minutes" })
  expect(region.getAttribute("aria-labelledby")).toBe(heading.id)
  expect(container.querySelector("[data-slot=card-eyebrow]")?.className).toContain("text-meta")
  expect(await axeViolations(container)).toEqual([])
})

function classes(element: Element) {
  return element.className.split(/\s+/)
}

test("with an action, the header wraps: the heading grows from an 11rem basis and the action follows it", () => {
  const { container } = render(
    <Card>
      <CardHeader>
        <CardEyebrow>Usage</CardEyebrow>
        <CardTitle>Build minutes</CardTitle>
        <CardAction>
          <Button size="sm">Export minutes</Button>
        </CardAction>
      </CardHeader>
    </Card>,
  )
  const header = container.querySelector("[data-slot=card-header]")!
  const heading = header.querySelector(":scope > [data-slot=card-heading]")!
  expect(classes(header)).toEqual(expect.arrayContaining(["flex", "flex-wrap"]))
  expect(classes(heading)).toEqual(expect.arrayContaining(["grow", "basis-(--card-heading-basis)", "min-w-0"]))
  expect([...heading.children].map((child) => child.getAttribute("data-slot"))).toEqual(["card-eyebrow", "card-title"])
  expect(header.lastElementChild?.getAttribute("data-slot")).toBe("card-action")
  expect(classes(header.lastElementChild!)).toEqual(expect.arrayContaining(["flex-wrap", "max-w-full"]))
})

test("without an action the header is a plain column, and a Section matches a Card", () => {
  const { container } = render(
    <>
      <Card>
        <CardHeader>
          <CardTitle>Plain</CardTitle>
        </CardHeader>
      </Card>
      <Section title="Deploys" action={<Button size="sm">New</Button>} />
    </>,
  )
  const [plain, section] = container.querySelectorAll("[data-slot=card-header]")
  expect(plain!.querySelector("[data-slot=card-heading]")).toBeNull()
  expect(plain!.firstElementChild?.getAttribute("data-slot")).toBe("card-title")
  expect(section!.querySelector(":scope > [data-slot=card-heading] > [data-slot=card-title]")).not.toBeNull()
  expect(section!.lastElementChild?.getAttribute("data-slot")).toBe("card-action")
})

test("a card without a title has no name and no dangling reference", async () => {
  const { container } = render(
    <Card>
      <CardContent>Body</CardContent>
    </Card>,
  )
  const card = container.querySelector("[data-slot=card]")!
  expect(card.hasAttribute("aria-labelledby")).toBe(false)
  expect(screen.queryByRole("region")).toBeNull()
  expect(await axeViolations(container)).toEqual([])
})

function Titled({ title }: { title: boolean }) {
  return (
    <Card>
      <CardHeader>{title ? <CardTitle render={<p id="usage-title" />}>Usage</CardTitle> : null}</CardHeader>
    </Card>
  )
}

test("the title keeps an id from its render element or props, and removing it unnames the card", () => {
  const { container, rerender } = render(<Titled title />)
  const card = container.querySelector("[data-slot=card]")!
  expect(card.getAttribute("aria-labelledby")).toBe("usage-title")
  expect(document.getElementById("usage-title")?.textContent).toBe("Usage")
  rerender(<Titled title={false} />)
  expect(card.hasAttribute("aria-labelledby")).toBe(false)
})

test("server rendering keeps the section element, so hydration doesn't swap it", () => {
  const html = renderToString(
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
    </Card>,
  )
  expect(html.startsWith("<section")).toBe(true)
})

test("Section composes a titled card with eyebrow, description, action and footer", async () => {
  const create = vi.fn()
  const { container } = render(
    <Section
      eyebrow="Team"
      title="Members"
      description="Everyone with access."
      action={<Button onClick={create}>Invite member</Button>}
      footer={<span>12 members</span>}
    >
      <p>List</p>
    </Section>,
  )
  const region = screen.getByRole("region", { name: "Members" })
  expect(screen.getByRole("heading", { level: 2, name: "Members" })).toBeTruthy()
  expect(region.dataset.surface).toBe("card")
  expect(region.querySelector("[data-slot=card-description]")?.textContent).toBe("Everyone with access.")
  expect(region.querySelector("[data-slot=card-footer]")?.textContent).toBe("12 members")
  expect(await axeViolations(container)).toEqual([])

  const entries = agent.snapshot().filter((entry) => !entry.offPage)
  for (const entry of entries) expect(entry.label, `${entry.component} has no name`).toBeTruthy()
  const result = await act(() => agent.act({ steps: [{ ref: "Invite member", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(create).toHaveBeenCalledOnce()
})

test("Section surfaces, padding and heading level", () => {
  const { rerender } = render(
    <Section title="Create" surface="dashed" padding="sm" headingLevel={3}>
      body
    </Section>,
  )
  let region = screen.getByRole("region", { name: "Create" })
  expect(region.className).toContain("border-dashed")
  expect(region.className).not.toContain("shadow-surface")
  expect(region.className).toContain("py-group")
  expect(screen.getByRole("heading", { level: 3 })).toBeTruthy()

  rerender(
    <Section title="Plain" surface="none" padding="sm">
      body
    </Section>,
  )
  region = screen.getByRole("region", { name: "Plain" })
  expect(region.className).not.toMatch(/\bborder\b|py-group|py-inset-surface/)
  expect(region.className).toContain("[&>[data-slot^=card-]]:px-0")
})
