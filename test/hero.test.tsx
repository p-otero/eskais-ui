import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"

import { Hero } from "@/components/ui/hero"

import { axeViolations } from "./axe"

test("Hero names its section by the title and shows the parts it gets", async () => {
  const { container } = render(
    <Hero
      eyebrow="Beta"
      title="Ship the page,"
      titleMuted="not the layout."
      description="Blocks with props."
      actions={<a href="#start">Start</a>}
      install="npx shadcn add @eskais/hero"
      aside={<p>Demo</p>}
    />,
  )
  const section = screen.getByRole("region", { name: "Ship the page, not the layout." })
  expect(within(section).getByRole("heading", { level: 1 })).toBeTruthy()
  expect(within(section).getByRole("group", { name: "Install command" })).toBeTruthy()
  expect(container.querySelector("[data-slot=hero-aside]")?.textContent).toBe("Demo")
  expect(await axeViolations(container)).toEqual([])
})

test("Hero centers and drops the decoration on request", () => {
  const { container } = render(<Hero title="Centered" align="center" decoration="none" headingLevel={2} />)
  expect(container.querySelector("[data-slot=hero]")?.getAttribute("data-align")).toBe("center")
  expect(container.querySelector(".bg-grid-lines")).toBeNull()
  expect(screen.getByRole("heading", { level: 2, name: "Centered" })).toBeTruthy()
})
