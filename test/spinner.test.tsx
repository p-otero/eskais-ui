import { render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import { Spinner } from "@/components/ui/spinner"

import { axeViolations } from "./axe"

const agent = createAgent()

test("a spinner without a label is decorative and sized like an icon", async () => {
  const { container } = render(<Spinner />)
  const svg = container.querySelector("svg")!
  expect(svg.getAttribute("aria-hidden")).toBe("true")
  expect(svg.dataset.slot).toBe("spinner")
  expect(svg.dataset.size).toBe("md")
  expect(svg.getAttribute("class")).toContain("size-4")
  expect(svg.getAttribute("stroke")).toBe("currentColor")
  expect(screen.queryByRole("status")).toBeNull()
  expect(await axeViolations(container)).toEqual([])
})

test("sizes map to the icon scale", () => {
  const { container } = render(
    <>
      <Spinner size="sm" />
      <Spinner size="lg" />
    </>,
  )
  const [sm, lg] = container.querySelectorAll("svg")
  expect(sm!.getAttribute("class")).toContain("size-3")
  expect(lg!.getAttribute("class")).toContain("size-6")
})

test("reduced motion swaps the spinning arc for a pulsing one", () => {
  const { container } = render(<Spinner />)
  const svg = container.querySelector("svg")!
  expect(svg.getAttribute("class")).toContain("motion-safe:animate-spin")
  expect(svg.querySelector("path.motion-reduce\\:hidden")).toBeTruthy()
  expect(svg.querySelector("g.motion-safe\\:hidden animate")?.getAttribute("repeatCount")).toBe("indefinite")
})

test("a label makes it a status region with a screen-reader-only name", async () => {
  const { container } = render(<Spinner label="Loading projects" />)
  const status = screen.getByRole("status")
  expect(status.textContent).toBe("Loading projects")
  expect(status.querySelector(".sr-only")?.textContent).toBe("Loading projects")
  expect(status.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
  expect(await axeViolations(container)).toEqual([])
})

test("agents see no control in a spinner", () => {
  render(<Spinner label="Loading" />)
  expect(agent.snapshot().filter((entry) => !entry.offPage)).toEqual([])
})
