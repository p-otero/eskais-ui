import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"

import { DataTable, type DataTableColumn } from "@/components/ui/data-table"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

type Invoice = { id: string; customer: string; amount: number }

const invoices = (count: number): Invoice[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `INV-${String(index + 1)}`,
    customer: `Customer ${String(index + 1)}`,
    amount: (index + 1) * 10,
  }))

const columns: DataTableColumn<Invoice>[] = [
  { id: "id", header: "Invoice", cell: (row) => row.id },
  { id: "customer", header: "Customer", cell: (row) => row.customer },
  { id: "amount", header: "Amount", cell: (row) => String(row.amount), align: "end" },
]

const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.index === undefined ? 0 : 41
    },
  })
  vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {})
})
afterEach(() => {
  if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight)
  vi.restoreAllMocks()
})

function Invoices({ count = 20, onOpen }: { count?: number; onOpen?: (invoice: Invoice) => void }) {
  const [selection, setSelection] = useState<string[]>([])
  return (
    <>
      <DataTable
        label="Invoices"
        rows={invoices(count)}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.id}
        selectable
        selection={selection}
        onSelectionChange={setSelection}
        onRowOpen={onOpen}
        virtualize={count > 200 ? "auto" : false}
      />
      <output>{selection.join(" ")}</output>
    </>
  )
}

function focusedRow() {
  return document.activeElement?.getAttribute("data-row-id")
}

test("rows are one tab stop with j/k, arrows, Home/End and page keys; Enter opens, x and Space select", async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  const { container } = render(<Invoices onOpen={onOpen} />)
  await user.tab()
  await user.tab()
  expect(focusedRow()).toBe("INV-1")
  await user.keyboard("jj{ArrowDown}")
  expect(focusedRow()).toBe("INV-4")
  await user.keyboard("k{ArrowUp}")
  expect(focusedRow()).toBe("INV-2")
  await user.keyboard("{End}")
  expect(focusedRow()).toBe("INV-20")
  await user.keyboard("{Home}{PageDown}")
  expect(focusedRow()).toBe("INV-11")

  await user.keyboard("{Enter}")
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "INV-11" }))
  await user.keyboard("xj ")
  expect(screen.getByRole("status").textContent).toBe("INV-11 INV-12")
  expect(screen.getByRole("checkbox", { name: /INV-12/ }).getAttribute("aria-checked")).toBe("true")
  await user.keyboard(" ")
  expect(screen.getByRole("status").textContent).toBe("INV-11")
  expect(await axeViolations(container)).toEqual([])
})

test("a checkbox inside a row keeps its own Space", async () => {
  const user = userEvent.setup()
  render(<Invoices />)
  await user.click(screen.getByRole("checkbox", { name: /INV-3/ }))
  expect(screen.getByRole("status").textContent).toBe("INV-3")
  await user.keyboard(" ")
  expect(screen.getByRole("status").textContent).toBe("")
})

test("past 200 rows the table virtualizes with row indexes, and agents still select any row", async () => {
  render(<Invoices count={2000} />)
  const table = screen.getByRole("table", { name: "Invoices" })
  expect(table.getAttribute("aria-rowcount")).toBe("2001")
  const rows = table.querySelectorAll("tbody tr[data-row-id]")
  expect(rows.length).toBeLessThan(200)
  expect(rows[0]?.getAttribute("aria-rowindex")).toBe("2")
  expect(table.querySelector('[data-slot="data-table-gap"]')).not.toBeNull()

  await settle()
  const agent = createAgent()
  const result = await agent.act({ steps: [{ ref: "Invoices", action: "setSelection", args: [["INV-1999"]] }] })
  expect(result.ok, result.error?.message).toBe(true)
  expect(screen.getByRole("status").textContent).toBe("INV-1999")
})
