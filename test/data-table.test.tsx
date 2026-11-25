import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import {
  createDataTableController,
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from "@/components/ui/data-table"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const agent = createAgent()

type Deployment = { id: string; name: string; region: string; builds: number | null }

const deployments: Deployment[] = [
  { id: "d1", name: "Atlas", region: "eu-west", builds: 12 },
  { id: "d2", name: "Borealis", region: "us-east", builds: 3 },
  { id: "d3", name: "Cygnus", region: "ap-south", builds: null },
  { id: "d4", name: "Draco", region: "eu-west", builds: 40 },
  { id: "d5", name: "Eridanus", region: "us-west", builds: 7 },
]

const columns: DataTableColumn<Deployment>[] = [
  { id: "name", header: "Name", cell: (row) => row.name, sortValue: (row) => row.name },
  { id: "region", header: "Region", cell: (row) => row.region },
  { id: "builds", header: "Builds", cell: (row) => row.builds ?? "—", sortValue: (row) => row.builds, align: "end" },
]

function names() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").at(-3)?.textContent)
}

function Deployments(props: Partial<Parameters<typeof DataTable<Deployment>>[0]>) {
  return (
    <DataTable
      label="Deployments"
      rows={deployments}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.name}
      {...props}
    />
  )
}

test("sorts by a column, toggles the direction and marks the header with aria-sort", async () => {
  const user = userEvent.setup()
  const onSortChange = vi.fn()
  render(<Deployments onSortChange={onSortChange} />)
  const builds = screen.getByRole("columnheader", { name: /Builds/ })
  expect(builds.getAttribute("aria-sort")).toBe("none")
  expect(screen.getByRole("columnheader", { name: "Region" }).hasAttribute("aria-sort")).toBe(false)

  await user.click(screen.getByRole("button", { name: "Sort by Builds" }))
  expect(builds.getAttribute("aria-sort")).toBe("ascending")
  expect(names()).toEqual(["Borealis", "Eridanus", "Atlas", "Draco", "Cygnus"])
  expect(onSortChange).toHaveBeenLastCalledWith(
    { columnId: "builds", direction: "ascending" },
    expect.objectContaining({ reason: "item-press" }),
  )

  await user.click(screen.getByRole("button", { name: "Sort by Builds" }))
  expect(builds.getAttribute("aria-sort")).toBe("descending")
  expect(names()).toEqual(["Draco", "Atlas", "Eridanus", "Borealis", "Cygnus"])
})

function Controlled() {
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: "name", direction: "descending" })
  return <Deployments sort={sort} onSortChange={(next, details) => details.source !== "agent" && setSort(next)} />
}

test("a controlled sort follows the app, and a canceled change keeps it", async () => {
  const user = userEvent.setup()
  render(<Controlled />)
  expect(names()[0]).toBe("Eridanus")
  await user.click(screen.getByRole("button", { name: "Sort by Name" }))
  expect(names()[0]).toBe("Atlas")

  render(<Deployments defaultSort={{ columnId: "name", direction: "ascending" }} onSortChange={(_, d) => d.cancel()} />)
  const second = screen.getAllByRole("button", { name: "Sort by Name" })[1] as HTMLElement
  await user.click(second)
  expect(second.closest("th")?.getAttribute("aria-sort")).toBe("ascending")
})

test("selects rows, and select-all checks the page, shows mixed and clears", async () => {
  const user = userEvent.setup()
  const onSelectionChange = vi.fn()
  render(<Deployments selectable onSelectionChange={onSelectionChange} />)
  const all = screen.getByRole("checkbox", { name: "Select all rows on this page" })

  await user.click(screen.getByRole("checkbox", { name: "Select Atlas" }))
  expect(all.getAttribute("aria-checked")).toBe("mixed")
  expect(onSelectionChange).toHaveBeenLastCalledWith(["d1"], expect.objectContaining({ reason: "press" }))
  expect(screen.getByRole("checkbox", { name: "Select Atlas" }).closest("tr")?.hasAttribute("data-selected")).toBe(true)

  await user.click(all)
  expect(all.getAttribute("aria-checked")).toBe("true")
  expect(onSelectionChange.mock.lastCall?.[0]).toHaveLength(5)
  expect(onSelectionChange.mock.lastCall?.[1].reason).toBe("select-all")

  await user.click(all)
  expect(all.getAttribute("aria-checked")).toBe("false")
  expect(onSelectionChange.mock.lastCall?.[0]).toEqual([])
})

test("pages with the built-in previous and next buttons, with page details", async () => {
  const user = userEvent.setup()
  const onPageChange = vi.fn()
  render(<Deployments pageSize={2} onPageChange={onPageChange} />)
  expect(names()).toEqual(["Atlas", "Borealis"])
  expect(screen.getByText("Page 1 of 3")).toBeTruthy()
  const previous = screen.getByRole("button", { name: "Previous page" })
  expect(previous.getAttribute("aria-disabled")).toBe("true")

  await user.click(screen.getByRole("button", { name: "Next page" }))
  expect(names()).toEqual(["Cygnus", "Draco"])
  expect(onPageChange).toHaveBeenLastCalledWith(2, expect.objectContaining({ reason: "next-press" }))
  await user.click(screen.getByRole("button", { name: "Next page" }))
  expect(names()).toEqual(["Eridanus"])
  expect(screen.getByRole("button", { name: "Next page" }).getAttribute("aria-disabled")).toBe("true")
  await user.click(previous)
  expect(screen.getByText("Page 2 of 3")).toBeTruthy()
})

test("renderPagination replaces the built-in buttons and drives the page", async () => {
  const user = userEvent.setup()
  render(
    <Deployments
      pageSize={2}
      defaultPage={3}
      labels={{ previousPage: "Anterior" }}
      renderPagination={({ page, pageCount, pageSize, total, onPageChange }) => (
        <button type="button" onClick={() => onPageChange(1)}>
          {`${page}/${pageCount} size ${pageSize} of ${total}`}
        </button>
      )}
    />,
  )
  expect(screen.queryByRole("button", { name: "Anterior" })).toBeNull()
  await user.click(screen.getByRole("button", { name: "3/3 size 2 of 5" }))
  expect(names()).toEqual(["Atlas", "Borealis"])
})

test("shows skeleton rows while loading and the empty slot without rows", async () => {
  const { container, rerender } = render(<Deployments loading selectable />)
  expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true")
  expect(container.querySelectorAll("[data-slot=skeleton]")).toHaveLength(5 * 4)
  expect(await axeViolations(container)).toEqual([])

  rerender(<Deployments rows={[]} empty={<p>No deployments yet.</p>} />)
  expect(screen.getByText("No deployments yet.").closest("[data-slot=empty]")).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})

test("has no axe violations sorted, selected and paginated", async () => {
  const { container } = render(
    <Deployments
      selectable
      pageSize={2}
      defaultSort={{ columnId: "name", direction: "ascending" }}
      defaultSelection={["d1"]}
    />,
  )
  await settle()
  expect(await axeViolations(container)).toEqual([])
})

test("an agent sorts the table, selects rows and changes page", async () => {
  render(<Deployments selectable pageSize={2} />)
  await settle()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const table = components.find((entry) => entry.component === "data-table")
  expect(table?.label).toBe("Deployments")
  expect(table?.actions).toEqual(expect.arrayContaining(["sortBy", "setSelection", "setPage"]))
  const labels = components.map((entry) => entry.label)
  for (const label of ["Sort by Name", "Select Atlas"]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label)
  }
  expect(components.some((entry) => entry.component === "pagination")).toBe(true)

  const result = await act(() =>
    agent.act({
      steps: [
        { ref: table?.ref ?? "Deployments", action: "sortBy", args: ["builds", "descending"] },
        { ref: table?.ref ?? "Deployments", action: "setSelection", args: [["d4", "d5"]] },
        { ref: "Select Atlas", action: "setChecked", args: [true] },
      ],
    }),
  )
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("columnheader", { name: /Builds/ }).getAttribute("aria-sort")).toBe("descending")
  expect(names()).toEqual(["Draco", "Atlas"])
  expect(screen.getByRole("checkbox", { name: "Select Draco" }).getAttribute("aria-checked")).toBe("true")
  expect(screen.getByRole("checkbox", { name: "Select Atlas" }).getAttribute("aria-checked")).toBe("true")

  const paged = await act(() =>
    agent.act({ steps: [{ ref: table?.ref ?? "Deployments", action: "setPage", args: [2] }] }),
  )
  expect(paged.ok, paged.error?.message).toBe(true)
  expect(names()).toEqual(["Eridanus", "Borealis"])
})

test("toggleRows builds on the selection an earlier call chose before the table renders it", async () => {
  const controller = createDataTableController()
  const onSelectionChange = vi.fn()
  render(<Deployments selectable controller={controller} onSelectionChange={onSelectionChange} />)
  await settle()
  act(() => {
    controller.toggleRows(["d1"], true)
    controller.toggleRows(["d2"], true)
  })
  expect(onSelectionChange).toHaveBeenLastCalledWith(["d1", "d2"], expect.anything())
  act(() => {
    controller.toggleRows(["d1"])
  })
  expect(onSelectionChange).toHaveBeenLastCalledWith(["d2"], expect.anything())
  expect(screen.getByRole("checkbox", { name: "Select Borealis" }).getAttribute("aria-checked")).toBe("true")
  expect(screen.getByRole("checkbox", { name: "Select Atlas" }).getAttribute("aria-checked")).toBe("false")
})

test("renders 1,000 rows with pagination", () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({
    id: `r${index}`,
    name: `Service ${String(index).padStart(4, "0")}`,
    region: index % 2 ? "eu-west" : "us-east",
    builds: (index * 7919) % 1000,
  }))
  const start = performance.now()
  render(
    <DataTable
      label="Services"
      rows={rows}
      columns={columns}
      getRowId={(row) => row.id}
      selectable
      pageSize={50}
      defaultSort={{ columnId: "builds", direction: "descending" }}
    />,
  )
  const elapsed = performance.now() - start
  console.info(`DataTable: 1,000 rows, 50 per page, sorted, rendered in ${elapsed.toFixed(1)} ms`)
  expect(screen.getAllByRole("row")).toHaveLength(51)
  expect(screen.getByText("Page 1 of 20")).toBeTruthy()
  expect(elapsed).toBeLessThan(2000)
})
