import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"

import type { UsageSummary } from "@/lib/agent-task-types"
import { UsageStat, UsageTable, usageLabelsEs } from "@/components/ui/usage"

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
