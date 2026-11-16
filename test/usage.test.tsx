import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import type { UsageSummary } from "@/lib/agent-task-types"
import { UsageStat, UsageTable, usageLabelsEs } from "@/components/ui/usage"
import { UsageGrid } from "@/components/ui/usage-grid"

import { axeViolations } from "./axe"

const summary: UsageSummary = {
  inputTokens: { value: 18_240, quality: "measured" },
  outputTokens: { value: 2_500, quality: "measured" },
  cacheReadTokens: { value: 0, quality: "measured" },
  cacheWriteTokens: { value: null, quality: "unknown" },
  reasoningTokens: { value: 1_000, quality: "estimated", source: "tokenizer" },
  costUsd: { value: 0.12, quality: "estimated", source: "price table" },
  durationMs: { value: 400_000, quality: "measured" },
}

function cell(table: HTMLElement, metric: string, column = 0) {
  const row = table.querySelector(`[data-metric="${metric}"]`)
  const quantity = row?.querySelectorAll('[data-slot="quantity"]')[column] as HTMLElement | undefined
  if (!quantity) throw new Error(`No ${metric} cell`)
  return { quantity, text: quantity.querySelector('[aria-hidden="true"]')?.textContent }
}

test("unknown values show a dash, never zero, and a measured zero stays zero", () => {
  render(<UsageTable usage={summary} locale="en-US" />)
  const table = screen.getByRole("table", { name: "Usage" })
  expect(cell(table, "cacheWriteTokens").text).toBe("—")
  expect(cell(table, "cacheWriteTokens").quantity.dataset.quality).toBe("unknown")
  expect(cell(table, "activeMs").text).toBe("—")
  expect(cell(table, "cacheReadTokens").text).toBe("0")
})

test("estimated values get a tilde and a title with the source", () => {
  render(<UsageTable usage={summary} locale="en-US" />)
  const table = screen.getByRole("table")
  const cost = cell(table, "costUsd")
  expect(cost.text).toBe("~$0.12")
  expect(cost.quantity.title).toBe("estimated: price table")
  const reasoning = cell(table, "reasoningTokens")
  expect(reasoning.text).toBe("~1K")
  expect(reasoning.quantity.querySelector(".sr-only")?.textContent).toBe("1K (estimated)")
  expect(reasoning.quantity.title).toBe("1,000 · estimated: tokenizer")
})

test("token counts are compact with the exact count in the title, durations use units", () => {
  render(<UsageTable usage={summary} locale="en-US" />)
  const table = screen.getByRole("table")
  const input = cell(table, "inputTokens")
  expect(input.text).toBe("18.2K")
  expect(input.quantity.title).toBe("18,240")
  const duration = cell(table, "durationMs")
  expect(duration.text).toBe("6.7m")
  expect(duration.quantity.title).toBe("400,000 milliseconds")
  expect(within(table).getByRole("rowheader", { name: "Cache write" })).toBeTruthy()
})

test("cost uses a custom currency formatter", () => {
  render(<UsageTable usage={summary} formatCurrency={(usd) => `${(usd * 0.9).toFixed(2)} €`} />)
  expect(cell(screen.getByRole("table"), "costUsd").text).toBe("~0.11 €")
})

test("several summaries compare as columns, with translated labels", async () => {
  const { container } = render(
    <UsageTable
      labels={usageLabelsEs}
      locale="es-ES"
      columns={[
        { id: "a1", label: "A1", usage: summary },
        { id: "a2", label: "A2" },
      ]}
    />,
  )
  const table = screen.getByRole("table", { name: "Consumo" })
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent),
  ).toEqual(["Métrica", "A1", "A2"])
  expect(cell(table, "inputTokens", 1).text).toBe("—")
  expect(cell(table, "inputTokens", 1).quantity.querySelector(".sr-only")?.textContent).toBe("desconocido")
  expect(within(table).getByRole("rowheader", { name: "Tokens de entrada" })).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})

test("a usage stat is one labeled, honest quantity", () => {
  render(
    <>
      <UsageStat data-testid="tokens" label="Input" value={summary.inputTokens} locale="en-US" />
      <UsageStat data-testid="cost" label="Cost" kind="cost" value={summary.costUsd} locale="en-US" />
      <UsageStat data-testid="unknown" label="Active" kind="duration" />
    </>,
  )
  expect(screen.getByTestId("tokens").textContent).toBe("Input18.2K18.2K")
  expect(screen.getByTestId("cost").querySelector('[aria-hidden="true"]')?.textContent).toBe("~$0.12")
  expect(screen.getByTestId("unknown").querySelector('[aria-hidden="true"]')?.textContent).toBe("—")
})

function gridTile(metric: string) {
  const item = document.querySelector<HTMLElement>(`[data-slot="usage-grid-item"][data-metric="${metric}"]`)
  const quantity = item?.querySelector<HTMLElement>('[data-slot="quantity"]')
  if (!item || !quantity) throw new Error(`No ${metric} tile`)
  return { item, quantity, text: quantity.querySelector('[aria-hidden="true"]')?.textContent }
}

describe("UsageGrid", () => {
  test("shows every metric, key figures first, as one named group of terms", () => {
    render(<UsageGrid usage={summary} locale="en-US" aria-label="Usage of T-1" />)
    const group = screen.getByRole("group", { name: "Usage of T-1" })
    const terms = within(group)
      .getAllByRole("term")
      .map((term) => term.textContent)
    expect(terms).toEqual([
      "Input tokens",
      "Output tokens",
      "Cache read",
      "Reasoning tokens",
      "Cost",
      "Duration",
      "Cache write",
      "Active time",
    ])
  })

  test("keeps values honest: dash for unknown, tilde for estimated, exact count in the title", () => {
    render(<UsageGrid usage={summary} locale="en-US" />)
    expect(gridTile("cacheWriteTokens").text).toBe("—")
    expect(gridTile("activeMs").text).toBe("—")
    expect(gridTile("cacheReadTokens").text).toBe("0")
    expect(gridTile("costUsd").text).toBe("~$0.12")
    expect(gridTile("costUsd").quantity.title).toBe("estimated: price table")
    expect(gridTile("reasoningTokens").text).toBe("~1K")
    expect(gridTile("reasoningTokens").quantity.title).toBe("1,000 · estimated: tokenizer")
    expect(gridTile("inputTokens").quantity.title).toBe("18,240")
  })

  test("without usage every tile is unknown, and labels are overridable", async () => {
    const { container } = render(<UsageGrid labels={usageLabelsEs} />)
    expect(screen.getByRole("group", { name: "Consumo" })).toBeTruthy()
    for (const metric of ["inputTokens", "costUsd", "durationMs"]) expect(gridTile(metric).text).toBe("—")
    expect(screen.getByText("Tokens de entrada")).toBeTruthy()
    expect(await axeViolations(container)).toEqual([])
  })
})
