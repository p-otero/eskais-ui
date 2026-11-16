"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import type { CollapsibleOpenChangeReason } from "@ui-sdk/react/collapsible"
import { CollapsiblePanel } from "@ui-sdk/react/collapsible"
import { Children, createContext, use, useId, useState, type ComponentProps, type ReactNode } from "react"
import { CircleMinusIcon, CirclePlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty } from "@/components/ui/empty"
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

type HeadingLevel = 2 | 3 | 4 | 5 | 6

type BoardColumnLabels = {
  /** Accessible name of the collapse button; must contain the tooltip's words for voice control. */
  collapse: (title: string) => string
  expand: (title: string) => string
  collapseTooltip: string
  expandTooltip: string
}

const boardColumnLabels: BoardColumnLabels = {
  collapse: (title) => `Collapse ${title}`,
  expand: (title) => `Expand ${title}`,
  collapseTooltip: "Collapse column",
  expandTooltip: "Expand column",
}

const toneColor = {
  neutral: "[--column-tone:var(--input-strong)]",
  info: "[--column-tone:var(--info)]",
  success: "[--column-tone:var(--success)]",
  warning: "[--column-tone:var(--warning)]",
  destructive: "[--column-tone:var(--destructive)]",
  violet: "[--column-tone:var(--violet)]",
} satisfies Record<Tone, string>

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  const Icon = collapsed ? CirclePlusIcon : CircleMinusIcon
  return <Icon data-slot="board-column-collapse-icon" data-icon={collapsed ? "circle-plus" : "circle-minus"} />
}

const HeadingLevelContext = createContext<HeadingLevel>(3)

function Count({ value, className }: { value: ReactNode; className?: string }) {
  if (value === undefined || value === null || value === false) return null
  return (
    <Badge variant="secondary" data-slot="board-column-count" className={className}>
      {value}
    </Badge>
  )
}

type BoardColumnProps = Omit<ComponentProps<"li">, "title" | "children"> & {
  title: string
  count?: number | ReactNode
  actions?: ReactNode
  empty?: ReactNode
  headingLevel?: HeadingLevel
  /** Marks the column with a dot before the title, a top border and a faint wash in this tone. */
  tone?: Tone
  collapsible?: boolean
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean, details: ChangeDetails<CollapsibleOpenChangeReason>) => void
  labels?: Partial<BoardColumnLabels>
  children?: ReactNode
}

function BoardColumn({
  title,
  count,
  actions,
  empty,
  headingLevel = 3,
  tone,
  collapsed: collapsedProp,
  defaultCollapsed,
  onCollapsedChange,
  collapsible = collapsedProp !== undefined || onCollapsedChange !== undefined || defaultCollapsed !== undefined,
  labels,
  className,
  children,
  ...props
}: BoardColumnProps) {
  const titleId = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultCollapsed ?? false)
  const collapsed = collapsible && (collapsedProp ?? uncontrolled)
  const Heading = `h${headingLevel}` as const
  const groupHeadingLevel = Math.min(headingLevel + 1, 6) as HeadingLevel
  const { collapse, expand, collapseTooltip, expandTooltip } = { ...boardColumnLabels, ...labels }

  const header = (
    <div
      data-slot="board-column-header"
      className="group/board-column-header flex min-h-control-sm items-center gap-inline px-inset-item group-data-collapsed/board-column:flex-col group-data-collapsed/board-column:px-items"
    >
      {tone && (
        <span
          aria-hidden="true"
          data-slot="board-column-dot"
          className="size-2 shrink-0 rounded-full bg-(--column-tone)"
        />
      )}
      <Heading
        id={titleId}
        data-slot="board-column-title"
        className="min-w-0 flex-1 truncate text-sm font-semibold group-data-collapsed/board-column:text-vertical group-data-collapsed/board-column:overflow-visible"
      >
        {title}
      </Heading>
      <Count value={count} />
      {actions !== undefined && (
        <div
          data-slot="board-column-actions"
          className="flex items-center gap-inline group-data-collapsed/board-column:hidden"
        >
          {actions}
        </div>
      )}
      {collapsible && (
        <Tooltip>
          <TooltipTrigger
            render={
              <CollapsibleTrigger
                aria-label={collapsed ? expand(title) : collapse(title)}
                className="size-control-sm shrink-0 justify-center px-0 text-muted-foreground opacity-0 group-focus-within/board-column-header:opacity-100 group-hover/board-column-header:opacity-100 group-data-collapsed/board-column:order-first group-data-collapsed/board-column:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
              />
            }
          >
            <CollapseIcon collapsed={collapsed} />
          </TooltipTrigger>
          <TooltipContent>{collapsed ? expandTooltip : collapseTooltip}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )

  const body = (
    <ScrollArea className="flex min-h-0 flex-col">
      <ScrollAreaViewport aria-labelledby={titleId} className="h-auto max-h-(--board-column-max-height)">
        <ScrollAreaContent className="flex flex-col gap-items px-items pb-items content-auto">
          {Children.toArray(children).length === 0 && empty !== undefined ? (
            <Empty className="p-group">{empty}</Empty>
          ) : (
            children
          )}
        </ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar>
        <ScrollAreaThumb />
      </ScrollAreaScrollbar>
    </ScrollArea>
  )

  const surface = cn(
    "flex w-full flex-col gap-inline rounded-surface border bg-muted/(--glass-opacity) pt-inline backdrop-surface group-data-collapsed/board-column:pb-items",
    tone && "board-column-wash border-t-2 border-t-(--column-tone)",
  )

  return (
    <li
      data-slot="board-column"
      data-collapsed={collapsed ? "" : undefined}
      data-tone={tone}
      className={cn(
        tone && toneColor[tone],
        "group/board-column flex max-w-(--board-column-max-width) min-w-(--board-column-min-width) flex-1 data-collapsed:max-w-none data-collapsed:min-w-0 data-collapsed:flex-none",
        className,
      )}
      {...props}
    >
      <HeadingLevelContext value={groupHeadingLevel}>
        {collapsible ? (
          <Collapsible
            render={<section aria-labelledby={titleId} />}
            className={surface}
            open={!collapsed}
            onOpenChange={(open, details) => {
              onCollapsedChange?.(!open, details)
              if (!details.canceled) setUncontrolled(!open)
            }}
          >
            {header}
            <CollapsiblePanel>{body}</CollapsiblePanel>
          </Collapsible>
        ) : (
          <section aria-labelledby={titleId} className={surface}>
            {header}
            {body}
          </section>
        )}
      </HeadingLevelContext>
    </li>
  )
}

type BoardColumnGroupProps = Omit<ComponentProps<"section">, "title"> & {
  title: string
  count?: number | ReactNode
}

function BoardColumnGroup({ title, count, className, children, ...props }: BoardColumnGroupProps) {
  const titleId = useId()
  const Heading = `h${use(HeadingLevelContext)}` as const
  return (
    <section
      aria-labelledby={titleId}
      data-slot="board-column-group"
      className={cn("flex flex-col gap-items", className)}
      {...props}
    >
      <div data-slot="board-column-group-header" className="flex items-center gap-inline px-inline pt-inline">
        <Heading id={titleId} className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
          {title}
        </Heading>
        <Count value={count} />
      </div>
      {children}
    </section>
  )
}

export { BoardColumn, BoardColumnGroup, boardColumnLabels }
export type { BoardColumnGroupProps, BoardColumnLabels, BoardColumnProps }
