import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import {
  DashboardCard,
  DashboardChart,
  DashboardGrid,
  DashboardMeter,
  DashboardStat,
  DashboardStats,
} from "@/components/ui/dashboard-grid"
import type { DataStatus } from "@/components/ui/data-state"
import { cssVars } from "@/lib/utils"

import { axeViolations } from "./axe"
import { settle } from "./overlay-helpers"

const noRetry = () => {}

function Dashboard({ status, onRetry = noRetry }: { status: DataStatus; onRetry?: () => unknown }) {
  return (
    <DashboardGrid
      columns={3}
      labels={{ errorTitle: "Couldn't load", emptyTitle: "Nothing yet" }}
      stats={
        <DashboardStats aria-label="This week" loading={status === "pending"}>
          <DashboardStat label="Runs" value={12} hint="of 20" loading={status === "pending"} />
        </DashboardStats>
      }
    >
      <DashboardCard
        title="Runs"
        span={2}
        rowSpan={2}
        status={status}
        data={status === "success" ? [1, 2] : undefined}
        error={new Error("Timed out")}
        onRetry={onRetry}
        actions={<Button size="sm">Export</Button>}
      >
        {(data) => <p>{data.length} runs</p>}
      </DashboardCard>
      <DashboardCard title="Queue" status="success" data={[]}>
        {() => <p>never</p>}
      </DashboardCard>
      <DashboardCard title="Notes" span={4}>
        <p>Static content</p>
      </DashboardCard>
    </DashboardGrid>
  )
}

test("DashboardGrid: cards are named regions that span columns and rows, capped at the grid's columns", async () => {
  const { container } = render(<Dashboard status="success" />)
  const runs = screen.getByRole("region", { name: "Runs" })
  expect(runs.style.getPropertyValue("--dashboard-span")).toBe("2")
  expect(runs.style.getPropertyValue("--dashboard-span-md")).toBe("2")
  expect(runs.style.getPropertyValue("--dashboard-row-span")).toBe("2")
  expect(screen.getByRole("region", { name: "Notes" }).style.getPropertyValue("--dashboard-span")).toBe("3")
  expect(screen.getByRole("list", { name: "This week" })).toBeTruthy()
  expect(within(runs).getByText("2 runs")).toBeTruthy()
  expect(within(screen.getByRole("region", { name: "Queue" })).getByText("Nothing yet")).toBeTruthy()
  expect(await axeViolations(container)).toEqual([])
})

test("DashboardCard: an object style and a function style both apply beside the span variables", () => {
  render(
    <DashboardGrid columns={3}>
      <DashboardCard title="Object" span={2} style={{ color: "red", ...cssVars({ "--dashboard-span": 9 }) }}>
        <p>Object</p>
      </DashboardCard>
      <DashboardCard title="Function" rowSpan={2} style={() => ({ color: "blue" })}>
        <p>Function</p>
      </DashboardCard>
    </DashboardGrid>,
  )
  const object = screen.getByRole("region", { name: "Object" })
  expect(object.style.color).toBe("red")
  expect(object.style.getPropertyValue("--dashboard-span")).toBe("2")
  const fromFunction = screen.getByRole("region", { name: "Function" })
  expect(fromFunction.style.color).toBe("blue")
  expect(fromFunction.style.getPropertyValue("--dashboard-span")).toBe("1")
  expect(fromFunction.style.getPropertyValue("--dashboard-row-span")).toBe("2")
})

test("DashboardGrid: loading draws placeholders, an error offers Retry", async () => {
  const user = userEvent.setup()
  const onRetry = vi.fn()
  const { rerender, container } = render(<Dashboard status="pending" onRetry={onRetry} />)
  const runs = screen.getByRole("region", { name: "Runs" })
  expect(runs.querySelector('[data-slot="loading-state"]')).toBeTruthy()
  expect(screen.getByRole("list", { name: "This week" }).getAttribute("aria-busy")).toBe("true")
  expect(container.querySelector('[data-slot="dashboard-stat"] [data-slot="skeleton"]')).toBeTruthy()

  rerender(<Dashboard status="error" onRetry={onRetry} />)
  expect(within(runs).getByRole("alert").textContent).toContain("Couldn't load")
  expect(within(runs).getByRole("alert").textContent).toContain("Timed out")
  await user.click(within(runs).getByRole("button", { name: "Retry" }))
  expect(onRetry).toHaveBeenCalledOnce()
})

test("DashboardChart: named by its card's title", () => {
  render(
    <DashboardGrid>
      <DashboardCard title="Latency">
        <DashboardChart config={{ p50: { label: "Median" } }}>
          <svg />
        </DashboardChart>
      </DashboardCard>
    </DashboardGrid>,
  )
  const title = screen.getByText("Latency")
  expect(screen.getByRole("figure").getAttribute("aria-labelledby")).toBe(title.id)
})

test("DashboardMeter: a ring meter named by its label, and DashboardStat shows its delta once loaded", () => {
  const { rerender } = render(
    <DashboardGrid
      stats={
        <DashboardStats aria-label="Week">
          <DashboardStat label="Runs" value={9} delta={<span data-testid="delta">+12%</span>} />
        </DashboardStats>
      }
    >
      <DashboardCard title="Storage">
        <DashboardMeter label="Space used" value={93} tone="warning" hint="1.86 of 2 TB" />
      </DashboardCard>
    </DashboardGrid>,
  )
  const meter = screen.getByRole("meter", { name: "Space used" })
  expect(meter.getAttribute("aria-valuenow")).toBe("93")
  expect(screen.getByText("1.86 of 2 TB")).toBeTruthy()
  expect(screen.getByTestId("delta")).toBeTruthy()
  rerender(
    <DashboardGrid
      stats={
        <DashboardStats aria-label="Week" loading>
          <DashboardStat label="Runs" value={9} delta={<span data-testid="delta">+12%</span>} loading />
        </DashboardStats>
      }
    />,
  )
  expect(screen.getByTestId("delta").closest('[aria-hidden="true"]')).toBeTruthy()
})

test("DashboardGrid: agents find every control by name and press Retry", async () => {
  const onRetry = vi.fn()
  render(<Dashboard status="error" onRetry={onRetry} />)
  await settle()
  const agent = createAgent()
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  expect(components.map((entry) => entry.label)).toEqual(expect.arrayContaining(["Export", "Retry"]))
  const result = await act(() => agent.act({ steps: [{ ref: "Retry", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  expect(onRetry).toHaveBeenCalledOnce()
})
