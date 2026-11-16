import { useId, useState, type ReactNode } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Label as PieLabel,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartDataTable,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Toggle } from "@/components/ui/toggle"

import { Section } from "../section"

const locale = "en-US"

const months = [
  { month: "January", desktop: 186, mobile: 80, tablet: 42 },
  { month: "February", desktop: 305, mobile: 200, tablet: 61 },
  { month: "March", desktop: 237, mobile: 120, tablet: 88 },
  { month: "April", desktop: 173, mobile: 190, tablet: 74 },
  { month: "May", desktop: 209, mobile: 130, tablet: 95 },
  { month: "June", desktop: 264, mobile: 140, tablet: 102 },
]

const deviceConfig = {
  month: { label: "Month" },
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
  tablet: { label: "Tablet", color: "var(--chart-3)" },
} satisfies ChartConfig

const days = Array.from({ length: 30 }, (_, index) => ({
  date: `2026-06-${String(index + 1).padStart(2, "0")}`,
  desktop: 180 + ((index * 73) % 220),
  mobile: 140 + ((index * 41) % 260),
}))

const dayConfig = {
  date: { label: "Date" },
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig

const browsers = [
  { browser: "chrome", visitors: 275, fill: "var(--color-chrome)" },
  { browser: "safari", visitors: 200, fill: "var(--color-safari)" },
  { browser: "firefox", visitors: 187, fill: "var(--color-firefox)" },
  { browser: "edge", visitors: 173, fill: "var(--color-edge)" },
  { browser: "other", visitors: 90, fill: "var(--color-other)" },
]

const browserConfig = {
  browser: { label: "Browser" },
  visitors: { label: "Visitors" },
  chrome: { label: "Chrome", color: "var(--chart-1)" },
  safari: { label: "Safari", color: "var(--chart-2)" },
  firefox: { label: "Firefox", color: "var(--chart-3)" },
  edge: { label: "Edge", color: "var(--chart-4)" },
  other: { label: "Other", color: "var(--chart-5)" },
} satisfies ChartConfig

const shortDate = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" })

function ChartCard({
  title,
  description,
  action,
  footer,
  children,
}: {
  title: string
  description: string
  action?: ReactNode
  footer: ReactNode
  children: (titleId: string) => ReactNode
}) {
  const titleId = useId()
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle headingLevel={3} id={titleId}>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {action === undefined ? null : <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">{children(titleId)}</div>
      </CardContent>
      <CardFooter>
        <div className="flex flex-col gap-1 text-sm">{footer}</div>
      </CardFooter>
    </Card>
  )
}

function StackedAreaChart() {
  const gradient = useId().replaceAll(":", "")
  return (
    <ChartCard
      title="Visitors by device"
      description="January to June 2026, stacked"
      footer={
        <>
          <p className="font-medium">Up 5.2% on the previous half</p>
          <p className="text-muted-foreground">Desktop leads every month but April.</p>
        </>
      }
    >
      {(titleId) => (
        <>
          <ChartContainer config={deviceConfig} aria-labelledby={titleId} className="aspect-auto h-64">
            <AreaChart data={months} accessibilityLayer margin={{ left: 12, right: 12 }}>
              <defs>
                {(["desktop", "mobile", "tablet"] as const).map((key) => (
                  <linearGradient key={key} id={`${gradient}-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.1} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value: string) => value.slice(0, 3)}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" locale={locale} />} />
              {(["tablet", "mobile", "desktop"] as const).map((key) => (
                <Area
                  key={key}
                  dataKey={key}
                  type="natural"
                  stackId="devices"
                  fill={`url(#${gradient}-${key})`}
                  stroke={`var(--color-${key})`}
                />
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
          <ChartDataTable
            aria-label="Visitors by device and month"
            data={months}
            labelKey="month"
            config={deviceConfig}
            locale={locale}
          />
        </>
      )}
    </ChartCard>
  )
}

function InteractiveBarChart() {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const total = days.reduce((sum, day) => sum + day[device], 0)
  return (
    <ChartCard
      title="Daily visitors"
      description="June 2026, one device at a time"
      action={
        <SegmentedControl aria-label="Device" value={device} onValueChange={(next) => next && setDevice(next)}>
          <SegmentedControlIndicator />
          <SegmentedControlItem value="desktop">Desktop</SegmentedControlItem>
          <SegmentedControlItem value="mobile">Mobile</SegmentedControlItem>
        </SegmentedControl>
      }
      footer={
        <p className="text-muted-foreground">
          {new Intl.NumberFormat(locale).format(total)} {dayConfig[device].label.toLowerCase()} visitors in June
        </p>
      }
    >
      {(titleId) => (
        <>
          <ChartContainer config={dayConfig} aria-labelledby={titleId} className="aspect-auto h-64">
            <BarChart data={days} accessibilityLayer margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={shortDate}
              />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(label) => shortDate(String(label))} locale={locale} />}
              />
              <Bar dataKey={device} fill={`var(--color-${device})`} radius={4} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
          <ChartDataTable
            aria-label={`Daily ${dayConfig[device].label.toLowerCase()} visitors`}
            data={days}
            labelKey="date"
            keys={[device]}
            config={dayConfig}
            locale={locale}
          />
        </>
      )}
    </ChartCard>
  )
}

function MultiLineChart() {
  const [showData, setShowData] = useState(false)
  return (
    <ChartCard
      title="Desktop and mobile"
      description="January to June 2026"
      action={
        <Toggle variant="outline" size="sm" pressed={showData} onPressedChange={setShowData}>
          Show data
        </Toggle>
      }
      footer={<p className="text-muted-foreground">Mobile overtook desktop in April only.</p>}
    >
      {(titleId) => (
        <>
          <ChartContainer config={deviceConfig} aria-labelledby={titleId} className="aspect-auto h-64">
            <LineChart data={months} accessibilityLayer margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value: string) => value.slice(0, 3)}
              />
              <YAxis tickLine={false} axisLine={false} width={32} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" locale={locale} />} />
              <Line dataKey="desktop" type="monotone" stroke="var(--color-desktop)" strokeWidth={2} dot={false} />
              <Line
                dataKey="mobile"
                type="monotone"
                stroke="var(--color-mobile)"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
          <ChartDataTable
            aria-label="Desktop and mobile visitors by month"
            data={months}
            labelKey="month"
            keys={["desktop", "mobile"]}
            config={deviceConfig}
            locale={locale}
            visuallyHidden={!showData}
          />
        </>
      )}
    </ChartCard>
  )
}

// Recharts clones the label content with the pie's polar viewBox.
function DonutCenter({ viewBox, total }: { viewBox?: { cx?: number; cy?: number }; total: number }) {
  if (viewBox?.cx === undefined || viewBox.cy === undefined) return null
  return (
    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
        {new Intl.NumberFormat(locale).format(total)}
      </tspan>
      <tspan x={viewBox.cx} y={viewBox.cy + 24} className="fill-muted-foreground">
        {browserConfig.visitors.label}
      </tspan>
    </text>
  )
}

function DonutChart() {
  const total = browsers.reduce((sum, row) => sum + row.visitors, 0)
  return (
    <ChartCard
      title="Visitors by browser"
      description="June 2026"
      footer={<p className="text-muted-foreground">Chrome brings a third of all visitors.</p>}
    >
      {(titleId) => (
        <>
          <ChartContainer config={browserConfig} aria-labelledby={titleId} className="mx-auto aspect-square h-64">
            <PieChart accessibilityLayer>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent nameKey="browser" hideLabel locale={locale} />}
              />
              <Pie
                data={browsers}
                dataKey="visitors"
                nameKey="browser"
                innerRadius="55%"
                strokeWidth={4}
                stroke="var(--card)"
              >
                <PieLabel position="center" content={<DonutCenter total={total} />} />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="browser" />} />
            </PieChart>
          </ChartContainer>
          <ChartDataTable
            aria-label="Visitors by browser in June"
            data={browsers}
            labelKey="browser"
            keys={["visitors"]}
            config={browserConfig}
            locale={locale}
          />
        </>
      )}
    </ChartCard>
  )
}

function ChartsSection() {
  return (
    <Section
      title="Charts"
      description="Recharts v3 composed with theme colors, popover tooltips and legends. Each chart is a named figure with its data in a table for screen readers and agents."
    >
      <div className="grid w-full gap-surface md:grid-cols-2">
        <StackedAreaChart />
        <InteractiveBarChart />
        <MultiLineChart />
        <DonutChart />
      </div>
    </Section>
  )
}

export { ChartsSection }
