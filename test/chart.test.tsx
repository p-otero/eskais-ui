import { act, render, screen, within } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import type { ReactNode } from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import type { LegendPayload, TooltipPayloadEntry } from "recharts"
import { afterAll, beforeAll, describe, expect, test } from "vitest"

import { chartStyleSheet, chartSwatchColor, formatChartValue, type ChartConfig } from "@/lib/chart-config"
import {
  ChartContainer,
  ChartDataTable,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { ChartContext } from "@/components/ui/chart-context"

import { ChartsSection } from "../apps/showcase/src/sections/charts"
import { axeViolations } from "./axe"

const agent = createAgent()

const config = {
  month: { label: "Month" },
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", theme: { light: "oklch(0.5 0.1 200)", dark: "oklch(0.8 0.1 200)" } },
} satisfies ChartConfig

const data = [
  { month: "January", desktop: 1860, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
]

function entry(overrides: Partial<TooltipPayloadEntry>): TooltipPayloadEntry {
  return { graphicalItemId: "bar", ...overrides }
}

function withConfig(children: ReactNode, value: ChartConfig = config) {
  return render(<ChartContext value={{ config: value }}>{children}</ChartContext>)
}

describe("chartStyleSheet", () => {
  test("writes a color variable per series, with a dark rule only for themed series", () => {
    const css = chartStyleSheet(config, "chart-a")
    expect(css).toBe(
      [
        '[data-chart="chart-a"] { --color-desktop: var(--chart-1); --color-mobile: oklch(0.5 0.1 200); }',
        '.dark [data-chart="chart-a"], [data-chart="chart-a"].dark { --color-desktop: var(--chart-1); --color-mobile: oklch(0.8 0.1 200); }',
      ].join("\n"),
    )
  })

  test("leaves the dark rule out when no series is themed", () => {
    expect(chartStyleSheet({ a: { color: "red" } }, "x")).toBe('[data-chart="x"] { --color-a: red; }')
  })

  test("drops keys and colors that could escape the style element", () => {
    const css = chartStyleSheet(
      {
        "bad key": { color: "red" },
        injected: { color: "red; } body { display: none" },
        closing: { color: "</style>" },
        ok: { color: "blue" },
      },
      'x"]{',
    )
    expect(css).toBe('[data-chart="x"] { --color-ok: blue; }')
  })
})

test("a patterned series' swatch falls back to its color variable", () => {
  const patterned = { repair: { label: "Repair", color: "var(--chart-3)" } } satisfies ChartConfig
  expect(chartSwatchColor(patterned, "repair", "url(#repair-hatch)")).toBe("var(--color-repair)")
  expect(chartSwatchColor(patterned, "repair", "var(--chart-1)")).toBe("var(--chart-1)")
  expect(chartSwatchColor({}, "other", "url(#x)")).toBe("url(#x)")
})

test("formatChartValue formats numbers through Intl and passes text through", () => {
  expect(formatChartValue(1234.5, { locale: "en-US" })).toBe("1,234.5")
  expect(formatChartValue(1234.5, { locale: "de-DE" })).toBe("1.234,5")
  expect(formatChartValue(0.25, { locale: "en-US", format: { style: "percent" } })).toBe("25%")
  expect(formatChartValue(3, { format: (value) => `${value} visits` })).toBe("3 visits")
  expect(formatChartValue("n/a")).toBe("n/a")
  expect(formatChartValue(undefined)).toBe("")
})

describe("ChartTooltipContent", () => {
  const payload = [
    entry({ dataKey: "desktop", name: "desktop", value: 1860, color: "var(--color-desktop)", payload: data[0] }),
    entry({ dataKey: "mobile", name: "mobile", value: 80, color: "var(--color-mobile)", payload: data[0] }),
  ]

  test("renders nothing while inactive", () => {
    const { container } = withConfig(<ChartTooltipContent active={false} payload={payload} label="January" />)
    expect(container.innerHTML).toBe("")
  })

  test("shows the label, each series by its config label and formatted values", () => {
    withConfig(<ChartTooltipContent active payload={payload} label="January" locale="en-US" />)
    const tooltip = document.querySelector('[data-slot="chart-tooltip"]')!
    expect(within(tooltip as HTMLElement).getByText("January")).toBeTruthy()
    expect(screen.getByText("Desktop")).toBeTruthy()
    expect(screen.getByText("1,860")).toBeTruthy()
    expect(screen.getByText("Mobile")).toBeTruthy()
    const indicators = document.querySelectorAll('[data-slot="chart-indicator"]')
    expect([...indicators].map((node) => node.getAttribute("data-indicator"))).toEqual(["dot", "dot"])
    expect((indicators[0] as HTMLElement).style.getPropertyValue("--indicator-color")).toBe("var(--color-desktop)")
  })

  test("labelKey takes the label from the config, nameKey names each item from the row", () => {
    const pie = { chrome: { label: "Chrome" }, visitors: { label: "Visitors" } } satisfies ChartConfig
    const row = { browser: "chrome", visitors: 275, fill: "var(--color-chrome)" }
    withConfig(
      <ChartTooltipContent
        active
        payload={[entry({ dataKey: "visitors", name: "chrome", value: 275, payload: row })]}
        labelKey="visitors"
        nameKey="browser"
      />,
      pie,
    )
    expect(screen.getByText("Visitors")).toBeTruthy()
    expect(screen.getByText("Chrome")).toBeTruthy()
    const indicator = document.querySelector<HTMLElement>('[data-slot="chart-indicator"]')!
    expect(indicator.style.getPropertyValue("--indicator-color")).toBe("var(--color-chrome)")
  })

  test("line and dashed indicators, hideLabel and hideIndicator", () => {
    const { rerender } = withConfig(<ChartTooltipContent active payload={payload} label="January" indicator="line" />)
    expect(document.querySelector('[data-slot="chart-indicator"]')?.getAttribute("data-indicator")).toBe("line")

    rerender(
      <ChartContext value={{ config }}>
        <ChartTooltipContent active payload={[payload[0]!]} label="January" indicator="dashed" />
      </ChartContext>,
    )
    const item = document.querySelector('[data-slot="chart-tooltip-item"]')!
    expect(item.querySelector('[data-indicator="dashed"]')).not.toBeNull()
    expect(within(item as HTMLElement).getByText("January")).toBeTruthy()

    rerender(
      <ChartContext value={{ config }}>
        <ChartTooltipContent active payload={payload} label="January" hideLabel hideIndicator />
      </ChartContext>,
    )
    expect(screen.queryByText("January")).toBeNull()
    expect(document.querySelector('[data-slot="chart-indicator"]')).toBeNull()
  })

  test("custom format and labelFormatter", () => {
    withConfig(
      <ChartTooltipContent
        active
        payload={[payload[0]!]}
        label="January"
        format={(value) => `${value} visits`}
        labelFormatter={(label) => `Month of ${String(label)}`}
      />,
    )
    expect(screen.getByText("1860 visits")).toBeTruthy()
    expect(screen.getByText("Month of January")).toBeTruthy()
  })
})

describe("ChartLegendContent", () => {
  test("lists each series by its config label with a swatch", () => {
    const payload: LegendPayload[] = [
      { value: "desktop", dataKey: "desktop", color: "var(--color-desktop)", type: "rect" },
      { value: "mobile", dataKey: "mobile", color: "var(--color-mobile)", type: "rect" },
    ]
    withConfig(<ChartLegendContent payload={payload} />)
    const items = screen.getAllByRole("listitem")
    expect(items.map((item) => item.textContent)).toEqual(["Desktop", "Mobile"])
    const swatch = items[0]!.querySelector<HTMLElement>('[data-slot="chart-legend-swatch"]')!
    expect(swatch.style.getPropertyValue("--indicator-color")).toBe("var(--color-desktop)")
  })

  test("nameKey reads the series from each row", () => {
    const pie = { chrome: { label: "Chrome" }, safari: { label: "Safari" } } satisfies ChartConfig
    const payload: LegendPayload[] = [
      { value: "chrome", color: "red", payload: { browser: "chrome" } },
      { value: "safari", color: "blue", payload: { browser: "safari" } },
    ]
    withConfig(<ChartLegendContent payload={payload} nameKey="browser" hideIcon />, pie)
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Chrome", "Safari"])
    expect(document.querySelector('[data-slot="chart-legend-swatch"]')).toBeNull()
  })
})

describe("ChartDataTable", () => {
  test("renders the series as columns and the categories as row headers", () => {
    render(
      <ChartDataTable aria-label="Visitors by month" data={data} labelKey="month" config={config} locale="en-US" />,
    )
    const table = screen.getByRole("table", { name: "Visitors by month" })
    const headers = within(table).getAllByRole("columnheader")
    expect(headers.map((cell) => cell.textContent)).toEqual(["Month", "Desktop", "Mobile"])
    const rows = within(table).getAllByRole("row").slice(1)
    expect(rows.map((row) => [...row.children].map((cell) => cell.textContent))).toEqual([
      ["January", "1,860", "80"],
      ["February", "305", "200"],
    ])
    expect(within(table).getByRole("rowheader", { name: "January" })).toBeTruthy()
    expect(table.closest('[data-slot="chart-data-table"]')?.hasAttribute("data-visually-hidden")).toBe(true)
  })

  test("keys picks columns, category labels come from the config, and it can be shown", () => {
    const pie = { browser: { label: "Browser" }, chrome: { label: "Chrome" } } satisfies ChartConfig
    render(
      <ChartDataTable
        aria-label="Visitors by browser"
        data={[{ browser: "chrome", visitors: 0.5, fill: "red" }]}
        labelKey="browser"
        keys={["visitors"]}
        config={pie}
        format={{ style: "percent" }}
        locale="en-US"
        visuallyHidden={false}
      />,
    )
    const table = screen.getByRole("table", { name: "Visitors by browser" })
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Browser", "visitors"])
    expect(within(table).getByRole("rowheader").textContent).toBe("Chrome")
    expect(within(table).getByText("50%")).toBeTruthy()
    expect(table.closest('[data-slot="chart-data-table"]')?.hasAttribute("data-visually-hidden")).toBe(false)
  })
})

const realBoundingRect = HTMLElement.prototype.getBoundingClientRect

// Only the responsive container gets a size: a sized legend would take the whole plot height.
function sizedRect(this: HTMLElement) {
  return this.classList.contains("recharts-responsive-container") ? new DOMRect(0, 0, 480, 270) : new DOMRect()
}

// Recharts measures, then lays out over a few ticks of its store.
async function settle() {
  for (let tick = 0; tick < 5; tick++) await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
}

beforeAll(() => {
  HTMLElement.prototype.getBoundingClientRect = sizedRect
})
afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = realBoundingRect
})

function VisitorsChart() {
  return (
    <div>
      <h3 id="visitors-title">Visitors</h3>
      <ChartContainer config={config} aria-labelledby="visitors-title" className="h-64">
        <BarChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="desktop" fill="var(--color-desktop)" isAnimationActive={false} />
          <Bar dataKey="mobile" fill="var(--color-mobile)" isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
      <ChartDataTable aria-label="Visitors by month" data={data} labelKey="month" config={config} />
    </div>
  )
}

async function renderChart() {
  const view = render(<VisitorsChart />)
  await settle()
  return view
}

describe("a full chart", () => {
  test("is a named figure with the series colors, a keyboard surface and a legend", async () => {
    await renderChart()
    const figure = screen.getByRole("figure", { name: "Visitors" })
    const chartId = figure.getAttribute("data-chart")!
    expect(figure.querySelector("style")?.textContent).toContain(`[data-chart="${chartId}"]`)
    const surface = figure.querySelector("svg.recharts-surface")
    expect(surface).not.toBeNull()
    expect(figure.querySelectorAll(".recharts-rectangle")).toHaveLength(4)
    expect(figure.querySelector('[tabindex="0"]')).not.toBeNull()
    expect(
      within(figure)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Desktop", "Mobile"])
  })

  test("has no axe violations", async () => {
    const { container } = await renderChart()
    expect(await axeViolations(container)).toEqual([])
  })

  test("agents see the data table by name and no unnamed entries", async () => {
    await renderChart()
    const entries = agent.snapshot().filter((item) => !item.offPage && item.component !== "more")
    for (const item of entries) expect(item.label, `${item.component} ${item.ref} has no name`).toBeTruthy()
    expect(entries.map((item) => item.label)).toContain("Visitors by month")
  })
})

describe("the showcase charts", () => {
  test("every chart is a named figure, agents see only named entries and can change what is shown", async () => {
    const { container } = render(<ChartsSection />)
    await settle()
    for (const name of ["Visitors by device", "Daily visitors", "Desktop and mobile", "Visitors by browser"]) {
      expect(screen.getByRole("figure", { name })).toBeTruthy()
    }
    expect(await axeViolations(container)).toEqual([])

    const entries = agent.snapshot().filter((item) => !item.offPage && item.component !== "more")
    for (const item of entries) expect(item.label, `${item.component} ${item.ref} has no name`).toBeTruthy()
    const labels = entries.map((item) => item.label)
    for (const label of ["Device", "Show data", "Visitors by device and month", "Visitors by browser in June"]) {
      expect(labels, `${label} is missing from the snapshot`).toContain(label)
    }

    const result = await agent.act({
      steps: [
        { ref: "Device", action: "setValue", args: ["mobile"] },
        { ref: "Show data", action: "setPressed", args: [true] },
      ],
    })
    expect(result.ok, result.error?.message).toBe(true)
    expect(screen.getByRole("table", { name: "Daily mobile visitors" })).toBeTruthy()
    const lines = screen.getByRole("table", { name: "Desktop and mobile visitors by month" })
    expect(lines.closest('[data-slot="chart-data-table"]')?.hasAttribute("data-visually-hidden")).toBe(false)
  })
})
