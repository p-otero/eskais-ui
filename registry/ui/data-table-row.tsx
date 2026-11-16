"use client"

import type { ReactNode } from "react"

import { DataTableCheckbox, type DataTableColumn } from "@/components/ui/data-table-parts"
import { Empty } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"

type DataTableRowProps<Row> = {
  row: Row
  id: string
  columns: readonly DataTableColumn<Row>[]
  selection?: { label: string; selected: boolean; onChange: (checked: boolean, event?: Event) => void }
}

function DataTableRow<Row>({ row, id, columns, selection }: DataTableRowProps<Row>) {
  return (
    <TableRow data-row-id={id} data-selected={selection?.selected ? "" : undefined} className="data-selected:bg-muted">
      {selection && (
        <TableCell className="w-0">
          <DataTableCheckbox label={selection.label} checked={selection.selected} onChange={selection.onChange} />
        </TableCell>
      )}
      {columns.map((column) => (
        <TableCell
          key={column.id}
          data-align={column.align}
          className="data-[align=center]:text-center data-[align=end]:text-end"
        >
          {column.cell(row)}
        </TableCell>
      ))}
    </TableRow>
  )
}

function DataTableEmptyRow({ columns, children }: { columns: number; children?: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columns} className="max-w-none">
        {children !== undefined && <Empty className="border-0">{children}</Empty>}
      </TableCell>
    </TableRow>
  )
}

function DataTableLoadingRows({ rows, columns }: { rows: number; columns: number }) {
  return Array.from({ length: rows }, (_, row) => (
    <TableRow key={`loading-${row}`} data-slot="data-table-loading-row" className="hover:bg-transparent">
      {Array.from({ length: columns }, (_cell, column) => (
        <TableCell key={column}>
          <Skeleton className="h-4 w-full max-w-40" />
        </TableCell>
      ))}
    </TableRow>
  ))
}

export { DataTableEmptyRow, DataTableLoadingRows, DataTableRow }
export type { DataTableRowProps }
