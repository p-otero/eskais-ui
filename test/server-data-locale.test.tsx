import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"

import { summarizeFilter, filterChipsLabels } from "@/components/ui/filter-chips"
import { createDataClient, DataProvider } from "@/components/ui/server-data"
import { ServerDataTable } from "@/components/ui/server-data-table"
import { arraySource } from "@/lib/array-source"
import { createPageController } from "@/lib/page-controller"
import { formatCount, pageStatusLabels } from "@/lib/page-source"

import { serverTaskFilters as schema } from "./fixtures/server-tasks"

afterEach(() => {
  document.documentElement.lang = ""
})

test("the range label writes its numbers in the locale it gets", () => {
  const range = { from: 1001, to: 1020, total: { kind: "exact" as const, value: 12_345 } }
  expect(pageStatusLabels.range(range, "de-DE")).toBe("Showing 1.001–1.020 of 12.345")
  expect(pageStatusLabels.range(range, "en-US")).toBe("Showing 1,001–1,020 of 12,345")
  expect(formatCount(1_234_567.5, "fr-FR")).toBe(new Intl.NumberFormat("fr-FR").format(1_234_567.5))
  const controller = createPageController(arraySource([]), { pageSize: 20 })
  controller.setPage(51)
  expect(controller.statusText({ items: Array.from({ length: 20 }), total: 4000 }, undefined, "de-DE")).toBe(
    "Showing 1.001–1.020 of 4.000",
  )
})

test("chips write dates and numbers in the locale, a date-only value as the day it names", () => {
  const labels = filterChipsLabels
  expect(summarizeFilter(schema.created, { from: "2026-01-01", to: "2026-01-31" }, labels, undefined, "en-US")).toBe(
    "Jan 1, 2026 – Jan 31, 2026",
  )
  expect(summarizeFilter(schema.created, { to: "2026-03-05" }, labels, undefined, "de-DE")).toBe("≤ 05.03.2026")
  expect(summarizeFilter(schema.points, { op: "gte", value: 1500 }, labels, undefined, "de-DE")).toBe("≥ 1.500")
  expect(summarizeFilter(schema.points, { op: "between", min: 1000, max: 2000 }, labels, undefined, "en-US")).toBe(
    "1,000–2,000",
  )
  expect(summarizeFilter(schema.status, ["open", "blocked", "done", "in_progress"], labels, undefined, "de-DE")).toBe(
    "4 selected",
  )
})

function renderTable(locale?: string) {
  const rows = Array.from({ length: 2400 }, (_, index) => ({ id: String(index) }))
  const client = createDataClient({ retryDelay: 0 })
  render(
    <DataProvider client={client}>
      <ServerDataTable
        label="Rows"
        source={arraySource(rows)}
        columns={[{ id: "id", header: "Row", cell: (row) => row.id }]}
        pageSize={10}
        pageSizes={[10, 1000]}
        locale={locale}
        labels={{ errorTitle: "Error", retry: "Retry", emptyTitle: "Empty" }}
      />
    </DataProvider>,
  )
  return () => document.querySelector("[data-slot=server-data-table-footer] output")?.textContent
}

test("the table follows <html lang>, and an explicit locale wins", async () => {
  document.documentElement.lang = "de-DE"
  const status = renderTable()
  await waitFor(() => expect(status()).toBe("Showing 1–10 of 2.400"))
  expect(screen.getByRole("combobox", { name: "Rows per page" }).textContent).toContain("10")
})

test("an explicit locale wins over the page's", async () => {
  document.documentElement.lang = "de-DE"
  const status = renderTable("en-US")
  await waitFor(() => expect(status()).toBe("Showing 1–10 of 2,400"))
})
