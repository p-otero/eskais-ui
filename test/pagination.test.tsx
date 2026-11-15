import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Pagination } from "@/components/ui/pagination"

import { axeViolations, settle } from "./overlay-helpers"

const agent = createAgent()

function Results({ onPageChange }: { onPageChange?: (page: number, reason: string) => void }) {
  const [page, setPage] = useState(1)
  return (
    <main>
      <Pagination
        aria-label="Results pages"
        page={page}
        total={95}
        pageSize={10}
        onPageChange={(next, details) => {
          onPageChange?.(next, details.reason)
          setPage(next)
        }}
      />
      <p>Showing page {page}</p>
    </main>
  )
}

test("renders a named navigation with the current page marked and the first step disabled", () => {
  render(<Results />)
  const nav = screen.getByRole("navigation", { name: "Results pages" })
  expect(nav.querySelector("ul, ol")).not.toBeNull()
  const current = screen.getByRole("button", { name: "Page 1" })
  expect(current.getAttribute("aria-current")).toBe("page")
  expect(screen.getByRole("button", { name: "Page 10" }).getAttribute("aria-current")).toBeNull()
  const previous = screen.getByRole("button", { name: "Previous page" })
  expect(previous.getAttribute("aria-disabled")).toBe("true")
  expect(screen.getByRole("button", { name: "Next page" }).getAttribute("aria-disabled")).toBeNull()
})

test("Next, a page button and the keyboard move the current page and report why", async () => {
  const user = userEvent.setup()
  const onPageChange = vi.fn()
  render(<Results onPageChange={onPageChange} />)

  await user.click(screen.getByRole("button", { name: "Next page" }))
  expect(onPageChange).toHaveBeenLastCalledWith(2, "next-press")
  expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page")

  const last = screen.getByRole("button", { name: "Page 10" })
  last.focus()
  await user.keyboard("{Enter}")
  expect(onPageChange).toHaveBeenLastCalledWith(10, "item-press")
  expect(screen.getByText("Showing page 10")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Next page" }).getAttribute("aria-disabled")).toBe("true")
})

test("labels are overridable", () => {
  render(
    <Pagination
      pageCount={3}
      labels={{ navigation: "Páginas", previous: "Anterior", next: "Siguiente", page: (page) => `Página ${page}` }}
    />,
  )
  expect(screen.getByRole("navigation", { name: "Páginas" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Anterior" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Siguiente" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Página 2" })).toBeTruthy()
})

test("has no axe violations", async () => {
  const { container } = render(<Results />)
  expect(await axeViolations(container)).toEqual([])
})

test("an agent can drive the pagination to a given page", async () => {
  const onPageChange = vi.fn()
  render(<Results onPageChange={onPageChange} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  expect(components.map((entry) => entry.label)).toContain("Results pages")

  const result = await agent.act({ steps: [{ ref: "Results pages", action: "setPage", args: [7] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(onPageChange).toHaveBeenLastCalledWith(7, "imperative")
  expect(screen.getByRole("button", { name: "Page 7" }).getAttribute("aria-current")).toBe("page")
})
