import { fireEvent, render, screen } from "@testing-library/react"
import { expect, test } from "vitest"

import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"

const long = "Retries stop after the first timeout, so a slow endpoint never gets a second chance"

function overflowing(cell: HTMLElement, overflows: boolean) {
  Object.defineProperty(cell, "clientWidth", { configurable: true, value: 100 })
  Object.defineProperty(cell, "scrollWidth", { configurable: true, value: overflows ? 400 : 100 })
}

function Cells() {
  return (
    <Table aria-label="Issues">
      <TableBody>
        <TableRow>
          <TableCell>{long}</TableCell>
          <TableCell wrap>{long}</TableCell>
          <TableCell title="Custom">{long}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

test("a cell truncates by default and shows its whole text in a title only while it is cut off", () => {
  render(<Cells />)
  const [cut] = screen.getAllByRole("cell")
  expect(cut!.className).toContain("truncate")
  expect(cut!.className).toContain("max-w-80")
  expect(cut!.hasAttribute("title")).toBe(false)

  overflowing(cut!, true)
  fireEvent.pointerEnter(cut!)
  expect(cut!.title).toBe(long)

  overflowing(cut!, false)
  fireEvent.pointerEnter(cut!)
  expect(cut!.title).toBe("")
})

test("a wrapping cell drops the truncation and the title; a title of the caller's own stays", () => {
  render(<Cells />)
  const [, wrapped, custom] = screen.getAllByRole("cell")
  expect(wrapped!.hasAttribute("data-wrap")).toBe(true)
  expect(wrapped!.className).toContain("whitespace-normal")
  expect(wrapped!.className).not.toContain("truncate")
  expect(wrapped!.className).not.toContain("max-w-80")
  overflowing(wrapped!, true)
  fireEvent.pointerEnter(wrapped!)
  expect(wrapped!.hasAttribute("title")).toBe(false)

  overflowing(custom!, true)
  fireEvent.pointerEnter(custom!)
  expect(custom!.title).toBe("Custom")
})

type Issue = { id: string; title: string; summary: string }

const columns: DataTableColumn<Issue>[] = [
  { id: "title", header: "Title", cell: (row) => row.title, headerClassName: "w-40" },
  { id: "summary", header: "Summary", cell: (row) => row.summary, wrap: true, cellClassName: "min-w-60" },
]

test("DataTable columns take wrap, cellClassName and headerClassName", () => {
  render(
    <DataTable
      label="Issues"
      rows={[{ id: "1", title: "Webhook retries", summary: long }]}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.title}
    />,
  )
  expect(screen.getByRole("columnheader", { name: "Title" }).className).toContain("w-40")
  const [title, summary] = screen.getAllByRole("cell")
  expect(title!.className).toContain("truncate")
  expect(summary!.hasAttribute("data-wrap")).toBe(true)
  expect(summary!.className).toContain("min-w-60")
  expect(summary!.className).not.toContain("truncate")
})
