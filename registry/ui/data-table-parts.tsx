"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import type { ReactNode } from "react"
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox, CheckboxIndicator, type CheckedState } from "@/components/ui/checkbox"
import type {
  DataTableController,
  DataTablePageChangeReason,
  DataTableSelectionChangeReason,
  DataTableSortChangeReason,
} from "@/components/ui/data-table-primitive"
import { Pagination } from "@/components/ui/pagination"
import { TableHead } from "@/components/ui/table"
import type { DataTableSort, SortDirection, SortValue } from "@/lib/data-table-model"

type DataTableAlign = "start" | "center" | "end"

type DataTableColumn<Row> = {
  id: string
  header: ReactNode
  cell: (row: Row) => ReactNode
  sortValue?: (row: Row) => SortValue
  align?: DataTableAlign
}

type DataTableLabels = {
  sortBy: (header: string) => string
  selectAll: string
  selectRow: (rowLabel: string) => string
  previousPage: string
  nextPage: string
  pageStatus: (page: number, pageCount: number) => string
}

const dataTableLabels: DataTableLabels = {
  sortBy: (header) => `Sort by ${header}`,
  selectAll: "Select all rows on this page",
  selectRow: (rowLabel) => `Select ${rowLabel}`,
  previousPage: "Previous page",
  nextPage: "Next page",
  pageStatus: (page, pageCount) => `Page ${page} of ${pageCount}`,
}

type DataTablePageOptions = { reason?: DataTablePageChangeReason; event?: Event }

type DataTablePaginationProps = {
  page: number
  pageCount: number
  pageSize: number
  total: number
  onPageChange: (page: number, options?: DataTablePageOptions) => void
}

function SortIcon({ direction }: { direction?: SortDirection }) {
  if (direction === "ascending") return <ChevronUpIcon />
  if (direction === "descending") return <ChevronDownIcon />
  return <ChevronsUpDownIcon />
}

function DataTableHeaderCell<Row>({
  column,
  sort,
  sortLabel,
  onSort,
}: {
  column: DataTableColumn<Row>
  sort: DataTableSort | null
  sortLabel: DataTableLabels["sortBy"]
  onSort: (event: Event) => void
}) {
  const direction = sort?.columnId === column.id ? sort.direction : undefined
  const header = typeof column.header === "string" ? column.header : column.id
  return (
    <TableHead
      scope="col"
      aria-sort={column.sortValue ? (direction ?? "none") : undefined}
      data-align={column.align}
      className="data-[align=center]:text-center data-[align=end]:text-end"
    >
      {column.sortValue ? (
        <Button
          variant="ghost"
          size="sm"
          aria-label={sortLabel(header)}
          data-slot="data-table-sort"
          data-align={column.align}
          className="-mx-control-x gap-inline text-foreground data-[align=end]:flex-row-reverse [&_svg]:size-3.5"
          onClick={(event) => onSort(event.nativeEvent)}
        >
          {column.header}
          <SortIcon direction={direction} />
        </Button>
      ) : (
        column.header
      )}
    </TableHead>
  )
}

function DataTableCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: CheckedState
  disabled?: boolean
  onChange: (checked: boolean, event?: Event) => void
}) {
  return (
    <Checkbox
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(next, details) => onChange(next === true, details.event)}
    >
      <CheckboxIndicator />
    </Checkbox>
  )
}

function DataTablePagination({
  page,
  pageCount,
  onPageChange,
  labels,
}: DataTablePaginationProps & { labels: Pick<DataTableLabels, "previousPage" | "nextPage" | "pageStatus"> }) {
  return (
    <div data-slot="data-table-pagination" className="flex flex-wrap items-center justify-end gap-items">
      <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
        {labels.pageStatus(page, pageCount)}
      </span>
      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={(next, details) => onPageChange(next, { reason: details.reason, event: details.event })}
        labels={{ previous: labels.previousPage, next: labels.nextPage }}
        className="w-auto"
      />
    </div>
  )
}

export { DataTableCheckbox, DataTableHeaderCell, dataTableLabels, DataTablePagination }
type DataTableProps<Row> = {
  label: string
  rows: readonly Row[]
  columns: readonly DataTableColumn<Row>[]
  getRowId: (row: Row) => string
  getRowLabel?: (row: Row) => string
  sort?: DataTableSort | null
  defaultSort?: DataTableSort | null
  onSortChange?: (sort: DataTableSort | null, details: ChangeDetails<DataTableSortChangeReason>) => void
  selectable?: boolean
  selection?: readonly string[]
  defaultSelection?: readonly string[]
  onSelectionChange?: (selection: string[], details: ChangeDetails<DataTableSelectionChangeReason>) => void
  pageSize?: number
  page?: number
  defaultPage?: number
  onPageChange?: (page: number, details: ChangeDetails<DataTablePageChangeReason>) => void
  renderPagination?: (props: DataTablePaginationProps) => ReactNode
  loading?: boolean
  loadingRows?: number
  empty?: ReactNode
  labels?: Partial<DataTableLabels>
  controller?: DataTableController
  className?: string
  tableClassName?: string
}

export type {
  DataTableAlign,
  DataTableColumn,
  DataTableLabels,
  DataTablePageOptions,
  DataTablePaginationProps,
  DataTableProps,
}
