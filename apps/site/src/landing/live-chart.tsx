import { Bar, CartesianGrid, Line, ComposedChart, XAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const weeks = [
  { week: "W1", done: 18, failed: 3, target: 20 },
  { week: "W2", done: 24, failed: 5, target: 22 },
  { week: "W3", done: 21, failed: 2, target: 24 },
  { week: "W4", done: 30, failed: 4, target: 26 },
  { week: "W5", done: 27, failed: 1, target: 28 },
  { week: "W6", done: 35, failed: 2, target: 30 },
]

const config = {
  week: { label: "Week" },
  done: { label: "Done", color: "var(--series-positive)" },
  failed: { label: "Failed", color: "var(--series-negative)" },
  target: { label: "Target", color: "var(--series-target)" },
} satisfies ChartConfig

export default function LiveChart() {
  return (
    <ChartContainer config={config} aria-label="Agent tasks per week against the target" className="aspect-auto h-56">
      <ComposedChart data={weeks} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent locale="en-US" />} />
        <Bar dataKey="done" stackId="tasks" fill="var(--color-done)" />
        <Bar dataKey="failed" stackId="tasks" fill="var(--color-failed)" radius={[4, 4, 0, 0]} />
        <Line
          dataKey="target"
          type="monotone"
          stroke="var(--color-target)"
          strokeDasharray="4 4"
          strokeWidth={2}
          dot={false}
        />
        <ChartLegend content={<ChartLegendContent />} />
      </ComposedChart>
    </ChartContainer>
  )
}
