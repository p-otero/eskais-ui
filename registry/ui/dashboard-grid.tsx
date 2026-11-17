"use client"

import {
  createContext,
  use,
  useId,
  useMemo,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react"

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { DataState, type DataStatus } from "@/components/ui/data-state"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useOverflowing } from "@/components/ui/use-dashboard-grid"
import { Stat, StatGroup, StatHint, StatLabel, StatValue, type StatValueProps } from "@/components/ui/stat"
import { cn } from "@/lib/utils"

type DashboardLabels = {
  /** Screen-reader text while a card loads. */
  loading: string
  /** Screen-reader text while a card refreshes data it still shows. */
  refreshing: string
  /** The retry button of a card that failed. */
  retry: string
  /** A failed card's title; without it the error's own message is the title. */
  errorTitle?: ReactNode
  /** An empty card's title; without it (and without the card's `empty`) an empty result renders as data. */
  emptyTitle?: ReactNode
}

const dashboardLabels: DashboardLabels = { loading: "Loading", refreshing: "Refreshing", retry: "Retry" }

type DashboardContextValue = { columns: number; labels: DashboardLabels; headingLevel: 2 | 3 | 4 }

const DashboardContext = createContext<DashboardContextValue>({
  columns: 3,
  labels: dashboardLabels,
  headingLevel: 2,
})

type DashboardGridProps = ComponentProps<"div"> & {
  /** A `DashboardStats` row above the cards. */
  stats?: ReactNode
  /** Columns on a wide container (64rem and up). From 42rem the grid has two; below, one. */
  columns?: 2 | 3 | 4
  /** Labels every card shares; a card's own `labels` win. */
  labels?: Partial<DashboardLabels>
  /** The level of the cards' titles. Default 2. */
  headingLevel?: 2 | 3 | 4
}

/**
 * A dashboard: a row of stats, then cards on a grid sized by its container. Every row has the same height
 * (`--dashboard-row-height`, 20rem by default), so cards beside each other line up and a card keeps its height from
 * loading to loaded; content taller than its card scrolls inside it.
 */
function DashboardGrid({
  stats,
  columns = 3,
  labels,
  headingLevel = 2,
  className,
  style,
  children,
  ...props
}: DashboardGridProps) {
  const context = useMemo(
    () => ({ columns, headingLevel, labels: { ...dashboardLabels, ...labels } }),
    [columns, headingLevel, labels],
  )
  return (
    <div
      data-slot="dashboard-grid"
      className={cn("@container/dashboard flex w-full min-w-0 flex-col gap-section", className)}
      style={
        {
          "--dashboard-row-height": "20rem",
          "--dashboard-columns": `repeat(${String(columns)}, minmax(0, 1fr))`,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      {stats}
      <div
        data-slot="dashboard-grid-cards"
        className="grid auto-rows-(--dashboard-row-height) grid-flow-row-dense grid-cols-1 gap-section @2xl/dashboard:grid-cols-2 @5xl/dashboard:grid-cols-(--dashboard-columns)"
      >
        <DashboardContext value={context}>{children}</DashboardContext>
      </div>
    </div>
  )
}

type DashboardStatsProps = ComponentProps<typeof StatGroup> & {
  /** Names the row of figures. */
  "aria-label": string
  /** Marks the row busy while its figures load; `DashboardStat loading` draws each placeholder. */
  loading?: boolean
}

function DashboardStats({ loading = false, className, ...props }: DashboardStatsProps) {
  return (
    <StatGroup
      data-slot="dashboard-stats"
      aria-busy={loading || undefined}
      className={cn("[&>li]:min-w-48", className)}
      {...props}
    />
  )
}

type DashboardStatProps = Omit<ComponentProps<typeof Stat>, "children"> &
  Pick<StatValueProps, "format" | "locale"> & {
    label: ReactNode
    value?: StatValueProps["value"]
    /** A change or a comparison under the value, like a `StatDelta` or "of 20". */
    hint?: ReactNode
    /** Draws a placeholder of the value's height instead of the value. */
    loading?: boolean
    children?: ReactNode
  }

/** A figure for `DashboardStats`: label, value (or a placeholder of its height while loading) and hint. */
function DashboardStat({
  label,
  value,
  hint,
  loading = false,
  format,
  locale,
  children,
  ...props
}: DashboardStatProps) {
  return (
    <Stat data-slot="dashboard-stat" {...props}>
      <StatLabel>{label}</StatLabel>
      {loading ? (
        <div className="text-display-sm leading-none">
          <Skeleton className="h-lh w-20" />
        </div>
      ) : (
        <StatValue value={value} format={format} locale={locale}>
          {children}
        </StatValue>
      )}
      {hint !== undefined && <StatHint>{hint}</StatHint>}
    </Stat>
  )
}

type DashboardCardContextValue = { titleId: string }

const DashboardCardContext = createContext<DashboardCardContextValue | null>(null)

type DashboardCardBase = Omit<ComponentProps<typeof Card>, "title" | "children"> & {
  title: ReactNode
  description?: ReactNode
  /** Buttons or a menu, at the end of the header. */
  actions?: ReactNode
  /** Columns on a wide container, capped at the grid's; over half the columns spans both of the two-column layout. */
  span?: 1 | 2 | 3 | 4
  /** Rows of `--dashboard-row-height`. */
  rowSpan?: 1 | 2 | 3
  labels?: Partial<DashboardLabels>
}

type DashboardCardProps<T> = DashboardCardBase &
  (
    | {
        status?: undefined
        data?: undefined
        error?: undefined
        onRetry?: undefined
        isEmpty?: undefined
        empty?: undefined
        fetching?: undefined
        keepPreviousData?: undefined
        children?: ReactNode
      }
    | {
        /** Loads through `DataState`: a skeleton while pending, the error with Retry, `empty` for no data. */
        status: DataStatus
        data: T | undefined
        error?: unknown
        onRetry?: () => unknown
        isEmpty?: (data: T) => boolean
        /** Shown when the data is empty; or `labels.emptyTitle`. */
        empty?: ReactNode
        /** Marks the content busy while it refetches with `status` success. */
        fetching?: boolean
        /** Shows the last data, marked busy, while `status` is pending again; `false` shows the skeleton. Default true. */
        keepPreviousData?: boolean
        children: (data: T) => ReactNode
      }
  )

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message
  return error === undefined || error === null ? "" : String(error)
}

function DashboardCardBody<T>(props: DashboardCardProps<T> & { labels: DashboardLabels }) {
  const { labels } = props
  if (props.status === undefined) return props.children
  const emptyNode =
    props.empty ??
    (labels.emptyTitle === undefined ? undefined : (
      <Empty size="inline" className="flex-1 justify-center">
        <EmptyHeader className="items-center self-center">
          <EmptyTitle>{labels.emptyTitle}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    ))
  const { onRetry } = props
  return (
    <DataState<T>
      status={props.status}
      data={props.data}
      error={props.error}
      fetching={props.fetching}
      keepPreviousData={props.keepPreviousData}
      isEmpty={emptyNode === undefined ? () => false : props.isEmpty}
      empty={emptyNode}
      size="inline"
      className="min-h-0 flex-1"
      labels={{ loading: labels.loading, refreshing: labels.refreshing }}
      loading={<LoadingState variant="skeleton" size="inline" rows={4} label={labels.loading} />}
      renderError={(error) =>
        onRetry ? (
          <ErrorState
            size="inline"
            title={labels.errorTitle ?? messageOf(error)}
            message={labels.errorTitle === undefined ? undefined : messageOf(error)}
            onRetry={onRetry}
            retryLabel={labels.retry}
          />
        ) : (
          <ErrorState
            size="inline"
            title={labels.errorTitle ?? messageOf(error)}
            message={labels.errorTitle === undefined ? undefined : messageOf(error)}
          />
        )
      }
    >
      {props.children}
    </DataState>
  )
}

/** A card on a `DashboardGrid`, named by its title; with `status` it loads, fails and empties in place. */
function DashboardCard<T>(props: DashboardCardProps<T>) {
  const {
    title,
    description,
    actions,
    span = 1,
    rowSpan = 1,
    labels: own,
    className,
    style,
    status: _status,
    data: _data,
    error: _error,
    onRetry: _onRetry,
    isEmpty: _isEmpty,
    empty: _empty,
    fetching: _fetching,
    keepPreviousData: _keepPreviousData,
    children: _children,
    ...rest
    // oxlint-disable-next-line shadcn/require-static-classes -- the caller's className, joined to static classes below
  } = props
  const grid = use(DashboardContext)
  const titleId = useId()
  const cardContext = useMemo(() => ({ titleId }), [titleId])
  const [content, setContent] = useState<HTMLDivElement | null>(null)
  // Content taller than its row scrolls; a keyboard can only scroll a box it can focus.
  const scrolls = useOverflowing(content)
  const labels = { ...grid.labels, ...own }
  const wide = Math.min(Math.max(span, 1), grid.columns)
  return (
    <Card
      data-slot="dashboard-card"
      data-status={props.status}
      className={cn(
        "col-span-1 row-span-(--dashboard-row-span) min-h-0 min-w-0 overflow-hidden @2xl/dashboard:col-span-(--dashboard-span-md) @5xl/dashboard:col-span-(--dashboard-span)",
        className,
      )}
      style={
        {
          ...style,
          "--dashboard-span": wide,
          "--dashboard-span-md": wide * 2 > grid.columns ? 2 : 1,
          "--dashboard-row-span": rowSpan,
        } as CSSProperties
      }
      {...rest}
    >
      <CardHeader>
        <CardTitle id={titleId} headingLevel={grid.headingLevel}>
          {title}
        </CardTitle>
        {description !== undefined && <CardDescription>{description}</CardDescription>}
        {actions !== undefined && <CardAction>{actions}</CardAction>}
      </CardHeader>
      <CardContent
        ref={setContent}
        data-slot="dashboard-card-content"
        tabIndex={scrolls ? 0 : undefined}
        role={scrolls ? "group" : undefined}
        aria-labelledby={scrolls ? titleId : undefined}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <DashboardCardContext value={cardContext}>
          <DashboardCardBody {...props} labels={labels} />
        </DashboardCardContext>
      </CardContent>
    </Card>
  )
}

type DashboardChartProps = Omit<ComponentProps<"figure">, "children" | "aria-label" | "aria-labelledby"> & {
  config: ChartConfig
  children: ReactNode
  /** Names the chart when the card's title doesn't. */
  "aria-label"?: string
}

/** A chart that fills its `DashboardCard`, named by the card's title. */
function DashboardChart({ "aria-label": label, className, ...props }: DashboardChartProps) {
  const card = use(DashboardCardContext)
  const name = label === undefined ? { "aria-labelledby": card?.titleId ?? "" } : { "aria-label": label }
  return <ChartContainer {...name} className={cn("aspect-auto h-full min-h-0 flex-1", className)} {...props} />
}

export { DashboardCard, DashboardChart, DashboardGrid, dashboardLabels, DashboardStat, DashboardStats }
export type {
  DashboardCardProps,
  DashboardChartProps,
  DashboardGridProps,
  DashboardLabels,
  DashboardStatProps,
  DashboardStatsProps,
}
