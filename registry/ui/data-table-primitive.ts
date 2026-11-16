import { createChange, createController, definePrimitive, type ChangeDetails, type ChangeOptions } from "@ui-sdk/core"

import type { DataTableSort, SortDirection } from "@/lib/data-table-model"

type DataTableSortChangeReason = "item-press" | "imperative"
type DataTableSelectionChangeReason = "press" | "select-all" | "imperative"
type DataTablePageChangeReason =
  | "previous-press"
  | "next-press"
  | "first-press"
  | "last-press"
  | "item-press"
  | "imperative"

type DataTableItem = { value: string; label: string }

type DataTableOptions = {
  sortableColumns?: string[]
  rowItems?: DataTableItem[]
  pageCount?: number
  sort?: DataTableSort | null
  defaultSort?: DataTableSort | null
  onSortChange?: (sort: DataTableSort | null, details: ChangeDetails<DataTableSortChangeReason>) => void
  selection?: readonly string[]
  defaultSelection?: readonly string[]
  onSelectionChange?: (selection: string[], details: ChangeDetails<DataTableSelectionChangeReason>) => void
  page?: number
  defaultPage?: number
  onPageChange?: (page: number, details: ChangeDetails<DataTablePageChangeReason>) => void
  controller?: DataTableController
}

interface DataTableController {
  sortBy: (
    columnId: string | null,
    direction?: SortDirection,
    options?: ChangeOptions<DataTableSortChangeReason>,
  ) => boolean | undefined
  setSelection: (ids: string[], options?: ChangeOptions<DataTableSelectionChangeReason>) => boolean | undefined
  setPage: (page: number, options?: ChangeOptions<DataTablePageChangeReason>) => boolean | undefined
}

function reasonOf<Reason extends string>(options: unknown): { reason: Reason | "imperative"; event?: Event } {
  if (typeof options !== "object" || options === null) return { reason: "imperative" }
  const { reason = "imperative", event } = options as ChangeOptions<Reason>
  return { reason, event: event instanceof Event ? event : undefined }
}

// The agent bridge passes action arguments unchecked, so every action validates its own.
const dataTable = definePrimitive({
  name: "data-table",
  options: {
    sortableColumns: "list",
    rowItems: "list",
    pageCount: "number",
    sort: "value",
    defaultSort: "value",
    onSortChange: "callback",
    selection: "list",
    defaultSelection: "list",
    onSelectionChange: "callback",
    page: "number",
    defaultPage: "number",
    onPageChange: "callback",
    controller: "value",
  },
  state: (options: DataTableOptions) => ({
    sort: options.sort !== undefined ? options.sort : (options.defaultSort ?? null),
    selection: options.selection ?? options.defaultSelection ?? [],
    page: options.page ?? options.defaultPage ?? 1,
  }),
  sync: (options) => ({
    ...(options.sort === undefined ? {} : { sort: options.sort }),
    ...(options.selection === undefined ? {} : { selection: options.selection }),
    ...(options.page === undefined ? {} : { page: options.page }),
  }),
  controlled: ["sort", "selection", "page"],
  api: (context) => {
    const change = createChange(context)
    return {
      sortBy(columnId: unknown, direction?: unknown, options?: ChangeOptions<DataTableSortChangeReason>) {
        if (columnId === null) return change("sort", null, reasonOf(options))
        const sortable = context.options().sortableColumns ?? []
        if (typeof columnId !== "string" || !sortable.includes(columnId)) {
          throw new RangeError(`Can't sort by "${String(columnId)}". Sortable columns: ${sortable.join(", ")}.`)
        }
        const current = context.store.get().sort
        const next: SortDirection =
          direction === "ascending" || direction === "descending"
            ? direction
            : current?.columnId === columnId && current.direction === "ascending"
              ? "descending"
              : "ascending"
        return change("sort", { columnId, direction: next }, reasonOf(options))
      },
      setSelection(ids: unknown, options?: ChangeOptions<DataTableSelectionChangeReason>) {
        const known = new Set((context.options().rowItems ?? []).map((item) => item.value))
        if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !known.has(id))) {
          throw new RangeError("setSelection takes a list of row ids from the table.")
        }
        return change("selection", [...new Set(ids as string[])], reasonOf(options))
      },
      setPage(page: unknown, options?: ChangeOptions<DataTablePageChangeReason>) {
        const pageCount = context.options().pageCount ?? 1
        if (typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > pageCount) {
          throw new RangeError(`setPage takes a page from 1 to ${pageCount}.`)
        }
        return change("page", page, reasonOf(options))
      },
      rows: () => context.options().rowItems ?? [],
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "region",
      attrs: (state) => ({
        "data-sorted": state.sort ? "" : undefined,
        "data-selected": state.selection.length > 0 ? "" : undefined,
      }),
    }),
  }),
  agent: { actions: ["sortBy", "setSelection", "setPage"], items: (api) => api.rows() },
})

function createDataTableController() {
  return createController<DataTableController>()
}

export { createDataTableController, dataTable }
export type {
  DataTableController,
  DataTableItem,
  DataTableOptions,
  DataTablePageChangeReason,
  DataTableSelectionChangeReason,
  DataTableSortChangeReason,
}
