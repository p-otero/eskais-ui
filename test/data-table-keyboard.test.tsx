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

function Invoices({
  count = 20,
  onOpen,
  navigation,
}: {
  count?: number
  onOpen?: (invoice: Invoice) => void
  navigation?: "rows" | "cells"
}) {
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
        navigation={navigation}
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

const focusedCell = () => {
  const cell = document.activeElement
  const row = cell?.closest("tr")?.getAttribute("data-row-id")
  return row && cell ? `${row}:${String([...(cell.parentElement?.children ?? [])].indexOf(cell))}` : undefined
}

test('navigation="cells" makes the cells one tab stop: arrows by cell, Home/End, Space selects, Enter opens', async () => {
  const user = userEvent.setup()
  const onOpen = vi.fn()
  render(<Invoices navigation="cells" onOpen={onOpen} />)
  expect(screen.getByRole("grid", { name: "Invoices" })).toBeTruthy()
  const stops = [...document.querySelectorAll<HTMLElement>('[role="gridcell"]')].filter((cell) => cell.tabIndex === 0)
  expect(stops).toHaveLength(1)
  expect(stops[0]?.dataset.slot).toBe("table-cell")
  expect(document.querySelectorAll('tr[tabindex="0"]')).toHaveLength(0)
  expect(document.querySelectorAll('tbody [role="checkbox"][tabindex="0"], tbody button[tabindex="0"]')).toHaveLength(0)

  stops[0]?.focus()
  expect(focusedCell()).toBe("INV-1:0")
  await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}")
  expect(focusedCell()).toBe("INV-2:2")
  await user.keyboard("{End}")
  expect(focusedCell()).toBe("INV-2:3")
  await user.keyboard("{Home}")
  expect(focusedCell()).toBe("INV-2:0")
  await user.keyboard("{Control>}{End}{/Control}")
  expect(focusedCell()).toBe("INV-20:3")
  await user.keyboard(" ")
  expect(screen.getByText("INV-20", { selector: "output" })).toBeTruthy()
  await user.keyboard("{Enter}")
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "INV-20" }))
})

test("cells reach rows a virtualized table hasn't rendered", async () => {
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 1000 * 41 + 800 })
  vi.mocked(globalThis.scrollTo).mockImplementation(((options?: ScrollToOptions | number, y?: number) => {
    const top = typeof options === "number" ? (y ?? 0) : (options?.top ?? globalThis.scrollY)
    Object.defineProperty(globalThis, "scrollY", { configurable: true, value: top })
    globalThis.dispatchEvent(new Event("scroll"))
  }) as typeof globalThis.scrollTo)
  const user = userEvent.setup()
  render(<Invoices count={1000} navigation="cells" />)
  await settle()
  const start = [...document.querySelectorAll<HTMLElement>('[role="gridcell"]')].find((cell) => cell.tabIndex === 0)
  start?.focus()
  await user.keyboard("{ArrowRight}{Control>}{End}{/Control}")
  await settle()
  expect(focusedCell()).toBe("INV-1000:3")
  Object.defineProperty(globalThis, "scrollY", { configurable: true, value: 0 })
  Reflect.deleteProperty(document.documentElement, "scrollHeight")
})
