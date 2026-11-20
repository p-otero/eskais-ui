import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { expect, test, vi } from "vitest"

import { DataTable, type DataTableColumn, type DataTableSort } from "@/components/ui/data-table"

const agent = createAgent()

type Invoice = { id: string; customer: string; amount: number }

const page: Invoice[] = [
  { id: "i9", customer: "Zeta", amount: 5 },
  { id: "i3", customer: "Alpha", amount: 90 },
]

const columns: DataTableColumn<Invoice>[] = [
  { id: "customer", header: "Customer", cell: (row) => row.customer, sortField: "customer.name" },
  { id: "amount", header: "Amount", cell: (row) => row.amount, sortField: "amount", align: "end" },
  { id: "id", header: "Number", cell: (row) => row.id },
]

function customers() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent)
}

// A manual table holds sort and page in the app, which fetches the matching rows. UI SDK's dev check fails a controlled
// value that a change request leaves as it was, so the app here updates both and leaves the rows alone.
function ManualInvoices({
  onSortChange,
  onPageChange,
}: {
  onSortChange: (sort: DataTableSort | null, details: unknown) => void
  onPageChange: (page: number, details: unknown) => void
}) {
  const [sort, setSort] = useState<DataTableSort | null>({ columnId: "amount", direction: "descending" })
  const [current, setCurrent] = useState(3)
  return (
    <DataTable
      label="Invoices"
      manual
      rows={page}
      total={42}
      pageSize={2}
      page={current}
      sort={sort}
      onSortChange={(next, details) => {
        onSortChange(next, details)
        setSort(next)
      }}
      onPageChange={(next, details) => {
        onPageChange(next, details)
        setCurrent(next)
      }}
      columns={columns}
      getRowId={(row) => row.id}
    />
  )
}

test("manual: shows the rows as given and only reports sort and page changes", async () => {
  const user = userEvent.setup()
  const onSortChange = vi.fn()
  const onPageChange = vi.fn()
  render(<ManualInvoices onSortChange={onSortChange} onPageChange={onPageChange} />)
  expect(customers()).toEqual(["Zeta", "Alpha"])
  expect(screen.getByRole("columnheader", { name: /Amount/ }).getAttribute("aria-sort")).toBe("descending")
  expect(screen.getByText("Page 3 of 21")).toBeTruthy()

  await user.click(screen.getByRole("button", { name: "Sort by Customer" }))
  expect(onSortChange).toHaveBeenCalledWith({ columnId: "customer", direction: "ascending" }, expect.anything())
  expect(screen.getByRole("columnheader", { name: /Customer/ }).getAttribute("aria-sort")).toBe("ascending")
  expect(customers()).toEqual(["Zeta", "Alpha"])

  await user.click(screen.getByRole("button", { name: "Next page" }))
  expect(onPageChange).toHaveBeenCalledWith(4, expect.objectContaining({ reason: "next-press" }))
  expect(screen.getByText("Page 4 of 21")).toBeTruthy()
  expect(customers()).toEqual(["Zeta", "Alpha"])
  expect(screen.queryByRole("columnheader", { name: "Number" })?.hasAttribute("aria-sort")).toBe(false)
})

test("manual: pageCount wins over total, busy marks the table, secondary sorts show their place", () => {
  render(
    <DataTable
      label="Invoices"
      manual
      rows={page}
      total={1000}
      pageCount={4}
      pageSize={2}
      busy
      sort={{ columnId: "customer", direction: "ascending" }}
      secondarySorts={[{ columnId: "amount", direction: "descending" }]}
      columns={columns}
      getRowId={(row) => row.id}
    />,
  )
  expect(screen.getByText("Page 1 of 4")).toBeTruthy()
  expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true")
  expect(screen.getByRole("button", { name: "Sort by Amount, sorted second" })).toBeTruthy()
  expect(screen.getByRole("columnheader", { name: /Amount/ }).getAttribute("aria-sort")).toBe("none")
})

test("manual: agents sort by a sortField column and page within pageCount", async () => {
  const onSortChange = vi.fn()
  const onPageChange = vi.fn()
  render(
    <DataTable
      label="Invoices"
      manual
      rows={page}
      pageCount={3}
      pageSize={2}
      onSortChange={onSortChange}
      onPageChange={onPageChange}
      columns={columns}
      getRowId={(row) => row.id}
    />,
  )
  const sorted = await agent.act({ steps: [{ ref: "Invoices", action: "sortBy", args: ["amount", "descending"] }] })
  expect(sorted.ok, sorted.error?.message).toBe(true)
  expect(onSortChange).toHaveBeenCalledWith({ columnId: "amount", direction: "descending" }, expect.anything())
  const paged = await agent.act({ steps: [{ ref: "Invoices", action: "setPage", args: [3] }] })
  expect(paged.ok, paged.error?.message).toBe(true)
  expect(onPageChange).toHaveBeenCalledWith(3, expect.anything())
  expect((await agent.act({ steps: [{ ref: "Invoices", action: "setPage", args: [4] }] })).ok).toBe(false)
  expect((await agent.act({ steps: [{ ref: "Invoices", action: "sortBy", args: ["id"] }] })).ok).toBe(false)
})
