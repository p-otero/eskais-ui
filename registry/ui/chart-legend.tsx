"use client"

import type { CSSProperties } from "react"
import type { LegendPayload } from "recharts"

import { chartSwatchColor, resolveChartSeries } from "@/lib/chart-config"
import { cn } from "@/lib/utils"
import { useChart } from "@/components/ui/chart-context"

// Recharts clones the content with every Legend prop, so only these are read and nothing is spread onto the DOM.
type ChartLegendContentProps = {
  className?: string
  payload?: readonly LegendPayload[]
  verticalAlign?: "top" | "middle" | "bottom"
  nameKey?: string
  hideIcon?: boolean
}

function ChartLegendContent({
  payload,
  verticalAlign = "bottom",
  nameKey,
  hideIcon = false,
  className,
}: ChartLegendContentProps) {
  const { config } = useChart()
  const items = (payload ?? []).filter((item) => item.type !== "none")
  if (items.length === 0) return null
  return (
    <ul
      data-slot="chart-legend"
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className,
      )}
    >
      {items.map((item) => {
        const key = nameKey ?? String(item.dataKey ?? item.value ?? "value")
        const { key: seriesKey, series } = resolveChartSeries(config, item, key)
        const Icon = series?.icon
        return (
          <li key={seriesKey} data-slot="chart-legend-item" className="flex items-center gap-1.5">
            {Icon && !hideIcon ? <Icon className="size-3 text-muted-foreground" /> : null}
            {!Icon && !hideIcon ? (
              <span
                aria-hidden="true"
                data-slot="chart-legend-swatch"
                style={{ "--indicator-color": chartSwatchColor(config, seriesKey, item.color) } as CSSProperties}
                className="size-2.5 shrink-0 rounded-xs bg-(--indicator-color)"
              />
            ) : null}
            <span>{series?.label ?? item.value}</span>
          </li>
        )
      })}
    </ul>
  )
}

export { ChartLegendContent }
export type { ChartLegendContentProps }
