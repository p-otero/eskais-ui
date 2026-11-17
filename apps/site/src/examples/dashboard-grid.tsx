import { useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { Button } from "@/components/ui/button"
import {
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  DashboardCard,
  DashboardChart,
  DashboardGrid,
  DashboardMeter,
  DashboardStat,
  DashboardStats,
} from "@/components/ui/dashboard-grid"
import { Field, FieldLabel } from "@/components/ui/field"
import { List, ListItem } from "@/components/ui/list-item"
import { StatDelta } from "@/components/ui/stat"
import { StatusPill } from "@/components/ui/status-pill"
import { Switch } from "@/components/ui/switch"

const runs = [
  { day: "Mon", passed: 42, failed: 3 },
  { day: "Tue", passed: 51, failed: 6 },
  { day: "Wed", passed: 47, failed: 2 },
  { day: "Thu", passed: 58, failed: 4 },
  { day: "Fri", passed: 63, failed: 1 },
]
const runsConfig = {
  day: { label: "Day" },
  passed: { label: "Passed", color: "var(--series-positive)" },
  failed: { label: "Failed", color: "var(--series-negative)" },
} satisfies ChartConfig

const latency = [
  { hour: "09:00", p50: 120, p95: 310 },
  { hour: "10:00", p50: 132, p95: 344 },
  { hour: "11:00", p50: 118, p95: 290 },
  { hour: "12:00", p50: 141, p95: 388 },
  { hour: "13:00", p50: 126, p95: 301 },
  { hour: "14:00", p50: 115, p95: 276 },
]
const latencyConfig = {
  hour: { label: "Hour" },
  p50: { label: "Median", color: "var(--chart-1)" },
  p95: { label: "95th percentile", color: "var(--chart-2)" },
} satisfies ChartConfig

const experiments = [
  { id: "exp-14", title: "Shorter system prompt", status: "Running", tone: "info" },
  { id: "exp-13", title: "Retrieval with reranking", status: "Won", tone: "success" },
  { id: "exp-12", title: "Temperature 0.2", status: "Lost", tone: "destructive" },
  { id: "exp-11", title: "Tool descriptions in Spanish", status: "Inconclusive", tone: "neutral" },
] as const

export default function DashboardGridDemo() {
  const [loading, setLoading] = useState(false)
  const status = loading ? "pending" : "success"
  return (
    <div className="flex w-full flex-col gap-group">
      <Field>
        <Switch checked={loading} onCheckedChange={setLoading} />
        <FieldLabel>Show loading</FieldLabel>
      </Field>
      <DashboardGrid
        labels={{ errorTitle: "Couldn't load this card", emptyTitle: "Nothing yet" }}
        stats={
          <DashboardStats aria-label="This week" loading={loading}>
            <DashboardStat
              label="Runs"
              value={261}
              delta={<StatDelta value={0.12} comparison="vs. last week" />}
              loading={loading}
            />
            <DashboardStat label="Pass rate" value={94.2} format={(n) => `${n}%`} hint="Target 95%" loading={loading} />
            <DashboardStat
              label="Median latency"
              value={126}
              format={(n) => `${n} ms`}
              delta={<StatDelta value={-0.05} invert comparison="vs. last week" />}
              loading={loading}
            />
            <DashboardStat label="Spend" value={182.4} format={(n) => `$${n.toFixed(2)}`} loading={loading} />
          </DashboardStats>
        }
      >
        <DashboardCard
          title="Evaluation runs"
          description="Passed and failed, per day"
          span={2}
          status={status}
          keepPreviousData={false}
          data={runs}
          actions={
            <Button size="sm" variant="outline">
              Export
            </Button>
          }
        >
          {(data) => (
            <DashboardChart config={runsConfig}>
              <BarChart data={data} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent locale="en-US" />} />
                <Bar dataKey="passed" stackId="runs" fill="var(--color-passed)" />
                <Bar dataKey="failed" stackId="runs" fill="var(--color-failed)" radius={[4, 4, 0, 0]} />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            </DashboardChart>
          )}
        </DashboardCard>
        <DashboardCard
          title="GPU quota"
          description="This month"
          status={status}
          keepPreviousData={false}
          data={{ used: 72 }}
        >
          {(data) => (
            <DashboardMeter
              label="Hours used"
              value={data.used}
              hint="72 of 100 GPU hours"
              tone={data.used > 90 ? "warning" : undefined}
            />
          )}
        </DashboardCard>
        <DashboardCard
          title="Storage"
          description="Datasets and checkpoints"
          status={status}
          keepPreviousData={false}
          data={{ used: 93 }}
        >
          {(data) => (
            <DashboardMeter
              label="Space used"
              value={data.used}
              hint="1.86 of 2 TB"
              tone={data.used > 90 ? "warning" : undefined}
            />
          )}
        </DashboardCard>
        <DashboardCard
          title="Experiments"
          description="Most recent first"
          span={2}
          status={status}
          keepPreviousData={false}
          data={experiments}
        >
          {(data) => (
            <List aria-label="Recent experiments">
              {data.map((experiment) => (
                <ListItem
                  key={experiment.id}
                  id={experiment.id}
                  title={experiment.title}
                  subtitle={<span className="font-mono">{experiment.id}</span>}
                  status={<StatusPill tone={experiment.tone}>{experiment.status}</StatusPill>}
                />
              ))}
            </List>
          )}
        </DashboardCard>
        <DashboardCard
          title="Latency"
          description="Milliseconds, by hour"
          span={3}
          status={status}
          keepPreviousData={false}
          data={latency}
        >
          {(data) => (
            <DashboardChart config={latencyConfig}>
              <AreaChart data={data} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="hour"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  padding={{ left: 16, right: 16 }}
                />
                <ChartTooltip content={<ChartTooltipContent locale="en-US" />} />
                <Area
                  dataKey="p95"
                  type="monotone"
                  fill="var(--color-p95)"
                  fillOpacity={0.2}
                  stroke="var(--color-p95)"
                />
                <Area
                  dataKey="p50"
                  type="monotone"
                  fill="var(--color-p50)"
                  fillOpacity={0.3}
                  stroke="var(--color-p50)"
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </DashboardChart>
          )}
        </DashboardCard>
      </DashboardGrid>
    </div>
  )
}
