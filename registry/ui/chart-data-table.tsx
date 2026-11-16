"use client"

import { use, type ReactNode } from "react"

import { formatChartValue, type ChartConfig, type ChartFormatOptions, type ChartName } from "@/lib/chart-config"
import { ChartContext } from "@/components/ui/chart-context"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ChartRow = Record<string, unknown>

type ChartDataTableProps<Row extends ChartRow> = ChartName &
  ChartFormatOptions & {
    data: readonly Row[]
    labelKey: keyof Row & string
    keys?: readonly (keyof Row & string)[]
    config?: ChartConfig
    caption?: ReactNode
    visuallyHidden?: boolean
    className?: string
  }

function ChartDataTable<Row extends ChartRow>({
  data,
  labelKey,
  keys,
  config: configProp,
  caption,
  visuallyHidden = true,
  locale,
  format,
  className,
  ...name
}: ChartDataTableProps<Row>) {
  const config = configProp ?? use(ChartContext)?.config ?? {}
  const columns =
    keys ?? Object.keys(config).filter((key) => key !== labelKey && data.some((row) => typeof row[key] === "number"))
  const headerFor = (key: string) => config[key]?.label ?? key

  const table = (
    <Table {...name} className={className}>
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{headerFor(labelKey)}</TableHead>
          {columns.map((key) => (
            <TableHead key={key} scope="col" className="text-end">
              {headerFor(key)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const category = String(row[labelKey] ?? "")
          return (
            <TableRow key={category}>
              <TableHead scope="row">{config[category]?.label ?? category}</TableHead>
              {columns.map((key) => (
                <TableCell key={key} className="text-end tabular-nums">
                  {formatChartValue(row[key], { locale, format })}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )

  if (!visuallyHidden) return <div data-slot="chart-data-table">{table}</div>
  // The inner box sizes to the table, so the scroll area never overflows and never adds a tab stop nobody can see.
  return (
    <div data-slot="chart-data-table" data-visually-hidden="" className="sr-only">
      <div className="w-max">{table}</div>
    </div>
  )
}

export { ChartDataTable }
export type { ChartDataTableProps, ChartRow }
