import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
  ChartContainer,
  ChartDataTable,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const weeks = [
  { week: "W1", done: 18, failed: 3 },
  { week: "W2", done: 24, failed: 5 },
  { week: "W3", done: 21, failed: 2 },
  { week: "W4", done: 30, failed: 4 },
  { week: "W5", done: 27, failed: 1 },
  { week: "W6", done: 35, failed: 2 },
]

const config = {
  week: { label: "Week" },
  done: { label: "Done", color: "var(--series-positive)" },
  failed: { label: "Failed", color: "var(--series-negative)" },
} satisfies ChartConfig

export default function ChartDemo() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-items">
      <p id="tasks-chart-title" className="text-title-sm">
        Agent tasks per week
      </p>
      <ChartContainer config={config} aria-labelledby="tasks-chart-title" className="aspect-auto h-64">
        <BarChart data={weeks} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent locale="en-US" />} />
          <Bar dataKey="done" stackId="tasks" fill="var(--color-done)" />
          <Bar dataKey="failed" stackId="tasks" fill="var(--color-failed)" radius={[4, 4, 0, 0]} />
          <ChartLegend content={<ChartLegendContent />} />
        </BarChart>
      </ChartContainer>
      <ChartDataTable aria-label="Agent tasks per week" data={weeks} labelKey="week" config={config} locale="en-US" />
    </div>
  )
}
