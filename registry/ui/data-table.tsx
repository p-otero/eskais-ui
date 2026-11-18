"use client"

import { createParts } from "@ui-sdk/react/primitive"
import { useCallback, useMemo, useRef, useState } from "react"

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
import { DataTableEmptyRow, DataTableGapRow, DataTableLoadingRows, DataTableRow } from "@/components/ui/data-table-row"
import { RowNavigationProvider, useRowNavigation } from "@/components/ui/row-navigation"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  clampPage,
  pageCountOf,
  paginate,
  selectionState,
  sortRows,
  toggleIds,
  type DataTableSort,
  type SortDirection,
  type SortValue,
} from "@/lib/data-table-model"
import { cn } from "@/lib/utils"
import { GapFindStubs, useVirtualRows } from "@/components/ui/virtual-rows"

const { Root: DataTableRoot } = createParts(dataTable, { root: "div" })

function useMirror<Value>(controlled: Value | undefined, initial: Value) {
  const [own, setOwn] = useState(initial)
  return [controlled === undefined ? own : controlled, setOwn] as const
}

// Stable between renders, so a virtualized table's find-in-page stubs re-render only when the rows change.
function useVisibleRows<Row>(
  rows: readonly Row[],
  columns: DataTableProps<Row>["columns"],
  sort: DataTableSort | null,
  page: number,
  pageSize: number | undefined,
  manual: boolean,
) {
  return useMemo(() => {
    if (manual) return rows
    const sortValue = columns.find((column) => column.id === sort?.columnId)?.sortValue
    return paginate(sortRows(rows, sort, sortValue), page, pageSize).rows
  }, [rows, columns, sort, page, pageSize, manual])
}

function isSortable<Row>(column: DataTableColumn<Row>, manual: boolean) {
  return column.sortValue !== undefined || (manual && column.sortField !== undefined)
}

function manualPageCount(pageCount: number | undefined, total: number | undefined, pageSize: number | undefined) {
  if (pageCount !== undefined) return Math.max(1, Math.trunc(pageCount))
  return total === undefined ? 1 : pageCountOf(total, pageSize)
}

function DataTable<Row>({
  label,
  rows,
  columns,
  getRowId,
  getRowLabel = getRowId,
  selectable = false,
  pageSize,
  manual = false,
  total,
  pageCount: pageCountProp,
  secondarySorts,
  busy = false,
  renderPagination,
  loading = false,
  loadingRows = 5,
  empty,
  labels: labelOverrides,
  controller: controllerProp,
  onRowOpen,
  virtualize = "auto",
  estimateSize = 41,
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
  // Agent steps run back to back without a render in between, so a toggle builds on the selection the previous step
  // chose until a render shows a newer one.
  const chosen = useRef<{ shown: typeof selection; next: typeof selection } | null>(null)
  const latestSelection = () =>
    chosen.current !== null && chosen.current.shown === selection ? chosen.current.next : selection

  const pageCount = manual ? manualPageCount(pageCountProp, total, pageSize) : pageCountOf(rows.length, pageSize)
  const page = clampPage(requestedPage, pageCount)
  const visible = useVisibleRows(rows, columns, sort, page, pageSize, manual)
  const visibleIds = useMemo(() => visible.map(getRowId), [visible, getRowId])
  const selected = new Set(selection)
  const pageSelection = selectionState(visibleIds, selected)
  const rowItems = rows.map((row) => ({ value: getRowId(row), label: getRowLabel(row) }))
  const columnCount = columns.length + (selectable ? 1 : 0)
  const indexOf = new Map(visibleIds.map((id, index) => [id, index]))

  const { anchor, ...virtual } = useVirtualRows({
    count: loading ? 0 : visible.length,
    virtualize,
    estimateSize,
    getKey: (index) => visibleIds[index] ?? String(index),
  })
  const textAt = useCallback(
    (index: number) => (visible[index] === undefined ? "" : getRowLabel(visible[index])),
    [visible, getRowLabel],
  )

  const toggleRow = (id: string, event?: Event) => {
    const checked = !latestSelection().includes(id)
    controller.setSelection(toggleIds(latestSelection(), [id], checked), { reason: "press", event })
  }
  const navigation = useRowNavigation({
    ids: visibleIds,
    onOpen: onRowOpen
      ? (id) => {
          const index = indexOf.get(id)
          if (index !== undefined && visible[index] !== undefined) onRowOpen(visible[index])
        }
      : undefined,
    onToggle: selectable ? (id, event) => toggleRow(id, event) : undefined,
    reveal: (id) => {
      const index = indexOf.get(id)
      if (index !== undefined) virtual.scrollToIndex(index)
    },
  })

  const pagination: DataTablePaginationProps = {
    page,
    pageCount,
    pageSize: pageSize ?? rows.length,
    total: manual ? (total ?? rows.length) : rows.length,
    onPageChange: (next: number, options?: DataTablePageOptions) =>
      controller.setPage(clampPage(next, pageCount), options),
  }

  return (
    <DataTableRoot
      aria-label={label}
      controller={controller}
      sortableColumns={columns.filter((column) => isSortable(column, manual)).map((column) => column.id)}
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
        chosen.current = { shown: selection, next }
        setSelection(next)
      }}
      page={page}
      onPageChange={(next, details) => {
        state.onPageChange?.(next, details)
        if (!details.canceled) setPage(next)
      }}
      className={cn("flex w-full flex-col gap-items", className)}
    >
      <Table
        aria-label={label}
        aria-busy={loading || busy || undefined}
        aria-rowcount={virtual.enabled ? visible.length + 1 : undefined}
        containerClassName="min-h-0"
        className={tableClassName}
      >
        <TableHeader className={cn(virtual.enabled && "[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-background")}>
          <TableRow className="hover:bg-transparent">
            {selectable && (
              <TableHead scope="col" className="w-0">
                <DataTableCheckbox
                  label={labels.selectAll}
                  disabled={loading || visibleIds.length === 0}
                  checked={pageSelection === "some" ? "indeterminate" : pageSelection === "all"}
                  onChange={(checked, event) =>
                    controller.setSelection(toggleIds(latestSelection(), visibleIds, checked), {
                      reason: "select-all",
                      event,
                    })
                  }
                />
              </TableHead>
            )}
            {columns.map((column) => {
              const rank = secondarySorts?.findIndex((secondary) => secondary.columnId === column.id) ?? -1
              const secondary = rank === -1 ? undefined : secondarySorts?.[rank]
              return (
                <DataTableHeaderCell
                  key={column.id}
                  column={column}
                  sort={sort}
                  sortable={isSortable(column, manual)}
                  secondary={secondary && { direction: secondary.direction, rank: rank + 2 }}
                  labels={labels}
                  onSort={(event) => controller.sortBy(column.id, undefined, { reason: "item-press", event })}
                />
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody ref={anchor} className={cn(virtual.enabled && "relative")}>
          {loading ? (
            <DataTableLoadingRows rows={loadingRows} columns={columnCount} />
          ) : visible.length === 0 ? (
            <DataTableEmptyRow columns={columnCount}>{empty}</DataTableEmptyRow>
          ) : (
            <RowNavigationProvider handle={navigation}>
              {virtual.segments.map((segment) => {
                if (segment.type === "gap") {
                  return (
                    <DataTableGapRow key={segment.key} columns={columnCount} size={segment.size}>
                      <GapFindStubs
                        from={segment.from}
                        to={segment.to}
                        text={textAt}
                        offsetOf={virtual.offsetOf}
                        onFound={virtual.scrollToIndex}
                      />
                    </DataTableGapRow>
                  )
                }
                const row = visible[segment.index]
                const id = visibleIds[segment.index]
                if (row === undefined || id === undefined) return null
                return (
                  <DataTableRow
                    key={id}
                    row={row}
                    id={id}
                    columns={columns}
                    position={virtual.enabled ? { index: segment.index, measure: virtual.measureElement } : undefined}
                    selection={
                      selectable
                        ? {
                            label: labels.selectRow(getRowLabel(row)),
                            selected: selected.has(id),
                            onChange: (checked, event) =>
                              controller.setSelection(toggleIds(latestSelection(), [id], checked), {
                                reason: "press",
                                event,
                              }),
                          }
                        : undefined
                    }
                  />
                )
              })}
            </RowNavigationProvider>
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
export type { DataTableSort, SortDirection, SortValue }
