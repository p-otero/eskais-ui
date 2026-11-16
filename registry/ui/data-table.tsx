"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { useEffect, useRef, useState } from "react"

import {
  DataTableCheckbox,
  DataTableHeaderCell,
  dataTableLabels,
  DataTablePagination,
  type DataTableColumn,
  type DataTableLabels,
  type DataTablePageOptions,
  type DataTablePaginationProps,
  type DataTableProps,
} from "@/components/ui/data-table-parts"
import { createDataTableController, dataTable } from "@/components/ui/data-table-primitive"
import { DataTableEmptyRow, DataTableLoadingRows, DataTableRow } from "@/components/ui/data-table-row"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { clampPage, pageCountOf, paginate, selectionState, sortRows, toggleIds } from "@/lib/data-table-model"
import { cn } from "@/lib/utils"

const { Root: DataTableRoot } = createParts(dataTable, { root: "div" })

function useMirror<Value>(controlled: Value | undefined, initial: Value) {
  const [own, setOwn] = useState(initial)
  return [controlled === undefined ? own : controlled, setOwn] as const
}

function DataTable<Row>({
  label,
  rows,
  columns,
  getRowId,
  getRowLabel = getRowId,
  selectable = false,
  pageSize,
  renderPagination,
  loading = false,
  loadingRows = 5,
  empty,
  labels: labelOverrides,
  controller: controllerProp,
  className,
  tableClassName,
  ...state
}: DataTableProps<Row>) {
  const labels = { ...dataTableLabels, ...labelOverrides }
  const [ownController] = useState(createDataTableController)
  const controller = controllerProp ?? ownController
  const [sort, setSort] = useMirror(state.sort, state.defaultSort ?? null)
  const [selection, setSelection] = useMirror(state.selection, state.defaultSelection ?? [])
  const [requestedPage, setPage] = useMirror(state.page, state.defaultPage ?? 1)
  // Agent steps run back to back without a render in between, so toggles read the latest selection, not the rendered one.
  const latestSelection = useRef(selection)
  useEffect(() => {
    latestSelection.current = selection
  })

  const sortColumn = columns.find((column) => column.id === sort?.columnId)
  const sorted = sortRows(rows, sort, sortColumn?.sortValue)
  const pageCount = pageCountOf(rows.length, pageSize)
  const page = clampPage(requestedPage, pageCount)
  const visible = paginate(sorted, page, pageSize).rows
  const visibleIds = visible.map(getRowId)
  const selected = new Set(selection)
  const pageSelection = selectionState(visibleIds, selected)
  const rowItems = rows.map((row) => ({ value: getRowId(row), label: getRowLabel(row) }))
  const columnCount = columns.length + (selectable ? 1 : 0)

  const pagination: DataTablePaginationProps = {
    page,
    pageCount,
    pageSize: pageSize ?? rows.length,
    total: rows.length,
    onPageChange: (next: number, options?: DataTablePageOptions) =>
      controller.setPage(clampPage(next, pageCount), options),
  }

  return (
    <DataTableRoot
      aria-label={label}
      controller={controller}
      sortableColumns={columns.filter((column) => column.sortValue).map((column) => column.id)}
      rowItems={rowItems}
      pageCount={pageCount}
      sort={sort}
      onSortChange={(next, details) => {
        state.onSortChange?.(next, details)
        if (!details.canceled) setSort(next)
      }}
      selection={selection}
      onSelectionChange={(next, details) => {
        state.onSelectionChange?.(next, details)
        if (details.canceled) return
        latestSelection.current = next
        setSelection(next)
      }}
      page={page}
      onPageChange={(next, details) => {
        state.onPageChange?.(next, details)
        if (!details.canceled) setPage(next)
      }}
      className={cn("flex w-full flex-col gap-items", className)}
    >
      <Table aria-label={label} aria-busy={loading || undefined} className={tableClassName}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable && (
              <TableHead scope="col" className="w-0">
                <DataTableCheckbox
                  label={labels.selectAll}
                  disabled={loading || visibleIds.length === 0}
                  checked={pageSelection === "some" ? "indeterminate" : pageSelection === "all"}
                  onChange={(checked, event) =>
                    controller.setSelection(toggleIds(latestSelection.current, visibleIds, checked), {
                      reason: "select-all",
                      event,
                    })
                  }
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <DataTableHeaderCell
                key={column.id}
                column={column}
                sort={sort}
                sortLabel={labels.sortBy}
                onSort={(event) => controller.sortBy(column.id, undefined, { reason: "item-press", event })}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <DataTableLoadingRows rows={loadingRows} columns={columnCount} />
          ) : visible.length === 0 ? (
            <DataTableEmptyRow columns={columnCount}>{empty}</DataTableEmptyRow>
          ) : (
            visible.map((row, index) => {
              const id = visibleIds[index] as string
              return (
                <DataTableRow
                  key={id}
                  row={row}
                  id={id}
                  columns={columns}
                  selection={
                    selectable
                      ? {
                          label: labels.selectRow(getRowLabel(row)),
                          selected: selected.has(id),
                          onChange: (checked, event) =>
                            controller.setSelection(toggleIds(latestSelection.current, [id], checked), {
                              reason: "press",
                              event,
                            }),
                        }
                      : undefined
                  }
                />
              )
            })
          )}
        </TableBody>
      </Table>
      {pageSize !== undefined &&
        pageCount > 1 &&
        (renderPagination ? renderPagination(pagination) : <DataTablePagination {...pagination} labels={labels} />)}
    </DataTableRoot>
  )
}

export { createDataTableController, DataTable, dataTableLabels }
export type { DataTableColumn, DataTableLabels, DataTablePaginationProps, DataTableProps }
export type { DataTableSort, SortDirection, SortValue } from "@/lib/data-table-model"
