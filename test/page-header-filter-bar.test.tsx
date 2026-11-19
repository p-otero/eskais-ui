import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { FilterBar, FilterBarButton, FilterBarSearch, FilterBarSeparator } from "@/components/ui/filter-bar"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

test("a page header renders its heading level, description, actions and breadcrumb", async () => {
  const { container, rerender } = render(
    <PageHeader
      title="Deployments"
      description="Every build of every project."
      breadcrumb={<nav aria-label="Breadcrumb">Projects / Apollo</nav>}
      actions={<Button>New deployment</Button>}
    />,
  )
  const heading = screen.getByRole("heading", { level: 1, name: "Deployments" })
  expect(heading.id).toBeTruthy()
  expect(screen.getByText("Every build of every project.")).toBeTruthy()
  expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy()
  expect(container.querySelector("[data-slot=page-header-actions]")?.textContent).toBe("New deployment")
  expect(await axeViolations(container)).toEqual([])

  rerender(<PageHeader title="Settings" headingLevel={2} titleId="settings-title" />)
  expect(screen.getByRole("heading", { level: 2, name: "Settings" }).id).toBe("settings-title")
  expect(container.querySelector("[data-slot=page-header-description]")).toBeNull()
  expect(container.querySelector("[data-slot=page-header-actions]")).toBeNull()
})

function Filters({ onReset }: { onReset?: () => void }) {
  const [query, setQuery] = useState("")
  const [mine, setMine] = useState(false)
  return (
    <FilterBar
      label="Filter deployments"
      isFiltered={query !== "" || mine}
      onReset={() => {
        setQuery("")
        setMine(false)
        onReset?.()
      }}
      resetLabel="Clear all"
    >
      <FilterBarSearch label="Search deployments" value={query} onValueChange={setQuery} />
      <FilterBarSeparator />
      <FilterBarButton aria-pressed={mine} onClick={() => setMine(!mine)}>
        Mine
      </FilterBarButton>
    </FilterBar>
  )
}

test("a filter bar is one toolbar tab stop, and its reset shows only while filtered", async () => {
  const user = userEvent.setup()
  const onReset = vi.fn()
  const { container } = render(<Filters onReset={onReset} />)
  await settle()
  expect(screen.getByRole("toolbar", { name: "Filter deployments" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull()

  await user.tab()
  const search = screen.getByRole("searchbox", { name: "Search deployments" })
  expect(document.activeElement).toBe(search)
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mine" }))
  await user.keyboard("{Enter}")
  expect(screen.getByRole("button", { name: "Mine" }).getAttribute("aria-pressed")).toBe("true")
  expect(await axeViolations(container)).toEqual([])

  await user.click(screen.getByRole("button", { name: "Clear all" }))
  expect(onReset).toHaveBeenCalledOnce()
  expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull()
})

test("an agent searches and resets the filters", async () => {
  render(<Filters />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const typed = await act(() =>
    agent.act({ steps: [{ ref: "Search deployments", action: "setValue", args: ["atlas"] }] }),
  )
  expect(typed.ok, typed.error?.message).toBe(true)
  expect(screen.getByRole<HTMLInputElement>("searchbox").value).toBe("atlas")
  const reset = await act(() =>
    agent.act({ steps: [{ ref: "Filter deployments", action: "press", args: ["Clear all"] }] }),
  )
  expect(reset.ok, reset.error?.message).toBe(true)
  expect(screen.getByRole<HTMLInputElement>("searchbox").value).toBe("")
})

test("a page header shows an eyebrow above the title and a tabs slot under the title row", async () => {
  const user = userEvent.setup()
  const { container } = render(
    <Tabs defaultValue="overview">
      <PageHeader
        eyebrow="Project"
        title="Apollo"
        actions={<Button>Deploy</Button>}
        tabs={
          <TabsList aria-label="Project sections">
            <TabsTab value="overview">Overview</TabsTab>
            <TabsTab value="settings">Settings</TabsTab>
          </TabsList>
        }
      />
      <TabsPanel value="overview">Overview panel</TabsPanel>
      <TabsPanel value="settings">Settings panel</TabsPanel>
    </Tabs>,
  )
  const header = container.querySelector("[data-slot=page-header]")!
  const eyebrow = header.querySelector("[data-slot=page-header-eyebrow]")!
  const heading = screen.getByRole("heading", { level: 1, name: "Apollo" })
  expect(eyebrow.textContent).toBe("Project")
  expect(eyebrow.className).toContain("text-meta")
  expect(eyebrow.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(heading.className).toContain("text-display-sm")
  expect(header.lastElementChild?.firstElementChild?.getAttribute("data-slot")).toBe("page-header-tabs")
  expect(header.querySelector("[data-slot=page-header-actions]")?.parentElement?.className).toContain("narrow:flex-col")
  expect(await axeViolations(container)).toEqual([])

  await user.click(screen.getByRole("tab", { name: "Settings" }))
  expect(screen.getByRole("tabpanel").textContent).toBe("Settings panel")
  const labels = agent
    .snapshot()
    .filter((entry) => !entry.offPage)
    .map((entry) => entry.label)
  expect(labels).toContain("Project sections")
  const result = await act(() =>
    agent.act({ steps: [{ ref: "Project sections", action: "setValue", args: ["overview"] }] }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("tabpanel").textContent).toBe("Overview panel")
})
