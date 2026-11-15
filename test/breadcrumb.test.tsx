import { render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test } from "vitest"

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function Trail({ label }: { label?: string }) {
  return (
    <main>
      <Breadcrumb aria-label={label}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Index the docs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </main>
  )
}

test("is a navigation named Breadcrumb by default, with an ordered list and the current page marked", () => {
  render(<Trail />)
  const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
  expect(nav.querySelector("ol")).not.toBeNull()
  expect(screen.getAllByRole("listitem")).toHaveLength(3)
  expect(screen.getByRole("link", { name: "Projects" }).getAttribute("href")).toBe("/projects")
  expect(screen.getByText("Index the docs").getAttribute("aria-current")).toBe("page")
  expect(screen.getByRole("link", { name: "Projects" }).getAttribute("aria-current")).toBeNull()
  for (const separator of nav.querySelectorAll('[data-slot="breadcrumb-separator"]')) {
    expect(separator.getAttribute("aria-hidden")).toBe("true")
    expect(separator.querySelector("svg")).not.toBeNull()
  }
})

test("its name is overridable", () => {
  render(<Trail label="Ruta" />)
  expect(screen.getByRole("navigation", { name: "Ruta" })).toBeTruthy()
})

test("has no axe violations", async () => {
  const { container } = render(<Trail />)
  expect(await axeViolations(container)).toEqual([])
})

test("adds no unnamed component to the agent snapshot", async () => {
  render(<Trail />)
  await settle()
  for (const entry of agent.snapshot().filter((item) => !item.offPage && item.component !== "more")) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
})
