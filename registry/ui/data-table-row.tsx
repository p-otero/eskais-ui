"use client"

import { useCallback, type ReactNode } from "react"

import { DataTableCheckbox, type DataTableColumn } from "@/components/ui/data-table-parts"
import { NavigableRow } from "@/components/ui/row-navigation"
import { Empty } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"

type DataTableRowProps<Row> = {
  row: Row
  id: string
  columns: readonly DataTableColumn<Row>[]
  selection?: { label: string; selected: boolean; onChange: (checked: boolean, event?: Event) => void }
  /** The row's place among all rows, while the table is virtualized. */
  position?: { index: number; measure?: (node: HTMLElement | null) => void }
}

// The focus ring sits inside the row: a table row draws no box-shadow, and its outline would be clipped by the scroller.
const rowClassName =
  "scroll-mt-(--control-height) outline-none data-selected:bg-muted focus-visible:bg-muted/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"

function DataTableRow<Row>({ row, id, columns, selection, position }: DataTableRowProps<Row>) {
  return (
    <NavigableRow
      id={id}
      render={<DataTableRowElement row={row} id={id} columns={columns} selection={selection} position={position} />}
    />
  )
}

function assignRef(ref: unknown, node: HTMLElement | null) {
  if (typeof ref === "function") return (ref as (node: HTMLElement | null) => unknown)(node)
  if (ref && typeof ref === "object") (ref as { current: unknown }).current = node
}

// Rendered by NavigableRow, which passes the roving tab stop's ref and handlers along with the row's own props.
function DataTableRowElement<Row>({
  row,
  id,
  columns,
  selection,
  position,
  ref,
  ...props
}: DataTableRowProps<Row> & { ref?: unknown } & Record<string, unknown>) {
  const measure = position?.measure
  const rowRef = useCallback(
    (node: HTMLTableRowElement | null) => {
      const cleanup = assignRef(ref, node)
      measure?.(node)
      return () => {
        if (typeof cleanup === "function") cleanup()
        else assignRef(ref, null)
      }
    },
    [ref, measure],
  )
  return (
    <TableRow
      {...props}
      ref={rowRef}
      data-index={position?.index}
      aria-rowindex={position ? position.index + 2 : undefined}
      data-row-id={id}
      data-selected={selection?.selected ? "" : undefined}
      className={rowClassName}
    >
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

function DataTableGapRow({ columns, size, children }: { columns: number; size: number; children?: ReactNode }) {
  return (
    <tr aria-hidden="true" data-slot="data-table-gap" style={{ height: size }}>
      <td colSpan={columns} className="p-0">
        {children}
      </td>
    </tr>
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

export { DataTableEmptyRow, DataTableGapRow, DataTableLoadingRows, DataTableRow }
export type { DataTableRowProps }
